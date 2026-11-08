/* WeRunIt brand system: one source for the mark used by the app, splash, PWA icons and Android assets.
 *
 * The mark (4.0): a stride "W" whose last leg keeps climbing into an arrow. Two strides, then up and forward:
 * the shape of a progress line that ends higher than it started. Strokes only, legible at notification size.
 * Exposes globalThis.WRI_BRAND.
 */
(function (G) {
  "use strict";
  // Geometry in a 64×64 box. TRACK = the stride W, CADENCE = the arrowhead it runs into.
  const TRACK = "M10 23 L19.5 47 L29.5 28 L39 47 L54 16";
  const CADENCE = "M43 16 H54 V27";
  const HOLO = [["0", "#FF5A1F"], ["1", "#FF5A1F"]];   // flat race orange (unslop: no hue gradient on the mark)
  let n = 0;

  /** opts: {size, mode:"holo"|"white"|"black", animated, title, bg} */
  function mark(opts = {}) {
    const id = "wri" + (++n), size = opts.size || 64, mode = opts.mode || "holo";
    const stroke = mode === "white" ? "#FFFFFF" : mode === "black" ? "#141415" : `url(#${id}g)`;
    const sw = opts.weight || 6.2;
    const defs = mode === "holo" ? `<defs><linearGradient id="${id}g" x1="6" y1="8" x2="60" y2="56" gradientUnits="userSpaceOnUse">${HOLO.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("")}${opts.animated ? `<animateTransform attributeName="gradientTransform" type="rotate" values="0 32 32;14 32 32;0 32 32" dur="6s" repeatCount="indefinite"/>` : ""}</linearGradient>${opts.liquid ? liquidFilter(id) : ""}</defs>` : "";
    const filt = opts.liquid ? ` filter="url(#${id}liq)"` : "";
    const bg = opts.bg ? `<rect width="64" height="64" rx="${opts.bgRadius ?? 15}" fill="${opts.bg}"/>` : "";
    return `<svg class="${opts.cls || "wri-mark"}" width="${size}" height="${size}" viewBox="0 0 64 64" role="img" aria-label="${opts.title || "WeRunIt"}" xmlns="http://www.w3.org/2000/svg">${defs}${bg}<g fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${filt}><path class="wri-track" d="${TRACK}"/><path class="wri-cadence" d="${CADENCE}"/></g></svg>`;
  }
  // Liquid formation: a displacement field that relaxes to zero, so the mark "settles" out of a fluid surface.
  function liquidFilter(id) {
    return `<filter id="${id}liq" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="n"><animate attributeName="baseFrequency" values="0.06;0.035;0.02" dur="1.6s" fill="freeze"/></feTurbulence><feDisplacementMap in="SourceGraphic" in2="n" scale="0" xChannelSelector="R" yChannelSelector="G"><animate attributeName="scale" values="26;9;0" keyTimes="0;0.55;1" dur="1.6s" calcMode="spline" keySplines="0.2 0.8 0.3 1;0.3 0.9 0.4 1" fill="freeze"/></feDisplacementMap></filter>`;
  }
  /** Wordmark: "WeRunIt" set in the display face; the "It" carries the holographic foil. */
  function wordmark(opts = {}) {
    return `<span class="wri-word${opts.cls ? " " + opts.cls : ""}" aria-label="WeRunIt"><span aria-hidden="true">WeRun</span><span class="holo-text" aria-hidden="true">It</span></span>`;
  }
  /** Lockup: mark + wordmark. */
  const lockup = (opts = {}) => `<span class="wri-lockup">${mark(Object.assign({ size: opts.size || 30 }, opts))}${wordmark()}</span>`;

  G.WRI_BRAND = { mark, wordmark, lockup, TRACK, CADENCE, HOLO, NAME: "WeRunIt", TAGLINE: "Teman latihan lari yang paham datamu." };
})(typeof globalThis !== "undefined" ? globalThis : this);
