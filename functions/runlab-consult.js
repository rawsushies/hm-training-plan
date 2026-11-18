// SCAFFOLD — NOT DEPLOYED, NOT EXPORTED FROM index.js. RUNLAB AI consultation adapter (provider-neutral).
// Requirements before it can run (owner decisions): Firebase Blaze or Cloud Run, a provider API key in Secret Manager
// (`LLM_API_KEY`), a provider choice, per-user and global budgets. A consumer AI subscription is not an API key.
// Security design (see docs/RUNLAB_ARCHITECTURE.md §4):
//  - Verify the Firebase ID token; the UID is the only identity. Reject requests without explicit consent flags.
//  - Payload is built on the device by WRI_CONSULT.buildPayload (no notes, no GPS, no Strava-origin runs) and re-validated here.
//  - Size cap, timeout, per-UID daily request cap and monthly token budget, global budget kill-switch.
//  - Never log prompts, notes, tokens or keys. CORS only for the app origins.
//  - Provider output must pass validateFinding (shared logic with public/js/lab/consult.js); citations must be source ids
//    that the client sent from the research layer. Anything else is rejected, not "repaired".
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getAuth } from "firebase-admin/auth";

const LLM_API_KEY = defineSecret("LLM_API_KEY");
const ORIGINS = ["https://we-run-it.web.app", "https://we-run-it.firebaseapp.com", "capacitor://localhost", "https://localhost"];
const MAX_BYTES = 48 * 1024, DAILY_CAP = 20;
const used = new Map();   // replace with Firestore counters (serverOnly/consultUsage/{uid}) before any deployment

/** Provider adapter interface: implement complete(payload) → LabFinding JSON. No provider is wired in. */
const providers = {};

export const runlabConsult = onRequest({ region: "asia-southeast2", secrets: [LLM_API_KEY], cors: ORIGINS, timeoutSeconds: 60 }, async (req, res) => {
  if (req.method !== "POST") { res.status(405).end(); return; }
  if (Number(req.get("content-length") || 0) > MAX_BYTES) { res.status(413).json({ error: "too large" }); return; }
  let uid;
  try { uid = (await getAuth().verifyIdToken((req.get("authorization") || "").replace(/^Bearer /, ""))).uid; } catch { res.status(401).json({ error: "unauthenticated" }); return; }
  const { consent, payload, sourceIds, provider } = req.body || {};
  if (!consent || consent.version !== 1 || !Array.isArray(consent.categories)) { res.status(400).json({ error: "consent required" }); return; }
  const day = new Date().toISOString().slice(0, 10), key = uid + day, n = (used.get(key) || 0) + 1;
  if (n > DAILY_CAP) { res.status(429).json({ error: "daily limit" }); return; }
  used.set(key, n);
  const p = providers[provider];
  if (!p) { res.status(503).json({ error: "not-configured" }); return; }   // the only possible outcome today
  void payload; void sourceIds;
  res.status(501).json({ error: "not implemented" });
});
