/* WeRunIt integrations: one activity model, dedupe, and a provider registry with HONEST status.
 * A provider is "available" only when it can actually import on this platform right now. Scaffolds that need
 * a server, credentials or a partner agreement report exactly that and never pretend to sync.
 *
 * ActivityProvider contract:
 *   id, name, kind: "file" | "device" | "cloud"
 *   status(env) -> {state: "available"|"needs-app-update"|"unsupported"|"needs-server"|"needs-credentials"|"partner-only", note}
 *   fetch(opts) -> Promise<Activity[]>   (only for available providers)
 *
 * Activity (normalized): {extId, src, date "YYYY-MM-DD", start ISO|null, distance km, duration s|null,
 *   elev m|null, hrAvg|null, hrMax|null, name, isRun}. Missing values stay null; nothing is estimated.
 */
(function (G) {
  "use strict";
  const r2 = v => Math.round(v * 100) / 100;
  const localYmd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const RUN_TYPES = ["running", "runningTreadmill", "trackAndField", "wheelchairRunPace"];

  /** Health Connect / HealthKit workout (from @capgo/capacitor-health) → Activity. */
  function fromHealthWorkout(w) {
    if (!w || !w.startDate) return null;
    const st = new Date(w.startDate); if (isNaN(st)) return null;
    return {
      extId: w.platformId ? "hc:" + String(w.platformId).slice(0, 80) : "t:" + st.toISOString().slice(0, 16),
      src: "Health Connect", date: localYmd(st), start: st.toISOString(),
      distance: typeof w.totalDistance === "number" && w.totalDistance > 0 ? r2(w.totalDistance / 1000) : 0,
      duration: typeof w.duration === "number" && w.duration > 0 ? Math.round(w.duration) : null,
      elev: null, hrAvg: null, hrMax: null,
      name: String(w.sourceName || "Health Connect").slice(0, 80), isRun: RUN_TYPES.includes(w.workoutType)
    };
  }

  /**
   * Is `a` the same run as an existing log? Same external id, or same start minute, or same date with
   * distance within 3% (min 0.15 km) and, when both have durations, duration within 5%.
   */
  function isDup(a, logs) {
    return (logs || []).some(l => {
      if (a.extId && l.extId && a.extId === l.extId) return true;
      if (a.start && l.extId === "t:" + a.start.slice(0, 16)) return true;
      if (l.date !== a.date) return false;
      const tol = Math.max(0.15, 0.03 * Math.max(a.distance, l.distance));
      if (Math.abs(l.distance - a.distance) > tol) return false;
      if (a.duration && l.duration) return Math.abs(a.duration - l.duration) <= 0.05 * Math.max(a.duration, l.duration);
      return true;
    });
  }
  /** Drop duplicates inside one batch (first wins). */
  function dedupeBatch(items) { const out = []; for (const it of items) if (!isDup(it, out)) out.push(it); return out; }

  /** Provider registry. env: {native:boolean, plugins:{Health:boolean}, android:boolean} */
  const PROVIDERS = [
    { id: "file", name: "File GPX / TCX / Strava CSV", kind: "file",
      status: () => ({ state: "available", note: "Import dari file ekspor jam/aplikasi apa pun. Diproses di perangkat." }) },
    { id: "healthconnect", name: "Health Connect (Android)", kind: "device",
      status: env => !env.native ? { state: "unsupported", note: "Hanya di aplikasi Android." }
        : !env.plugins.Health ? { state: "needs-app-update", note: "APK yang terpasang belum punya modul Health Connect. Pasang APK terbaru." }
        : { state: "available", note: "Membaca lari (jarak, durasi) yang dicatat aplikasi lain di Health Connect, 30 hari terakhir. Hanya baca." } },
    { id: "strava", name: "Strava (sinkron otomatis)", kind: "cloud",
      status: () => ({ state: "needs-server", note: "Butuh server untuk OAuth (client secret tidak boleh ada di aplikasi). Kode server sudah disiapkan di functions/, belum di-deploy karena butuh Firebase Blaze. Sementara itu: import file CSV Strava." }) },
    { id: "huawei", name: "Huawei Health", kind: "cloud",
      status: () => ({ state: "needs-credentials", note: "Butuh akun developer Huawei + persetujuan Health Kit API. Belum tersedia. Ekspor GPX/TCX dari Huawei Health bisa diimport lewat file." }) },
    { id: "garmin", name: "Garmin Connect", kind: "cloud",
      status: () => ({ state: "partner-only", note: "API Garmin hanya untuk partner terdaftar. Alternatif: Garmin → Health Connect, atau ekspor file." }) },
    { id: "coros", name: "COROS", kind: "cloud",
      status: () => ({ state: "partner-only", note: "API COROS lewat program partner. Alternatif: COROS → Strava/Health Connect, atau ekspor file." }) },
    { id: "suunto", name: "Suunto", kind: "cloud",
      status: () => ({ state: "partner-only", note: "Suunto API butuh pendaftaran partner. Alternatif: Suunto → Health Connect/Strava, atau ekspor file." }) }
  ];
  const STATE_LBL = { available: "Tersedia", "needs-app-update": "Perlu update aplikasi", unsupported: "Tidak didukung di sini", "needs-server": "Butuh server", "needs-credentials": "Butuh kredensial", "partner-only": "Khusus partner" };

  G.WRI_INTEG = { fromHealthWorkout, isDup, dedupeBatch, PROVIDERS, STATE_LBL, RUN_TYPES };
})(typeof globalThis !== "undefined" ? globalThis : this);
