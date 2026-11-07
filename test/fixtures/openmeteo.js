// Builds a response in the exact shape of Open-Meteo's /v1/forecast (hourly + current, timezone=auto).
// Used by unit and e2e tests so they never depend on the live API. Values are a fixed, synthetic diurnal curve.
export function forecast(startYmd, { days = 3, hot = false, stormHour = null, rainHour = null } = {}) {
  const time = [], T = [], A = [], RH = [], D = [], P = [], PR = [], C = [], W = [], UV = [];
  const [y, m, d] = startYmd.split("-").map(Number);
  for (let i = 0; i < days * 24; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d, i)), hr = i % 24;
    time.push(dt.toISOString().slice(0, 16));
    const t = (hot ? 29 : 24) + (hot ? 5 : 6) * Math.sin(((hr - 9) / 24) * 2 * Math.PI);
    T.push(+t.toFixed(1)); A.push(+(t + (hot ? 5 : 1.5)).toFixed(1)); RH.push(hot ? 78 : 65); D.push(hot ? 25.2 : 17.5);
    const storm = stormHour !== null && i === stormHour, rain = rainHour !== null && i === rainHour;
    P.push(storm || rain ? 80 : 10); PR.push(storm || rain ? 2.4 : 0); C.push(storm ? 95 : rain ? 63 : hr < 6 || hr > 18 ? 1 : 2);
    W.push(9); UV.push(hr >= 10 && hr <= 14 ? (hot ? 10.5 : 7) : hr >= 7 && hr <= 16 ? 4 : 0);
  }
  return {
    latitude: -6.2, longitude: 106.8125, generationtime_ms: 0.3, utc_offset_seconds: 25200, timezone: "Asia/Jakarta", timezone_abbreviation: "GMT+7", elevation: 8,
    current_units: { time: "iso8601", interval: "seconds", temperature_2m: "°C", apparent_temperature: "°C", relative_humidity_2m: "%", precipitation: "mm", weather_code: "wmo code", wind_speed_10m: "km/h" },
    current: { time: time[7], interval: 900, temperature_2m: T[7], apparent_temperature: A[7], relative_humidity_2m: RH[7], precipitation: 0, weather_code: C[7], wind_speed_10m: 9 },
    hourly_units: { time: "iso8601", temperature_2m: "°C", apparent_temperature: "°C", relative_humidity_2m: "%", dew_point_2m: "°C", precipitation_probability: "%", precipitation: "mm", weather_code: "wmo code", wind_speed_10m: "km/h", uv_index: "" },
    hourly: { time, temperature_2m: T, apparent_temperature: A, relative_humidity_2m: RH, dew_point_2m: D, precipitation_probability: P, precipitation: PR, weather_code: C, wind_speed_10m: W, uv_index: UV }
  };
}
export const geocode = { results: [{ id: 1642911, name: "Jakarta", latitude: -6.21462, longitude: 106.84513, elevation: 16, feature_code: "PPLC", country_code: "ID", timezone: "Asia/Jakarta", population: 8540121, country: "Indonesia", admin1: "Jakarta" }], generationtime_ms: 0.25 };
