import { tip } from '../util.js';
/** Line chart for [[label, value], ...]. opts: {lines:[{y,cls}], fmt, height} */
export function lineChart(svg, pts, opts = {}) {
  svg._lc = [pts, opts];                                       // remember inputs so a resize can redraw at the new real width (text stays readable in narrow columns)
  if (!svg._ro && 'ResizeObserver' in window) { let w0 = 0; svg._ro = new ResizeObserver(() => { const w = Math.round(svg.getBoundingClientRect().width); if (w && Math.abs(w - w0) > 24) { w0 = w; draw(svg, ...svg._lc); } }); svg._ro.observe(svg); }
  draw(svg, pts, opts);
}
function draw(svg, pts, opts) {
  const W = Math.max(260, Math.round(svg.getBoundingClientRect().width) || 760), H = opts.height || 240, m = { l: 48, r: 12, t: 12, b: 24 };
  if (!pts || pts.length < 2) { svg.innerHTML = ''; return; }
  const ys = pts.map(p => p[1]).concat((opts.lines || []).map(l => l.y));
  let lo = Math.min(...ys), hi = Math.max(...ys); const pad = (hi - lo) * .08 || 1; lo -= pad; hi += pad;
  const X = i => m.l + i / (pts.length - 1) * (W - m.l - m.r), Y = v => H - m.b - (v - lo) / (hi - lo) * (H - m.t - m.b);
  const f = opts.fmt || (v => Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2));
  let h = '';
  for (let k = 0; k <= (W < 400 ? 3 : 4); k++) { const v = lo + (hi - lo) * k / (W < 400 ? 3 : 4), y = Y(v); h += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}"/><text class="ax" x="${m.l - 6}" y="${y + 3}" text-anchor="end">${f(v)}</text>`; }
  let last = '';
  const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (opts.monthly) pts.forEach((p, i) => { const m = p[0].slice(0, 7); if (m !== last && (W >= 400 || +m.slice(5, 7) % 2 === 1)) h += `<text class="ax" x="${X(i)}" y="${H - 7}" text-anchor="middle">${MN[+m.slice(5, 7) - 1]}</text>`; last = m; });
  else pts.forEach((p, i) => { const y = p[0].slice(0, 4); if (y !== last && (+y % (pts.length > 150 ? 5 : 2) * (W < 400 ? 2 : 1) === 0)) { h += `<text class="ax" x="${X(i)}" y="${H - 7}" text-anchor="middle">${y}</text>`; } last = y; });
  (opts.lines || []).forEach(l => { h += `<line class="thr ${l.cls}" x1="${m.l}" x2="${W - m.r}" y1="${Y(l.y)}" y2="${Y(l.y)}"/>`; });
  h += `<polyline class="ln" fill="none" points="${pts.map((p, i) => X(i).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')}"/><line id="lcx" class="cross" y1="${m.t}" y2="${H - m.b}" style="display:none"/><circle id="lcd" class="lens" r="4.5" style="display:none"/>`;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = h;
  const cx = svg.querySelector('#lcx'), dot = svg.querySelector('#lcd');
  svg.onmousemove = e => { const b = svg.getBoundingClientRect(), px = (e.clientX - b.left) / b.width * W; const i = Math.max(0, Math.min(pts.length - 1, Math.round((px - m.l) / (W - m.l - m.r) * (pts.length - 1)))); cx.style.display = ''; cx.setAttribute('x1', X(i)); cx.setAttribute('x2', X(i)); dot.style.display = ''; dot.setAttribute('cx', X(i)); dot.setAttribute('cy', Y(pts[i][1])); tip.show(`<b>${pts[i][0]}</b><br>${f(pts[i][1])}`, e); };
  svg.onmouseleave = () => { tip.hide(); cx.style.display = 'none'; dot.style.display = 'none'; };
}
