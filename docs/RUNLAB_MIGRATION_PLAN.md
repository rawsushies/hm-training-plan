# RUNLAB migration plan

## 1. Schema map (current, verified in code)

**Local storage** (`logic.js` `KEYS`, `index.html`):
- `hmtp:anon:v3` (signed-out state) and `hmtp:user:{uid}:v3` (per-account state cache).
- `hmtp:sync:{uid}:v3` (base revisions, pending, conflicts).
- `hmtp:device:v3`.
- `hmtp:backup:{ts}` (automatic backups).
- `hmtp:anon:conflicts:v3`.
- `hmtp:v1*` (legacy, read-only).
- Feature keys:
  - `hmtp:gate:v4`, `hmtp:update:v1`, `hmtp:nativeSignIn`
  - `hmtp:friendnames:{uid}`, `hmtp:myinvites:{uid}`
  - `hmtp:weather:loc`, `hmtp:weather:cache:v1`
  - `hmtp:notif:tz`
  - `hmtp:shoes:remote:v2`

**Firestore** `users/{uid}/{coll}/{id}` with envelope `{data, rev, deleted, updatedAt, device}`.
- Sync collections: `runs`, `strength`, `checkins`, `shoes`, `reviews`, `plan`.
- `plan` records:
  - single: `settings`, `goals`, `raceCheck`, `tutorial`, `schedule`, `profile`, `race`, `planmap`
  - maps: `ovr_*`, `status_*`, `locked_*`, `elev_*`, `event_*`, `share_*`
- Private non-sync collections: `conflicts`, `memberships` (legacy), `blocks`; plus `inbox` (server-written).
- Top-level: `profiles` (opt-in directory), `invites`, `requests`, `friendships`, `shares`, `goals/{id}/contrib`, legacy
  `groups/**`, and `serverOnly/**` (client-denied).

**Account isolation:** `ACTIVE_UID` selects the local slot, sync only runs for the signed-in UID, and the rules enforce `isUser(uid)`.
**Deletion paths:** per-record delete (tombstone `deleted: true`, rev+1); Reset (backup first); per-friend share removal; profile
removal (toggle).

## 2. Changes for RUNLAB (all additive)

| Step | Change | Backward compatibility |
|---|---|---|
| M1-a | New sync collection **`lab`** in `logic.js` (`COLLS`, `stateToRecords`, `recordsToState`, `sanitizeState`, `mergeStates`), `cloud-firebase.js` `PATH_RE`, `firestore.rules` `syncColl()` | Older app versions ignore unknown collections in `recordsToState`. Their path regex rejects writing `lab/*`, so they never touch it. A v3/v4 user without Lab data produces byte-identical records (unit-tested). |
| M1-b | `S.lab = {}` default; `cleanInvestigation` sanitizer | Missing field → `{}`; invalid entries are dropped on load, never thrown. |
| M1-c | Dock: `lab` replaces `race`; Race moves to Kamu and the Hari ini card | Deep links unchanged (`nav race` still renders the race view). |
| M2 | Quick body check stored as `checkins.quick` (new optional field) instead of six invented values; existing records unchanged | Old records keep their values; new taps stop inventing. |
| M2+ | `lab/{id}.snapshots` (bounded) | Additive. |
| M3 | Research cache: device-side (`hmtp:lab:research:v1`) first; shared server cache only with a server | Additive. |

No destructive transformation is planned. No existing field is renamed or removed.

## 3. Backup and rollback

- **Before the first Lab write** on a device, the app takes one automatic backup (`hmtp:backup:{ts}` with reason
  `"runlab-1"`). This uses the existing backup mechanism and is visible under Data & backup.
- **Rollback of the app:** the live-update channel can ship the previous release. Older clients ignore `lab/*` records, so
  rollback leaves Lab data intact in the cloud and invisible.
- **Rollback of rules:** the previous rules simply deny `lab`. Data is kept, and nothing is deleted by a rules rollback.
- **Per-investigation delete** writes a tombstone (same as runs). Export first is offered in the UI.

## 4. Phases and acceptance tests

| Phase | Acceptance |
|---|---|
| M1 | Existing unit/rules/e2e suites pass. New: lab unit tests; rules test for `lab` (owner-only, other accounts and friends denied); e2e create → follow-ups (answer, skip, unknown, correct) → scope → save → reopen → edit → export → delete; Workout Compiler disabled; no UI claims AI or research output; ✓ Selesai, import and Race (via Kamu) still work; v3/v4 data unchanged after upgrade. |
| M2 | Analyses reproducible (same input → same output), each reports units, window, count, source, method version and exclusions; sample data excluded; score labels re-worded; quick check-in no longer invents values. |
| M3 | Every citation resolves to a verified ID; dedupe by DOI/PMID; cache freshness and backoff tested with mocked APIs; offline shows unavailable. |
| M4 | Credential-gated; consent; schema validation; adversarial tests (fake citations, medical claims, injected instructions in abstracts, cross-UID access). |
| M5 | Experiment protocol validation (one variable, safe), adherence, "inconclusive" outcome tested. |

## 5. Deployment

Nothing is deployed by this plan. Hosting, Firestore rules (the `lab` collection needs the updated rules before the Lab can sync in
production), APK and releases each need explicit owner authorization. Until the rules are deployed, Lab records stay on the device:
the batch write falls back to per-record transactions on `permission-denied` (`cloud-firebase.js push`), so every other record
still syncs. The denied Lab records stay pending, and the sync badge shows an error. **Release order: deploy rules first, then
hosting.**
