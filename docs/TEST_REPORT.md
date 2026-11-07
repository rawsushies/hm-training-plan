# Test report

Run on 7 Nov 2026 in the development container: Node 22.23, Chromium (Playwright 1.63),
firebase-tools 15.35 with the **real** Auth and Firestore emulators, OpenJDK 21. Firebase SDK
12.19.0 (vendored). All results below come from actual runs; none are simulated.

| Suite | Command | Result |
|---|---|---|
| Unit | `npm test` | **19 / 19 pass** |
| Security rules | `npm run test:rules` | **15 / 15 pass** |
| End-to-end + regression | `npm run test:e2e` | **18 / 18 pass** |

## Unit (`test/unit/`, no network)

Validation of hostile state (R3) · lossless record round-trip · dirty detection · 3-way settings merge ·
conflict policies · state merge dedupe (id / extId / date+distance+duration / session), unlinking,
check-in conflicts, review note combining, **idempotency** · backup verification · legacy `hmtp:v1`
one-time move (legacy key untouched) · tutorial version policy · reminder planner (off by default, lead
time, quiet hours, real-data weekly recap).
Sync engine with a fake cloud that enforces the same `rev+1` rule: initial upload with no duplicate
writes · two devices adding runs · offline edits queued then delivered · failed writes retried ·
concurrent edit → first wins, loser archived + restorable · settings field-level merge · tombstone
propagation and edit-beats-delete · account isolation.

## Security rules (`test/rules/`, Firestore emulator)

Unauthenticated denied · own records rev+1 allowed · stale/skip/new-doc-rev≠1 rejected · user A can't
read/list/write B's records, settings or profile · payload validation (extra fields, bad enums, id
mismatch, wrong types, out-of-range check-in, unknown collection, client-supplied timestamp) ·
tombstones only, hard delete denied · profile whitelist + https photo · group creation requires
founder membership, impersonation denied · non-members can't read group/members/progress · join with
valid invite, **reuse rejected** · wrong token / expired / not consuming / no invite rejected · invites
owner-only · progress: own doc only, whitelist enforced, sensitive extra field rejected, non-member
rejected · **group owner still can't read a member's private runs** · removal revokes access · owner
can't orphan the group · leave and delete group.

## End-to-end (`test/e2e/app.test.js`, Chromium + emulators)

1. Legacy `hmtp:v1` → anonymous slot → first Google sign-in shows the merge dialog → merge → records in
   Firestore, settings carried, backup created, anonymous slot cleared **after** verification; merging the
   backup again adds 0.
2. Account isolation on one device: A logs a run, signs out (UI clears), B signs in → 0 runs locally
   and in B's Firestore, no prompt; A signs back in → A's data back.
3. Shared device with unrelated anonymous data: "Pakai data akun" keeps it local and out of the account.
4. Two devices live sync; device B offline → status "Offline", pending count → reconnect → delivered,
   no duplicate documents.
5. Concurrent edit of one run on two devices → one wins, loser in `users/{uid}/conflicts` and in
   *Data & backup* → "Pakai versi ini" propagates to the other device.
6. Groups: create, invite link, second user joins via link, private by default, opt-in shows only
   whitelisted fields (checked in Firestore), third user reusing the link is rejected, opt-out deletes
   the summary, owner removes member → member loses access. No console errors.
7. Tutorial: new user auto quick start; completion synced to `plan/tutorial`; `?` help → calendar tour
   with real highlight on session actions; second device for the same account doesn't re-show it.
8. Layout at 320×640, 390×844, 844×390, 1280×800: no horizontal overflow on 10 pages; tour bubble never
   covers its target (dashboard tour).
9. Local-only mode (no config): fully usable, labelled "Mode lokal", notifications page says nothing is
   sent, `Notification.requestPermission` never called, data survives reload.

## Regression (`test/e2e/regression.test.js`)

10. **Side-by-side with the original v2 file** on identical data and a fixed clock: the 31-week plan
    (dates, distances, types, titles, times, strength days), session states, monthly reviews
    (improved/stable/needs/decision/focus), badge stats, goal values, readiness, persistent pain, pace
    calculator, Riegel predictions, race plan tables and CSV export are **byte-identical**.
11. Timer: start, pause (paused time excluded: 35 s recorded), resume, next step, finish → log form
    prefilled with session and time; cancel.
12. Calendar: skip/unskip, edit session (weekly target unchanged), Wednesday reschedule refused, valid
    reschedule, reset to plan.
13. Strength, check-in (pain 4 → "Mending istirahat"), goal edit, shoes + default, locked-in target +
    "use this pace for later sessions", elevation target, review notes, settings (weekday change moves
    sessions).
14. GPX import: distance, duration, elevation gain, plan matching, `extId`; the same file again is
    flagged "Udah ada" and unselected.
15. Data: JSON/CSV export, merge-import twice (0 added the second time), replace-import of a v2 backup
    with automatic backup, sample data load/clear, reset.
16. Hostile backup (markup in id/type/date) neutralised: no injected element, no script execution.
17. Performance with 700 logged runs, render time per page: home 4 ms, calendar 5, log 13, review 36,
    goals 7, locked 4, elevation 5, data 3 (headless desktop CPU).
18. Offline startup via the service worker: reload with the network off still opens the app with its data.

## Not verified here (needs the developer)

- **A real Firebase project and real Google accounts.** Everything ran against the emulators with
  emulator Google identities. The production popup/redirect flow, authorised domains and deployed
  rules must be checked once after following `docs/FIREBASE_SETUP.md`.
- Real Android devices / low-memory phones, iOS Safari, and slow real-world networks. Narrow, tall,
  landscape and desktop viewports and offline mode were emulated in Chromium only.
- Native notifications: none are implemented (by design in this phase).

## Re-running

```bash
npm install
```

```bash
npm run test:all
```

Emulators need Java 11+. The first run downloads the Firestore emulator JAR from Google.
