/* RUNLAB scholarly retrieval (M3): PubMed (NCBI E-utilities) + OpenAlex. Exposes globalThis.WRI_RESEARCH.
 * - Only records actually returned by the providers are shown; nothing is generated. Abstract text is the provider's own
 *   text (OpenAlex abstracts are rebuilt from its inverted index), shown as a short excerpt with a link to the source.
 * - Queries are built from the investigation type/answers only (never names, emails, notes or other personal data).
 * - Results are normalized, de-duplicated by DOI → PMID → OpenAlex id, cached locally with a retrieval time (14 days).
 * - Polite use: sequential requests with spacing, one retry with backoff on 429/5xx, `tool=werunit` identification.
 * - Provider text is treated as untrusted data: it is escaped on render and never executed or followed as instructions.
 * No API key is used. Browser CORS for both APIs is documented by the providers; it could not be verified live from the
 * build sandbox (network policy), see docs/RUNLAB_DECISIONS.md.
 */
(function (G) {
  "use strict";
  const PM = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/", OA = "https://api.openalex.org/";
  const KEY = "hmtp:lab:research:v1", TTL = 14 * 864e5, MAXQ = 20;
  let fetchImpl = (u, o) => G.fetch(u, o);
  let parseXml = s => (typeof DOMParser !== "undefined" ? new DOMParser().parseFromString(s, "text/xml") : null);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const store = {
    get() { try { return JSON.parse(G.localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; } },
    set(o) { try { G.localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
  };

  /** Query terms per investigation type (English: the literature is mostly English). No personal data. */
  const BASE = {
    performance: "running performance training adaptation recreational runners",
    consistency: "running training frequency weekly volume adaptation",
    comparison: "running pace comparison training session type",
    environment: "running performance environmental conditions",
    equipment: "running shoes running economy performance",
    recovery: "sleep recovery endurance runners",
    experiment: "single-case n-of-1 running training"
  };
  const FACTOR = { heat: "heat humidity running performance", elev: "uphill gradient running economy pace", time: "time of day running performance" };
  function queryFor(inv) {
    const a = k => inv.answers && inv.answers[k] && inv.answers[k].state === "answered" ? inv.answers[k].v : null;
    let text = BASE[inv.type] || BASE.performance;
    if (inv.type === "environment" && FACTOR[a("factor")]) text = FACTOR[a("factor")];
    if (inv.type === "recovery" && a("signal") && a("signal") !== "sleep") text = `${a("signal") === "soreness" ? "muscle soreness" : a("signal") === "fatigue" ? "fatigue" : "perceived energy"} recovery endurance runners`;
    if (inv.type === "comparison" && a("groups") === "time") text = FACTOR.time;
    if (inv.type === "comparison" && a("groups") === "shoe") text = BASE.equipment;
    const words = text.split(/\s+/);
    return { text, pubmed: words.map(w => `${w}[tiab]`).slice(0, 6).join(" AND ").replace(/runners\[tiab\]|running\[tiab\]/g, "(running[tiab] OR runners[tiab])"), openalex: text, terms: words };
  }

  async function getJson(url) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await fetchImpl(url, { headers: { accept: "application/json" } });
      if (r.ok) return r.json();
      if (attempt === 0 && (r.status === 429 || r.status >= 500)) { await sleep(1200); continue; }
      throw new Error(`HTTP ${r.status}`);
    }
  }
  async function getText(url) { const r = await fetchImpl(url, {}); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); }

  const KIND = { meta: "meta-analisis", review: "tinjauan (review)", rct: "uji acak (RCT)", guideline: "pedoman / konsensus", primary: "studi primer", article: "artikel" };
  function kindFromPubTypes(types) {
    const t = (types || []).map(x => String(x).toLowerCase());
    if (t.some(x => x.includes("meta-analysis"))) return "meta";
    if (t.some(x => x.includes("systematic review") || x === "review")) return "review";
    if (t.some(x => x.includes("randomized controlled trial"))) return "rct";
    if (t.some(x => x.includes("guideline") || x.includes("consensus"))) return "guideline";
    if (t.some(x => x.includes("journal article") || x.includes("clinical trial") || x.includes("observational"))) return "primary";
    return "article";
  }
  const clean = s => String(s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const excerpt = s => { s = clean(s); return s.length > 420 ? s.slice(0, 417).replace(/\s+\S*$/, "") + "…" : s; };
  function why(item, terms) {
    const hay = (item.title + " " + (item.excerpt || "")).toLowerCase();
    const hit = [...new Set(terms.filter(t => t.length > 3 && hay.includes(t.toLowerCase())))];
    return hit.length ? `judul/abstrak memuat: ${hit.slice(0, 5).join(", ")}` : "";
  }
  const relevant = item => /\brun(ning|ners?)?\b|\bmarathon|\bjog/i.test(item.title + " " + (item.excerpt || ""));

  /** PubMed: esearch → esummary (+ efetch abstracts). Returns normalized items. */
  async function pubmed(q, now) {
    const s = await getJson(`${PM}esearch.fcgi?db=pubmed&retmode=json&sort=relevance&retmax=8&tool=werunit&term=${encodeURIComponent(q.pubmed)}`);
    const ids = (s && s.esearchresult && s.esearchresult.idlist || []).filter(x => /^\d{1,10}$/.test(x));
    if (!ids.length) return [];
    await sleep(350);
    const sum = await getJson(`${PM}esummary.fcgi?db=pubmed&retmode=json&tool=werunit&id=${ids.join(",")}`);
    await sleep(350);
    let abs = {};
    try {
      const doc = parseXml(await getText(`${PM}efetch.fcgi?db=pubmed&rettype=abstract&retmode=xml&tool=werunit&id=${ids.join(",")}`));
      if (doc) for (const a of Array.from(doc.getElementsByTagName("PubmedArticle"))) { const id = (a.getElementsByTagName("PMID")[0] || {}).textContent; abs[id] = Array.from(a.getElementsByTagName("AbstractText")).map(x => x.textContent).join(" "); }
    } catch (e) { abs = {}; }
    return ids.map(id => {
      const r = sum && sum.result && sum.result[id]; if (!r || !r.title) return null;
      const doi = ((r.articleids || []).find(x => x.idtype === "doi") || {}).value || null;
      const year = /^(\d{4})/.exec(r.pubdate || r.sortpubdate || "");
      const kind = kindFromPubTypes(r.pubtype);
      return { id: doi ? "doi:" + doi.toLowerCase() : "pmid:" + id, provider: "PubMed", pmid: id, doi, openalex: null, title: clean(r.title).replace(/\.$/, ""), authors: (r.authors || []).map(x => x.name).filter(Boolean).slice(0, 12),
        year: year ? Number(year[1]) : null, journal: clean(r.fulljournalname || r.source), kind, kindLabel: KIND[kind], url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`, excerpt: excerpt(abs[id] || ""), retrievedAt: now };
    }).filter(Boolean);
  }
  const oaAbstract = inv => { if (!inv || typeof inv !== "object") return ""; const words = []; for (const [w, pos] of Object.entries(inv)) for (const p of pos) words[p] = w; return words.join(" "); };
  /** OpenAlex: works search. */
  async function openalex(q, now) {
    const j = await getJson(`${OA}works?search=${encodeURIComponent(q.openalex)}&per-page=8&filter=type:article|review&select=id,doi,display_name,publication_year,authorships,primary_location,abstract_inverted_index,type,ids`);
    return (j && j.results || []).map(w => {
      const doi = w.doi ? String(w.doi).replace(/^https?:\/\/doi\.org\//i, "") : null, oid = String(w.id || "").replace(/^https?:\/\/openalex\.org\//, "");
      const pmid = w.ids && w.ids.pmid ? String(w.ids.pmid).replace(/\D/g, "") : null;
      if (!w.display_name || !oid) return null;
      const kind = w.type === "review" ? "review" : "article";
      return { id: doi ? "doi:" + doi.toLowerCase() : pmid ? "pmid:" + pmid : "openalex:" + oid, provider: "OpenAlex", pmid, doi, openalex: oid, title: clean(w.display_name), authors: (w.authorships || []).map(a => a.author && a.author.display_name).filter(Boolean).slice(0, 12),
        year: w.publication_year || null, journal: clean(w.primary_location && w.primary_location.source && w.primary_location.source.display_name), kind, kindLabel: KIND[kind],
        url: doi ? `https://doi.org/${doi}` : `https://openalex.org/${oid}`, excerpt: excerpt(oaAbstract(w.abstract_inverted_index)), retrievedAt: now };
    }).filter(Boolean);
  }
  /** Merge and de-duplicate (DOI, then PMID). PubMed metadata wins; OpenAlex fills gaps. */
  function dedupe(items) {
    const out = [];
    for (const it of items) {
      const same = out.find(o => (it.doi && o.doi && it.doi.toLowerCase() === o.doi.toLowerCase()) || (it.pmid && o.pmid && it.pmid === o.pmid));
      if (!same) { out.push(Object.assign({}, it)); continue; }
      if (!same.excerpt && it.excerpt) same.excerpt = it.excerpt;
      if (!same.openalex && it.openalex) same.openalex = it.openalex;
      if (!same.pmid && it.pmid) { same.pmid = it.pmid; same.url = `https://pubmed.ncbi.nlm.nih.gov/${it.pmid}/`; }
      if (same.kind === "article" && it.kind !== "article") { same.kind = it.kind; same.kindLabel = it.kindLabel; }
      same.provider = same.provider === it.provider ? same.provider : "PubMed + OpenAlex";
    }
    return out;
  }
  /** Search both providers. Returns {items, errors, cachedAt|null, stale}. Uses a fresh cache entry when present. */
  async function search(q, { now = new Date().toISOString(), force = false } = {}) {
    const cache = store.get(), hit = cache[q.text];
    if (!force && hit && Date.now() - Date.parse(hit.at) < TTL) return { items: hit.items, errors: [], cachedAt: hit.at, stale: false };
    const errors = []; let items = [];
    try { items = items.concat(await pubmed(q, now)); } catch (e) { errors.push(`PubMed tidak bisa dihubungi (${e.message}).`); }
    try { items = items.concat(await openalex(q, now)); } catch (e) { errors.push(`OpenAlex tidak bisa dihubungi (${e.message}).`); }
    if (errors.length === 2 && hit) return { items: hit.items, errors, cachedAt: hit.at, stale: true };
    items = dedupe(items).filter(relevant).map(x => Object.assign(x, { why: why(x, q.terms) })).slice(0, 10);
    if (errors.length < 2) {
      cache[q.text] = { at: now, items };
      const keys = Object.keys(cache).sort((a, b) => Date.parse(cache[b].at) - Date.parse(cache[a].at)); keys.slice(MAXQ).forEach(k => delete cache[k]);
      store.set(cache);
    }
    return { items, errors, cachedAt: null, stale: false };
  }
  /** Minimal record saved into an investigation (bounded; every field came from a provider). */
  const toSaved = x => ({ id: String(x.id).slice(0, 120), provider: x.provider, title: String(x.title).slice(0, 300), authors: (x.authors || []).slice(0, 6), year: x.year || null, journal: String(x.journal || "").slice(0, 160), pmid: x.pmid || null, doi: x.doi || null, url: x.url, kind: x.kind, kindLabel: x.kindLabel, retrievedAt: x.retrievedAt });

  G.WRI_RESEARCH = { queryFor, search, dedupe, pubmed, openalex, kindFromPubTypes, toSaved, KIND,
    setFetch(f) { fetchImpl = f; }, setXml(f) { parseXml = f; }, clearCache() { store.set({}); } };
})(typeof globalThis !== "undefined" ? globalThis : this);
