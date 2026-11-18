// Strava DISPLAY-ONLY helpers (pure; unit-tested in test/unit/strava.test.js). No Firebase imports here.
// Owner decision 2026-11-18 (docs/STRAVA_INTEGRATION_FEASIBILITY.md): Strava activities are fetched on demand,
// shown back to the same athlete, cached at most 7 days on their device, and never stored server-side, synced,
// analysed by the coach, used for plans, or sent to any AI.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const CACHE_DAYS = 7;
export const SCOPE = "activity:read";      // public activities only; the narrowest read scope that lists activities

// state = uid.nonce.expiry.hmac: binds the OAuth callback to the signed-in user who started it, valid for 10 minutes
const sign = (v, key) => createHmac("sha256", key).update(v).digest("base64url");
export function makeState(uid, key, now = Date.now()) {
  const n = randomBytes(12).toString("base64url"), exp = String(Math.floor(now / 1000) + 600);
  return `${uid}.${n}.${exp}.${sign(`${uid}.${n}.${exp}`, key)}`;
}
export function readState(state, key, now = Date.now()) {
  const [uid, n, exp, mac] = String(state || "").split(".");
  if (!uid || !n || !exp || !mac || !/^\d+$/.test(exp)) return null;
  if (Number(exp) * 1000 < now) return null;
  const want = Buffer.from(sign(`${uid}.${n}.${exp}`, key)), got = Buffer.from(mac);
  return want.length === got.length && timingSafeEqual(want, got) ? uid : null;
}

export function authorizeUrl({ clientId, redirectUri, state }) {
  const q = new URLSearchParams({ client_id: clientId, response_type: "code", approval_prompt: "auto", scope: SCOPE, redirect_uri: redirectUri, state });
  return `https://www.strava.com/oauth/authorize?${q}`;
}
/** Refresh when the access token expires within 60 s (Strava access tokens last 6 h). */
export const needsRefresh = (expiresAt, now = Date.now()) => !expiresAt || expiresAt * 1000 < now + 60e3;
/** `after` parameter for /athlete/activities: start of the 7-day window, in epoch seconds. */
export const afterEpoch = (now = Date.now()) => Math.floor((now - CACHE_DAYS * 864e5) / 1000);

/** Minimal display fields from a Strava SummaryActivity. Missing values stay null; nothing is estimated. */
export function toDisplay(a) {
  if (!a || typeof a !== "object" || !a.id) return null;
  const sport = String(a.sport_type || a.type || "");
  const km = typeof a.distance === "number" && a.distance > 0 ? Math.round(a.distance / 10) / 100 : null;
  const sec = typeof a.moving_time === "number" && a.moving_time > 0 ? a.moving_time : null;
  return {
    id: String(a.id), name: String(a.name || "").slice(0, 120), sport, run: /Run/.test(sport),
    startLocal: String(a.start_date_local || a.start_date || "").slice(0, 19), date: String(a.start_date_local || a.start_date || "").slice(0, 10),
    distanceKm: km, movingSec: sec, elevGainM: typeof a.total_elevation_gain === "number" ? a.total_elevation_gain : null,
    hrAvg: a.has_heartrate && typeof a.average_heartrate === "number" ? a.average_heartrate : null
  };
}
/** Keep only activities that started inside the 7-day window. */
export function inWindow(list, now = Date.now()) {
  const from = new Date(now - CACHE_DAYS * 864e5).toISOString().slice(0, 10);
  return (list || []).map(toDisplay).filter(x => x && x.date >= from);
}
/** Webhook events that mean the athlete revoked access. */
export const isDeauth = e => !!e && e.object_type === "athlete" && e.aspect_type === "update" && e.updates && String(e.updates.authorized) === "false";
