// Inline glossary: the first occurrence of a known term inside a container becomes a keyboard-focusable abbreviation with a short definition.
// Works with hover, keyboard focus and tap; Escape or moving away closes it. Definitions contain no market numbers.
// Skips links, buttons, code, headings and SVG, so it never changes navigation or layout of controls.
const TERMS = [
  ['OAS', /\bOAS\b/, 'Option-adjusted spread: the extra yield a corporate bond pays over a comparable Treasury. A wider spread means investors demand more for taking credit risk.'],
  ['VIX', /\bVIX\b/, 'The expected 30-day volatility of the S&P 500 implied by option prices. Often called the fear gauge.'],
  ['MOVE', /\bMOVE\b/, 'Implied volatility of US Treasury bonds, the bond-market counterpart of the VIX.'],
  ['SKEW', /\bSKEW\b/, 'An index of how expensive far out-of-the-money S&P 500 puts are relative to calls, a measure of demand for crash protection.'],
  ['Sahm rule', /\bSahm rule\b/i, 'A recession signal that triggers when the 3-month average unemployment rate rises 0.5 percentage points above its lowest level of the past 12 months.'],
  ['inverted', /\binverted\b/i, 'An inverted yield curve means short-term Treasury yields are above long-term yields. It has preceded most US recessions, with a variable lead time.'],
  ['net liquidity', /\bnet liquidity\b/i, 'The Fed balance sheet minus the Treasury cash account and reverse repo: a rough gauge of the liquidity available to markets.'],
  ['NFCI', /\bNFCI\b/, 'Chicago Fed National Financial Conditions Index. Above zero means financial conditions are tighter than average.'],
  ['SLOOS', /\bSLOOS\b/, 'Senior Loan Officer Opinion Survey: whether US banks are tightening or easing their lending standards.'],
  ['percentile', /\bpercentile\b/i, "Where today's value ranks against its own history (here the last ten years). The 90th percentile means higher than 90% of readings."],
  ['AUC', /\bAUC\b/, 'In the track record: the chance that a month before a downturn scores higher than an ordinary month. 0.5 is a coin flip, 1.0 is perfect.'],
  ['R²', /R²|R&sup2;/, 'The share of the variation in past returns that the model explains. A low value means weak explanatory power: treat results as direction only.'],
  ['GEX', /\bGEX\b/, 'Dealer gamma exposure: an estimate of whether options dealers hedging may dampen or amplify market moves. Experimental here and not scored.'],
  ['composite', /\bcomposite\b/i, 'The weighted blend of all scored indicators, from 0 (calm) to 100 (critical). It sets the regime.'],
  ['breakeven', /\bbreakeven\b/i, 'The inflation rate implied by the gap between nominal and inflation-protected Treasury yields.'],
];
const SKIP = 'a,button,code,pre,svg,textarea,input,select,abbr,h1,h2,h3,h4,script,style,.term,[contenteditable]';
let tip = null, active = null;

function ensureTip() {
  if (tip) return tip;
  tip = document.createElement('div'); tip.id = 'termTip'; tip.className = 'term-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true; document.body.appendChild(tip);
  document.addEventListener('mouseover', e => { const t = e.target.closest && e.target.closest('abbr.term'); if (t) show(t); });
  document.addEventListener('mouseout', e => { const t = e.target.closest && e.target.closest('abbr.term'); if (t && !(e.relatedTarget && t.contains(e.relatedTarget))) hide(); });
  document.addEventListener('focusin', e => { const t = e.target.closest && e.target.closest('abbr.term'); if (t) show(t); });
  document.addEventListener('focusout', e => { if (e.target.closest && e.target.closest('abbr.term')) hide(); });
  document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('abbr.term'); if (t) { active === t && !tip.hidden ? hide() : show(t); } else hide(); });
  // capture phase: while a definition is open, the first Escape closes only it (not the drawer or dialog behind it)
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && tip && !tip.hidden) { hide(); e.stopPropagation(); } }, true);
  addEventListener('scroll', hide, { passive: true, capture: true });
  return tip;
}
function show(t) {
  ensureTip(); active = t; tip.textContent = t.dataset.def; tip.hidden = false; t.setAttribute('aria-describedby', 'termTip');
  const r = t.getBoundingClientRect(), w = Math.min(320, innerWidth - 24); tip.style.maxWidth = w + 'px';
  const th = tip.offsetHeight, left = Math.max(12, Math.min(innerWidth - tip.offsetWidth - 12, r.left + r.width / 2 - tip.offsetWidth / 2));
  const above = r.top - th - 10 >= 8; tip.style.left = left + 'px'; tip.style.top = (above ? r.top - th - 10 : r.bottom + 10) + 'px';
}
function hide() { if (!tip || tip.hidden) return; tip.hidden = true; if (active) active.removeAttribute('aria-describedby'); active = null; }

/** Wrap the first occurrence of each known term inside `root`. Safe to call repeatedly: already wrapped terms are skipped. */
export function glossify(root) {
  if (!root) return; ensureTip();
  const used = new Set([...root.querySelectorAll('abbr.term')].map(a => a.dataset.key));
  for (const [key, re, def] of TERMS) {
    if (used.has(key)) continue;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => n.nodeValue.trim() && !(n.parentElement && n.parentElement.closest(SKIP)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const m = re.exec(n.nodeValue); if (!m) continue;
      const mid = n.splitText(m.index); const after = mid.splitText(m[0].length);
      const el = document.createElement('abbr'); el.className = 'term'; el.tabIndex = 0; el.dataset.def = def; el.dataset.key = key; el.textContent = mid.nodeValue;
      mid.parentNode.replaceChild(el, mid); used.add(key); void after; break;
    }
  }
}
