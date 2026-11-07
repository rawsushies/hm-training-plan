# Android app (APK)

The Android app is a Capacitor 8 shell around the same files that are deployed to Firebase Hosting
(`public/`). Package: `com.hmtrainingplan.app`. Minimum Android 7.0 (API 24), target API 36.

## What is different from the website

| | Website | APK |
|---|---|---|
| Google sign-in | Firebase popup/redirect | **native** account picker (`@capacitor-firebase/authentication`, `skipNativeAuth`), ID token handed to the Firebase JS SDK |
| Offline | service worker (after first visit) | files bundled in the APK, works offline from the first start |
| Updates | service worker (see `docs/UPDATES.md`) | **live update**: new files downloaded from `https://we-run-it.web.app/`, SHA-256 checked, switched after a successful start |

Google blocks OAuth inside embedded WebViews, which is why the APK uses native sign-in.

## Firebase (project `we-run-it`, done)

- Android app `1:227466072680:android:be7412f7ff021c0b3361dd` registered.
- Release key fingerprints registered:
  SHA-1 `72:EE:B6:91:5F:CD:F2:F1:11:72:A1:BD:A1:C0:B5:2E:4D:A1:08:69`,
  SHA-256 `7C:3C:93:22:15:DE:07:AF:91:40:3D:46:1F:B4:A8:4C:D5:FF:C7:B5:85:58:28:26:ED:93:F3:4C:0D:92:F6:55`.
- `android/app/google-services.json` is committed (it holds public identifiers only, not secrets).
- `localhost` is an authorised domain (the APK's WebView origin is `https://localhost`).

Native Google sign-in only works in APKs signed with **that** key. A debug/temporary key gives
`DEVELOPER_ERROR` / "Login gagal".

## Signing key (never in the repo)

The release keystore (`hmtp-release.jks`, alias `hmtp`) was generated for you and handed over
privately. **Keep it safe:** Android only installs an update over an existing app if it is signed with
the same key, and Google sign-in is tied to it. If it's lost, a new key must be created, its
fingerprints registered in Firebase, and users must uninstall/reinstall.

Add to GitHub → repository **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | contents of `keystore.base64.txt` |
| `ANDROID_KEYSTORE_PASSWORD` | from `secrets.txt` |
| `ANDROID_KEY_ALIAS` | `hmtp` |
| `ANDROID_KEY_PASSWORD` | from `secrets.txt` |

## Building

**GitHub Actions (recommended):** Actions → *Android APK* → *Run workflow*. It runs the unit tests,
copies `public/` into the Android project, builds a signed release APK, uploads it as an artifact and
(by default) publishes a GitHub Release with the APK attached. Pushing a tag `v3.2.0` does the same.

**Locally** (Android SDK + Java 21):

```bash
npm ci && npx cap sync android
```

```bash
cd android && ANDROID_KEYSTORE_FILE=/path/hmtp-release.jks ANDROID_KEYSTORE_PASSWORD=… ANDROID_KEY_ALIAS=hmtp ANDROID_KEY_PASSWORD=… VERSION_NAME=3.1.0 VERSION_CODE=1001 ./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`.

## Installing

Copy the APK to the phone, open it, allow "install unknown apps" for the file manager/browser when
asked. Later APKs (only needed when the app says *"Perlu install APK baru"*) install over it and keep
all data, as long as they're signed with the same key.

## When a new APK is needed

Only for native changes: new/updated Capacitor plugins, Android permissions, icon/splash, package
settings. Then bump `"appendUserAgent": "HMTPNative/N"` in `capacitor.config.json`, build the APK, and
release the web files with `--min-native=N` so older APKs show the download prompt.
Everything in `public/` (texts, training content, UI/UX) reaches installed APKs by live update.

## Not verified yet

The APK was built and its signature, package and embedded Firebase config were checked, but it has
not been run on a physical device from this environment (no Android emulator available here).
Please test on your phone: install, sign in with Google, log a run, then check it appears on the
website after signing in with the same account.
