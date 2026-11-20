import { tip } from '../util.js';
/** Line chart for [[label, value], ...]. opts: {lines:[{y,cls}], fmt, height}. Drag across the chart to zoom into a range; double-click or the reset label restores it. */
export function lineChart(svg, pts, opts = {}) {
  svg._lc = [pts, opts]; svg._zoom = null;                                       // remember inputs so a resize can redraw at the new real width (text stays readable in narrow columns)
  if (!svg._ro && 'ResizeObserver' in window) { let w0 = 0; svg._ro = new ResizeObserver(() => { const w = Math.round(svg.getBoundingClientRect().width); if (w && Math.abs(w - w0) > 24) { w0 = w; draw(svg, ...svg._lc); } }); svg._ro.observe(svg); }
  draw(svg, pts, opts);
}
function draw(svg, pts, opts) {
  const full = pts, z = svg._zoom; if (z && pts) pts = pts.slice(z[0], z[1] + 1);
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
  // drag to zoom (pointer events: mouse, pen and touch); needs at least 4 points in the selection
  const idxAt = e => { const b = svg.getBoundingClientRect(), px = (e.clientX - b.left) / b.width * W; return Math.max(0, Math.min(pts.length - 1, Math.round((px - m.l) / (W - m.l - m.r) * (pts.length - 1)))); };
  let a0 = null, band = null;
  svg.style.touchAction = 'pan-y'; svg.style.cursor = 'crosshair';
  svg.onpointerdown = e => { if (e.button) return; a0 = idxAt(e); band = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); band.setAttribute('class', 'zoomband'); band.setAttribute('y', m.t); band.setAttribute('height', H - m.t - m.b); band.setAttribute('width', 0); svg.appendChild(band); try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } };
  svg.addEventListener('pointermove', e => { if (a0 == null) return; const i = idxAt(e), x0 = X(Math.min(a0, i)), x1 = X(Math.max(a0, i)); band.setAttribute('x', x0); band.setAttribute('width', x1 - x0); });
  const end = e => { if (a0 == null) return; const i = idxAt(e), lo2 = Math.min(a0, i), hi2 = Math.max(a0, i); a0 = null; if (band) band.remove(); band = null;
    if (hi2 - lo2 >= 3) { const off = z ? z[0] : 0; svg._zoom = [off + lo2, off + hi2]; draw(svg, full, opts); } };
  svg.onpointerup = end; svg.onpointercancel = () => { a0 = null; if (band) band.remove(); band = null; };
  svg.ondblclick = () => { if (svg._zoom) { svg._zoom = null; draw(svg, full, opts); } };
  if (z) { const t = document.createElementNS('http://www.w3.org/2000/svg', 'text'); t.setAttribute('class', 'ax zoomreset'); t.setAttribute('x', W - m.r); t.setAttribute('y', m.t + 10); t.setAttribute('text-anchor', 'end'); t.setAttribute('tabindex', '0'); t.setAttribute('role', 'button'); t.textContent = 'Reset zoom';
    t.onclick = ev => { ev.stopPropagation(); svg._zoom = null; draw(svg, full, opts); }; t.onpointerdown = ev => ev.stopPropagation(); t.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); svg._zoom = null; draw(svg, full, opts); } }; svg.appendChild(t); }
}
