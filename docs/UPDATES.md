# Updating the app (in-app updates)

Installed copies of the app (website/PWA and the Android APK) update themselves. You only deploy.

## Ship a change (texts, training content, UI/UX tweaks)

```bash
npm run release -- 3.2.0 "Catatan perubahan 1" "Catatan perubahan 2"
```

```bash
npm test
```

```bash
npm run deploy
```

`release` stamps the version into `public/js/version.js` and `public/sw.js` and writes
`public/version.json` (version, notes, SHA-256 of every file). `deploy` first verifies that no file
changed after `release` (`npm run check:release`), then deploys hosting + rules.
Run `release` **last**, after all edits; otherwise `check:release` stops the deploy.

## What users see

- The app checks `version.json` at start, when it comes back to the foreground (after 30 min), every
  hour, and when the network returns.
- **Website:** the service worker downloads the new release in the background → green banner
  *"Versi baru X siap"* → *Perbarui sekarang* reloads into the new version. With *Update otomatis*
  (default on, *Menu → Tentang & update*) it is applied automatically when the app is in the
  background or on the next start.
- **APK:** the files are downloaded and hash-checked, then applied the same way. If the new version
  fails to start, the app keeps the previous one and never retries that build.
- Never applied during a running timer or while a form/dialog is open. Training data is never touched
  by an update (it lives in local storage + Firestore, not in the app files).
- After updating: toast *"App diperbarui ke versi X"*; notes are in *Menu → Tentang & update*.

## Changing the data format

Older copies that haven't updated yet could write records without new fields. If a release changes
the shape of stored data, release it with `--min-app=<this version>`: copies older than that pause
sync (data stays on the device) and ask the user to update first.

## Native changes

See `docs/ANDROID.md` → *When a new APK is needed* (`--min-native=N`).
