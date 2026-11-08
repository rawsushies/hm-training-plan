/* Tutorial v3 content: Quick Start, one tour per feature, and contextual help ("?").
 * Each step: {tab, sel, t, b}. `tab` = page to open, `sel` = value of data-tour on the element to
 * highlight (null = no highlight). If an element is missing (e.g. a rest day has no session buttons)
 * the bubble still shows, with a short fallback note. Text describes only what the app really does.
 * Exposes globalThis.HMTP_TUT. */
(function (G) {
  "use strict";
  const QUICK = {
    id: "quick", title: "Mulai cepat", mins: 1,
    steps: [
      { tab: "home", sel: null, t: "Halo, aku Kiki", b: "Pelatih sakumu sampai garis finish. Satu menit, enam langkah." },
      { tab: "home", sel: "hero", t: "Ini lari hari ini", b: "Angka besar itu km-nya. Udah lari? Tap ✓." },
      { tab: "home", sel: "scores", t: "Tiga skor, sekali lirik", b: "Siap, Beban, Tidur. Tap satu buat lihat trennya." },
      { tab: "home", sel: "next", t: "Habis ini apa?", b: "Sesi berikutnya, lengkap sama bentuknya." },
      { tab: "log", sel: "log-new", t: "Catat dalam 5 detik", b: "Tombol oranye. Jaraknya udah aku isiin." },
      { tab: "more", sel: "tut-hub", t: "Aku nggak ke mana-mana", b: "Bingung? Tap ? di halaman mana aja." }
    ]
  };
  const T = {
    dashboard: { title: "Dashboard", steps: [
      { tab: "home", sel: "scores", t: "Tiga angka, satu pagi", b: "Siap = pulih. Beban = berat. Tidur = dari check-in." },
      { tab: "home", sel: "hero", t: "Bentuk latihanmu", b: "Lebar = lama, tinggi = berat. ✓ catat, ▶ timer." },
      { tab: "home", sel: "body", t: "Gimana badanmu?", b: "Satu tap. Aku ubah jadi skor Siap dan Tidur." },
      { tab: "home", sel: "monitor", t: "Lima lampu sinyal", b: "Hijau aman. Tanda ! artinya pelan-pelan." },
      { tab: "home", sel: "week", t: "Minggu ini", b: "Bar = km vs target. Titik penuh = beres." },
      { tab: "home", sel: "next", t: "Habis ini", b: "Sesi setelah hari ini." },
      { tab: "home", sel: "race-chip", t: "Hari menuju race", b: "Tap buat buka tab Race." },
    ] },
    calendar: { title: "Jadwal latihan", steps: [
      { tab: "cal", sel: "cal-mode", t: "Tampilan bulan atau per minggu", b: "Bulan atau per minggu." },
      { tab: "cal", sel: "cal", t: "Kalender & warna sesi", b: "Kotak warna = sesi. Tepi = selesai, pudar = skip." },
      { tab: "cal", sel: "cal-legend", t: "Arti warna", b: "Warna per jenis sesi. Kosong = istirahat." },
      { tab: "cal", sel: "cal-day", t: "Detail hari", b: "Tap tanggal: sesi, jarak, rencana vs aktual." },
      { tab: "cal", sel: "cal-actions", t: "Skip, edit, pindah hari", b: "Skip, edit, atau pindah hari. Bisa dibatalkan." },
      { tab: "cal", sel: null, t: "Istirahat, cutback, taper", b: "Tiap minggu ke-4 ringan. Minggu 28–30 taper." }
    ] },
    log: { title: "Log lari", steps: [
      { tab: "log", sel: "log-new", t: "Catat lari manual", b: "Jarak + waktu, atau jarak + pace." },
      { tab: "log", sel: null, t: "Kolom opsional", b: "HR, RPE, tanjakan, sepatu: opsional." },
      { tab: "log", sel: null, t: "Nyambungin ke sesi terjadwal", b: "Pilih sesi di jadwal supaya sesi itu selesai." },
      { tab: "log", sel: "log-filter", t: "Filter & urutan", b: "Saring bulan, jenis, jarak. Urutkan." },
      { tab: "log", sel: "log-list", t: "Edit atau hapus", b: "Tap lari untuk edit atau hapus." }
    ] },
    import: { title: "Import aktivitas", steps: [
      { tab: "log", sel: "import", t: "Format yang didukung", b: "GPX, TCX, atau activities.csv Strava." },
      { tab: "log", sel: "import", t: "Alur import", b: "Pilih file → centang → simpan. Sesi dicocokkan otomatis." },
      { tab: "log", sel: "import", t: "Deteksi duplikat", b: "Lari yang sudah ada ditandai dan tidak dicentang." },
      { tab: "log", sel: "import-help", t: "Cek sebelum simpan", b: "Semua bisa diedit setelah disimpan." }
    ] },
    timer: { title: "Workout timer", steps: [
      { tab: "home", sel: "timer-btn", t: "Mulai", b: "▶ di sesi mana pun. Tanpa GPS." },
      { tab: "home", sel: null, t: "Bagian-bagian latihan", b: "Pemanasan → kerja → jog → pendinginan." },
      { tab: "home", sel: null, t: "Bunyi, getar, pindah bagian", b: "Bunyi + getar saat ganti bagian." },
      { tab: "home", sel: null, t: "Jeda, lanjut, batal", b: "Jeda, lanjut, atau batal." },
      { tab: "home", sel: null, t: "Selesai & simpan", b: "Selesai membuka form dengan waktu terisi." }
    ] },
    locked: { title: "Locked-in", steps: [
      { tab: "locked", sel: null, t: "Tujuannya", b: "Jaga pace stabil, bukan secepat mungkin." },
      { tab: "locked", sel: "locked-pace", t: "Pace yang disepakati", b: "Pace target sesi ini." },
      { tab: "locked", sel: "locked-steps", t: "Urutannya", b: "Pemanasan, set kerja, pendinginan." },
      { tab: "locked", sel: "locked-actions", t: "Atur target", b: "Ubah pace, ulangan, jeda." },
      { tab: "locked", sel: "locked-hist", t: "Hasil vs target", b: "Beda ≤10 dtk = pace terjaga." }
    ] },
    elev: { title: "Elevation", steps: [
      { tab: "elev", sel: null, t: "Tujuannya", b: "Sebulan sekali, ganti long run Sabtu." },
      { tab: "elev", sel: "elev-list", t: "Target naik", b: "Target meter naik." },
      { tab: "elev", sel: "elev-list", t: "Mencatat sesi", b: "Catat sesi, isi tanjakan." },
      { tab: "elev", sel: "elev-chart", t: "Target vs aktual", b: "Abu = target, warna = aktual." }
    ] },
    strength: { title: "Strength", steps: [
      { tab: "strength", sel: "str-kind", t: "Strength A dan B", b: "A = kaki. B = inti dan betis." },
      { tab: "strength", sel: "str-sets", t: "Jumlah set", b: "1 atau 2 set." },
      { tab: "strength", sel: "str-ex", t: "Gerakan & cara", b: "Centang gerakan yang selesai." },
      { tab: "strength", sel: "str-save", t: "Simpan sesi", b: "Simpan. Sesi di jadwal ikut selesai." },
      { tab: "strength", sel: "str-next", t: "Jadwal & riwayat", b: "Jadwal berikutnya dan riwayat." }
    ] },
    recovery: { title: "Check-in harian", steps: [
      { tab: "recovery", sel: "ci-rate", t: "Enam pertanyaan", b: "Enam skala 1–5. 20 detik." },
      { tab: "recovery", sel: "ci-result", t: "Indikator kesiapan", b: "Hijau = lari, kuning = santai, merah = istirahat." },
      { tab: "recovery", sel: "ci-result", t: "Ini bukan diagnosa", b: "Bukan diagnosa. Nyeri berulang = periksa." },
      { tab: "recovery", sel: "ci-hist", t: "Riwayat", b: "Riwayat check-in." }
    ] },
    review: { title: "Review bulanan", steps: [
      { tab: "review", sel: "review", t: "Pilih bulan", b: "Pilih bulan." },
      { tab: "review", sel: "rev-table", t: "Rencana vs aktual", b: "Rencana vs aktual." },
      { tab: "review", sel: "rev-sum", t: "Yang membaik, stabil, perlu dibenahi", b: "Naik, stabil, atau ulang." },
      { tab: "review", sel: "rev-notes", t: "Catatan kamu", b: "Catatan pribadi." },
      { tab: "review", sel: "rev-charts", t: "Grafik", b: "Grafik per minggu." }
    ] },
    race: { title: "Race plan", steps: [
      { tab: "race", sel: "rp-input", t: "Target finish & strategi", b: "Target finish + strategi." },
      { tab: "race", sel: "rp-table", t: "Pace per km", b: "Pace dan waktu tiap km." }
    ] },
    shoes: { title: "Sepatu", steps: [
      { tab: "shoes", sel: "shoe-add", t: "Tambah sepatu", b: "Nama + batas km." },
      { tab: "shoes", sel: "shoe-list", t: "Default, km, pensiun", b: "Default, km, pensiun." },
      { tab: "shoes", sel: "shoe-list", t: "Lari tanpa sepatu", b: "Pasang sepatu ke lari lama sekaligus." }
    ] },
    goals: { title: "Goals & badge", steps: [
      { tab: "goals", sel: "goal-main", t: "Goal utama", b: "Goal race kamu." },
      { tab: "goals", sel: "goal-ms", t: "Milestone", b: "Milestone dari data." },
      { tab: "goals", sel: "goal-badges", t: "Badge", b: "Badge dari lari asli." },
      { tab: "goals", sel: "goal-check", t: "Checklist race day", b: "Checklist race day." }
    ] },
    pace: { title: "Pace calculator", steps: [
      { tab: "pace", sel: "pc", t: "Dari jarak & waktu", b: "Jarak + waktu → pace dan perkiraan." },
      { tab: "pace", sel: "pp", t: "Dari target pace", b: "Pace → waktu tempuh." },
      { tab: "pace", sel: null, t: "Cuma perkiraan", b: "Perkiraan, bukan janji." }
    ] },
    data: { title: "Data & backup", steps: [
      { tab: "data", sel: "data-sync", t: "Status data", b: "Di mana datamu tersimpan." },
      { tab: "data", sel: "data-export", t: "Export", b: "JSON = backup, CSV = spreadsheet." },
      { tab: "data", sel: "data-import", t: "Import backup", b: "Gabungkan atau ganti. Backup dibuat dulu." },
      { tab: "data", sel: "data-backups", t: "Kenapa tetap backup?", b: "Backup sesekali tetap berguna." }
    ] },
    account: { title: "Akun & teman", steps: [
      { tab: "more", sel: "acct", t: "Masuk dengan Google", b: "Masuk dan sync antar perangkat." },
      { tab: "more", sel: "acct", t: "Sync & ganti akun", b: "Status sync dan ganti akun." },
      { tab: "bareng", sel: "groups", t: "Tambah teman", b: "Link undangan 7 hari, sekali pakai." },
      { tab: "bareng", sel: "share-toggle", t: "Privat per teman", b: "Pilih apa yang dibagi per teman." }
    ] },
    settings: { title: "Settings", steps: [
      { tab: "settings", sel: "st-days", t: "Hari & jam latihan", b: "Hari dan jam latihan." },
      { tab: "settings", sel: "st-dates", t: "Tanggal mulai & race", b: "Tanggal mulai dan race." },
      { tab: "settings", sel: "st-goal", t: "Target & satuan", b: "Target dan satuan." },
      { tab: "settings", sel: "st-theme", t: "Tampilan", b: "Gelap, terang, atau ikut HP." }
    ] },
    notif: { title: "Notifikasi", steps: [
      { tab: "notif", sel: null, t: "Di aplikasi Android", b: "Pengingat dikirim aplikasi Android." },
      { tab: "notif", sel: "notif-prefs", t: "Pilihan per kategori", b: "Nyalakan per kategori." },
      { tab: "notif", sel: "notif-preview", t: "Pratinjau", b: "Pengingat 7 hari ke depan." }
    ] }
  };
  const ORDER = ["dashboard", "calendar", "log", "import", "timer", "locked", "elev", "strength", "recovery", "review", "race", "shoes", "goals", "pace", "data", "account", "settings", "notif"];
  for (const k of ORDER) T[k].id = k;

  /* Contextual help per page: what / why / how / example / warning, plus which tour to start. */
  const HELP = {
    home: { tour: "dashboard", title: "Hari ini", what: "Latihan hari ini sebagai angka dan bentuk, check-in satu tap, minggu ini, dan sesi berikutnya.", why: "Biar sekali buka langsung tahu harus ngapain hari ini dan sejauh mana progresnya.", how: ["Lihat “Hari ini” buat sesi hari ini.", "Mulai timer atau catat lari dari “Workout berikutnya”.", "Tap sesi mana pun buat detailnya."], ex: "Selasa malam: buka app → “▶ Mulai timer” → lari → “Selesai” → cek jarak → simpan.", warn: "“Udah lari” menghitung semua log di tanggal minggu itu, termasuk lari di luar jadwal." },
    cal: { tour: "calendar", title: "Jadwal latihan", what: "Semua sesi 31 minggu dalam tampilan bulan atau per minggu.", why: "Buat lihat ke depan, dan ngatur ulang sesi kalau ada halangan.", how: ["Tap tanggal buat lihat sesinya.", "Pakai Skip, Edit, atau Pindah hari di detail sesi.", "Ganti ke “Per minggu” buat lihat target dan km aktual tiap minggu."], ex: "Sabtu ada acara: buka long run Sabtu → “Pindah hari” → pilih Jumat → app ngingetin kalau nempel sama lari lain.", warn: "Rabu nggak bisa dipilih buat pindah hari. Sesi yang udah dicatat nggak bisa dipindah atau di-skip." },
    log: { tour: "log", title: "Log lari", what: "Daftar semua lari yang kamu catat, manual atau hasil import.", why: "Semua angka di app (progres, review, goal, badge) dihitung dari log ini.", how: ["“Catat lari” buat isi manual.", "Pilih file GPX/TCX/CSV buat import.", "Tap baris buat edit atau hapus."], ex: "Habis lari pakai jam: “Catat lari” → tanggal, 5 km, 35:00 → pilih sesi di jadwal → simpan.", warn: "App ini nggak merekam GPS sendiri. Satu sesi terjadwal cuma bisa punya satu catatan." },
    review: { tour: "review", title: "Review bulanan", what: "Rangkuman tiap blok ±4 minggu: rencana vs aktual, perbandingan sama bulan lalu, saran lanjut/ulang, catatan, dan grafik.", why: "Buat mutusin naik beban atau ulang dulu berdasarkan data, bukan kalender.", how: ["Pilih bulan di atas.", "Baca bagian membaik/stabil/perlu dibenahi.", "Isi catatan kamu lalu simpan."], ex: "Akhir Desember: buka Des → lihat km naik dari Nov → isi “satu hal yang mau dibenahi”.", warn: "Saran lanjut/ulang baru muncul setelah bulannya selesai. Kalau datanya kurang, app bilang belum bisa dibandingin." },
    more: { tour: "account", title: "Menu & akun", what: "Akun Google, status sync, dan semua fitur lain.", why: "Satu tempat buat akun dan fitur pendukung.", how: ["“Masuk dengan Google” buat sync.", "Pilih fitur dari daftar.", "“Tutorial & bantuan” buat tur per fitur."], ex: "Ganti HP: masuk dengan akun Google yang sama di HP baru, data ikut.", warn: "Tanpa masuk, data cuma ada di perangkat ini. Export backup sesekali." },
    bareng: { tour: "account", title: "Bareng teman", what: "Grup latihan buat bandingin ringkasan progres sama teman.", why: "Saling semangatin tanpa buka detail latihan masing-masing.", how: ["Bikin grup atau buka link undangan.", "Nyalain “Bagikan ringkasan progres” kalau mau ikut kelihatan.", "Pemilik grup bisa bikin link undangan dan ngeluarin anggota."], ex: "Bikin grup “Lari Kantor” → “Bikin link undangan” → kirim ke teman → teman masuk pakai Google → gabung.", warn: "Default privat. Yang dibagikan cuma angka ringkasan. Link undangan cuma berlaku 7 hari dan sekali pakai." },
    locked: { tour: "locked", title: "Locked-in", what: "Layar khusus sesi locked-in dan benchmark: target pace, urutan, hasil.", why: "Latihan jaga pace yang terkontrol dan ngecek progres.", how: ["Atur target pace/struktur.", "Mulai timer atau catat hasil.", "Bandingkan pace aktual vs target."], ex: "Week 6: set pace 7:30 → timer 3 × 5 menit → catat → beda 6 detik = pace kejaga.", warn: "Lebih cepat dari target bukan berarti lebih bagus. Badan belum siap? Turunin target atau ganti easy run." },
    elev: { tour: "elev", title: "Elevation", what: "Sesi tanjakan bulanan yang gantiin long run Sabtu.", why: "Kaki lebih kuat dan terbiasa naik-turun.", how: ["Set target naik (meter).", "Catat sesi, isi tanjakan aktual.", "Lihat grafik target vs aktual."], ex: "Week 7: target 120 m → lari rute bukit → catat 7 km, tanjakan 135 m.", warn: "Jangan sprint di tanjakan. Turunan juga berat buat lutut, turun pelan." },
    strength: { tour: "strength", title: "Strength", what: "Latihan tanpa alat, A (kaki & keseimbangan) dan B (perut, pinggul, betis).", why: "Mengurangi risiko cedera dan bikin lari lebih stabil.", how: ["Pilih A atau B dan jumlah set.", "Centang gerakan yang beres.", "Simpan sesi."], ex: "Senin malam: Strength A, 2 set, centang 5 gerakan → simpan.", warn: "Berhenti 2–3 repetisi sebelum benar-benar nggak kuat. Jangan yang berat sehari sebelum long run." },
    recovery: { tour: "recovery", title: "Check-in harian", what: "Enam pertanyaan singkat tentang kondisi badan.", why: "Bantu mutusin latihan sesuai rencana, dibikin ringan, atau istirahat.", how: ["Isi 6 skala 1–5.", "Baca indikator kesiapan.", "Simpan check-in."], ex: "Bangun pegal dan kurang tidur → “Santai dulu” → long run dipendekin.", warn: "Ini panduan sederhana, bukan diagnosa medis. Nyeri tajam, pusing, nyeri dada, atau sesak: stop dan cari bantuan medis." },
    goals: { tour: "goals", title: "Goals & badge", what: "Goal utama, milestone, badge, dan checklist race day.", why: "Lihat progres jangka panjang dari data asli.", how: ["Edit judul/target goal.", "Lihat badge yang kebuka.", "Centang checklist race day."], ex: "Long run 16 km pertama → milestone “Long run” tercapai.", warn: "Contoh data nggak dihitung di badge." },
    race: { tour: "race", title: "Race plan", what: "Pace per km buat race day dari target finish.", why: "Biar nggak kecepatan di awal dan tahu posisi waktu di tiap km.", how: ["Isi target finish.", "Pilih strategi.", "Cocokin waktu kumulatif dengan cut-off."], ex: "Target 3:20:00, mulai pelan → km 1–5 di 9:43 /km.", warn: "Ini hitungan, bukan jaminan hasil." },
    shoes: { tour: "shoes", title: "Sepatu", what: "Jarak tempuh tiap sepatu dari log lari.", why: "Tahu kapan sepatu mulai aus dan nyiapin sepatu race.", how: ["Tambah sepatu.", "Set default.", "Pilih sepatu di tiap catatan lari."], ex: "Sepatu harian udah 640/700 km → peringatan → mulai biasain sepatu baru.", warn: "Batas km cuma perkiraan kasar. Cek kondisi sol dan rasa di kaki." },
    pace: { tour: "pace", title: "Pace calculator", what: "Hitung pace dan perkiraan waktu di jarak lain.", why: "Buat nentuin target yang masuk akal.", how: ["Isi jarak & waktu, atau isi pace."], ex: "5K 35:00 → perkiraan half marathon sekitar 2:42.", warn: "Perkiraan Riegel makin kasar kalau beda jaraknya jauh." },
    settings: { tour: "settings", title: "Settings", what: "Hari latihan, jam, tanggal, target, satuan, tampilan.", why: "Menyesuaikan jadwal sama hidup kamu.", how: ["Ubah nilainya lalu “Simpan settings”."], ex: "Kerja Selasa sampai malam → ganti hari lari weekday ke Kamis.", warn: "Ganti hari weekday menghapus pindahan tanggal di sesi weekday & strength. Ganti tanggal mulai menggeser semua tanggal sesi." },
    data: { tour: "data", title: "Data & backup", what: "Status sync, export/import, backup otomatis, konflik.", why: "Biar data kamu aman dan bisa dipindah.", how: ["Export JSON berkala.", "Import pakai “Gabungkan” biar nggak ada yang hilang.", "Pulihkan dari backup otomatis kalau perlu."], ex: "Pindah dari versi lama: export JSON di app lama → import di sini → Gabungkan.", warn: "Reset dan “Ganti semua” juga berlaku di akun yang ke-sync." },
    guide: { tour: null, title: "Panduan latihan", what: "Ringkasan panduan latihan dari PDF.", why: "Referensi cepat soal jenis lari, pemulihan, minum, dan race day.", how: ["Buka bagian yang mau dibaca."], ex: "", warn: "" },
    kamus: { tour: null, title: "Kamus istilah", what: "Arti istilah lari yang dipakai di app.", why: "Biar semua istilah gampang dipahami.", how: ["Scroll atau tap kata bergaris titik di halaman lain."], ex: "", warn: "" },
    notif: { tour: "notif", title: "Notifikasi", what: "Pengingat latihan, race, dan minum dari jadwal kamu, di aplikasi Android.", why: "Biar nggak lupa sesi dan persiapan race, tanpa harus buka app.", how: ["Nyalakan notifikasi dan pilih kategorinya.", "Atur waktu dan jam tenang, lalu simpan (Android minta izin sekali).", "Cek pratinjau 7 hari ke depan."], ex: "Long run Minggu 06:00 → pengingat Sabtu malam dan 1 jam sebelumnya.", warn: "Versi web nggak mengirim notifikasi. Android bisa menggeser waktunya beberapa menit untuk hemat baterai." },
    about: { tour: null, title: "Tentang & update", what: "Versi app yang lagi jalan dan update otomatis.", why: "Supaya perbaikan dan fitur baru sampai ke kamu tanpa install ulang.", how: ["Biarkan “Update otomatis” nyala.", "Atau tap “Cek update sekarang”, lalu “Perbarui sekarang”."], ex: "Ada versi baru → banner muncul di atas → tap “Perbarui sekarang” → app dimuat ulang dengan versi baru, data tetap.", warn: "Update nggak pernah dipasang di tengah timer. Perubahan di bagian Android tertentu tetap butuh install APK baru." },
    tutorials: { tour: "quick", title: "Tutorial", what: "Semua tur: mulai cepat dan tur per fitur.", why: "Belajar satu fitur tanpa harus ngulang semuanya.", how: ["Pilih tur, ikuti langkahnya, tutup kapan aja."], ex: "", warn: "" }
  };
  G.HMTP_TUT = { QUICK, TOURS: T, ORDER, HELP, VERSION: 3 };
})(typeof globalThis !== "undefined" ? globalThis : this);
