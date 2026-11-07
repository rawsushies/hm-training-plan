/* WeRunIt shoe catalogue (embedded, offline). Facts per model (brand, model name, release date) come from the
 * public source linked on each entry, retrieved on `retrieved`. `approx: true` = the source gives the first
 * colourway / regional listing rather than an official launch day. `plus` / `minus` are WeRunIt's own short
 * notes (editorial opinion, not lab tests) and are shown separately, below the sourced facts.
 * Update: edit this file, bump the release, ship (installed apps update themselves).
 */
(function (G) {
  "use strict";
  const R = "2026-11-07";
  const S = (label, url) => ({ label, url });
  G.WRI_SHOE_CATALOG = { retrieved: R, models: [
    // ---- daily / easy ----
    { id: "nike-pegasus-42", brand: "Nike", model: "Pegasus 42", released: "2026-04-09", use: "daily", source: S("nike.com", "https://www.nike.com/a/pegasus-42-release-date"),
      plus: ["Serba bisa: easy run, long run santai, sampai tempo ringan", "Seri yang sudah puluhan tahun, mudah dicari dan dicoba di toko"],
      minus: ["Bukan pilihan paling empuk buat yang cari bantalan maksimal", "Untuk race cepat, sepatu ber-plate terasa lebih responsif"] },
    { id: "asics-novablast-6", brand: "ASICS", model: "Novablast 6", released: "2026-07-01", use: "daily", source: S("The Running Channel", "https://therunningchannel.com/first-look-asics-novablast-6/"),
      plus: ["Terasa memantul dan fun untuk lari harian", "Cocok jadi satu sepatu untuk easy run dan latihan agak cepat"],
      minus: ["Rasa memantul bisa terasa kurang stabil buat sebagian pelari", "Model baru: stok dan ukuran di Indonesia bisa terbatas di awal"] },
    { id: "brooks-ghost-18", brand: "Brooks", model: "Ghost 18", released: "2026-05-01", use: "daily", source: S("Sole Retriever", "https://www.soleretriever.com/news/articles/brooks-ghost-18-pre-order-release-date-april-2026"),
      plus: ["Nyaman dan stabil, ramah untuk pelari pemula", "Transisi langkah halus untuk lari santai jarak jauh"],
      minus: ["Kurang “greget” untuk sesi cepat", "Tanggal rilis di luar AS lebih belakangan (UK Juni 2026)"] },
    { id: "hoka-clifton-10", brand: "HOKA", model: "Clifton 10", released: "2025-04-15", approx: true, use: "daily", source: S("StockX (listing rilis)", "https://stockx.com/hoka-one-one-clifton-10-white"),
      plus: ["Bantalan tebal tapi tetap ringan di kaki", "Enak untuk easy run dan recovery run"],
      minus: ["Bentuk sol tebal butuh adaptasi buat yang terbiasa sepatu rendah", "Tanggal dari listing retail, bukan pengumuman resmi"] },
    { id: "nb-1080v15", brand: "New Balance", model: "1080v15", released: "2026-01-15", use: "long", source: S("Sole Retriever", "https://www.soleretriever.com/news/articles/new-balance-1080v15-release-date-january-2026"),
      plus: ["Bantalan tinggi untuk long run dan kaki yang capek", "Busa baru (Infinion) menggantikan Fresh Foam X di versi sebelumnya"],
      minus: ["Terasa lebih besar/tebal dibanding sepatu harian biasa", "Bukan untuk interval atau race cepat"] },
    { id: "nike-vomero-18", brand: "Nike", model: "Vomero 18", released: "2025-02-27", use: "long", source: S("nike.com", "https://www.nike.com/au/a/nike-vomero-18-release"),
      plus: ["Disebut Nike sebagai Vomero paling empuk", "Cocok untuk long run lambat dan recovery"],
      minus: ["Kurang lincah untuk sesi tempo", "Sol tebal bisa terasa berat untuk pelari ringan"] },
    { id: "asics-nimbus-28", brand: "ASICS", model: "Gel-Nimbus 28", released: "2025-12-01", approx: true, use: "long", source: S("Kicks On Fire (listing rilis)", "https://www.kicksonfire.com/asics-gel-nimbus-28-seashell-black"),
      plus: ["Bantalan maksimal untuk lari santai panjang", "Nyaman dipakai lama, cocok juga untuk aktivitas harian"],
      minus: ["Lebih cocok pelan; kurang responsif untuk tempo", "Rilis bertahap per warna; tanggal dari listing pertama"] },
    { id: "asics-superblast-2", brand: "ASICS", model: "Superblast 2", released: "2024-07-05", use: "long", source: S("WearTesters", "https://weartesters.com/asics-superblast-2-performance-review"),
      plus: ["Satu sepatu untuk long run dan latihan tempo", "Ringan untuk ukuran sol setebal itu"],
      minus: ["Harga premium untuk sepatu latihan", "Model 2024: versi lebih baru mungkin sudah ada di toko"] },
    // ---- tempo / fast training ----
    { id: "adidas-boston-13", brand: "adidas", model: "Adizero Boston 13", released: "2025-04-18", use: "tempo", source: S("adidas News", "https://news.adidas.com/global/adidas-launches-new-adizero-boston-13---designed-for-fast-training-runs/s/0ca9243c-a53d-47a6-8e7c-31e4e2d77357"),
      plus: ["Dirancang untuk latihan cepat (tempo, interval panjang)", "Tetap cukup nyaman untuk long run dengan bagian cepat"],
      minus: ["Lebih kaku dibanding sepatu harian empuk", "Bukan pilihan utama untuk recovery run"] },
    { id: "saucony-speed-5", brand: "Saucony", model: "Endorphin Speed 5", released: "2025-06-16", approx: true, use: "tempo", source: S("GOAT (listing rilis)", "https://www.goat.com/en-gb/sneakers/endorphin-speed-5-black-white-s21007-01"),
      plus: ["Cepat dan serba bisa: tempo, long run cepat, bahkan race", "Rasa melaju (rolling) yang enak di pace sedang–cepat"],
      minus: ["Harga cukup tinggi untuk sepatu latihan", "Tanggal dari listing retail pertama"] },
    { id: "adidas-evo-sl", brand: "adidas", model: "Adizero Evo SL", released: "2024-10-15", use: "tempo", source: S("Sole Retriever", "https://soleretriever.com/news/articles/adidas-adizero-evo-sl-debut-release-date-october-2024"),
      plus: ["Busa ala sepatu race tanpa carbon plate", "Ringan, enak untuk tempo dan lari harian cepat"],
      minus: ["Kurang stabil untuk pelari yang butuh support", "Sumber lain menyebut 25 Okt 2024 (rilis berbeda per kanal)"] },
    { id: "hoka-mach-6", brand: "HOKA", model: "Mach 6", released: "2024-03-01", use: "tempo", source: S("Kicks On Fire (listing rilis)", "https://www.kicksonfire.com/hoka-mach-6-white-nimbus-cloud"),
      plus: ["Ringan dan responsif tanpa plate", "Cocok untuk latihan cepat dan lari harian"],
      minus: ["Bantalan lebih tipis dari Clifton untuk long run sangat jauh", "Model 2024: cek apakah versi baru sudah tersedia"] },
    // ---- race ----
    { id: "nike-alphafly-3", brand: "Nike", model: "Alphafly 3", released: "2024-01-04", use: "race", source: S("Tom's Guide", "https://tomsguide.com/news/nike-alphafly-3-release-date-price-and-whats-changed"),
      plus: ["Sepatu race untuk HM dan marathon", "Dipakai di rekor-rekor marathon dunia"],
      minus: ["Mahal (rilis US$285) dan cepat aus kalau dipakai latihan harian", "Butuh adaptasi; kurang stabil di tikungan tajam untuk sebagian orang"] },
    { id: "adidas-adios-pro-4", brand: "adidas", model: "Adizero Adios Pro 4", released: "2024-11-08", use: "race", source: S("adidas News", "https://news.adidas.com/sports/adizero-adios-pro-4-leads-the-way-as-adidas-introduces-new-race-and-training-silhouettes-to-its-awar/S/ecd0a1fe-e467-4f81-a767-0a64ab29d98f"),
      plus: ["Sepatu race untuk HM–marathon", "Terasa melaju di pace race"],
      minus: ["Mahal (US$250); simpan untuk race dan sesi kunci", "Ketersediaan luas mulai Januari 2025 (rilis awal Nov 2024)"] },
    { id: "asics-metaspeed-sky-tokyo", brand: "ASICS", model: "Metaspeed Sky Tokyo", released: "2025-07-25", use: "race", source: S("WearTesters", "https://weartesters.com/asics-metaspeed-sky-tokyo-performance-review"),
      plus: ["Sepatu race untuk pelari dengan langkah panjang (stride)", "Ringan untuk race HM dan marathon"],
      minus: ["Mahal (US$270)", "Ada versi Edge Tokyo untuk tipe langkah berbeda; pilih yang cocok"] },
    // ---- trail ----
    { id: "hoka-speedgoat-7", brand: "HOKA", model: "Speedgoat 7", released: "2026-02-01", use: "trail", source: S("Deckers / HOKA press release", "https://ir.deckers.com/news-events/press-releases/detail/609/the-g-o-a-t-returns-hoka-unveils-the-new-speedgoat-7"),
      plus: ["Grip untuk jalur tanah dan bebatuan", "Bantalan cukup untuk trail jarak jauh"],
      minus: ["Berlebihan untuk lari di aspal", "Sol bergerigi cepat aus kalau sering dipakai di jalan raya"] }
  ] };
})(typeof globalThis !== "undefined" ? globalThis : this);
