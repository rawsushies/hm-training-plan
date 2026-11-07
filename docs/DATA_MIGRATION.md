# Data migration

## Sources

| Source | How it reaches v3 |
|---|---|
| A. `localStorage["hmtp:v1"]` (v2 on the same origin) | On first start, copied once into `hmtp:anon:v3` (the `owner` field is dropped). The legacy key is never modified or deleted. Other `hmtp:v1:*` slots are listed in *Data & backup → Data dari versi lama* and can be merged manually. |
| B. v2 cloud data in the Claude runtime | A standalone app can't read anyone's private Claude data. If this build is opened inside claude.ai, *Data & backup → Ambil data dari akun Claude* reads it once (read-only) and merges it into the local state; then export JSON. Otherwise use the old app's **Export JSON**. |
| C. JSON backup files (v2 or v3) | *Data & backup → Import backup → Gabungkan* (or *Ganti semua*). Also offered inside the first-sign-in dialog. |

Note: claude.ai and the hosted app are different origins, so their localStorage isn't shared. For most
users the real path is **old app → Export JSON → new app → Import (Gabungkan)**.

## First Google sign-in on a device

1. If this account already has a local cache on this device, normal sync starts. No questions.
2. Otherwise the app reads all the account's cloud records (needs internet; offline shows *"Butuh
   internet buat masuk pertama kali di perangkat ini"* and nothing is changed).
3. Decision:
   | Device (anonymous) data | Cloud data | Action |
   |---|---|---|
   | none | none | new account; settings chosen before sign-in carry over (sample data dropped) |
   | none | yes | cloud data used |
   | yes | none / yes | **dialog**: counts per type for both sides and the merge preview (added, duplicates, unlinked, differing check-ins) |
4. Dialog options (nothing is changed before the user picks):
   - **Gabungkan / Upload** (recommended): verified backup written to `hmtp:backup:{ts}` first
     (if storage is full, the backup is offered as a download instead), then merge.
   - **Pakai data akun / Mulai kosong**: device data isn't uploaded and stays in the anonymous slot.
   - **Import file backup JSON**: replaces the device data *in the preview* with the file's content,
     then the same choices.
   - **Download backup**, or **Batal & keluar** (signs out, nothing changed).
5. After the merge is pushed, the app re-reads the server and compares runs, strength, check-ins and
   shoes with the local counts. Only when they match is the migration marked **verified** (local meta
   and `users/{uid}.migration`) and the anonymous slot cleared. The backup stays until the user
   deletes it. Clearing the anonymous slot also stops a second person on the same device from being
   offered the first person's data.

## Merge rules (`HMTP.mergeStates(primary, incoming)`)

Primary = cloud when the cloud has data, otherwise the device. The function is idempotent.

| Data | Rule |
|---|---|
| Runs | same id → one copy (differing content → conflict kept); same `extId` or same date + distance ±0.15 km + duration ±60 s → duplicate; a new run whose planned session already has a run is kept but **unlinked** from that session (reported) |
| Strength | same id → one; same date + kind + session → one, completed exercises **unioned** |
| Check-ins | one per date: identical → one; different → primary kept, other version stored as a **conflict** (restorable), never silently dropped |
| Settings | primary's settings (the dialog says which) |
| Shoes | by id (keeps `log.shoeId` valid) |
| Monthly reviews | per field: differing notes are **combined** ("— dari perangkat lain: …") |
| Overrides / skips / locked-in / elevation targets | union, primary wins on the same session |
| Race checklist, tutorial progress | union |
| Sample data | never migrated |

## Safety properties (tested)

- Running the same migration or import twice adds nothing (`test/unit/logic.test.js`, e2e test 1, regression "data").
- A backup is created and round-trip verified (`HMTP.verifyBackup`) before merge, import and reset.
- Record counts are verified against the server after migration.
- Legacy keys are never written.
- Hostile backups are sanitised (e2e "hostile backup").

## Restore

*Data & backup → Backup otomatis → Gabungkan* (safe) or *Download*. Conflicts: *Data & backup →
perubahan bentrok → Pakai versi yang disimpan ini*.

## v3 → v4

- No migration step is needed. `sanitizeState` fills the new v4 fields with defaults locally, and new records are written only
  once the user sets something (schedule, profile, race prefs, event, per-friend sharing, shoe extras). A v3 account
  therefore produces byte-identical records after the upgrade (tested in `logic.test.js` and `migration-v4.test.js`).
- Every v4 field survives the records → state → records cycle (tested), and merging a v4 device into a v3 account keeps both sides.
- Group documents from v3 are left in place and never deleted automatically. The UI no longer reads them.
