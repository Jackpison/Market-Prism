import { $, $$, esc } from './util.js';

// Sticky in-page section navigation for long pages. Reads the panels a view has rendered, builds one chip per titled panel, and highlights the
// section in view. Pages with fewer than three titled panels are left alone. Panels render asynchronously, so a MutationObserver re-runs the scan.
const VIEWS = ['radar', 'narratives', 'capital', 'smart', 'markets', 'learn'];
const short = t => t.replace(/\s*[:(,].*$/, '').replace(/^Risk heatmap.*/, 'Heatmap').replace(/^Composite risk history.*/, 'History').replace(/^Track record.*/, 'Track record').trim().slice(0, 26);

function build(view) {
  const panels = $$('.panel', view).filter(p => !p.hidden && !p.parentElement.closest('.panel'));
  const items = [];
  panels.forEach(p => {
    const h = p.querySelector('h2,h3'); if (!h) return;
    const label = short(h.textContent || ''); if (!label) return;
    if (!p.id) p.id = 'sec-' + view.id.replace('view-', '') + '-' + items.length;
    items.push([p.id, label]);
  });
  let nav = $('.secnav', view);
  if (items.length < 3) { if (nav) nav.remove(); return; }
  const sig = items.map(i => i.join(':')).join('|');
  if (nav && nav.dataset.sig === sig) return;
  if (!nav) { nav = document.createElement('nav'); nav.className = 'secnav'; nav.setAttribute('aria-label', 'On this page'); view.prepend(nav); }
  nav.dataset.sig = sig;
  nav.innerHTML = items.map(([id, l]) => `<a href="#${id}" data-sec="${id}">${esc(l)}</a>`).join('');
  nav.onclick = e => {
    const a = e.target.closest('a[data-sec]'); if (!a) return; e.preventDefault();
    const t = document.getElementById(a.dataset.sec); if (t) t.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  };
  spy(view, nav, items.map(i => i[0]));
}

let io = null;
function spy(view, nav, ids) {
  if (io) io.disconnect();
  if (!('IntersectionObserver' in window)) return;
  const on = id => $$('a', nav).forEach(a => { const k = a.dataset.sec === id; a.classList.toggle('on', k); k ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current'); });
  io = new IntersectionObserver(es => { const v = es.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (v) on(v.target.id); }, { rootMargin: '-110px 0px -60% 0px' });
  ids.forEach(id => io.observe(document.getElementById(id))); on(ids[0]);
}

export function initSecNav() {
  VIEWS.forEach(v => {
    const view = document.getElementById('view-' + v); if (!view) return;
    let t = null;
    const run = () => { clearTimeout(t); t = setTimeout(() => { if (view.classList.contains('on')) build(view); }, 200); };
    new MutationObserver(run).observe(view, { childList: true, subtree: true });
    document.addEventListener('tabchange', e => { if (e.detail === v) run(); });
    run();
  });
}
