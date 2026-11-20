// History chart with range (1Y/5Y/10Y/Max) and resolution (Day/Week/Month) controls. Used by the Radar composite card and the indicator drawer.
// rows: [{d:'YYYY-MM-DD', c:value}] ascending. native: the finest resolution the data really has; finer buttons stay disabled so nothing is faked.
import { resample, lastYears, autoRes, allowedRes } from '../history.js';
import { lineChart } from './linechart.js';
import { esc } from '../util.js';

const RANGES = [[1, '1Y'], [5, '5Y'], [10, '10Y'], [0, 'Max']], RES = [['D', 'Day'], ['W', 'Week'], ['M', 'Month']];

export function mountHistory(box, { rows, native = 'D', lines = [], fmt = v => String(v), height = 220, label = 'History', years = 5, svgId = '' }) {
  const spanY = (Date.parse(rows[rows.length - 1].d) - Date.parse(rows[0].d)) / 31557600000, ok = allowedRes(native);
  const ranges = RANGES.filter(([y]) => y === 0 || y < spanY - 0.5);
  let range = ranges.some(r => r[0] === years) ? years : 0, res = null;
  const eff = () => { const a = res && ok.includes(res) ? res : autoRes(range || spanY); return ok.includes(a) ? a : ok[0]; };
  box.innerHTML = `<div class="oh-res hc-ctl"><div class="seg" data-k="range" role="group" aria-label="${esc(label)} range">${ranges.map(([y, l]) => `<button type="button" data-v="${y}">${l}</button>`).join('')}</div>
    <div class="seg" data-k="res" role="group" aria-label="${esc(label)} resolution">${RES.map(([k, l]) => `<button type="button" data-v="${k}"${ok.includes(k) ? '' : ' disabled title="This series is not published that often"'}>${l}</button>`).join('')}</div><span class="muted small hc-n"></span></div><svg class="lc hc-svg"${svgId ? ` id="${esc(svgId)}"` : ''}></svg>`;
  const svg = box.querySelector('svg'), cnt = box.querySelector('.hc-n');
  const draw = () => {
    const r = eff(), pts = resample(lastYears(rows, range), r).map(x => [x.d, x.c]);
    box.querySelectorAll('[data-k=range] button').forEach(b => { const on = +b.dataset.v === range; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    box.querySelectorAll('[data-k=res] button').forEach(b => { const on = b.dataset.v === r; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    cnt.textContent = `${pts.length.toLocaleString()} points`;
    const span = (Date.parse(pts[pts.length - 1][0]) - Date.parse(pts[0][0])) / 31557600000;
    svg._zoom = null; svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${label} from ${pts[0][0]} to ${pts[pts.length - 1][0]}, ${r === 'D' ? 'daily' : r === 'W' ? 'weekly' : 'monthly'}; latest ${fmt(pts[pts.length - 1][1])}.`);
    lineChart(svg, pts, { lines, fmt, height, monthly: span <= 1.5, yearStep: span <= 6 ? 1 : span <= 15 ? 2 : 0 });
  };
  box.onclick = e => { const b = e.target.closest('button[data-v]'); if (!b || b.disabled) return; if (b.parentElement.dataset.k === 'range') range = +b.dataset.v; else res = b.dataset.v; draw(); };
  draw(); return { svg, redraw: draw };
}
