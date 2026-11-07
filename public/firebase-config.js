/* Firebase web client configuration for project "we-run-it".
 * These are public identifiers (not secrets): every Firebase web app ships them to the browser.
 * Access is controlled by firestore.rules and the Authentication "Authorized domains" list.
 * See docs/FIREBASE_SETUP.md. Set to null to run the app local-only. */
window.HMTP_FIREBASE_CONFIG = window.HMTP_FIREBASE_CONFIG !== undefined ? window.HMTP_FIREBASE_CONFIG : {
  apiKey: "AIzaSyCxz4eZuB7RC2iRoNmO6NAXYL2q2q34OfU",
  authDomain: "we-run-it.firebaseapp.com",
  projectId: "we-run-it",
  appId: "1:227466072680:web:719c7f0f748bb5f73361dd",
  messagingSenderId: "227466072680"
};
// Where installed apps (APK) download live updates from.
window.HMTP_UPDATE_URL = window.HMTP_UPDATE_URL || "https://we-run-it.web.app/";
