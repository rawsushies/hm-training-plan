/* Strava DISPLAY-ONLY client (owner decision 2026-11-18). Exposes globalThis.WRI_STRAVA.
 * - Activities come from our server function on demand (last 7 days) and are kept only in this device's localStorage,
 *   per account, for at most 7 days. They are never written to S.logs, synced, exported, analysed by the coach,
 *   used to change the plan, or sent to any AI.
 * - Off until the owner deploys the functions and sets window.HMTP_STRAVA_ENABLED = true (then status "disconnected").
 * Pure helpers (cache rules, matching) are separate from the network calls so they can be unit-tested.
 */
(function (G) {
  "use strict";
  const DAYS = 7, DAY = 864e5, KEY = uid => `hmtp:strava:recent:${uid || "anon"}`;
  const ymd = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

  /** Cache rule: drop the whole cache after 7 days; drop activities older than the 7-day window. */
  function fresh(cache, now = Date.now()) {
    if (!cache || typeof cache !== "object" || !(cache.fetchedAt > 0) || now - cache.fetchedAt > DAYS * DAY || cache.fetchedAt > now + 6e4) return null;
    const from = ymd(now - DAYS * DAY);
    return { fetchedAt: cache.fetchedAt, status: cache.status || "connected", activities: (cache.activities || []).filter(a => a && typeof a.date === "string" && a.date >= from) };
  }
  /** Strava runs on a date (display next to a plan day; never marks the session done). */
  const runsOn = (cache, date) => cache ? cache.activities.filter(a => a.run && a.date === date) : [];

  /* ---------- network + state (browser only) ---------- */
  const ST = { status: null, busy: false, err: "" };
  const enabled = () => G.HMTP_STRAVA_ENABLED === true;
  const base = () => { const c = G.HMTP_FIREBASE_CONFIG; return G.HMTP_FUNCTIONS_URL || (c && c.projectId ? `https://asia-southeast2-${c.projectId}.cloudfunctions.net` : null); };
  let cloud = () => null;                                   // app injects () => CLOUD (a top-level const, not on window)
  const bind = f => { cloud = f; };
  const uid = () => { const c = cloud(); return (c && c.user && c.user.uid) || null; };
  function read() { try { return fresh(JSON.parse(localStorage.getItem(KEY(uid())) || "null")); } catch (e) { return null; } }
  function write(c) { try { if (c) localStorage.setItem(KEY(uid()), JSON.stringify(c)); else localStorage.removeItem(KEY(uid())); } catch (e) { /* storage blocked: show nothing */ } }
  function status() {
    if (!enabled() || !base()) return "unavailable";
    if (!uid()) return "signed-out";
    if (ST.busy) return "connecting";
    const c = read();
    return ST.status || (c ? c.status : "disconnected");
  }
  async function call(path, method = "GET") {
    const c = cloud(), t = c && c.api && c.api.idToken ? await c.api.idToken() : null;
    if (!t) throw new Error("Masuk dulu untuk menyambungkan Strava.");
    const r = await fetch(`${base()}/${path}`, { method, headers: { authorization: `Bearer ${t}` }, cache: "no-store" });
    let j = null; try { j = await r.json(); } catch (e) { j = null; }
    if (!r.ok && !(j && j.status)) throw new Error(`Server membalas ${r.status}`);
    return j || {};
  }
  async function connect() { ST.busy = true; ST.err = ""; try { const j = await call("stravaStart"); if (j.url) G.location.href = j.url; } catch (e) { ST.err = String(e.message || e).slice(0, 160); } finally { ST.busy = false; } }
  async function refresh() {
    ST.busy = true; ST.err = "";
    try { const j = await call("stravaRecent"); ST.status = j.status || "error"; write(j.status === "connected" ? { fetchedAt: j.fetchedAt || Date.now(), status: "connected", activities: j.activities || [] } : null); }
    catch (e) { ST.err = String(e.message || e).slice(0, 160); }
    finally { ST.busy = false; }
  }
  async function disconnect() { ST.busy = true; ST.err = ""; try { await call("stravaDisconnect", "POST"); ST.status = "disconnected"; write(null); } catch (e) { ST.err = String(e.message || e).slice(0, 160); } finally { ST.busy = false; } }
  /** Handle the ?strava=… flag the callback sends back. */
  function fromRedirect(search) {
    const m = /[?&]strava=([a-z-]+)/.exec(search || ""); if (!m) return null;
    ST.status = m[1] === "connected" ? "connected" : null; ST.err = { denied: "Akses Strava tidak diberikan.", invalid: "Sesi menyambung kedaluwarsa; coba lagi.", scope: "Izin membaca aktivitas tidak dicentang.", error: "Strava menolak pertukaran token." }[m[1]] || "";
    return m[1];
  }
  G.WRI_STRAVA = { bind, DAYS, fresh, runsOn, read, write, status, connect, refresh, disconnect, fromRedirect, ST, enabled };
})(typeof globalThis !== "undefined" ? globalThis : this);
