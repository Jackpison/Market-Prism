import { $, $$, esc, getJSON, num, signed, unitFmt, STATUS, scoreColor, cssVar, loadScript, onTab } from '../util.js';
import { explain } from '../regimeExplain.js';
import { glossify } from '../glossary.js';
import { icon } from '../icons.js';
import { loadTrends, QUAD_CLASS } from '../trendsData.js';
import { spark } from '../charts/spark.js';
import { gauge, gaugeLegend, SEG, REGIME_TEXT, regimeVar } from '../charts/gauge.js';
import { getWatch, toggleWatch } from '../watch.js';
import { toast } from '../fx.js';
import { tickNumbers, emptyState } from '../ui2.js';

// Overview: the home page. Everything here is derived from files the pipeline already writes; each block degrades to nothing when its data is missing.
let loaded = false, D = null, charts = [], range = 60;   // months shown in the hero chart (0 = everything)
const KPI_IDS = ['t10y2y', 'vix', 'hyoas', 'netliq', 'usd', 'oil'];
const rel = iso => { const t = Date.parse(iso || ''); if (isNaN(t)) return ''; const h = (Date.now() - t) / 3600e3; return h < 1 ? 'just now' : h < 24 ? Math.round(h) + 'h ago' : Math.round(h / 24) + 'd ago'; };

/* ---------------- helpers ---------------- */
function fillNulls(row) {
  const ok = row.map((v, i) => (v == null ? -1 : i)).filter(i => i >= 0); if (!ok.length) return null;
  return row.map((v, i) => { if (v != null) return v; const lo = [...ok].reverse().find(k => k < i), hi = ok.find(k => k > i); return lo == null ? row[hi] : hi == null ? row[lo] : row[lo] + (row[hi] - row[lo]) * (i - lo) / (hi - lo); });
}
const chartBase = () => ({ responsive: true, maintainAspectRatio: false, animation: { duration: 700 }, interaction: { mode: 'index', intersect: false },
  plugins: { legend: { display: false }, tooltip: { backgroundColor: cssVar('--ink'), titleColor: cssVar('--bg'), bodyColor: cssVar('--bg'), padding: 10, cornerRadius: 8, displayColors: false, titleFont: { family: cssVar('--sans'), weight: '600' }, bodyFont: { family: cssVar('--mono') } } } });
const axis = (extra = {}) => Object.assign({ grid: { color: cssVar('--line'), drawTicks: false }, border: { display: false }, ticks: { color: cssVar('--muted'), font: { family: cssVar('--mono'), size: 11 }, padding: 8 } }, extra);
function fade(ctx, color) { const g = ctx.createLinearGradient(0, 0, 0, ctx.canvas.clientHeight || 200); g.addColorStop(0, color + '44'); g.addColorStop(1, color + '00'); return g; }

/* ---------------- sections ---------------- */
function hero(L, BT, H) {
  const score = L.composite, r = L.regime, rv = regimeVar(r);
  const inds = L.indicators.filter(i => i.status !== 'nodata'), red = inds.filter(i => i.status === 'red').length, yel = inds.filter(i => i.status === 'yellow').length, ok = inds.length - red - yel;
  const top = [...inds].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).filter(i => (i.score ?? 0) >= 50).slice(0, 2).map(i => i.name);
  const series = BT ? BT.composite_series : H ? H.months.map((m, k) => [m, H.composite[k]]).filter(p => p[1] != null) : [];
  let delta = '';
  if (series.length > 1) { const d = score - series[series.length - 2][1], prev = series[series.length - 2][0]; delta = `<span class="delta ${d > 0.4 ? 'up' : d < -0.4 ? 'dn' : ''}">${icon(d > 0.4 ? 'arrow-up-right' : d < -0.4 ? 'arrow-down-right' : 'arrow-right', 14)}${signed(d, 1)} vs ${esc(prev)}</span>`; }
  const ct = BT && BT.composite && BT.composite.recession && BT.composite.recession.t45;
  const cred = ct && ct.hit_rate != null ? `Since 1990, a composite reading of 45 or more preceded ${ct.hits} of ${ct.events_covered} recessions${ct.median_lead_months != null ? ` by a median of ${ct.median_lead_months} months` : ''}, but ${Math.round((ct.false_alarm_share ?? 0) * 100)}% of such episodes were false alarms. <a href="#radar">See the track record</a>.` : '';
  return `<section class="card ov-hero c12" style="--rc:var(${rv})">
    <div class="oh-gauge">${gauge(score, rv)}${gaugeLegend(r)}</div>
    <div class="oh-text"><div class="eyebrow">Market regime ${delta}</div><div class="oh-regime">${esc(r)}</div>
      <p class="oh-lead">${esc(REGIME_TEXT[r] || '')}${top.length ? ` Pressure is coming mainly from <b>${top.map(esc).join('</b> and <b>')}</b>.` : ''}</p>
      <div class="oh-counts"><span><b>${red}</b> alert</span><span><b>${yel}</b> warning</span><span><b>${ok}</b> normal</span></div>
      ${cred ? `<p class="oh-cred">${cred}</p>` : ''}</div>
    <div class="oh-chart"><div class="oh-chart-h"><span>Composite risk</span><div class="seg" role="group" aria-label="Chart range">${[[12, '1Y'], [60, '5Y'], [120, '10Y'], [0, 'Max']].map(([m, l]) => `<button type="button" data-range="${m}" aria-pressed="${m === range}" class="${m === range ? 'on' : ''}">${l}</button>`).join('')}</div></div><div class="chartbox"><canvas id="ovComposite" role="img" aria-label="Composite risk score over the last five years"></canvas></div></div>
  </section>`;
}
/** "What would move the regime": sensitivity of the composite to each indicator, from the published weights (see regimeExplain.js). */
function regimeCard(L) {
  const E = explain(L); if (!E) return '';
  const pts = v => num(v, 1), li = (r, verb, d, sign) => `<li><a href="#radar" data-focus="${esc(r.id)}"><b>${esc(r.name)}</b></a> <span class="muted">score ${Math.round(r.score)}</span><br>${verb} <b>${sign}${pts(d)}</b> points &rarr; ${pts(r.to)}${r.regime !== E.regime ? ` (<b>${esc(r.regime)}</b>)` : ''}</li>`;
  return `<section class="card c12 rx"><div class="card-h"><h2>What would move the regime</h2><span class="muted small">A sensitivity, not a forecast</span></div>
   <p>The composite is <b>${pts(E.composite)}</b> (${esc(E.regime)}).${E.toNext ? ` It becomes <b>${esc(E.toNext.label)}</b> at ${E.toNext.at}, which is <b>${pts(E.toNext.points)}</b> points higher.` : ' This is the highest regime.'}${E.toPrev ? ` It would drop back to <b>${esc(E.toPrev.label)}</b> if it fell by <b>${pts(E.toPrev.points)}</b> points.` : ''}</p>
   <div class="rx-cols"><div><h3>What could push it up</h3><ul>${E.lift.map(r => li(r, 'Alone at its critical level the composite would rise by', r.up, '+')).join('') || '<li class="muted">Every weighted indicator is already at its extreme.</li>'}</ul></div>
   <div><h3>What is holding it up now</h3><ul>${E.hold.map(r => li(r, 'If it were fully calm the composite would fall by', r.down, '&minus;')).join('') || '<li class="muted">Nothing: every weighted indicator is already calm.</li>'}</ul></div></div>
   <p class="muted small">Each indicator is moved alone to its extreme with all others unchanged, using the published weights (experimental indicators carry none). Real moves are rarely this clean, and the thresholds are heuristics: see <a href="#learn/methodology">Methodology and limits</a>.</p></section>`;
}
function tiles(L) {
  const by = Object.fromEntries(L.indicators.map(i => [i.id, i]));
  const picks = KPI_IDS.map(id => by[id]).filter(i => i && i.status !== 'nodata');
  return `<section class="tiles c12">${picks.map(i => {
    const lab = { green: 'Normal', yellow: 'Warning', red: 'Alert', stale: 'Stale' }[i.status] || '';
    return `<a class="tile" href="#radar" data-focus="${esc(i.id)}"><div class="t-top"><span class="t-name">${esc(i.name)}</span><span class="t-st" style="color:${STATUS[i.status]}"><i style="background:${STATUS[i.status]}"></i>${lab}</span></div>
      <div class="t-val">${unitFmt(i.value, i.unit)}</div><div class="t-foot"><span class="t-d">${signed(i.chg_1m, 2)} <small>1M</small></span>${spark((i.hist || []).slice(-36), STATUS[i.status], 110, 30)}</div></a>`;
  }).join('')}</section>`;
}
function watchCard(L) {
  const ids = getWatch(), by = Object.fromEntries(L.indicators.map(i => [i.id, i])), picks = ids.map(id => by[id]).filter(Boolean);
  if (!picks.length) return `<div class="wl-empty">${icon('star', 18)}<span><b>Your watchlist is empty.</b> Open any indicator on the <a href="#radar">radar</a> and press <b>Watch</b> to pin it here. Pins stay in this browser only.</span></div>`;
  return `<div class="card-h" style="margin-bottom:10px"><h2>Your watchlist</h2><span class="muted small">${picks.length} pinned</span></div><div class="tiles wl">${picks.map(i => {
    const lab = { green: 'Normal', yellow: 'Warning', red: 'Alert', stale: 'Stale', nodata: 'No data' }[i.status] || '';
    return `<div class="tile"><button type="button" class="icon-btn wl-x" data-unwatch="${esc(i.id)}" aria-label="Remove ${esc(i.name)} from watchlist" title="Remove">${icon('x', 14)}</button><a class="wl-a" href="#radar" data-focus="${esc(i.id)}"><div class="t-top"><span class="t-name">${esc(i.name)}</span><span class="t-st" style="color:${STATUS[i.status]}"><i style="background:${STATUS[i.status]}"></i>${lab}</span></div>
      <div class="t-val">${i.status === 'nodata' ? '–' : unitFmt(i.value, i.unit)}</div><div class="t-foot"><span class="t-d">${signed(i.chg_1m, 2)} <small>1M</small></span>${spark((i.hist || []).slice(-36), STATUS[i.status], 110, 30)}</div></a></div>`;
  }).join('')}</div>`;
}
function renderWatch() { const el = $('#watchSlot'); if (el && D) el.innerHTML = watchCard(D.L); }
function attention(L) {
  const rows = [...L.indicators].filter(i => i.status !== 'nodata' && i.score != null).sort((a, b) => b.score - a.score).slice(0, 8);
  return `<section class="card c5"><div class="card-h"><h2>Needs attention</h2><a href="#radar" class="more">All indicators ${icon('arrow-right', 14)}</a></div>
    <div class="att">${rows.map(i => `<a class="att-row" href="#radar" data-focus="${esc(i.id)}"><span class="a-dot" style="background:${STATUS[i.status]}"></span><span class="a-name">${esc(i.name)}</span><span class="a-val">${unitFmt(i.value, i.unit)}</span>
      <span class="a-bar"><i style="width:${Math.min(100, i.score)}%;background:${STATUS[i.status]}"></i></span><span class="a-score">${Math.round(i.score)}</span></a>`).join('')}</div>
    <p class="muted small">Score: 0 calm, 50 at the warning threshold, 100 at the critical threshold.</p></section>`;
}
function yieldCard(Y) {
  if (!Y || !Y.curves || Y.curves.length < 30) return '';
  const last = Y.curves.length - 1, row = Y.curves[last], i10 = Y.maturities.indexOf('10Y'), i2 = Y.maturities.indexOf('2Y'), i3 = Y.maturities.indexOf('3M');
  const s = (a, b) => (row[a] != null && row[b] != null) ? Math.round((row[a] - row[b]) * 100) : null, s210 = s(i10, i2), s310 = s(i10, i3);
  const chip = (n, v) => v == null ? '' : `<span class="chip-s ${v < 0 ? 'neg' : ''}">${n} <b>${v > 0 ? '+' : ''}${v}bp</b>${v < 0 ? ' · inverted' : ''}</span>`;
  return `<section class="card c7"><div class="card-h"><h2>Yield curve</h2><a href="#yield" class="more">Explore history ${icon('arrow-right', 14)}</a></div>
    <div class="chips-s">${chip('10Y–2Y', s210)}${chip('10Y–3M', s310)}</div><div class="chartbox"><canvas id="ovYield" role="img" aria-label="US Treasury yield curve now, one year ago and two years ago"></canvas></div></section>`;
}
function areasCard(L) {
  const cats = [...(L.categories || [])].filter(c => c.score != null).sort((a, b) => b.score - a.score);
  if (!cats.length) return '';
  const tot = cats.reduce((a, c) => a + c.weight * c.score, 0) || 1;
  return `<section class="card c5"><div class="card-h"><h2>Risk by area</h2><a href="#radar" class="more">Heatmap ${icon('arrow-right', 14)}</a></div>
    <div class="areas">${cats.map(c => `<div class="area"><div class="ar-top"><span class="ar-name">${esc(c.name)}</span><span class="ar-w">${Math.round(c.weight * 100)}% weight</span><b class="ar-score" data-count="${Math.round(c.score)}">${Math.round(c.score)}</b></div>
      <div class="ar-track" role="img" aria-label="${esc(c.name)} risk ${Math.round(c.score)} of 100"><i style="width:${Math.max(3, c.score)}%;background:${scoreColor(c.score)}"></i><u style="left:25%"></u><u style="left:45%"></u><u style="left:65%"></u></div>
      <small>${Math.round(c.weight * c.score / tot * 100)}% of the composite</small></div>`).join('')}</div></section>`;
}
function countUp(root) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  $$('[data-count]', root).forEach(el => { const to = +el.dataset.count, t0 = performance.now(), d = 900;
    const f = t => { const k = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * e); if (k < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); });
}
function trendsCard(M) {
  if (!M || !(M.trends || []).length) return '';
  const pr = { 'Smart Money Stealth': 0, 'Mainstream Trend': 1, 'Retail Hype / Bubble': 2, 'Dormant / Seed': 3 };
  const rows = [...M.trends].filter(t => t.nvs != null && t.capital && t.capital.score != null).sort((a, b) => (pr[a.quadrant] ?? 4) - (pr[b.quadrant] ?? 4) || b.capital.score - a.capital.score).slice(0, 6);
  return `<section class="card c7"><div class="card-h"><h2>Trend radar</h2><a href="#narratives" class="more">All trends ${icon('arrow-right', 14)}</a></div>
    <div class="trs"><div class="trs-h"><span>Trend</span><span>Attention</span><span>Capital</span><span></span></div>${rows.map(t => `<a class="trs-row" href="#narratives"><span class="tr-name"><b>${esc(t.name)}</b><small>${esc(t.sector)} · ${esc(t.horizon)}</small></span>
      <span class="tr-bar"><i style="width:${t.nvs}%;background:var(--acc)"></i><em>${Math.round(t.nvs)}</em></span><span class="tr-bar"><i style="width:${t.capital.score}%;background:var(--ok)"></i><em>${Math.round(t.capital.score)}</em></span>
      <span>${t.quadrant ? `<span class="pill ${QUAD_CLASS[t.quadrant]}">${esc(t.quadrant)}</span>` : ''}</span></a>`).join('')}</div></section>`;
}
function feedCard(A, M) {
  const ev = ((A && A.events) || []).slice(0, 6).map(e => ({ ts: e.ts, title: e.title, detail: e.detail, sev: e.severity, ic: e.kind === 'regime' ? 'gauge' : e.kind === 'indicator' ? 'triangle-alert' : 'trending-up', href: e.kind === 'quadrant' ? '#narratives' : '#radar' }));
  const sg = ((M && M.signals) || []).filter(s => s.strength === 'High').slice(0, 4).map(s => ({ ts: s.ts, title: s.title, detail: s.trend_name, sev: 'signal', ic: 'fish', href: '#smart' }));
  const all = [...ev, ...sg].sort((a, b) => String(b.ts).localeCompare(String(a.ts))).slice(0, 6);
  if (!all.length) return `<section class="card c12"><div class="card-h"><h2>What changed</h2></div>${emptyState('bell', 'Nothing has changed yet', 'Regime moves, indicators turning red and trend quadrant changes appear here as the scheduled runs find them. Subscribe to the <a href="data/feed.xml">Atom feed</a> to get them elsewhere.')}</section>`;
  return `<section class="card c12"><div class="card-h"><h2>What changed</h2><a href="data/feed.xml" class="more">${icon('bell', 14)} Feed</a></div>
    <div class="feed">${all.map((e, n) => `<a class="f-row" style="--i:${n}" href="${e.href}"><span class="f-ic ${e.sev}">${icon(e.ic, 15)}</span><span class="f-body"><b>${esc(e.title)}</b><small>${esc(e.detail || '')}</small></span><time>${esc(rel(e.ts))}</time></a>`).join('')}</div></section>`;
}

/* ---------------- charts ---------------- */
function destroyCharts() { charts.forEach(c => c.destroy()); charts = []; }
function buildCharts(ctx) {
  destroyCharts(); const { BT, H, Y } = ctx, acc = cssVar('--acc');
  const series = (BT ? BT.composite_series : H ? H.months.map((m, k) => [m, H.composite[k]]).filter(p => p[1] != null) : []).slice(range ? -range : 0);
  const el = $('#ovComposite');
  if (el && series.length > 2) {
    const bands = { id: 'bands', beforeDatasetsDraw(c) { const { ctx: g, chartArea: a, scales: { y } } = c; g.save(); [[0, 25, '--ok'], [25, 45, '--warn'], [45, 65, '--orange'], [65, 100, '--bad']].forEach(([lo, hi, col]) => { const t = y.getPixelForValue(hi), b = y.getPixelForValue(lo); g.globalAlpha = .07; g.fillStyle = cssVar(col); g.fillRect(a.left, t, a.right - a.left, b - t); }); g.restore(); } };
    charts.push(new Chart(el, { type: 'line', plugins: [bands], data: { labels: series.map(p => p[0]), datasets: [{ data: series.map(p => p[1]), borderColor: acc, borderWidth: 2.2, tension: .35, pointRadius: 0, pointHoverRadius: 4, fill: true, backgroundColor: c => fade(c.chart.ctx, acc) }] },
      options: Object.assign(chartBase(), { scales: { x: axis({ grid: { display: false }, ticks: { color: cssVar('--muted'), font: { family: cssVar('--mono'), size: 11 }, maxTicksLimit: 6, maxRotation: 0, padding: 8, callback(v) { const l = String(this.getLabelForValue(v)); return series.length > 24 ? l.slice(0, 4) : l.slice(2, 4) + '/' + l.slice(5, 7).replace(/^0/, ''); } } }), y: axis({ min: 0, max: 100, ticks: { stepSize: 25, color: cssVar('--muted'), font: { family: cssVar('--mono'), size: 11 }, padding: 8 } }) } }) }));
  }
  const ey = $('#ovYield');
  if (ey && Y) {
    const last = Y.curves.length - 1, mk = (k, label, color, w, dash, fillIt) => { const row = Y.curves[k] && fillNulls(Y.curves[k]); const [yy, mm] = (Y.dates[k] || '').split('-'); return row && { label: `${label} (${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+mm - 1]} ${yy})`, data: row, borderColor: color, borderWidth: w, borderDash: dash, tension: .35, pointRadius: 0, pointHoverRadius: 4, fill: fillIt, backgroundColor: fillIt ? (c => fade(c.chart.ctx, color)) : undefined }; };
    const ds = [mk(last - 24, '2 years ago', cssVar('--line2'), 1.5, [], false), mk(last - 12, '1 year ago', cssVar('--muted'), 1.6, [5, 4], false), mk(last, 'Latest', acc, 2.4, [], true)].filter(Boolean);
    charts.push(new Chart(ey, { type: 'line', data: { labels: Y.maturities, datasets: ds }, options: Object.assign(chartBase(), { plugins: Object.assign(chartBase().plugins, { legend: { display: true, position: 'bottom', labels: { color: cssVar('--muted'), usePointStyle: true, boxWidth: 7, boxHeight: 7, font: { family: cssVar('--sans'), size: 12 } } },
      tooltip: Object.assign(chartBase().plugins.tooltip, { callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y.toFixed(2)}%` } }) }), scales: { x: axis({ grid: { display: false } }), y: axis({ ticks: { callback: v => v.toFixed(1) + '%', color: cssVar('--muted'), font: { family: cssVar('--mono'), size: 11 }, padding: 8 } }) } }) }));
  }
}

/* ---------------- load ---------------- */
async function load() {
  if (loaded) return; loaded = true; const root = $('#view-overview');
  const [L, M, H, BT, Y, A] = await Promise.all([getJSON('data/indicators/latest.json').catch(() => null), loadTrends(), getJSON('data/indicators/heatmap.json').catch(() => null), getJSON('data/indicators/backtest.json').catch(() => null),
    getJSON('data/indicators/yield_curve.json').catch(() => null), getJSON('data/alerts.json').catch(() => null)]);
  if (!L) { root.innerHTML = '<div class="card"><div class="notice">No indicator data yet. Open the repo Actions tab, run <b>Data · macro indicators</b>, and refresh.</div></div>'; return; }
  D = { L, M, H, BT, Y, A };
  root.innerHTML = `<div class="bento">${hero(L, BT, H)}${tiles(L)}${regimeCard(L)}<section class="c12" id="watchSlot"></section>${areasCard(L)}${yieldCard(Y)}${attention(L)}${trendsCard(M)}${feedCard(A, M)}</div>`;
  glossify(root.querySelector('.oh-text')); glossify(root.querySelector('.rx'));
  renderWatch(); countUp(root); tickNumbers(root);
  try { await loadScript('vendor/chart.umd.js'); buildCharts(D); } catch (e) { console.warn('[overview] charts unavailable', e); }
  root.addEventListener('click', e => {
    const u = e.target.closest('[data-unwatch]');
    if (u) { const id = u.dataset.unwatch; toggleWatch(id); toast('Removed from watchlist', { action: 'Undo', onAction: () => toggleWatch(id) }); return; }
    const r = e.target.closest('[data-range]');
    if (r) { range = +r.dataset.range; $$('[data-range]', root).forEach(b => { const on = b === r; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); if (window.Chart) buildCharts(D); return; }
    const a = e.target.closest('[data-focus]'); if (a) { window.__focusIndicator = a.dataset.focus; document.dispatchEvent(new CustomEvent('focus-indicator', { detail: a.dataset.focus })); } });
}
export function initOverview() {
  onTab('overview', load);
  document.addEventListener('watchchange', renderWatch);
  document.addEventListener('themechange', () => { if (loaded && D && window.Chart) buildCharts(D); });
}
