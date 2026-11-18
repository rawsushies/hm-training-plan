/* WeRunIt plan coach (pure, deterministic). Exposes globalThis.WRI_PLAN.
 *  prescribe(session, ctx) → purpose, warm-up, main set, cool-down, intensity guide, shorter alternative, why.
 *    Intensity is RPE-based by default. A pace hint is shown only when the runner's own recent easy runs support it
 *    (≥ 4 runs with RPE ≤ 4 and pace in the last 8 weeks); no zones are invented.
 *  adapt(week, ctx) → proposals for missed sessions. It never doubles up, never adds load, and never moves a session next
 *    to a hard one. Proposals are applied only after the runner confirms (UI), and each carries its reason.
 */
(function (G) {
  "use strict";
  const p2 = n => String(n).padStart(2, "0");
  const pace = s => `${Math.floor(s / 60)}:${p2(Math.round(s % 60))}`;
  const km = v => (Math.round(v * 10) / 10).toString().replace(".", ",");
  const half = v => Math.max(1, Math.round(v * 2) / 2);
  const parse = s => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); };
  const ymd = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const add = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
  const HARD = t => ["locked", "benchmark", "elevation", "race", "long"].includes(t);

  /** The runner's own easy pace: median pace of recent runs they rated RPE ≤ 4. Null when the evidence is thin. */
  function easyPace(sessions, today) {
    const from = add(today, -56), e = (sessions || []).filter(s => s.date >= from && s.date <= today && s.rpe !== null && s.rpe <= 4 && s.paceSecPerKm);
    return e.length >= 4 ? { pace: median(e.map(s => s.paceSecPerKm)), n: e.length } : null;
  }

  function prescribe(s, ctx = {}) {
    const d = s.dist || 0, ep = ctx.easyPace, hint = ep ? ` Biasanya sekitar ${pace(ep.pace)} /km (median ${ep.n} lari santaimu); kalau terasa lebih berat, ikuti RPE, bukan pace.` : " Belum ada cukup lari santai dengan RPE untuk saran pace; pakai RPE.";
    const warm = "10 menit jogging pelan + ayun kaki dan putar pinggul.", cool = "5–10 menit jogging atau jalan santai.";
    switch (s.type) {
      case "easy": return { purpose: "Membangun daya tahan aerobik dengan beban rendah.", warm: "Mulai 5 menit lebih pelan dari biasanya.", main: `${km(d)} km santai.`, cool, guide: "RPE 3–4: bisa ngobrol dalam kalimat utuh." + hint, alt: `${km(half(d * .6))} km santai, atau 25 menit.`, why: "Sebagian besar volume sebaiknya santai supaya sesi berat tetap berkualitas." };
      case "recovery": return { purpose: "Gerak ringan untuk pemulihan, bukan latihan.", warm: "Langsung mulai sangat pelan.", main: `${km(d)} km sangat santai.`, cool: "Jalan 5 menit.", guide: "RPE 2–3: jauh lebih pelan dari lari santai." + hint, alt: "20 menit jalan cepat atau lewati kalau sangat lelah.", why: "Membantu sirkulasi tanpa menambah kelelahan." };
      case "long": return { purpose: "Memperpanjang daya tahan untuk jarak tujuan.", warm: "2 km pertama paling pelan.", main: `${km(d)} km dengan effort rata.`, cool, guide: "RPE 3–5; bawa minum kalau lebih dari 75 menit." + hint, alt: `${km(half(d * .7))} km dengan effort yang sama.`, why: "Lari panjang rutin adalah dasar untuk 10K ke atas." };
      case "locked": return { purpose: "Latihan effort terkontrol (tempo/interval) untuk menaikkan kecepatan berkelanjutan.", warm, main: s.desc ? String(s.desc) : `${km(d)} km dengan bagian inti di effort terkontrol.`, cool, guide: "Bagian inti RPE 6–7: berat tapi terkendali; pace target hanya jika sudah kamu set sendiri.", alt: "20 menit: 10 menit santai + 3×3 menit RPE 6 dengan 2 menit jogging.", why: "Satu sesi kualitas per minggu cukup; sisanya santai." };
      case "elevation": return { purpose: "Kekuatan kaki dan ekonomi lari di tanjakan.", warm, main: "4–6 × 1–3 menit naik di RPE 5–6, turun pelan.", cool, guide: "Atur effort, bukan pace; pace pasti melambat di tanjakan.", alt: "3 × 1 menit tanjakan.", why: "Tanjakan melatih otot tanpa kecepatan tinggi." };
      case "benchmark": return { purpose: "Tes untuk melihat kemajuan, bukan latihan harian.", warm, main: `${km(d)} km tes.`, cool, guide: "Effort tes yang bisa dipertahankan sampai selesai.", alt: "Tunda tes kalau sangat lelah; hasil tes saat lelah tidak mewakili.", why: "Memberi data pembanding untuk perkiraan finish." };
      case "race": return { purpose: "Hari race.", warm: "Jogging 10 menit + 3 percepatan pendek.", main: `${km(d)} km.`, cool, guide: "Mulai lebih pelan dari target; percepat hanya di paruh akhir kalau terasa baik.", alt: "Kalau sakit atau nyeri sebelum start, jangan memaksakan diri; tidak start lebih baik daripada cedera.", why: "Mulai terlalu cepat adalah kesalahan race yang paling umum." };
      case "strength": return { purpose: "Kekuatan pendukung lari: kaki satu-satu, posterior chain, core.", warm: "5 menit gerak ringan.", main: "2–3 set: split squat, hip hinge/bridge, calf raise, plank samping.", cool: "Peregangan ringan.", guide: "Sisakan 2–3 repetisi di setiap set; tanpa nyeri.", alt: "1 set tiap gerakan, 10 menit.", why: "Membantu otot menahan beban lari; bukan pengganti lari." };
      default: return { purpose: "Lari.", warm, main: d ? `${km(d)} km.` : "Sesuai rencana.", cool, guide: "RPE sesuai rasa.", alt: "Versi lebih pendek dengan effort sama.", why: "" };
    }
  }

  /**
   * Missed-session proposals. week: [{id,date,type,dist,state}] (state: done|skip|missed|today|up), today: YYYY-MM-DD.
   * A missed long run moves to the next free day this week when it is not right next to a hard session; anything else is
   * let go (marked skipped). Never two sessions on a day; never makes up volume.
   */
  function adapt(week, today) {
    const out = [], byDate = {};
    week.forEach(s => { (byDate[s.date] = byDate[s.date] || []).push(s); });
    const end = week.length ? week.map(s => s.date).sort().pop() : today, last = add(week.length ? week.map(s => s.date).sort()[0] : today, 6);
    for (const s of week.filter(x => x.state === "missed" && x.type !== "strength")) {
      let to = null;
      if (s.type === "long") {
        for (let d = add(today, 1); d <= last; d = add(d, 1)) {
          if ((byDate[d] || []).some(x => x.type !== "strength")) continue;
          const near = [add(d, -1), add(d, 1)].some(n => (byDate[n] || []).some(x => HARD(x.type) && x.state !== "skip"));
          if (!near) { to = d; break; }
        }
      }
      out.push(to ? { id: s.id, kind: "move", to, reason: `Long run ${s.date} tidak tercatat. Hari ${to} kosong dan tidak berdempetan dengan sesi berat, jadi long run bisa dipindah ke sana tanpa menumpuk.` }
        : { id: s.id, kind: "skip", reason: `Sesi ${s.date} tidak tercatat. Usulan: lepaskan saja dan lanjutkan jadwal; mengejar sesi yang terlewat dengan menumpuk beban tidak membantu.${s.type === "long" ? " Tidak ada hari kosong yang aman untuk memindahkan long run minggu ini." : ""}` });
    }
    void end;
    return out;
  }

  G.WRI_PLAN = { prescribe, adapt, easyPace };
})(typeof globalThis !== "undefined" ? globalThis : this);
