import { icon } from '../icons.js';
import { $, $$, esc, getJSON, num, signed, unitFmt, STATUS, scoreColor, onTab, RUN_HINT } from '../util.js';
import { drawRadar } from '../charts/radar.js';
import { drawHeatmap } from '../charts/heatmap.js';
import { lineChart } from '../charts/linechart.js';
import { spark } from '../charts/spark.js';
import { gauge, gaugeLegend, REGIME_TEXT, regimeVar } from '../charts/gauge.js';

let loaded = false, D = null, HM = null, BT = null, AL = null, filter = 'all', attentionOnly = false, selId = null, opener = null;
const STATUS_LABEL = { green: 'OK', yellow: 'WARN', red: 'ALERT', nodata: 'NO DATA', stale: 'STALE' };
const STATUS_WORD = { green: 'Normal', yellow: 'Warning', red: 'Alert', nodata: 'No data', stale: 'Stale' };
const PILL = { green: 'st-live', yellow: 'st-partial', red: 'st-failed', nodata: 'st-unconfigured', stale: 'st-unconfigured' };
const rel = iso => { const t = Date.parse(iso || ''); if (isNaN(t)) return ''; const h = (Date.now() - t) / 3600e3; return h < 1 ? 'just now' : h < 24 ? Math.round(h) + 'h ago' : Math.round(h / 24) + 'd ago'; };

async function load() {
  if (loaded) return; loaded = true;
  const root = $('#view-radar');
  try { D = await getJSON('data/indicators/latest.json'); } catch (e) { root.innerHTML = `<div class="card"><h2>Early-warning radar</h2><div class="notice">${RUN_HINT}</div></div>`; return; }
  try { HM = await getJSON('data/indicators/heatmap.json'); } catch (e) { HM = null; }
  try { BT = await getJSON('data/indicators/backtest.json'); } catch (e) { BT = null; }
  try { AL = await getJSON('data/alerts.json'); } catch (e) { AL = null; }
  render(root);
}

function hero() {
  const cov = D.coverage, c = D.composite, r = D.regime, rv = regimeVar(r);
  const live = D.indicators.filter(i => i.status !== 'nodata'), red = live.filter(i => i.status === 'red').length, yel = live.filter(i => i.status === 'yellow').length;
  return `<section class="card ov-hero c12" style="--rc:var(${rv})">
    <div class="oh-gauge">${c == null ? '<div class="g-empty">–</div>' : gauge(c, rv)}${gaugeLegend(r)}</div>
    <div class="oh-text"><div class="eyebrow">Composite risk</div><div class="oh-regime">${esc(r || 'Insufficient data')}</div>
      <p class="oh-lead">${esc(REGIME_TEXT[r] || '')}</p>
      <div class="oh-counts"><span><b>${red}</b> alert</span><span><b>${yel}</b> warning</span><span><b>${live.length - red - yel}</b> normal</span></div>
      <p class="oh-cred">Data as of ${esc(D.generated)} UTC. ${cov.with_data} of ${cov.total} indicators have fresh data.</p>
      ${cov.with_data < 8 ? `<div class="notice">Only ${cov.with_data} of ${cov.total} indicators have data, so the composite is incomplete. ${RUN_HINT}</div>` : ''}</div>
    <div class="oh-radar"><svg id="radar" class="radar" role="img" aria-label="Category risk radar"></svg></div>
  </section>`;
}

function catTiles() {
  const by = {}; D.indicators.forEach(i => (by[i.cat] = by[i.cat] || []).push(i));
  return `<section class="tiles c12 cats">${D.categories.map(k => {
    const inds = (by[k.id] || []).filter(i => i.status !== 'nodata' && i.score != null), top = [...inds].sort((a, b) => b.score - a.score)[0], n = (by[k.id] || []).length;
    const st = k.score == null ? 'nodata' : k.score >= 100 ? 'red' : k.score >= 50 ? 'yellow' : 'green';
    return `<button type="button" class="tile cat-tile" data-f="${k.id}"><div class="t-top"><span class="t-name">${esc(k.name)}</span><span class="t-st" style="color:${STATUS[st]}"><i style="background:${STATUS[st]}"></i>${STATUS_WORD[st]}</span></div>
      <div class="t-val">${k.score == null ? '–' : Math.round(k.score)}<small>/100</small></div>
      <div class="a-bar"><i style="width:${k.score ?? 0}%;background:${scoreColor(k.score)}"></i></div>
      <div class="t-d">${n} indicators${top ? ` · highest: ${esc(top.name.split(',')[0].split('(')[0].trim())}` : ''}</div></button>`;
  }).join('')}</section>`;
}

function render(root) {
  root.innerHTML = `<div class="bento">
    ${hero()}
    ${catTiles()}
    <section class="card c12" id="matrixCard"><div class="card-h mx-h"><h2>Indicator matrix</h2>
      <div class="mx-ctl"><div class="seg" id="statseg" role="group" aria-label="Status filter"><button type="button" data-a="0" class="on" aria-pressed="true">All</button><button type="button" data-a="1" aria-pressed="false">Needs attention</button></div>
      <div class="seg" id="catchips" role="group" aria-label="Category filter"></div></div></div>
      <div class="tw"><table class="matrix"><thead><tr><th></th><th>Indicator</th><th class="n">Latest</th><th class="n">1M chg</th><th class="n">3M chg</th><th class="n">10Y pctile</th><th>Risk</th><th>3Y trend</th></tr></thead><tbody id="mbody"></tbody></table></div>
      <p class="muted small">Select a row for the trigger logic, thresholds, history and sources. Score: 0 calm, 50 at the warning threshold, 100 at the critical threshold. Thresholds are heuristics editable in <code>config/indicators.json</code>.</p></section>
    ${AL ? alertsCard() : ''}
    ${HM ? `<section class="card ${AL ? 'c7' : 'c12'}"><div class="card-h"><h2>Composite history</h2></div><svg id="comp" class="lc"></svg></section>
    <section class="card c12"><div class="card-h"><h2>Risk heatmap</h2></div><p class="muted small">Each cell is the indicator's risk score at month end, last ${HM.months.length} months. Darker red means higher risk. Grey = no data. Credit-spread history on FRED is limited to roughly 3 years.</p><svg id="hm" class="hm"></svg></section>` : ''}
    ${BT ? trackCard() : ''}
  </div>`;
  drawRadar($('#radar'), D.categories);
  $('#radar').setAttribute('aria-label', 'Category risk radar. ' + D.categories.map(k => `${k.name} ${k.score == null ? 'no data' : Math.round(k.score)}`).join(', ') + '. Scale 0 to 100.');
  $('#catchips').innerHTML = [['all', 'All'], ...D.categories.map(k => [k.id, k.name.split(',')[0].split(' ')[0]])].map(([id, n]) => `<button type="button" class="${filter === id ? 'on' : ''}" data-f="${id}" aria-pressed="${filter === id}">${esc(n)}</button>`).join('');
  $('#catchips').onclick = e => { const f = e.target.dataset?.f; if (f) setFilter(f); };
  $('#statseg').onclick = e => { const a = e.target.dataset?.a; if (a == null) return; attentionOnly = a === '1'; $$('#statseg button').forEach(b => { const on = (b.dataset.a === '1') === attentionOnly; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); renderRows(); };
  $$('.cat-tile', root).forEach(t => t.onclick = () => { setFilter(t.dataset.f); $('#matrixCard').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); });
  renderRows(); mountDrawer();
  if (HM) {
    drawHeatmap($('#hm'), HM);
    $('#hm').setAttribute('role', 'img'); $('#hm').setAttribute('aria-label', `Risk heatmap of ${HM.rows.length} indicators over the last ${HM.months.length} months; darker red means higher risk. The indicator table above has the same latest values as text.`);
    const pts = BT && BT.composite_series.length > 24 ? BT.composite_series : HM.months.map((m, i) => [m, HM.composite[i]]).filter(p => p[1] != null);
    $('#comp').setAttribute('role', 'img'); $('#comp').setAttribute('aria-label', `Composite risk score history from ${pts[0][0]} to ${pts[pts.length - 1][0]}; latest ${Math.round(pts[pts.length - 1][1])} of 100.`);
    lineChart($('#comp'), pts, { lines: [{ y: 25, cls: 'ok' }, { y: 45, cls: 'warn' }, { y: 65, cls: 'bad' }], fmt: v => String(Math.round(v) || 0), height: 230 });
  }
}

function setFilter(f) { filter = f; $$('#catchips button').forEach(b => { const on = b.dataset.f === f; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); renderRows(); }

function alertsCard() {
  const ev = (AL.events || []).slice(0, 6), IC = { regime: 'gauge', indicator: 'triangle-alert', quadrant: 'trending-up' };
  return `<section class="card c5"><div class="card-h"><h2>Recent alerts</h2><a class="more" href="data/feed.xml">${icon('bell', 14)} Atom feed</a></div>
   ${ev.length ? `<div class="feed one">${ev.map(x => `<div class="f-row"><span class="f-ic ${esc(x.severity)}">${icon(IC[x.kind] || 'bell', 15)}</span><span class="f-body"><b title="${esc(x.title)}">${esc(x.title)}</b><small>${esc(x.detail)}</small></span><time>${esc(rel(x.ts))}</time></div>`).join('')}</div>`
     : '<p class="muted small">No regime changes, indicator breaches or quadrant moves recorded yet. Alerts are logged after each scheduled data run; serious ones also open a GitHub issue.</p>'}</section>`;
}

/** Verdict from backtest AUC: skill is judged against 0.5 (coin flip). Wording is deliberately cautious: very few independent events. */
const verdict = a => a == null ? ['n/a', 'st-unconfigured'] : a >= 0.65 ? ['Useful', 'st-live'] : a >= 0.55 ? ['Weak', 'st-partial'] : ['No skill', 'st-failed'];
function trackCard() {
  const cell = (r, k) => { const t = r.recession[k]; return t.hit_rate == null ? '<span class="muted">n/a</span>' : `${Math.round(t.hit_rate * 100)}% <span class="muted">(${t.hits}/${t.events_covered})</span>`; };
  const row = (r, k) => {
    if (!r.recession) return `<tr><td><b>${esc(r.name)}</b></td><td colspan="7" class="muted">Not enough history to backtest${r.note ? ' (' + esc(r.note) + ')' : ''}. FRED serves only ~3 years of credit-spread data.</td></tr>`;
    const a = r.recession, b = r.drawdown, [vt, vc] = verdict(a.auc), t = a[k];
    return `<tr><td><b>${esc(r.name)}</b></td><td class="n">${esc(r.coverage_from)}</td><td class="n">${a.auc == null ? '–' : a.auc.toFixed(2)}</td><td class="n">${cell(r, k)}</td>
      <td class="n">${t.median_lead_months == null ? '–' : t.median_lead_months + ' mo'}</td><td class="n">${t.false_alarm_share == null ? '–' : Math.round(t.false_alarm_share * 100) + '%'}</td>
      <td class="n">${b.auc == null ? '–' : b.auc.toFixed(2)}</td><td><span class="pill ${vc}">${vt}</span></td></tr>`;
  };
  const rows = [row(BT.composite, 't45'), ...BT.indicators.map(r => row(r, 't50'))].join('');
  return `<section class="card c12"><div class="card-h"><h2>Track record</h2></div><p class="lead-s">Did each signal fire before downturns?</p>
   <p class="muted small">Backtest on month-end data (${esc(BT.sample)}). Recessions began ${BT.targets.recession.events.map(esc).join(', ')}; S&amp;P 500 bear markets peaked ${BT.targets.drawdown.events.map(esc).join(', ')}.
   <b>AUC</b> 0.5 = coin flip, 1.0 = perfect. <b>Hit rate</b>: share of recessions preceded by a warning (score &ge; 50; composite &ge; 45) in the prior 18 months. <b>False alarms</b>: share of warning episodes not followed by a recession within 18 months.</p>
   <div class="tw"><table class="matrix"><thead><tr><th>Signal</th><th class="n">Data from</th><th class="n">Recession AUC</th><th class="n">Hit rate</th><th class="n">Median lead</th><th class="n">False alarms</th><th class="n">Bear-mkt AUC</th><th>Verdict</th></tr></thead><tbody>${rows}</tbody></table></div>
   <div class="notice warn"><b>Read with care.</b> ${BT.caveats.map(esc).join(' ')}</div></section>`;
}

function renderRows() {
  const rows = D.indicators.filter(r => (filter === 'all' || r.cat === filter) && (!attentionOnly || r.status === 'yellow' || r.status === 'red'));
  $('#mbody').innerHTML = rows.length ? rows.map(r => {
    const st = r.status, flag = (r.flags || []).length ? ' <span class="flag" title="' + esc(r.flags.join('; ')) + '">' + icon('flag', 13) + '</span>' : '';
    return `<tr data-id="${r.id}" tabindex="0" role="button" aria-label="${esc(r.name)}: ${STATUS_WORD[st]}. Open details" class="${selId === r.id ? 'sel' : ''}"><td><span class="dot" style="background:${STATUS[st]}" title="${STATUS_LABEL[st]}"></span></td>
      <td><b>${esc(r.name)}</b>${flag}<div class="muted small">${esc(r.cat)} &middot; ${esc(r.freq)}${st === 'yellow' || st === 'red' ? ` &middot; <span class="st-txt" style="color:${STATUS[st]}">${STATUS_WORD[st]}</span>` : ''}${r.weight === 0 ? ' &middot; unscored' : ''}</div></td>
      <td class="n">${st === 'nodata' ? '<span class="muted">no data</span>' : unitFmt(r.value, r.unit)}</td>
      <td class="n">${signed(r.chg_1m, 2)}</td><td class="n">${signed(r.chg_3m, 2)}</td><td class="n">${r.pctile_10y == null ? '–' : r.pctile_10y.toFixed(0) + '%'}</td>
      <td><div class="bar"><i style="width:${r.score ?? 0}%;background:${scoreColor(r.score)}"></i></div></td>
      <td>${spark((r.hist || []).slice(-36), STATUS[st])}</td></tr>`;
  }).join('') : '<tr><td colspan="8" class="muted" style="padding:18px">Nothing needs attention in this category.</td></tr>';
  $('#mbody').onclick = e => { const tr = e.target.closest('tr[data-id]'); if (tr) select(tr.dataset.id, tr); };
  $('#mbody').onkeydown = e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset?.id) { e.preventDefault(); select(e.target.dataset.id, e.target); } };
}

/* ---- detail drawer ---- */
function mountDrawer() {
  if ($('#ewDetail')) return;
  document.body.insertAdjacentHTML('beforeend', '<div class="scrim dscrim" id="dScrim" hidden></div><aside id="ewDetail" class="drawer" role="dialog" aria-modal="true" aria-label="Indicator details" hidden></aside>');
  $('#dScrim').onclick = closeDrawer;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#ewDetail').hidden && document.body.classList.contains('pal-open') === false) closeDrawer(); });
}
function closeDrawer() {
  const el = $('#ewDetail'); if (!el || el.hidden) return;
  el.hidden = true; $('#dScrim').hidden = true; document.body.classList.remove('drawer-open'); selId = null; $$('#mbody tr').forEach(t => t.classList.remove('sel'));
  if (opener && opener.focus) opener.focus();
}

function select(id, from) {
  const r = D.indicators.find(x => x.id === id); if (!r) return;
  selId = id; if (from) opener = from; $$('#mbody tr').forEach(t => t.classList.toggle('sel', t.dataset.id === id));
  const el = $('#ewDetail'), st = r.status, dirTxt = r.direction === 'higher_worse' ? 'higher is worse' : 'lower is worse';
  const thr = `warn ${r.center != null ? 'beyond ' + r.warn + ' from ' + r.center : r.two_sided ? '|x| > ' + r.warn : r.warn}, critical ${r.center != null ? 'beyond ' + r.crit : r.two_sided ? '|x| > ' + r.crit : r.crit} (${dirTxt})`;
  el.innerHTML = `<div class="dr-h"><div><div class="eyebrow">${esc(r.cat)} · ${esc(r.freq)}</div><h2>${esc(r.name)}</h2></div><button type="button" class="icon-btn" id="closeD" aria-label="Close details">${icon('x', 16)}</button></div>
   <div class="dr-hero"><div class="dr-val">${st === 'nodata' ? '–' : unitFmt(r.value, r.unit)}</div><span class="pill ${PILL[st]}">${STATUS_WORD[st]}</span></div>
   <div class="dr-stats"><div><small>1M change</small><b>${signed(r.chg_1m, 2)}</b></div><div><small>3M change</small><b>${signed(r.chg_3m, 2)}</b></div><div><small>10Y percentile</small><b>${r.pctile_10y == null ? '–' : r.pctile_10y.toFixed(0) + '%'}</b></div><div><small>Risk score</small><b>${r.score == null ? '–' : Math.round(r.score)}</b></div></div>
   ${(r.hist || []).length > 2 ? '<svg id="dchart" class="lc"></svg>' : ''}
   ${(r.flags || []).map(f => `<div class="notice">${icon('triangle-alert', 14)} ${esc(f)}</div>`).join('')}
   <h3>Trigger logic</h3><p>${esc(r.logic)}</p><h3>Why it matters</h3><p>${esc(r.why)}</p>
   <h3>Thresholds</h3><p class="muted">${thr}.</p>
   <h3>Historical relevance</h3><ul class="eps">${Object.entries(r.history || {}).map(([k, v]) => `<li><b>${esc(k)}</b> ${esc(v)}</li>`).join('')}</ul>
   <h3>Tracking and sources</h3><p class="muted">${esc(r.track || '')}<br>${(r.sources || []).map(esc).join('; ')}</p>`;
  $('#closeD').onclick = closeDrawer;
  el.hidden = false; $('#dScrim').hidden = false; document.body.classList.add('drawer-open'); el.scrollTop = 0; $('#closeD').focus();
  if ((r.hist || []).length > 2) {
    const lines = [];
    if (r.center != null) { lines.push({ y: r.center + r.warn, cls: 'warn' }, { y: r.center - r.warn, cls: 'warn' }, { y: r.center + r.crit, cls: 'bad' }, { y: r.center - r.crit, cls: 'bad' }); }
    else if (r.two_sided) { lines.push({ y: r.warn, cls: 'warn' }, { y: -r.warn, cls: 'warn' }, { y: r.crit, cls: 'bad' }, { y: -r.crit, cls: 'bad' }); }
    else lines.push({ y: r.warn, cls: 'warn' }, { y: r.crit, cls: 'bad' });
    lineChart($('#dchart'), r.hist, { lines, fmt: v => num(v, Math.abs(v) >= 100 ? 0 : 2), height: 200 });
  }
}

export function initEarlyWarning() {
  const go = (id, n = 0) => { if (!id) return; if (!D || !$('#mbody tr[data-id]')) { if (n < 40) setTimeout(() => go(id, n + 1), 150); return; } if (D.indicators.some(x => x.id === id)) { select(id); window.__focusIndicator = null; } };
  onTab('radar', async () => { await load(); go(window.__focusIndicator); });
  document.addEventListener('focus-indicator', e => go(e.detail));
  addEventListener('hashchange', closeDrawer);
}
