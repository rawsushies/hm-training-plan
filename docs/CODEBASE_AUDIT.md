# Codebase Audit — Half Marathon Training Plan (Milestone 0)

> This is the Milestone 0 audit as delivered before implementation (sections 1–9, unchanged in
> substance), followed by an **addendum** recording what happened to each finding in milestones 1–6.

Audited file: `hm-training-plan.html` (1,966 lines), kept unchanged in this repo as
`legacy/hm-training-plan.claude.html`. Audit date: 7 Nov 2026.

## 1. Architecture (v2)

Single self-contained HTML file, no build step, no framework, no external JS dependencies (Google
Fonts only). Vanilla JS, string-template rendering.

| Layer | Implementation |
|---|---|
| Entry | inline `<script>`: `hydrate(Storage.load())` → tour/run resume → `render(false)` → badge init → `initCloud()` |
| State | one mutable global `S`; modal state `M` (not persisted); timer `RUN` (mirrored to `S.ui.run`) |
| Rendering | `render(keep)` rebuilds `PLANW = buildPlan()` and replaces `#app.innerHTML`; 16 view functions |
| Events | 3 delegated listeners: `click` → `ACT[data-act]` (~80 actions), `input`/`change` → `LIVE[data-live]`, `data-filter` |
| Local storage | `Storage` adapter, one key `hmtp:v1`, whole `S` as JSON |
| Cloud | `window.claude.use("user"|"db"|"downloads")` (claude.ai artifact runtime only) |
| Cloud data | `data/users/{uid}/state` = `{v:2, state:<JSON string>, updatedAt}`; `board/{uid}` summary |
| Persistence | `persist()` → `checkBadges()` → diff `dataJson()` → bump `updatedAt`, `queueCloud()` (1.5 s) → localStorage |

## 2. Feature inventory (all preserved in v3)

Plan engine (`PLAN`, `weekKind`, `buildPlan`, `LOCKED_DEFAULT`, `STR_DAYS`, overrides) · Home
(`vHome`, week strip, today card, night tips, streak, missed notice) · Calendar (month/week, day detail,
skip/edit/reschedule with Wednesday block) · Log (filters/sort, form, delete) · Import (GPX, TCX,
Strava CSV) · Timer (steps, pause/next/finish/cancel, beeps, wake lock) · Locked-in · Elevation ·
Strength A/B · Check-in + readiness heuristic + persistent-pain warning · Monthly review + charts ·
Goals, 19 badges, race checklist · Race plan · Shoes · Pace calculator (Riegel 1.06) ·
Account/friends board · Tutorial (10 steps, Kiki) · Guide (15 sections), glossary (29 terms) ·
JSON/CSV export, JSON import, sample data, reset.

## 3. Data schema (`S`, v2)

`v`, `updatedAt` (client clock), `owner` (hotfix), `settings` `{weekday, unit, peakLow, peakHigh,
goalTime, lockedRpe, benchKm, theme, startDate, raceDate, shareBoard, wdTime, wkTime, defaultShoe}`,
`overrides{sid:{title,dist,desc,date}}`, `status{sid:"skip"}`, `locked{sid:{…}}`, `elev{sid:{target}}`,
`logs[]{id,date,type,sessionId,distance,duration,elev,hrAvg,hrMax,rpe,weather,notes,src?,sample?,shoeId?}`,
`strength[]{id,date,kind,sets,done[],sessionId,sample?}`, `checkins[]{date,sleep,soreness,fatigue,energy,motivation,pain}`
(one per date), `shoes[]{id,name,limit,retired}`, `reviews{block:{best,hard,rec,fix}}`,
`goals{main,items[]}`, `raceCheck{i:bool}`, `badges[]`, `ui{…}` (device-local).
Session ids are deterministic: `w{n}-wd|sat|sun`, strength `w{n}-sA|sB`.

## 4. Risks found

| # | Sev | Issue |
|---|---|---|
| R1 | 🔴 | Cross-account upload: one local key for everyone |
| R2 | 🔴 | Stored XSS via shared board numbers printed raw |
| R3 | 🟠 | Attribute injection via imported JSON (ids, dates, types) |
| R4 | 🟠 | Whole-document last-write-wins with client clocks |
| R5 | 🟠 | Anonymous → account overwrite without merge |
| R6 | 🟡 | Start-date change moves sessions; logs stay linked by session id |
| R7 | 🟡 | Weekday change silently clears date overrides |
| R8 | 🟡 | Import duplicate detection only date + distance |
| R9 | 🟡 | `saveLog` silently unlinks when session already logged |
| R10 | 🟡 | `invalid_argument` mislabelled as read-only |
| R11 | ⚪ | Tutorial completion per device, not per account |
| R12 | ⚪ | Board listener never unsubscribed |
| R13 | ⚪ | 240k-char cloud payload limit |
| R14 | ⚪ | Readiness is a heuristic |

## 5. Hard constraint: where Firebase can run

claude.ai's CSP blocks Google hosts, so the Firebase build must be hosted separately (Firebase Hosting
recommended). The claude.ai copy keeps its own login; data moves by JSON export → import. Emulator
tests need Java + Google downloads. Invites without Cloud Functions are possible with rule-enforced
random tokens.

## 6–9. Hotfix, migration proposal, untouchables, decisions

See the original audit log (hotfix R1–R3 in the claude.ai copy; proposed CloudAdapter, record-level
sync, `hmtp:user:{uid}` slots, merge dialog, groups, tutorial v3, notification prefs; untouched:
`PLAN`, `weekKind`, Wednesday rule, session ids, `LOCKED_DEFAULT`, `EX`, Riegel, review logic,
readiness wording, badges, Indonesian copy).

---

## Addendum: outcome after milestones 1–6

**Note on the source file:** the file provided for implementation is the **pre-hotfix** v2 (no
`owner`, no validation in `hydrate`). The hotfix protections were therefore re-implemented in v3
(below), not copied.

| # | Status in v3 | How |
|---|---|---|
| R1 | ✅ Fixed by design | per-account slots `hmtp:user:{uid}:v3`; `setActive()` swaps state atomically; anonymous data only uploads after an explicit choice and is cleared after verified migration (e2e: "account isolation", "never silently pushed") |
| R2 | ✅ Fixed | shared progress is whitelisted + type-checked **in Firestore rules**; client renders through `esc()`/`Number()`/`fmtKm` |
| R3 | ✅ Fixed | `HMTP.sanitizeState` validates every source (local, cloud, backup) (unit + e2e "hostile backup") |
| R4 | ✅ Fixed | record-level docs, server-enforced `rev+1` optimistic concurrency, server timestamps, conflict archive (unit + e2e) |
| R5 | ✅ Fixed | first-sign-in dialog with counts, merge / use cloud / import, verified backup |
| R6 | ⚠️ Documented | behaviour unchanged (would alter training data semantics); warning added in Settings and tour |
| R7 | ⚠️ Documented | behaviour unchanged; explained in Settings help |
| R8 | ✅ Fixed | `extId` (Strava Activity ID / start timestamp) + in-file duplicate check (e2e "activity import") |
| R9 | ✅ Fixed | toast tells the user the run was saved but not linked |
| R10 | ✅ Gone | Claude writes removed; Firebase errors mapped to Indonesian messages |
| R11 | ✅ Fixed | `S.tutorial` synced per account |
| R12 | ✅ Fixed | all listeners unsubscribed on account switch (`stopSync`, `GROUPS.reset`) |
| R13 | ✅ Gone | per-record documents |
| R14 | ✅ Kept | heuristic wording kept; help/tour say "bukan diagnosa" |

Also fixed: 6 px horizontal overflow on Settings at 320 px width (already in v2), and the clipped
"race" label on the Home 31-week chart.
