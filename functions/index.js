// NOT DEPLOYED. Strava DISPLAY-ONLY backend for WeRunIt (owner decision 2026-11-18; see docs/STRAVA_INTEGRATION_FEASIBILITY.md).
// Why a server: Strava's token exchange needs the client secret, which must never ship in app JavaScript.
// What it does: OAuth connect, on-demand list of the athlete's last 7 days, disconnect, and revoke handling.
// What it never does: store activities in Firestore, write runs, analyse data, or send Strava data to any AI or third party.
// To activate (owner): Firebase Blaze plan, a Strava API app (with any subscription Strava requires for API access),
//   `firebase functions:secrets:set STRAVA_CLIENT_SECRET`, params STRAVA_CLIENT_ID / STRAVA_VERIFY_TOKEN / APP_URL,
//   add "functions" to firebase.json, deploy, then set window.HMTP_STRAVA_ENABLED = true in public/firebase-config.js.
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { makeState, readState, authorizeUrl, needsRefresh, afterEpoch, inWindow, isDeauth } from "./strava-core.js";

initializeApp();
const db = getFirestore();
const CLIENT_SECRET = defineSecret("STRAVA_CLIENT_SECRET");
const CLIENT_ID = defineString("STRAVA_CLIENT_ID");
const VERIFY_TOKEN = defineString("STRAVA_VERIFY_TOKEN");
const APP_URL = defineString("APP_URL", { default: "https://we-run-it.web.app/" });
const REGION = "asia-southeast2";
const tokRef = uid => db.doc(`serverOnly/strava/tokens/${uid}`);          // serverOnly/** is denied to every client by the rules

async function userOf(req) {
  const tok = (req.get("authorization") || "").replace(/^Bearer /, "");
  try { return (await getAuth().verifyIdToken(tok)).uid; } catch { return null; }
}
async function tokenExchange(body) {
  const r = await fetch("https://www.strava.com/oauth/token", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(Object.assign({ client_id: CLIENT_ID.value(), client_secret: CLIENT_SECRET.value() }, body)) });
  return r.ok ? r.json() : null;
}
async function forget(uid, athleteId) {
  await tokRef(uid).delete().catch(() => {});
  if (athleteId) await db.doc(`serverOnly/strava/athletes/${athleteId}`).delete().catch(() => {});
}

/** GET + Firebase ID token → {url} for Strava's consent screen. */
export const stravaStart = onRequest({ region: REGION, secrets: [CLIENT_SECRET], cors: true }, async (req, res) => {
  const uid = await userOf(req); if (!uid) { res.status(401).json({ error: "unauthenticated" }); return; }
  const redirectUri = `https://${REGION}-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/stravaCallback`;
  res.json({ url: authorizeUrl({ clientId: CLIENT_ID.value(), redirectUri, state: makeState(uid, CLIENT_SECRET.value()) }) });
});

/** Strava redirects here (?code&state&scope or ?error). Tokens only; back to the app with a status flag. */
export const stravaCallback = onRequest({ region: REGION, secrets: [CLIENT_SECRET] }, async (req, res) => {
  const back = s => res.redirect(302, `${APP_URL.value()}?strava=${s}`);
  if (req.query.error) { back("denied"); return; }
  const uid = readState(req.query.state, CLIENT_SECRET.value());
  if (!uid || !req.query.code) { back("invalid"); return; }
  if (!String(req.query.scope || "").split(",").includes("activity:read")) { back("scope"); return; }
  const t = await tokenExchange({ code: String(req.query.code), grant_type: "authorization_code" });
  if (!t) { back("error"); return; }
  const athleteId = t.athlete && t.athlete.id;
  await tokRef(uid).set({ athleteId, access: t.access_token, refresh: t.refresh_token, expiresAt: t.expires_at, scope: String(req.query.scope || ""), updatedAt: FieldValue.serverTimestamp() });
  if (athleteId) await db.doc(`serverOnly/strava/athletes/${athleteId}`).set({ uid });
  back("connected");
});

/** GET + ID token → {status, activities, fetchedAt}. Last 7 days only, fetched on demand, nothing persisted. */
export const stravaRecent = onRequest({ region: REGION, secrets: [CLIENT_SECRET], cors: true }, async (req, res) => {
  const uid = await userOf(req); if (!uid) { res.status(401).json({ status: "unauthenticated" }); return; }
  const snap = await tokRef(uid).get(); if (!snap.exists) { res.json({ status: "disconnected", activities: [] }); return; }
  const tok = snap.data(); let access = tok.access;
  if (needsRefresh(tok.expiresAt)) {
    const t = await tokenExchange({ grant_type: "refresh_token", refresh_token: tok.refresh });
    if (!t) { res.json({ status: "expired", activities: [] }); return; }
    access = t.access_token; await tokRef(uid).update({ access, refresh: t.refresh_token, expiresAt: t.expires_at });
  }
  const r = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${afterEpoch()}&per_page=50`, { headers: { authorization: `Bearer ${access}` } });
  if (r.status === 401) { await forget(uid, tok.athleteId); res.json({ status: "revoked", activities: [] }); return; }
  if (r.status === 429) { res.json({ status: "rate-limited", activities: [] }); return; }
  if (!r.ok) { res.status(502).json({ status: "error", activities: [] }); return; }
  res.set("Cache-Control", "no-store");
  res.json({ status: "connected", activities: inWindow(await r.json()), fetchedAt: Date.now() });
});

/** POST + ID token → revoke at Strava and delete the stored tokens. */
export const stravaDisconnect = onRequest({ region: REGION, secrets: [CLIENT_SECRET], cors: true }, async (req, res) => {
  const uid = await userOf(req); if (!uid) { res.status(401).json({ status: "unauthenticated" }); return; }
  const snap = await tokRef(uid).get();
  if (snap.exists) {
    const tok = snap.data();
    await fetch("https://www.strava.com/oauth/deauthorize", { method: "POST", headers: { authorization: `Bearer ${tok.access}` } }).catch(() => {});
    await forget(uid, tok.athleteId);
  }
  res.json({ status: "disconnected" });
});

/** Webhook: subscription validation and athlete de-authorisation only (activity events are ignored; nothing is imported). */
export const stravaWebhook = onRequest({ region: REGION }, async (req, res) => {
  if (req.method === "GET") {
    if (req.query["hub.verify_token"] !== VERIFY_TOKEN.value()) { res.status(403).end(); return; }
    res.json({ "hub.challenge": req.query["hub.challenge"] }); return;
  }
  res.status(200).end();
  const e = req.body || {};
  if (!isDeauth(e)) return;
  const link = await db.doc(`serverOnly/strava/athletes/${e.owner_id}`).get(); if (!link.exists) return;
  await forget(link.data().uid, e.owner_id);
});
