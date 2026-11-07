# Firebase setup

The app works fully **without** Firebase (local mode: data stays on the device). Firebase adds
Google sign-in, per-account cloud sync across devices, and training groups.

None of the steps below can be done from this repository. They need a Google account and the
Firebase console. Official references:
- Google sign-in (web): https://firebase.google.com/docs/auth/web/google-signin
- Redirect sign-in best practices: https://firebase.google.com/docs/auth/web/redirect-best-practices
- Security rules: https://firebase.google.com/docs/firestore/security/get-started
- Emulator Suite: https://firebase.google.com/docs/emulator-suite

> Console menu names change from time to time. If a label below doesn't match, use the linked
> official page.

## 1. Create the project (free Spark plan is enough)

1. Go to https://console.firebase.google.com and click **Create a project**. Google Analytics isn't needed.
2. **Build → Authentication → Get started → Sign-in method → Google → Enable**. Pick a support email and save.
3. **Build → Firestore Database → Create database**. Choose **production mode**; the rules in this repo
   replace the defaults. Choose a location close to your users (for Indonesia, e.g. `asia-southeast2`
   Jakarta). The location can't be changed later.
4. **Project settings (gear) → General → Your apps → Web (`</>`)**. Register an app (no need to tick
   Hosting here). Copy the `firebaseConfig` object.

No Cloud Functions are used, so the **Blaze (billing) plan isn't required**. Invites are enforced by
the security rules (see `docs/ARCHITECTURE.md` §5).

## 2. Give the app its configuration

Edit `public/firebase-config.js`:

```js
window.HMTP_FIREBASE_CONFIG = window.HMTP_FIREBASE_CONFIG || {
  apiKey: "AIza…",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  appId: "1:…:web:…",
  messagingSenderId: "…"
};
```

These values are **public identifiers, not secrets**. Every web app that uses Firebase ships them to
the browser. Access is controlled by `firestore.rules` and the authorised-domains list.
**Never** put a service-account JSON, Admin SDK key, OAuth client secret or any backend secret in this
repository or in `public/`.

`.env.example` lists the same fields for reference. The app has no build step, so it doesn't read `.env`.

## 3. Deploy hosting + rules

```bash
npm install
```

```bash
npx firebase login
```

```bash
cp .firebaserc.example .firebaserc   # then put your project id in it
```

```bash
npx firebase deploy --only firestore:rules,firestore:indexes,hosting
```

The app is then live at `https://<project>.web.app` (and `.firebaseapp.com`).

### Authorised domains

**Authentication → Settings → Authorized domains**: `localhost`, `<project>.firebaseapp.com` and
`<project>.web.app` are there by default. Add every other domain the app is served from (a custom
domain, or `username.github.io` if you use GitHub Pages). Without it, sign-in fails and the app shows:
*“Alamat app ini belum diizinkan buat login Google…”*.

### Popup vs redirect

The app first tries a **popup**. If the browser blocks popups (in-app browsers, some WebViews), it falls
back to a **full-page redirect** automatically. Many browsers now block third-party storage, and
redirect sign-in only works reliably when `authDomain` is served from the **same site** as the app. The
simplest way: host on Firebase Hosting (step 3) and set `authDomain` to the hosting domain you actually
use (e.g. `your-project.web.app` or your custom domain connected in Hosting). See the redirect best
practices link above for other options.

## 4. Android (future Capacitor shell)

A WebView can't always complete Google's browser OAuth flow. The Android build should use native Google
sign-in (e.g. `@capacitor-firebase/authentication`) and pass the resulting **Google ID token** to
`cloud.signInWithGoogleIdToken(idToken)`, which already exists in `public/js/cloud-firebase.js`.
The rest of the app doesn't change.

Native Google sign-in needs the app's signing certificate fingerprints:

1. Get them: `./gradlew signingReport` (debug and release keys), plus the **Play App Signing** key
   from Play Console → *App integrity*.
2. **Project settings → Your apps → Add app → Android** (package name), then **Add fingerprint** for
   each SHA-1 and SHA-256.
3. Download the new `google-services.json` into the Android project (it isn't a secret, but it's
   project-specific; keep it out of `public/`).

## 5. Emulator Suite (local testing, no real project needed)

Needs Java 11+ and Node 20+. The project id `demo-hmtp` is a *demo* project: nothing reaches real
Google servers.

```bash
npm run emulators            # Auth :9099, Firestore :8080
```

```bash
npm run serve                # app on http://localhost:5173
```

Open `http://localhost:5173/?emulator=1` after setting a config in `public/firebase-config.js`
(any values work with the emulator, e.g. `{apiKey:"demo", authDomain:"demo-hmtp.firebaseapp.com", projectId:"demo-hmtp", appId:"1:1:web:1"}`).
`?emulator=1` is only honoured on `localhost`/`127.0.0.1`. The emulator shows its own fake Google
account picker.

Tests (see `docs/TEST_REPORT.md`):

```bash
npm test               # unit (no emulator)
```

```bash
npm run test:rules     # security rules against the Firestore emulator
```

```bash
npm run test:e2e       # browser end-to-end against Auth + Firestore emulators
```

## 6. Restoring existing user records

- **From a JSON backup** (old Claude version or this app): *Menu → Data & backup → Import backup →
  Gabungkan*. A merge never deletes anything and skips duplicates.
- **Automatic backups**: before every merge, import, reset or first-sign-in migration, the app stores a
  backup in the browser (*Data & backup → Backup otomatis*), where you can merge it back or download it.
- **Conflicts**: losing versions of concurrent edits are kept under *Data & backup* and in Firestore
  `users/{uid}/conflicts`, and can be restored with one tap.
- **Admin recovery**: with console access, records are plain documents under `users/{uid}/…`.
  Tombstones (`deleted: true`) mark deletions; a deleted run can be recovered by an admin by
  exporting the project (`gcloud firestore export`) before the change. Point-in-time recovery is
  a paid Firestore feature and isn't enabled by this repo.

## 7. Cost notes (Spark plan)

Each app start reads the account's documents once (~1 read per record, a few hundred for a full season)
and keeps listeners open. Two people training for 31 weeks stay well inside the free daily quota
(50k reads / 20k writes).
