/* RUNLAB scholarly retrieval (M3): PubMed (NCBI E-utilities) + OpenAlex. Exposes globalThis.WRI_RESEARCH.
 * Contracts, provider policies and the list of live-network checks that remain unverified: docs/RUNLAB_RESEARCH.md.
 * - Only records actually returned by the providers are shown; nothing is generated. Excerpts are the provider's own text.
 * - Queries come from the investigation type/answers only (never names, emails, notes or other personal data).
 * - No key or email is sent; OpenAlex is used keyless (small per-IP daily budget; a key may only ever live server-side).
 * - Per-request timeout, one retry with backoff (429/5xx/network), polite spacing, 14-day local cache with origin labels.
 * - Provider text is untrusted data: markup is stripped on parse and escaped on render; never executed or followed.
 */
(function (G) {
  "use strict";
  const PM = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/", OA = "https://api.openalex.org/";
  const KEY = "hmtp:lab:research:v1", TTL = 14 * 864e5, MAXQ = 20;
  let fetchImpl = (u, o) => G.fetch(u, o), TIMEOUT = 12000, RETRY_MS = 1200, SPACING = 350;
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

  /* ---------- transport: timeout, retry, readable errors ---------- */
  class ProviderError extends Error { constructor(msg, kind) { super(msg); this.kind = kind; } }
  async function request(url, as) {
    let lastErr = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = setTimeout(() => ctl && ctl.abort(), TIMEOUT);
      let r;
      try { r = await fetchImpl(url, Object.assign({ headers: { accept: as === "json" ? "application/json" : "text/xml" } }, ctl ? { signal: ctl.signal } : {})); }
      catch (e) {
        clearTimeout(timer);
        lastErr = e && e.name === "AbortError" ? new ProviderError("waktu habis", "timeout") : new ProviderError("jaringan gagal", "network");
        if (lastErr.kind === "timeout") throw lastErr;            // a hung provider is not retried (keeps the UI responsive)
        if (attempt === 0) { await sleep(RETRY_MS); continue; }
        throw lastErr;
      }
      clearTimeout(timer);
      if (!r.ok) {
        let body = ""; try { body = await r.text(); } catch (e) {}
        if (r.status === 429 && /budget/i.test(body)) throw new ProviderError("kuota harian tanpa kunci habis (reset tengah malam UTC)", "budget");
        lastErr = new ProviderError(`HTTP ${r.status}`, "http");
        if (attempt === 0 && (r.status === 429 || r.status >= 500)) { await sleep(RETRY_MS); continue; }
        throw lastErr;
      }
      const text = await r.text();
      if (as === "text") return text;
      try { return JSON.parse(text); } catch (e) { throw new ProviderError("respons tidak valid", "parse"); }
    }
    throw lastErr || new ProviderError("gagal", "unknown");
  }

  /* ---------- parsing ---------- */
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
  const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  const decode = s => String(s).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e.toLowerCase()]);
  const clean = s => decode(String(s || "").replace(/<[^>]+>/g, "")).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const excerpt = s => { s = clean(s); return s.length > 420 ? s.slice(0, 417).replace(/\s+\S*$/, "") + "…" : s; };
  /** PubMed efetch XML → {pmid: abstract}. Labelled sections become "LABEL: text". Pure; works without DOMParser. */
  function parsePubmedXml(xml) {
    const out = {};
    for (const m of String(xml || "").matchAll(/<PubmedArticle\b[^>]*>([\s\S]*?)<\/PubmedArticle>/g)) {
      const pm = /<PMID\b[^>]*>(\d{1,10})<\/PMID>/.exec(m[1]); if (!pm) continue;
      const parts = [...m[1].matchAll(/<AbstractText\b([^>]*)>([\s\S]*?)<\/AbstractText>/g)].map(a => { const lab = /Label="([^"]+)"/.exec(a[1]); return (lab ? lab[1] + ": " : "") + clean(a[2]); });
      out[pm[1]] = parts.join(" ").trim();
    }
    return out;
  }
  function why(item, terms) {
    const hay = (item.title + " " + (item.excerpt || "")).toLowerCase();
    const hit = [...new Set(terms.filter(t => t.length > 3 && hay.includes(t.toLowerCase())))];
    return hit.length ? `judul/abstrak memuat: ${hit.slice(0, 5).join(", ")}` : "";
  }
  const relevant = item => /\brun(ning|ners?)?\b|\bmarathon|\bjog/i.test(item.title + " " + (item.excerpt || ""));

  /** PubMed adapter: esearch → esummary → efetch (abstracts are optional; a failed efetch keeps the summaries). */
  async function pubmed(q, now) {
    const s = await request(`${PM}esearch.fcgi?db=pubmed&retmode=json&sort=relevance&retmax=8&tool=werunit&term=${encodeURIComponent(q.pubmed)}`, "json");
    const ids = (s && s.esearchresult && s.esearchresult.idlist || []).filter(x => /^\d{1,10}$/.test(x));
    if (!ids.length) return [];
    await sleep(SPACING);
    const sum = await request(`${PM}esummary.fcgi?db=pubmed&retmode=json&tool=werunit&id=${ids.join(",")}`, "json");
    await sleep(SPACING);
    let abs = {};
    try { abs = parsePubmedXml(await request(`${PM}efetch.fcgi?db=pubmed&rettype=abstract&retmode=xml&tool=werunit&id=${ids.join(",")}`, "text")); } catch (e) { abs = {}; }
    return ids.map(id => {
      const r = sum && sum.result && sum.result[id]; if (!r || !clean(r.title)) return null;
      const doi = ((r.articleids || []).find(x => x.idtype === "doi") || {}).value || null;
      const year = /^(\d{4})/.exec(r.pubdate || r.sortpubdate || "");
      const kind = kindFromPubTypes(r.pubtype);
      return { id: doi ? "doi:" + doi.toLowerCase() : "pmid:" + id, provider: "PubMed", pmid: id, doi, openalex: null, title: clean(r.title).replace(/\.$/, ""), authors: (r.authors || []).map(x => clean(x.name)).filter(Boolean).slice(0, 12),
        year: year ? Number(year[1]) : null, journal: clean(r.fulljournalname || r.source), kind, kindLabel: KIND[kind], url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`, excerpt: excerpt(abs[id] || ""), retrievedAt: now };
    }).filter(Boolean);
  }
  const oaAbstract = inv => { if (!inv || typeof inv !== "object") return ""; const words = []; for (const [w, pos] of Object.entries(inv)) for (const p of pos || []) if (Number.isInteger(p) && p >= 0 && p < 5000) words[p] = w; return words.filter(Boolean).join(" "); };
  /** OpenAlex adapter: keyless works search. */
  async function openalex(q, now) {
    const j = await request(`${OA}works?search=${encodeURIComponent(q.openalex)}&per-page=8&filter=type:article|review&select=id,doi,display_name,publication_year,authorships,primary_location,abstract_inverted_index,type,ids`, "json");
    return (j && j.results || []).map(w => {
      const doi = w.doi ? String(w.doi).replace(/^https?:\/\/doi\.org\//i, "") : null, oid = String(w.id || "").replace(/^https?:\/\/openalex\.org\//, "");
      const pmid = w.ids && w.ids.pmid ? String(w.ids.pmid).replace(/\D/g, "") : null;
      if (!clean(w.display_name) || !oid) return null;
      const kind = w.type === "review" ? "review" : "article";
      return { id: doi ? "doi:" + doi.toLowerCase() : pmid ? "pmid:" + pmid : "openalex:" + oid, provider: "OpenAlex", pmid, doi, openalex: oid, title: clean(w.display_name), authors: (w.authorships || []).map(a => a.author && clean(a.author.display_name)).filter(Boolean).slice(0, 12),
        year: Number.isInteger(w.publication_year) ? w.publication_year : null, journal: clean(w.primary_location && w.primary_location.source && w.primary_location.source.display_name), kind, kindLabel: KIND[kind],
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
  /**
   * Search both providers. Returns {items, errors, origin:"live"|"cache"|"stale-cache"|"none", cachedAt}.
   * opts: {now, force (skip fresh cache), offline (cache only)}.
   */
  async function search(q, { now = new Date().toISOString(), force = false, offline = false } = {}) {
    const cache = store.get(), hit = cache[q.text];
    if (offline) return hit ? { items: hit.items, errors: [], origin: "stale-cache", cachedAt: hit.at } : { items: [], errors: ["Kamu offline dan belum ada hasil tersimpan untuk pertanyaan ini."], origin: "none", cachedAt: null };
    if (!force && hit && Date.now() - Date.parse(hit.at) < TTL) return { items: hit.items, errors: [], origin: "cache", cachedAt: hit.at };
    const errors = []; let items = [], okCount = 0;
    for (const [name, fn] of [["PubMed", pubmed], ["OpenAlex", openalex]]) {
      try { items = items.concat(await fn(q, now)); okCount++; } catch (e) { errors.push(`${name} ${e && e.message ? e.message : "gagal"}.`); }
    }
    if (!okCount) return hit ? { items: hit.items, errors, origin: "stale-cache", cachedAt: hit.at } : { items: [], errors, origin: "none", cachedAt: null };
    items = dedupe(items).filter(relevant).map(x => Object.assign(x, { why: why(x, q.terms) })).slice(0, 10);
    cache[q.text] = { at: now, items };
    Object.keys(cache).sort((a, b) => Date.parse(cache[b].at) - Date.parse(cache[a].at)).slice(MAXQ).forEach(k => delete cache[k]);
    store.set(cache);
    return { items, errors, origin: "live", cachedAt: null };
  }
  /** Minimal record saved into an investigation (bounded; every field came from a provider). */
  const toSaved = x => ({ id: String(x.id).slice(0, 120), provider: x.provider, title: String(x.title).slice(0, 300), authors: (x.authors || []).slice(0, 6), year: x.year || null, journal: String(x.journal || "").slice(0, 160), pmid: x.pmid || null, doi: x.doi || null, url: x.url, kind: x.kind, kindLabel: x.kindLabel, retrievedAt: x.retrievedAt });

  G.WRI_RESEARCH = { queryFor, search, dedupe, pubmed, openalex, parsePubmedXml, kindFromPubTypes, toSaved, KIND,
    setFetch(f) { fetchImpl = f; }, setTimeoutMs(ms) { TIMEOUT = ms; }, setRetryDelay(ms) { RETRY_MS = ms; SPACING = Math.min(SPACING, ms); }, clearCache() { store.set({}); },
    setXml() { /* kept for older tests; parsing is regex-based and DOM-free now */ } };
})(typeof globalThis !== "undefined" ? globalThis : this);
