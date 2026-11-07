# Architecture (v3)

## 1. Overview

A mobile-first, framework-free web app. No build step. Firebase is optional and loaded on demand.

```
public/
  index.html             the app: UI, plan engine, all training modules (evolved from the v2 single file)
  firebase-config.js     public Firebase web config (null = local-only mode)
  js/logic.js            pure logic: validation, record model, merge, migration, reminder planner
  js/sync.js             record-level sync engine (no Firebase imports, testable with a fake cloud)
  js/cloud-firebase.js   ES module: Firebase Auth (Google) + Firestore adapter + groups
  js/tutorial.js         tutorial v3 content (quick start, feature tours, contextual help)
  js/notify.js           notification adapter interface (NullNotifier on the web)
  vendor/firebase/…      pinned Firebase 12.19.0 CDN builds, same-origin (scripts/vendor-firebase.mjs)
  sw.js, manifest        offline start (PWA)
legacy/hm-training-plan.claude.html   the original v2 file, unchanged (keeps running on claude.ai)
firestore.rules, firebase.json, firestore.indexes.json
```

What stayed exactly as in v2: the `PLAN` table, `weekKind`, `buildPlan`, session id format,
`LOCKED_DEFAULT`, `EX`, readiness heuristic, review logic, badges, Riegel factor, and all the
training views. A regression test runs the original file and the new one side by side on the same
data and requires identical output (`test/e2e/regression.test.js`).

## 2. Identity

- **Firebase Authentication, Google provider.** The permanent account key is the Firebase **UID**,
  never the email.
- Popup sign-in, with automatic fallback to redirect when popups are blocked; `getRedirectResult` runs
  at startup.
- Session persistence: Firebase's own `browserLocalPersistence` (IndexedDB). The app never stores
  Google access tokens or passwords.
- Android-ready: `signInWithGoogleIdToken(idToken)` accepts a native Google ID token
  (`GoogleAuthProvider.credential`).
- The Claude runtime is no longer an auth path. It is only used as an optional, read-only, one-time
  **legacy source** (*Data & backup → Ambil data dari akun Claude*) when the page runs on claude.ai.

Account states shown in the UI (Indonesian messages, raw Firebase errors are mapped by `errText`):
`off` (no config), `loading`, `signedout`, `signingin`, `migrate` (choice needed), `firstwait`
(first sign-in on this device needs internet), `syncing`, `synced`, `offline`, `error`, `autherror`.

## 3. Local storage (account-scoped)

| Key | Content |
|---|---|
| `hmtp:device:v3` | `{deviceId, legacyMigrated, lastUid}` |
| `hmtp:anon:v3` | state used when nobody is signed in |
| `hmtp:user:{uid}:v3` | that account's state cache (works offline) |
| `hmtp:sync:{uid}:v3` | sync metadata: per-record base revisions, conflicts, migration status |
| `hmtp:backup:{ts}` | automatic backups (before merge/import/reset/migration) |
| `hmtp:anon:conflicts:v3` | conflicts from merges while signed out |
| `hmtp:v1`, `hmtp:v1:*` | legacy v2 data, read once and never modified |

`ACTIVE_UID` decides which slot `persist()` writes. `setActive()` swaps the whole in-memory state
(nothing of the previous account remains) and stops the previous account's sync and group listeners.

- **Startup:** if `lastUid` has a cache, that slot is shown immediately (offline start). When Auth
  reports no session, the app switches to the anonymous slot.
- **Sign-out:** pending writes are flushed (8 s max). Any that remain stay in the account's slot and
  are sent at the next sign-in. The UI switches to the anonymous slot at once. Optionally the account's
  local copy is deleted, which is only allowed when nothing is pending. Cloud data is never deleted.
- **Account switching:** sign-out, then Google's account chooser (`prompt=select_account`).

All loaded data (local, cloud, backup files) passes through `HMTP.sanitizeState`. Ids, session ids,
dates, enums and numbers are validated, which keeps the audit hotfix R3 protection against
attribute/markup injection.

## 4. Firestore data model

```
users/{uid}                         {profile:{displayName, photoURL}, schemaVersion:3, migration:{…}, updatedAt}
users/{uid}/runs/{logId}            ┐
users/{uid}/strength/{entryId}      │ envelope: {data, rev, deleted, updatedAt: serverTimestamp, device}
users/{uid}/checkins/{YYYY-MM-DD}   │
users/{uid}/shoes/{shoeId}          │
users/{uid}/reviews/{block 0–7}     │
users/{uid}/plan/{id}               ┘ id = settings | goals | raceCheck | tutorial | ovr_{sid} | status_{sid} | locked_{sid} | elev_{sid}
users/{uid}/conflicts/{auto}        archived losing versions
users/{uid}/memberships/{gid}       private index of my groups
groups/{gid}                        {name, ownerUid, createdAt}
groups/{gid}/members/{uid}          {uid, displayName, photoURL, joinedAt, inviteId?, token?}
groups/{gid}/invites/{iid}          {token, expiresAt, usedBy, usedAt, createdAt}   owner-only
groups/{gid}/progress/{uid}         whitelisted summary (opt-in)
```

Why this split: runs, strength, check-ins and shoes are append-mostly lists with stable ids, so each
becomes its own document and two devices adding runs never touch the same document. Small
configuration maps (`overrides`, `status`, `locked`, `elev`) are split per session id for the same
reason. Relationships are kept by id: `log.sessionId` → plan session (`w{n}-wd|sat|sun`),
`log.shoeId` → shoe, review id = block index, check-in id = date. Imported activities carry `extId`
(Strava Activity ID or start timestamp) for duplicate detection (audit R8).

Device-local only (not synced): `ui` (current tab, filters, timer state, tour step), `badges`
(derived; only used to toast newly earned badges).

## 5. Sync engine (`js/sync.js`)

- `stateToRecords(S)` flattens the state into `{path: value}`. The engine keeps `base[path] = {rev, hash}`,
  the last version agreed with the server. **Dirty** means the local hash differs from base.
- **Push:** dirty records are written as one batch with `rev = base.rev + 1`. The **security rules
  only accept `rev == stored rev + 1`** (or `1` for a new doc), so a stale write is rejected
  server-side. If a batch is rejected, each record is retried in its own transaction to find exactly
  which ones conflict. Nothing is written twice: after success the base matches, so no record is dirty.
- **Pull:** `onSnapshot` on each collection. A server change is applied only to records that are not
  dirty locally. Echoes of our own writes (`rev <= base.rev`) are ignored.
- **Conflict policy** (`HMTP.resolveConflict`):
  | Situation | Result |
  |---|---|
  | both sides equal | adopt, no conflict |
  | `settings`, `goals`, `tutorial`, `raceCheck` | 3-way field merge; same field changed on both → server value, local kept as conflict |
  | both edited the same run / check-in / … | first committed wins; local version archived (`conflicts/` + local list), restorable |
  | we deleted, they edited | edit kept; deletion reported |
  | they deleted, we edited | our edit re-created (an edit is never lost to a delete) |
- **Offline / errors:** with no network, or on `unavailable`, the engine stays dirty and retries with
  backoff (2 s … 60 s) and on the browser `online` event. The status shows the pending count.
- Firestore runs with the default **memory cache**. Offline durability comes from the per-account
  localStorage slot, which keeps accounts strictly separate (no shared IndexedDB cache between users).

## 6. First sign-in & migration

See `docs/DATA_MIGRATION.md`. In short: cloud data and anonymous device data are compared. Without a
real choice to make, nothing is asked. Otherwise the user picks *merge* / *use cloud* / *import JSON*,
after seeing record counts and duplicates. A verified backup is written before merging. After the first
sync, server counts are compared with local counts before the anonymous source is cleared.

## 7. Groups & privacy (no Cloud Functions)

- Create: one batch writes the group, the owner's member doc and the owner's membership index (rules
  require the founder's member doc in the same batch).
- Invite: the owner creates `invites/{iid}` with a 192-bit random token (`crypto.getRandomValues`),
  valid 7 days (rules cap at 8). Link: `…/#join={gid}.{iid}.{token}`.
- Join: one batch creates `members/{me}` (with `inviteId`, `token`) **and** sets `invites/{iid}.usedBy = me`.
  The rules check token equality, expiry, `usedBy == null` before, and use `getAfter` to require both
  writes together. That makes every link **single-use**, enforced server-side without a backend.
  Reuse, expired, wrong-token and revoked invites are all rejected (tested).
- Read access to a group, its members and progress requires being a member. Removal by the owner
  revokes access immediately; the removed client detects `permission-denied` and cleans up.
- Progress: `groups/{gid}/progress/{uid}`, writable only by that member, with an exact whitelist of
  numeric fields (`totalKm, weekKm, runs, longest, bestPace, fullWeeks, lastRun, week`) plus
  name/photo. Private by default (`settings.shareBoard = false`). Turning sharing off deletes the
  summary in every group. Logs, notes, check-ins, pain and reviews are never readable by anyone else.
- If the stricter "server-verified invite" flow is wanted later, it moves to a callable Cloud Function
  (Blaze plan); the client interface (`createInvite/joinGroup`) can stay the same.

## 8. Notifications

`js/notify.js` defines the adapter contract. The web build uses `NullNotifier` (unsupported). Preferences
live in `settings.notif` (per account, synced). `HMTP.buildReminders()` turns the real schedule plus
preferences into a deterministic reminder list. The Notifikasi page shows it as a preview only. See
`docs/NOTIFICATION_ROADMAP.md`.

## 9. Known limitations

- The Firebase build can't run inside claude.ai (that page's CSP blocks Google hosts). The legacy file
  stays there; data moves via JSON export → import (or the one-time read in *Data & backup*).
- Changing the training start date moves session dates, and logs stay linked by session id (audit R6).
  This is now explained in Settings.
- Group size is not capped by the rules. Intended for small groups of friends.
- Full listeners read all of an account's documents at startup (fine for one season of data).
