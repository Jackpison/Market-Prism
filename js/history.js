// Daily composite history (data/history/composite_daily.csv): parsing, resampling to weeks and months, and "where today sits" statistics.
// Pure functions (no DOM) so they can be unit-tested with node. Every number here is computed from the file; nothing is typed in.

/** Parse the CSV text. Rows: { d: 'YYYY-MM-DD', c: composite, cats: {id: score|null}, n: indicators with data, src: 'recon'|'live'|'fill' }. Returns null when unusable. */
export function parseHistory(text) {
  const lines = String(text || '').trim().split(/\r?\n/); if (lines.length < 3) return null;
  const head = lines[0].split(','), at = k => head.indexOf(k);
  if (at('date') < 0 || at('composite') < 0) return null;
  const cats = head.filter(h => !['date', 'composite', 'n', 'src'].includes(h)), rows = [];
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i].split(','), c = parseFloat(p[at('composite')]);
    if (!p[0] || !isFinite(c)) continue;
    rows.push({ d: p[at('date')], c, n: at('n') < 0 ? null : +p[at('n')], src: at('src') < 0 ? '' : p[at('src')], cats: Object.fromEntries(cats.map(k => [k, p[at(k)] === '' || p[at(k)] == null ? null : parseFloat(p[at(k)])])) });
  }
  return rows.length > 2 ? { rows, categories: cats } : null;
}

const day = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
/** Monday of the ISO week that contains the date, as 'YYYY-MM-DD' (the key that groups days into weeks). */
export function weekKey(d) { const t = new Date(day(d)), wd = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - wd); return t.toISOString().slice(0, 10); }

/** Keep the LAST row of each period: 'D' every day, 'W' every ISO week, 'M' every calendar month. The last row is the period-end value, so the newest point is always today. */
export function resample(rows, res) {
  if (res === 'D') return rows.slice();
  const key = res === 'W' ? r => weekKey(r.d) : r => r.d.slice(0, 7), out = [];
  for (const r of rows) { if (out.length && key(out[out.length - 1]) === key(r)) out[out.length - 1] = r; else out.push(r); }
  return out;
}

/** Rows of the last `years` years counted back from the final date (0 = everything). */
export function lastYears(rows, years) {
  if (!years || !rows.length) return rows;
  const end = rows[rows.length - 1].d, cut = `${+end.slice(0, 4) - years}${end.slice(4)}`;
  return rows.filter(r => r.d >= cut);
}

/** Sensible default resolution for a range: daily detail for a year, weekly for a few years, monthly beyond that. */
export const autoRes = years => (years && years <= 1 ? 'D' : years && years <= 10 ? 'W' : 'M');

/** Where today's composite sits in the file, from `regimes` [{max,label}]. Returns null if there is too little data. */
export function outlook(rows, regimes) {
  if (!rows || rows.length < 30 || !regimes || !regimes.length) return null;
  const last = rows[rows.length - 1], regimeOf = c => (regimes.find(r => c < r.max) || regimes[regimes.length - 1]).label;
  const lower = rows.filter(r => r.c < last.c).length, cur = regimeOf(last.c);
  let i = rows.length - 1; while (i > 0 && regimeOf(rows[i - 1].c) === cur) i--;
  const start = rows[i].d, startedAtBeginning = i === 0;
  const year = lastYears(rows, 1), vals = year.map(r => r.c);
  const counts = Object.fromEntries(regimes.map(r => [r.label, 0])); rows.forEach(r => { counts[regimeOf(r.c)]++; });
  const withN = rows.filter(r => r.n != null);
  return {
    now: last.c, regime: cur, date: last.d, first: rows[0].d, days: rows.length,
    pctLower: Math.round(lower / rows.length * 100),
    spell: { since: start, days: Math.round((day(last.d) - day(start)) / 864e5), fromStart: startedAtBeginning },
    year: { min: Math.min(...vals), max: Math.max(...vals), avg: vals.reduce((a, b) => a + b, 0) / vals.length, from: year[0].d },
    share: regimes.map(r => ({ label: r.label, pct: counts[r.label] / rows.length * 100 })),
    coverage: withN.length ? { first: { d: withN[0].d, n: withN[0].n }, last: { d: withN[withN.length - 1].d, n: withN[withN.length - 1].n } } : null,
    live: (rows.find(r => r.src === 'live') || {}).d || null,
  };
}

let _p = null;
/** Fetch and parse the history file once; resolves to null if it is missing or malformed (the page then keeps its monthly chart). */
export function loadHistory(url = 'data/history/composite_daily.csv') {
  if (!_p) _p = fetch(url).then(r => r.ok ? r.text() : null).then(parseHistory).catch(() => null);
  return _p;
}

/** Parse a per-indicator file (date,value). Rows: { d, c } so resample/lastYears work on it unchanged. Null when unusable. */
export function parseSeries(text) {
  const lines = String(text || '').trim().split(/\r?\n/); if (lines.length < 4 || lines[0].trim() !== 'date,value') return null;
  const rows = []; for (let i = 1; i < lines.length; i++) { const p = lines[i].split(','), c = parseFloat(p[1]); if (p[0] && isFinite(c)) rows.push({ d: p[0], c }); }
  return rows.length > 2 ? rows : null;
}

/** Native resolution of a series from the median gap between its last observations: 'D' (<=4 days), 'W' (<=10) or 'M'. Finer views would only repeat values. */
export function nativeRes(rows) {
  const t = rows.slice(-60), g = []; for (let i = 1; i < t.length; i++) g.push((day(t[i].d) - day(t[i - 1].d)) / 864e5);
  if (!g.length) return 'M'; g.sort((a, b) => a - b); const m = g[g.length >> 1];
  return m <= 4 ? 'D' : m <= 10 ? 'W' : 'M';
}
const ORDER = { D: 0, W: 1, M: 2 };
/** Resolutions a series can honestly show: its native one and anything coarser. */
export const allowedRes = native => ['D', 'W', 'M'].filter(r => ORDER[r] >= ORDER[native]);

const _s = {};
/** Fetch one indicator's history once; resolves to null if the file is missing (the drawer keeps its 3-year monthly chart). */
export function loadIndicator(id, base = 'data/history/ind/') {
  if (!_s[id]) _s[id] = fetch(base + encodeURIComponent(id) + '.csv').then(r => r.ok ? r.text() : null).then(parseSeries).catch(() => null);
  return _s[id];
}
