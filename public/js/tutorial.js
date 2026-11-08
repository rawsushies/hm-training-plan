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
      { tab: "home", sel: null, t: "Kenalan sama Kiki", b: "Selamat datang di WeRunIt! Aku temen lari kamu di sini. WeRunIt nyimpen rencana latihan 31 minggu kamu, nyatet lari, dan ngerangkum progres. Yuk kenalan 6 langkah aja." },
      { tab: "home", sel: "hero", t: "Latihan hari ini", b: "Angka besar = jarak hari ini. Balok di bawahnya = bentuk latihannya: abu-abu = pemanasan/pendinginan, putih = lari santai, oranye = bagian berat. Tap “✓ Selesai” kalau udah lari sesuai rencana, atau “Mulai” buat timer." },
      { tab: "home", sel: "scores", t: "Skor harian", b: "Siap, Beban, Tidur: tiga skor 0–100 kayak di jam olahraga. Siap ngasih target beban hari ini. Tap skor buat lihat grafik 30 hari." },
      { tab: "home", sel: "next", t: "Berikutnya", b: "Sesi terdekat setelah hari ini, lengkap dengan bentuk latihannya. Tap buat detail." },
      { tab: "log", sel: "log-new", t: "Catat lari", b: "Tombol oranye “+” atau “Catat”: jarak udah keisi dari rencana, tinggal geser +/−, isi waktu kalau ada, pilih effort, Simpan. Pace dihitung otomatis." },
      { tab: "more", sel: "tut-hub", t: "Butuh bantuan?", b: "Di tab Kamu → “Tutorial” ada tur per fitur. Tiap halaman juga punya tombol “?” buat penjelasan singkat." }
    ]
  };
  const T = {
    dashboard: { title: "Dashboard", steps: [
      { tab: "home", sel: "scores", t: "Siap, Beban, Tidur", b: "Tiga skor harian 0–100. Siap = seberapa pulih badanmu (check-in dibanding biasanya + kesegaran latihan). Beban = seberapa berat latihan hari ini. Tidur = kualitas tidur dari check-in. Tap salah satu buat grafik 30 hari." },
      { tab: "home", sel: "hero", t: "Latihan hari ini", b: "Angka besar = jarak hari ini. Balok = bentuk latihan: lebar = lama, tinggi = berat, oranye = bagian inti. “✓ Selesai” mencatat jarak rencana, “Mulai” buka timer." },
      { tab: "home", sel: "body", t: "Badan hari ini", b: "Satu tap: Segar, Oke, Capek, atau Nyeri. Itu jadi check-in harian yang ngisi skor Siap dan Tidur." },
      { tab: "home", sel: "monitor", t: "Monitor badan", b: "Lima sinyal: tidur, energi, pegal, nyeri, dan rasio beban 7:28 hari. Centang hijau = dalam rentang aman, tanda seru = perlu diperhatiin." },
      { tab: "home", sel: "week", t: "Sesi minggu ini", b: "Bar = km minggu ini dibanding target. Bulatan = sesi: penuh = selesai, cincin oranye = hari ini, garis putus merah = kelewat." },
      { tab: "home", sel: "next", t: "Berikutnya", b: "Sesi berikutnya setelah hari ini, dengan bentuk latihannya." },
      { tab: "home", sel: "race-chip", t: "Hitung mundur race", b: "Sisa hari ke race. Tap buat tab Race: kesiapan race, rasio beban, rekor, dan strategi." },
    ] },
    calendar: { title: "Jadwal latihan", steps: [
      { tab: "cal", sel: "cal-mode", t: "Tampilan bulan atau per minggu", b: "“Bulan” nampilin kalender. “Per minggu” nampilin 31 minggu berurutan dengan target, km aktual, dan semua sesi (termasuk strength)." },
      { tab: "cal", sel: "cal", t: "Kalender & warna sesi", b: "Kotak kecil berwarna = sesi di hari itu. Warnanya sesuai jenis (lihat keterangan di bawah). Kotak bergaris tepi = udah selesai, pudar = di-skip. Rabu bergaris miring karena Rabu malam sengaja dikosongin." },
      { tab: "cal", sel: "cal-legend", t: "Arti warna", b: "Easy, Long, Recovery, Locked-in, Elevation, Benchmark, Race, Strength, dan Istirahat. Hari tanpa kotak = hari istirahat." },
      { tab: "cal", sel: "cal-day", t: "Detail hari", b: "Tap tanggal buat lihat sesinya di sini: jarak, jam, keterangan, dan kalau udah dicatat, perbandingan rencana → aktual." },
      { tab: "cal", sel: "cal-actions", t: "Skip, edit, pindah hari", b: "“Skip” nandain sesi dilewati (bisa dibatalin). “Edit” ngubah nama, jarak, atau keterangan sesi; target asli dari PDF tetap kelihatan. “Pindah hari” mindahin sesi ke tanggal lain (bukan Rabu, dan masih di masa latihan); app ngasih peringatan kalau nempel sama lari lain." },
      { tab: "cal", sel: null, t: "Istirahat, cutback, taper", b: "Hari tanpa sesi = istirahat (boleh jalan santai). Tiap minggu ke-4 adalah minggu ringan (cutback) dengan benchmark. Minggu 28–30 adalah taper: jarak turun supaya kaki segar di race day minggu 31." }
    ] },
    log: { title: "Log lari", steps: [
      { tab: "log", sel: "log-new", t: "Catat lari manual", b: "Tap “Catat lari”. Isi tanggal, jenis lari, jarak (km), dan waktu total (mm:ss atau j:mm:ss). Nggak tahu waktunya? Isi pace aja, waktu dihitung dari pace × jarak." },
      { tab: "log", sel: null, t: "Kolom opsional", b: "Tanjakan (meter naik), HR rata-rata dan HR tertinggi (detak jantung), RPE 1–10 (seberapa capek rasanya), cuaca, sepatu, dan catatan. Semua opsional, tapi RPE dan catatan bikin review bulanan lebih berguna." },
      { tab: "log", sel: null, t: "Nyambungin ke sesi terjadwal", b: "Kolom “Sesi di jadwal” nampilin sesi ±7 hari dari tanggal lari yang belum punya catatan. Pilih sesinya supaya sesi itu jadi “Selesai”. Satu sesi cuma bisa punya satu catatan." },
      { tab: "log", sel: "log-filter", t: "Filter & urutan", b: "Saring per bulan, jenis, atau jarak, dan urutkan dari terbaru, pace tercepat, terjauh, atau tanjakan terbanyak. Di bawahnya ada total km dan pace rata-rata hasil filter." },
      { tab: "log", sel: "log-list", t: "Edit atau hapus", b: "Tap baris lari buat edit. Tombol “Hapus” ada di form edit, dan minta konfirmasi dulu." }
    ] },
    import: { title: "Import aktivitas", steps: [
      { tab: "log", sel: "import", t: "Format yang didukung", b: "File GPX atau TCX (satu lari per file, dari Strava, Garmin, Huawei, dll) dan activities.csv dari export akun Strava (banyak lari sekaligus). File FIT belum didukung." },
      { tab: "log", sel: "import", t: "Alur import", b: "Pilih file → app baca tanggal, jarak, waktu, tanjakan, dan HR → muncul daftar buat dicentang. Lari yang tanggalnya pas sama sesi terjadwal otomatis dicocokin ke sesi itu." },
      { tab: "log", sel: "import", t: "Deteksi duplikat", b: "Lari yang udah ada (tanggal sama dan jarak beda ≤150 m, atau ID aktivitas yang sama) ditandai “Udah ada” dan nggak dicentang. Kamu tetap bisa centang manual kalau memang beda." },
      { tab: "log", sel: "import-help", t: "Cek sebelum simpan", b: "Waktu dari GPX = durasi rekaman dari awal sampai akhir, termasuk berhenti. Setelah disimpan, semua bisa diedit seperti catatan biasa. “Cara ambil file-nya” jelasin langkah export dari tiap aplikasi." }
    ] },
    timer: { title: "Workout timer", steps: [
      { tab: "home", sel: "timer-btn", t: "Mulai", b: "Tap “▶ Mulai timer” di sesi mana pun (Home, Jadwal, atau Locked-in). Layar dijaga tetap nyala kalau browser mendukung. Timer ini nggak pakai GPS." },
      { tab: "home", sel: null, t: "Bagian-bagian latihan", b: "Easy/long/recovery: satu bagian, timer jalan terus. Interval & tempo: pemanasan 10 menit → lari kerja → jogging pemulihan (diulang sesuai jumlah set) → pendinginan 5 menit. Benchmark & elevation: pemanasan → bagian inti (tap “Lanjut” kalau beres) → pendinginan." },
      { tab: "home", sel: null, t: "Bunyi, getar, pindah bagian", b: "3 detik terakhir tiap bagian ada bunyi, dan pas ganti bagian ada bunyi + getar. Bagian berdurasi pindah otomatis; “Lanjut ›” buat pindah lebih awal." },
      { tab: "home", sel: null, t: "Jeda, lanjut, batal", b: "“Jeda” menghentikan hitungan, “Lanjut timer” melanjutkan. “Batalin tanpa nyimpen” menutup timer tanpa catatan. Kalau halaman ketutup, timer dilanjutin pas app dibuka lagi." },
      { tab: "home", sel: null, t: "Selesai & simpan", b: "“Selesai” menutup timer dan membuka form catatan lari dengan waktu total udah keisi dan jarak dari rencana. Ganti jaraknya sesuai jam/aplikasi kamu, lalu simpan." }
    ] },
    locked: { title: "Locked-in", steps: [
      { tab: "locked", sel: null, t: "Tujuannya", b: "Tiap 2 minggu ada sesi locked-in: minggu ke-2 latihan jaga pace/effort (interval atau tempo), minggu ke-4 benchmark. Tujuannya lari stabil di target, bukan secepat mungkin." },
      { tab: "locked", sel: "locked-pace", t: "Pace yang disepakati", b: "Pace target sesi ini. Kalau belum diset, patokannya RPE. Lari bareng teman? Sepakati satu pace ini." },
      { tab: "locked", sel: "locked-steps", t: "Urutannya", b: "Pemanasan, lalu set kerja (jumlah ulangan × menit lari) diselingi jogging santai, lalu pendinginan. Angka-angka ini yang dipakai timer." },
      { tab: "locked", sel: "locked-actions", t: "Atur target", b: "“Atur target” ngubah jenis sesi, pace, target waktu, RPE, jumlah ulangan, lama lari, jeda, jarak benchmark, atau time attack. “Pakai pace ini buat sesi berikutnya” nyalin pace ke semua sesi locked-in/benchmark yang belum dicatat." },
      { tab: "locked", sel: "locked-hist", t: "Hasil vs target", b: "Setelah dicatat, app bandingin pace aktual sama target. Beda ≤10 detik = pace kejaga (ini juga dihitung di goal “Jaga pace”). Grafik dan tabel nunjukin semua sesi yang udah ada waktunya." }
    ] },
    elev: { title: "Elevation", steps: [
      { tab: "elev", sel: null, t: "Tujuannya", b: "Sebulan sekali sesi tanjakan gantiin long run Sabtu (bukan tambahan). Melatih kaki dan napas di tanjakan dengan effort stabil." },
      { tab: "elev", sel: "elev-list", t: "Target naik", b: "“Set target naik” = target total meter tanjakan (elevation gain) buat sesi itu. Sesuaikan sama rute yang ada." },
      { tab: "elev", sel: "elev-list", t: "Mencatat sesi", b: "“Catat sesi” buka form catatan lari. Isi kolom Tanjakan (m) dari jam/aplikasi, plus catatan rute. File GPX/TCX yang di-import juga ngisi tanjakan otomatis." },
      { tab: "elev", sel: "elev-chart", t: "Target vs aktual", b: "Grafik: abu-abu = target, berwarna = aktual per sesi elevation. Total tanjakan semua lari juga ada di Home dan di grafik Review. Jarak sesi elevation biasanya lebih pendek dari long run karena effort-nya lebih berat." }
    ] },
    strength: { title: "Strength", steps: [
      { tab: "strength", sel: "str-kind", t: "Strength A dan B", b: "A = kaki dan keseimbangan (±15–25 menit). B = perut, pinggul, dan betis, lebih ringan. Semua cuma pakai berat badan." },
      { tab: "strength", sel: "str-sets", t: "Jumlah set", b: "Pilih 1 atau 2 set. Minggu pertama atau kaki masih pegal, 1 set cukup." },
      { tab: "strength", sel: "str-ex", t: "Gerakan & cara", b: "Tiap gerakan ada repetisi, cara melakukan, kuncinya, dan salah yang sering. Centang kotak di kiri tiap gerakan yang udah kamu kerjakan." },
      { tab: "strength", sel: "str-save", t: "Simpan sesi", b: "Pilih tanggal lalu “Simpan sesi strength” (minimal satu gerakan dicentang). Kalau dibuka dari jadwal, sesi itu otomatis jadi “Selesai”; kalau nggak, app nyari sesi strength sejenis di minggu itu." },
      { tab: "strength", sel: "str-next", t: "Jadwal & riwayat", b: "Jadwal strength berikutnya dan riwayat sesi yang udah dicatat. Riwayat bisa dihapus kalau salah catat." }
    ] },
    recovery: { title: "Check-in harian", steps: [
      { tab: "recovery", sel: "ci-rate", t: "Enam pertanyaan", b: "Tidur, otot pegal, kaki capek, tenaga, semangat, dan nyeri, masing-masing skala 1–5. Butuh ±20 detik. Satu check-in per tanggal; isi lagi di tanggal yang sama = menimpa." },
      { tab: "recovery", sel: "ci-result", t: "Indikator kesiapan", b: "Rata-rata sederhana dari 6 jawaban (pegal, capek, dan nyeri dibalik). ≥3,8 = “Siap lari”, ≥2,8 = “Santai dulu”, di bawahnya = “Mending istirahat”. Nyeri 4–5 selalu = istirahat, nyeri 3 menurunkan “Siap” jadi “Santai”." },
      { tab: "recovery", sel: "ci-result", t: "Ini bukan diagnosa", b: "Indikator ini cuma patokan kasar, bukan penilaian medis. Kalau nyeri muncul berulang (2 dari 3 check-in terakhir), app ngasih peringatan buat kurangi latihan dan konsultasi ke dokter atau fisioterapis." },
      { tab: "recovery", sel: "ci-hist", t: "Riwayat", b: "10 check-in terakhir. Rata-rata skornya juga muncul di Review bulanan." }
    ] },
    review: { title: "Review bulanan", steps: [
      { tab: "review", sel: "review", t: "Pilih bulan", b: "Program dibagi 8 blok (Nov–Jun). Tap bulan buat lihat review blok itu." },
      { tab: "review", sel: "rev-table", t: "Rencana vs aktual", b: "Km, sesi lari, lari terjauh, pace rata-rata, benchmark terbaik, tanjakan, strength, dan skor check-in. Semuanya dari data yang kamu catat." },
      { tab: "review", sel: "rev-sum", t: "Yang membaik, stabil, perlu dibenahi", b: "App bandingin sama bulan sebelumnya (kalau ada datanya) dan ngasih saran lanjut atau ulang beban. Kalau datanya kurang, app bilang belum bisa dibandingin." },
      { tab: "review", sel: "rev-notes", t: "Catatan kamu", b: "Empat pertanyaan: yang paling oke, yang paling berat, pemulihan, dan satu hal yang mau dibenahi. Tap “Simpan catatan”. Catatan ini privat." },
      { tab: "review", sel: "rev-charts", t: "Grafik", b: "Km per minggu, pace per minggu, long run Sabtu, tanjakan, dan seberapa rutin per bulan." }
    ] },
    race: { title: "Race plan", steps: [
      { tab: "race", sel: "rp-input", t: "Target finish & strategi", b: "Isi target finish (j:mm:ss) untuk 21,1 km. “Rata” = pace sama tiap km. “Mulai pelan” = 5 km pertama ±15 detik/km lebih lambat, sisanya sedikit lebih cepat supaya total waktunya tetap sama." },
      { tab: "race", sel: "rp-table", t: "Pace per km", b: "Tabel pace tiap km dan waktu kumulatif di tiap titik, plus catatan strategi per bagian (km 0–5, 5–10, dst). Cocokin kolom waktu sama cut-off resmi di race guide." }
    ] },
    shoes: { title: "Sepatu", steps: [
      { tab: "shoes", sel: "shoe-add", t: "Tambah sepatu", b: "Isi nama dan batas km perkiraan (default 700). Sepatu pertama otomatis jadi default." },
      { tab: "shoes", sel: "shoe-list", t: "Default, km, pensiun", b: "Sepatu default otomatis dipilih di form catatan lari dan di import. Km tiap sepatu = jumlah jarak lari yang pakai sepatu itu. Mendekati batas (≥90%) ada peringatan. “Pensiunkan” nyembunyiin sepatu dari pilihan." },
      { tab: "shoes", sel: "shoe-list", t: "Lari tanpa sepatu", b: "Kalau ada lari yang belum ada sepatunya, muncul tombol buat masang semuanya ke sepatu default." }
    ] },
    goals: { title: "Goals & badge", steps: [
      { tab: "goals", sel: "goal-main", t: "Goal utama", b: "Judul dan target race kamu (bisa diedit). Tercentang otomatis pas kamu mencatat lari di sesi race day." },
      { tab: "goals", sel: "goal-ms", t: "Milestone", b: "Tujuh goal yang dihitung dari data: minggu lengkap, km tertinggi seminggu, long run terjauh, sesi locked-in yang pace-nya kejaga, sesi elevation, sesi strength, dan benchmark. Target bisa diedit." },
      { tab: "goals", sel: "goal-badges", t: "Badge", b: "19 badge yang kebuka otomatis dari catatan asli (contoh data nggak dihitung), misal lari pertama, 10K, total 100 km, atau streak 4 minggu lengkap." },
      { tab: "goals", sel: "goal-check", t: "Checklist race day", b: "Daftar persiapan race day yang bisa dicentang." }
    ] },
    pace: { title: "Pace calculator", steps: [
      { tab: "pace", sel: "pc", t: "Dari jarak & waktu", b: "Isi jarak dan waktu finish → pace rata-rata, plus perkiraan 5K, 10K, dan half marathon pakai rumus Riegel (waktu × (jarak baru ÷ jarak lama)^1,06)." },
      { tab: "pace", sel: "pp", t: "Dari target pace", b: "Isi pace → waktu tempuh 5K, 10K, half marathon, dan jarak lain. Ini hitungan lurus tanpa faktor capek." },
      { tab: "pace", sel: null, t: "Cuma perkiraan", b: "Makin jauh beda jaraknya, makin kasar perkiraan Riegel. Panas, tanjakan, dan latihan long run sangat ngaruh. Buat strategi race per km, pakai Race plan." }
    ] },
    data: { title: "Data & backup", steps: [
      { tab: "data", sel: "data-sync", t: "Status data", b: "Nunjukin di mana data kamu: cuma di perangkat ini, atau juga ke-sync ke akun Google kamu, plus perubahan yang belum terkirim dan konflik kalau ada." },
      { tab: "data", sel: "data-export", t: "Export", b: "“Export JSON” = backup lengkap (semua log, settings, catatan). “Export CSV” = daftar lari buat dibuka di spreadsheet." },
      { tab: "data", sel: "data-import", t: "Import backup", b: "Pilih file JSON dari app ini. “Gabungkan” menambah yang belum ada tanpa menghapus apa pun. “Ganti semua” mengganti data sekarang. Sebelum keduanya, app bikin backup otomatis yang bisa dipulihkan." },
      { tab: "data", sel: "data-backups", t: "Kenapa tetap backup?", b: "Sync menjaga data antar perangkat, tapi kalau kamu salah hapus, hapusan itu ikut ke-sync. Backup JSON sesekali (misal tiap akhir bulan) jadi pegangan kedua." }
    ] },
    account: { title: "Akun & teman", steps: [
      { tab: "more", sel: "acct", t: "Masuk dengan Google", b: "Tap “Masuk dengan Google”. Setelah masuk, data kamu ke-sync ke akun kamu dan bisa dibuka di perangkat lain. Tanpa masuk, app tetap jalan penuh, data cuma di perangkat ini." },
      { tab: "more", sel: "acct", t: "Sync & ganti akun", b: "Statusnya kelihatan di sini: ke-sync, lagi sync, offline (perubahan disimpan dan dikirim nanti), atau gagal. “Ganti akun” keluar dulu lalu pilih akun lain; tiap akun punya data sendiri yang terpisah di perangkat ini." },
      { tab: "bareng", sel: "groups", t: "Tambah teman", b: "Buat link undangan dan kirim ke temanmu. Link berlaku 7 hari dan sekali pakai. Temanmu mengirim permintaan, kamu yang menerima atau menolak." },
      { tab: "bareng", sel: "share-toggle", t: "Privat per teman", b: "Defaultnya nggak ada yang dibagikan. Untuk tiap teman kamu bisa menyalakan: jarak mingguan, sesi selesai, personal best, aktivitas tertentu, jadwal, dan HR di pace tertentu. Catatan, check-in, nyeri, rute, dan lokasi nggak pernah dibagikan." }
    ] },
    settings: { title: "Settings", steps: [
      { tab: "settings", sel: "st-days", t: "Hari & jam latihan", b: "Pilih hari lari weekday (Senin, Selasa, Kamis, atau Jumat; Rabu dikosongin) dan jam lari weekday/weekend. Strength ikut dijadwalkan di hari kerja lain." },
      { tab: "settings", sel: "st-dates", t: "Tanggal mulai & race", b: "Tanggal mulai otomatis digeser ke Senin. Mengubahnya menggeser semua tanggal sesi; catatan lari tetap nempel ke sesinya (misal “Week 3 long run”), jadi cek lagi jadwal setelah ganti." },
      { tab: "settings", sel: "st-goal", t: "Target & satuan", b: "Target finish dipakai di dashboard dan race plan. Satuan pace bisa per km atau per mile. Target km/minggu cuma dipakai buat goal; jadwal tetap ikut PDF." },
      { tab: "settings", sel: "st-theme", t: "Tampilan", b: "Gelap, terang, atau ikut pengaturan HP." }
    ] },
    notif: { title: "Notifikasi", steps: [
      { tab: "notif", sel: null, t: "Di aplikasi Android", b: "Pengingat dikirim oleh aplikasi Android lewat sistem Android, jadi tetap muncul walau app ditutup. Versi web cuma menyimpan pilihan dan nggak pernah minta izin." },
      { tab: "notif", sel: "notif-prefs", t: "Pilihan per kategori", b: "Workout, hitung mundur race, pengingat minum, tips, rekap mingguan, dan review bulanan bisa dinyalakan sendiri-sendiri, plus waktu pengingat dan jam tenang. Izin baru diminta setelah kamu menyalakan dan menyimpan." },
      { tab: "notif", sel: "notif-preview", t: "Pratinjau", b: "Pengingat 7 hari ke depan yang dibuat dari jadwal asli kamu." }
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
