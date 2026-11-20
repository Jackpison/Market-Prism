import { $, $$, esc, getJSON, num, signed, unitFmt, STATUS, cssVar, loadScript, onTab } from '../util.js';
import { icon } from '../icons.js';
import { loadTrends, QUAD_CLASS } from '../trendsData.js';
import { spark } from '../charts/spark.js';

// Overview: the home page. Everything here is derived from files the pipeline already writes; each block degrades to nothing when its data is missing.
let loaded = false, D = null, charts = [];
const KPI_IDS = ['t10y2y', 'vix', 'hyoas', 'netliq', 'usd', 'oil'];
const REGIME_TEXT = {
  Calm: 'Conditions look benign: few indicators are near their warning thresholds.',
  Watch: 'Some stress is building, but there is no broad deterioration. Worth monitoring, not acting on.',
  Elevated: 'Multiple indicators are in warning territory at once. Late-cycle risks are rising.',
  Critical: 'Broad stress across indicators. Historically this is where drawdowns and credit events cluster.',
};
const SEG = [[0, 25, '--ok'], [25, 45, '--warn'], [45, 65, '--orange'], [65, 100, '--bad']];
const rel = iso => { const t = Date.parse(iso || ''); if (isNaN(t)) return ''; const h = (Date.now() - t) / 3600e3; return h < 1 ? 'just now' : h < 24 ? Math.round(h) + 'h ago' : Math.round(h / 24) + 'd ago'; };

/* ---------------- gauge ---------------- */
const A0 = 135, SWEEP = 270, CX = 100, CY = 100, R = 78;
const ang = v => A0 + SWEEP * Math.max(0, Math.min(100, v)) / 100;
const pt = a => [CX + R * Math.cos(a * Math.PI / 180), CY + R * Math.sin(a * Math.PI / 180)];
function arc(v0, v1, gap = 0) { const a0 = ang(v0) + gap, a1 = ang(v1) - gap, [x0, y0] = pt(a0), [x1, y1] = pt(a1); return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`; }
function gauge(score, regimeVar) {
  const len = (R * Math.PI * SWEEP / 180 * score / 100).toFixed(1);
  return `<svg class="gauge-svg" viewBox="0 0 200 200" role="img" aria-label="Composite risk ${Math.round(score)} out of 100">
    ${SEG.map(([a, b, v]) => `<path d="${arc(a, b, 0.9)}" fill="none" stroke="var(${v})" stroke-width="11" opacity=".26"/>`).join('')}
    <path class="g-prog" d="${arc(0, score)}" fill="none" stroke="var(${regimeVar})" stroke-width="11" stroke-linecap="round" style="--len:${len}"/>
    <text x="100" y="108" text-anchor="middle" class="g-num">${Math.round(score)}</text><text x="100" y="132" text-anchor="middle" class="g-sub">of 100</text></svg>`;
}

/* ---------------- helpers ---------------- */
const regimeVar = r => ({ Calm: '--ok', Watch: '--warn', Elevated: '--orange', Critical: '--bad' }[r] || '--acc');
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
    <div class="oh-gauge">${gauge(score, rv)}<div class="oh-legend">${SEG.map(([a, b, v], k) => `<span class="${['Calm', 'Watch', 'Elevated', 'Critical'][k] === r ? 'on' : ''}"><i style="background:var(${v})"></i>${['Calm', 'Watch', 'Elevated', 'Critical'][k]}</span>`).join('')}</div></div>
    <div class="oh-text"><div class="eyebrow">Market regime ${delta}</div><div class="oh-regime">${esc(r)}</div>
      <p class="oh-lead">${esc(REGIME_TEXT[r] || '')}${top.length ? ` Pressure is coming mainly from <b>${top.map(esc).join('</b> and <b>')}</b>.` : ''}</p>
      <div class="oh-counts"><span><b>${red}</b> alert</span><span><b>${yel}</b> warning</span><span><b>${ok}</b> normal</span></div>
      ${cred ? `<p class="oh-cred">${cred}</p>` : ''}</div>
    <div class="oh-chart"><div class="oh-chart-h"><span>Composite risk, last 5 years</span></div><div class="chartbox"><canvas id="ovComposite" role="img" aria-label="Composite risk score over the last five years"></canvas></div></div>
  </section>`;
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
function attention(L) {
  const rows = [...L.indicators].filter(i => i.status !== 'nodata' && i.score != null).sort((a, b) => b.score - a.score).slice(0, 6);
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
  if (!all.length) return '';
  return `<section class="card c5"><div class="card-h"><h2>What changed</h2><a href="data/feed.xml" class="more">${icon('bell', 14)} Feed</a></div>
    <div class="feed">${all.map(e => `<a class="f-row" href="${e.href}"><span class="f-ic ${e.sev}">${icon(e.ic, 15)}</span><span class="f-body"><b>${esc(e.title)}</b><small>${esc(e.detail || '')}</small></span><time>${esc(rel(e.ts))}</time></a>`).join('')}</div></section>`;
}

/* ---------------- charts ---------------- */
function destroyCharts() { charts.forEach(c => c.destroy()); charts = []; }
function buildCharts(ctx) {
  destroyCharts(); const { BT, H, Y } = ctx, acc = cssVar('--acc');
  const series = (BT ? BT.composite_series : H ? H.months.map((m, k) => [m, H.composite[k]]).filter(p => p[1] != null) : []).slice(-60);
  const el = $('#ovComposite');
  if (el && series.length > 2) {
    const bands = { id: 'bands', afterDatasetsDraw(c) { const { ctx: g, chartArea: a, scales: { y } } = c; g.save(); g.setLineDash([3, 4]); g.lineWidth = 1; [[25, '--ok'], [45, '--warn'], [65, '--orange']].forEach(([v, col]) => { const py = y.getPixelForValue(v); g.strokeStyle = cssVar(col); g.globalAlpha = .55; g.beginPath(); g.moveTo(a.left, py); g.lineTo(a.right, py); g.stroke(); }); g.restore(); } };
    charts.push(new Chart(el, { type: 'line', plugins: [bands], data: { labels: series.map(p => p[0]), datasets: [{ data: series.map(p => p[1]), borderColor: acc, borderWidth: 2.2, tension: .35, pointRadius: 0, pointHoverRadius: 4, fill: true, backgroundColor: c => fade(c.chart.ctx, acc) }] },
      options: Object.assign(chartBase(), { scales: { x: axis({ grid: { display: false }, ticks: { color: cssVar('--muted'), font: { family: cssVar('--mono'), size: 11 }, maxTicksLimit: 6, maxRotation: 0, padding: 8, callback(v) { return String(this.getLabelForValue(v)).slice(0, 4); } } }), y: axis({ min: 0, max: 100, ticks: { stepSize: 25, color: cssVar('--muted'), font: { family: cssVar('--mono'), size: 11 }, padding: 8 } }) } }) }));
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
  if (!L) { root.innerHTML = '<div class="card"><div class="notice">No indicator data yet. Open the repo Actions tab, run <b>Update data</b>, and refresh.</div></div>'; return; }
  D = { L, M, H, BT, Y, A };
  root.innerHTML = `<div class="bento">${hero(L, BT, H)}${tiles(L)}${attention(L)}${yieldCard(Y)}${trendsCard(M)}${feedCard(A, M)}</div>`;
  try { await loadScript('vendor/chart.umd.js'); buildCharts(D); } catch (e) { console.warn('[overview] charts unavailable', e); }
  root.addEventListener('click', e => { const a = e.target.closest('[data-focus]'); if (a) { window.__focusIndicator = a.dataset.focus; document.dispatchEvent(new CustomEvent('focus-indicator', { detail: a.dataset.focus })); } });
}
export function initOverview() {
  onTab('overview', load);
  document.addEventListener('themechange', () => { if (loaded && D && window.Chart) buildCharts(D); });
}
