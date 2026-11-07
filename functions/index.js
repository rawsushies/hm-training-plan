// SCAFFOLD — NOT DEPLOYED. Strava integration backend for WeRunIt.
// Why a server: the Strava client secret must never ship in app JavaScript, and Strava refresh tokens must be kept private.
// Requirements before this can run (see docs/INTEGRATIONS.md): Firebase Blaze plan, a Strava API application,
//   `firebase functions:secrets:set STRAVA_CLIENT_SECRET`, STRAVA_CLIENT_ID + STRAVA_VERIFY_TOKEN params, and adding
//   "functions" to firebase.json. Nothing here is wired into the app UI yet; the app labels Strava as "Butuh server".
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

initializeApp();
const db = getFirestore();
const CLIENT_SECRET = defineSecret("STRAVA_CLIENT_SECRET");
const CLIENT_ID = defineString("STRAVA_CLIENT_ID");
const VERIFY_TOKEN = defineString("STRAVA_VERIFY_TOKEN");
const REGION = "asia-southeast2";

// state = uid.nonce.hmac — binds the OAuth callback to the signed-in user who started it
const sign = (v, key) => createHmac("sha256", key).update(v).digest("base64url");
const makeState = (uid, key) => { const n = randomBytes(12).toString("base64url"); return `${uid}.${n}.${sign(uid + "." + n, key)}`; };
function readState(state, key) {
  const [uid, n, mac] = String(state || "").split(".");
  if (!uid || !n || !mac) return null;
  const want = Buffer.from(sign(uid + "." + n, key)), got = Buffer.from(mac);
  return want.length === got.length && timingSafeEqual(want, got) ? uid : null;
}

/** GET with Authorization: Bearer <Firebase ID token> → {url} to open Strava's consent screen. */
export const stravaStart = onRequest({ region: REGION, secrets: [CLIENT_SECRET], cors: true }, async (req, res) => {
  const tok = (req.get("authorization") || "").replace(/^Bearer /, "");
  let uid; try { uid = (await getAuth().verifyIdToken(tok)).uid; } catch { res.status(401).json({ error: "unauthenticated" }); return; }
  const redirect = `https://${REGION}-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/stravaCallback`;
  const url = `https://www.strava.com/oauth/authorize?client_id=${encodeURIComponent(CLIENT_ID.value())}&response_type=code&approval_prompt=auto&scope=activity:read&redirect_uri=${encodeURIComponent(redirect)}&state=${encodeURIComponent(makeState(uid, CLIENT_SECRET.value()))}`;
  res.json({ url });
});

/** Strava redirects here with ?code&state. Exchanges the code server-side; tokens go to a server-only collection. */
export const stravaCallback = onRequest({ region: REGION, secrets: [CLIENT_SECRET] }, async (req, res) => {
  const uid = readState(req.query.state, CLIENT_SECRET.value());
  if (!uid || !req.query.code) { res.status(400).send("Invalid state"); return; }
  const r = await fetch("https://www.strava.com/oauth/token", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_id: CLIENT_ID.value(), client_secret: CLIENT_SECRET.value(), code: req.query.code, grant_type: "authorization_code" }) });
  if (!r.ok) { res.status(502).send("Strava token exchange failed"); return; }
  const t = await r.json();
  // serverOnly/** is denied to every client by firestore.rules
  await db.doc(`serverOnly/strava/tokens/${uid}`).set({ athleteId: t.athlete && t.athlete.id, access: t.access_token, refresh: t.refresh_token, expiresAt: t.expires_at, scope: String(req.query.scope || ""), updatedAt: FieldValue.serverTimestamp() });
  await db.doc(`serverOnly/strava/athletes/${t.athlete && t.athlete.id}`).set({ uid });
  res.status(200).send("Strava terhubung. Kembali ke WeRunIt.");
});

/** Strava webhook: GET = subscription validation, POST = activity events. Imports into users/{uid}/inbox for review in-app. */
export const stravaWebhook = onRequest({ region: REGION, secrets: [CLIENT_SECRET] }, async (req, res) => {
  if (req.method === "GET") {
    if (req.query["hub.verify_token"] !== VERIFY_TOKEN.value()) { res.status(403).end(); return; }
    res.json({ "hub.challenge": req.query["hub.challenge"] }); return;
  }
  res.status(200).end();                              // ack fast; Strava retries otherwise
  const e = req.body || {};
  if (e.object_type !== "activity" || e.aspect_type !== "create") return;
  const link = await db.doc(`serverOnly/strava/athletes/${e.owner_id}`).get(); if (!link.exists) return;
  const uid = link.data().uid, tokRef = db.doc(`serverOnly/strava/tokens/${uid}`), tok = (await tokRef.get()).data();
  let access = tok.access;
  if (tok.expiresAt * 1000 < Date.now() + 60e3) {
    const r = await fetch("https://www.strava.com/oauth/token", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_id: CLIENT_ID.value(), client_secret: CLIENT_SECRET.value(), grant_type: "refresh_token", refresh_token: tok.refresh }) });
    if (!r.ok) return;
    const t = await r.json(); access = t.access_token;
    await tokRef.update({ access, refresh: t.refresh_token, expiresAt: t.expires_at });
  }
  const a = await (await fetch(`https://www.strava.com/api/v3/activities/${e.object_id}`, { headers: { authorization: `Bearer ${access}` } })).json();
  if (!/Run/.test(a.sport_type || a.type || "")) return;
  // Only measured fields from Strava; missing values stay null.
  await db.doc(`users/${uid}/inbox/strava_${a.id}`).set({ extId: "strava:" + a.id, src: "Strava", start: a.start_date, startLocal: a.start_date_local,
    distance: a.distance ? Math.round(a.distance / 10) / 100 : 0, duration: a.moving_time || null, elev: a.total_elevation_gain ?? null,
    hrAvg: a.has_heartrate ? a.average_heartrate : null, hrMax: a.has_heartrate ? a.max_heartrate : null, name: String(a.name || "").slice(0, 120), receivedAt: FieldValue.serverTimestamp() });
});
