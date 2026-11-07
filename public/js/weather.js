/* WeRunIt weather: Open-Meteo forecast (free, no API key) + rule-based running tips.
 * Pure functions, usable in Node tests. Every value keeps its source, retrieval time and unit, and is labelled
 * as a forecast (model estimate), never as a measurement. Nothing here invents a value when data is missing.
 * Attribution: Weather data by Open-Meteo.com, licensed CC BY 4.0.
 */
(function (G) {
  "use strict";
  const SOURCE = "Open-Meteo", SOURCE_URL = "https://open-meteo.com/", LICENSE = "CC BY 4.0";
  const HOURLY = ["temperature_2m", "apparent_temperature", "relative_humidity_2m", "dew_point_2m", "precipitation_probability", "precipitation", "weather_code", "wind_speed_10m", "uv_index"];
  const CURRENT = ["temperature_2m", "apparent_temperature", "relative_humidity_2m", "precipitation", "weather_code", "wind_speed_10m"];
  const STALE_MS = 3 * 3600e3, EXPIRED_MS = 12 * 3600e3, REFRESH_MS = 3600e3;
  // Coordinates are rounded to ~1 km before leaving the device.
  const round2 = v => Math.round(v * 100) / 100;

  function forecastUrl(lat, lon, days = 3) {
    return `https://api.open-meteo.com/v1/forecast?latitude=${round2(lat)}&longitude=${round2(lon)}&current=${CURRENT.join(",")}&hourly=${HOURLY.join(",")}&forecast_days=${days}&timezone=auto&wind_speed_unit=kmh`;
  }
  function geocodeUrl(q) { return `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(String(q).slice(0, 80))}&count=5&language=id&format=json`; }

  const num = v => (typeof v === "number" && isFinite(v) ? v : null);
  /** Open-Meteo forecast JSON → normalized object, or throws with a readable reason. */
  function parseForecast(j, retrievedAt = Date.now()) {
    if (!j || typeof j !== "object") throw new Error("Respons cuaca kosong");
    if (j.error) throw new Error(String(j.reason || "Layanan cuaca menolak permintaan").slice(0, 160));
    const h = j.hourly, u = j.hourly_units || {};
    if (!h || !Array.isArray(h.time) || !h.time.length) throw new Error("Data prakiraan per jam tidak ada");
    const hours = h.time.map((t, i) => ({
      time: String(t).slice(0, 16),                      // local time at the location, "YYYY-MM-DDTHH:MM"
      temp: num((h.temperature_2m || [])[i]), feels: num((h.apparent_temperature || [])[i]),
      rh: num((h.relative_humidity_2m || [])[i]), dew: num((h.dew_point_2m || [])[i]),
      pop: num((h.precipitation_probability || [])[i]), precip: num((h.precipitation || [])[i]),
      code: num((h.weather_code || [])[i]), wind: num((h.wind_speed_10m || [])[i]), uv: num((h.uv_index || [])[i])
    }));
    const c = j.current || null;
    return {
      source: SOURCE, sourceUrl: SOURCE_URL, license: LICENSE, kind: "forecast", retrievedAt,
      lat: num(j.latitude), lon: num(j.longitude), tz: String(j.timezone || ""), elevation: num(j.elevation),
      units: { temp: u.temperature_2m || "°C", rh: u.relative_humidity_2m || "%", pop: u.precipitation_probability || "%", precip: u.precipitation || "mm", wind: u.wind_speed_10m || "km/h", uv: "" },
      current: c ? { time: String(c.time || "").slice(0, 16), temp: num(c.temperature_2m), feels: num(c.apparent_temperature), rh: num(c.relative_humidity_2m), precip: num(c.precipitation), code: num(c.weather_code), wind: num(c.wind_speed_10m) } : null,
      hours
    };
  }
  function parseGeocode(j) {
    if (!j || j.error) throw new Error(String((j && j.reason) || "Pencarian lokasi gagal").slice(0, 160));
    return (j.results || []).filter(r => num(r.latitude) !== null && num(r.longitude) !== null).slice(0, 5)
      .map(r => ({ name: String(r.name || "").slice(0, 60), admin: String(r.admin1 || "").slice(0, 60), country: String(r.country || "").slice(0, 40), lat: round2(r.latitude), lon: round2(r.longitude) }));
  }

  /** "fresh" | "stale" (older than 3 h: shown, labelled) | "expired" (older than 12 h: no tips from it). */
  function freshness(data, now = Date.now()) {
    const age = now - (data && data.retrievedAt || 0);
    return age > EXPIRED_MS ? "expired" : age > STALE_MS ? "stale" : "fresh";
  }
  const needsRefresh = (data, now = Date.now()) => !data || now - data.retrievedAt > REFRESH_MS;

  const WMO = { 0: "Cerah", 1: "Cerah berawan", 2: "Berawan sebagian", 3: "Mendung", 45: "Berkabut", 48: "Kabut beku", 51: "Gerimis ringan", 53: "Gerimis", 55: "Gerimis lebat", 56: "Gerimis beku", 57: "Gerimis beku", 61: "Hujan ringan", 63: "Hujan sedang", 65: "Hujan lebat", 66: "Hujan beku", 67: "Hujan beku", 71: "Salju ringan", 73: "Salju", 75: "Salju lebat", 77: "Butiran salju", 80: "Hujan lokal ringan", 81: "Hujan lokal", 82: "Hujan lokal lebat", 85: "Salju lokal", 86: "Salju lokal lebat", 95: "Badai petir", 96: "Badai petir + es", 99: "Badai petir + es" };
  const codeText = c => (c === null || c === undefined ? "—" : WMO[c] || "Kode cuaca " + c);
  const isStorm = c => c !== null && c >= 95;

  /** Hours overlapping [start, start+durationMin) on the location's local clock ("YYYY-MM-DD", "HH:MM"). */
  function windowFor(data, date, time, durationMin = 60) {
    if (!data || !data.hours) return [];
    const [hh, mm] = time.split(":").map(Number), last = Math.floor((hh * 60 + mm + Math.max(30, durationMin) - 1) / 60);
    return data.hours.filter(h => h.time.slice(0, 10) === date && +h.time.slice(11, 13) >= hh && +h.time.slice(11, 13) <= last);
  }
  const max = (a, k) => { const v = a.map(x => x[k]).filter(x => x !== null); return v.length ? Math.max(...v) : null; };
  const f1 = v => (Math.round(v * 10) / 10).toString().replace(".", ",");

  /** Summary of a window: worst-case values for planning. */
  function summarize(win) {
    if (!win.length) return null;
    return { from: win[0].time, to: win[win.length - 1].time, feels: max(win, "feels"), temp: max(win, "temp"), dew: max(win, "dew"), rh: max(win, "rh"), pop: max(win, "pop"), precip: win.reduce((a, h) => a + (h.precip || 0), 0), wind: max(win, "wind"), uv: max(win, "uv"), storm: win.some(h => isStorm(h.code)), code: win[0].code };
  }

  /**
   * Rule-based tips for a planned run. Each tip: {id, level:"good"|"info"|"warn"|"bad", text, why}.
   * `why` always names the forecast numbers it is based on.
   */
  function tips(sum, { type = "easy", durationMin = 45 } = {}) {
    if (!sum) return [];
    const out = [], long = durationMin >= 60 || type === "long" || type === "race";
    if (sum.storm) out.push({ id: "storm", level: "bad", text: "Ada potensi badai petir. Geser jam lari atau pindah ke treadmill.", why: `Prakiraan: ${codeText(sum.code === null ? 95 : sum.code)} di jam lari kamu.` });
    const humidHeat = sum.temp !== null && sum.dew !== null && sum.temp >= 28 && sum.dew >= 24;
    if ((sum.feels !== null && sum.feels >= 32) || humidHeat) {
      out.push({ id: "heat", level: "warn", text: `Panas dan lembap. Lari pakai RPE, bukan pace: wajar kalau lebih lambat dari biasanya.${long ? " Bawa minum dan siram kepala/leher kalau bisa." : ""}`,
        why: `Terasa sampai ${f1(sum.feels)}°C${sum.dew !== null ? `, titik embun ${f1(sum.dew)}°C` : ""}. Saat udara lembap, keringat susah menguap jadi badan lebih cepat panas.` });
    } else if (sum.feels !== null && sum.feels > 26 && !sum.storm) {
      out.push({ id: "warm", level: "info", text: `Cukup hangat. Mulai pelan dan minum sebelum lari${long ? "; bawa air buat sesi panjang" : ""}.`, why: `Terasa sampai ${f1(sum.feels)}°C${sum.rh !== null ? `, kelembapan ${Math.round(sum.rh)}%` : ""}.` });
    } else if (sum.feels !== null && sum.feels <= 26 && (sum.pop === null || sum.pop < 30) && !sum.storm) {
      out.push({ id: "nice", level: "good", text: "Kondisi enak buat lari. Tetap jaga effort sesuai rencana.", why: `Terasa ${f1(sum.feels)}°C${sum.pop !== null ? `, peluang hujan ${Math.round(sum.pop)}%` : ""}.` });
    }
    if (!sum.storm && ((sum.pop !== null && sum.pop >= 60) || sum.precip >= 1)) out.push({ id: "rain", level: "info", text: "Kemungkinan hujan. Pakai topi, hindari jalan licin dan genangan, dan siapkan kaus kaki ganti.", why: `Peluang hujan ${sum.pop !== null ? Math.round(sum.pop) + "%" : "—"}, total ${f1(sum.precip)} mm di jam lari kamu.` });
    if (sum.uv !== null && sum.uv >= 8) out.push({ id: "uv", level: "warn", text: "UV sangat tinggi. Pakai sunscreen, topi, dan kacamata, atau lari lebih pagi/sore.", why: `Indeks UV sampai ${f1(sum.uv)}.` });
    if (sum.wind !== null && sum.wind >= 30) out.push({ id: "wind", level: "info", text: "Angin kencang. Mulai melawan angin supaya pulangnya dibantu angin.", why: `Angin sampai ${Math.round(sum.wind)} km/jam.` });
    return out;
  }

  /** Coolest dry-ish hour between 05:00 and 20:00 on a date, or null. Planning hint, not a prescription. */
  function coolestHour(data, date) {
    const c = (data && data.hours || []).filter(h => h.time.slice(0, 10) === date && +h.time.slice(11, 13) >= 5 && +h.time.slice(11, 13) <= 20 && h.feels !== null && !isStorm(h.code) && (h.pop === null || h.pop < 50));
    if (!c.length) return null;
    return c.reduce((a, h) => (h.feels < a.feels ? h : a));
  }

  G.WRI_WEATHER = { SOURCE, SOURCE_URL, LICENSE, STALE_MS, EXPIRED_MS, REFRESH_MS, forecastUrl, geocodeUrl, parseForecast, parseGeocode, freshness, needsRefresh, codeText, isStorm, windowFor, summarize, tips, coolestHour, round2 };
})(typeof globalThis !== "undefined" ? globalThis : this);
