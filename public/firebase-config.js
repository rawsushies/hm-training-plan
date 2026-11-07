/* Firebase web client configuration.
 * Fill in the values from Firebase console → Project settings → Your apps → Web app.
 * These are public identifiers (not secrets). Security comes from firestore.rules and the
 * Authentication "Authorised domains" list. Leave as null to run the app local-only.
 * See docs/FIREBASE_SETUP.md. */
window.HMTP_FIREBASE_CONFIG = window.HMTP_FIREBASE_CONFIG || null;
/* Example:
window.HMTP_FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  appId: "1:1234567890:web:abcdef",
  messagingSenderId: "1234567890"
};
*/
