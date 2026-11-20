import { $, $$, esc, getJSON } from './util.js';
import { icon } from './icons.js';
import { loadTrends } from './trendsData.js';
import { PAGES, GROUPS, REGIME_KEY, store } from './pages.js';
import { initPalette } from './palette.js';
import { moveSlider, initDockAutoHide } from './ui2.js';

const HOUR = 3600e3;
const ago = iso => { const t = Date.parse(iso || ''); if (isNaN(t)) return null; const h = (Date.now() - t) / HOUR; return h < 1 ? 'just now' : h < 48 ? Math.round(h) + 'h ago' : Math.round(h / 24) + 'd ago'; };
const hoursOld = iso => { const t = Date.parse(iso || ''); return isNaN(t) ? null : (Date.now() - t) / HOUR; };
const current = () => { const t = (location.hash || '#overview').slice(1); return PAGES[t] ? t : 'overview'; };

function renderNav() {
  $('#nav').innerHTML = GROUPS.map(g => `${g.label ? `<div class="nav-label">${esc(g.label)}</div>` : ''}<div class="nav-group">${g.tabs.map(id => {
    const p = PAGES[id]; return `<a class="nav-item" href="#${id}" data-tab="${id}">${icon(p[3], 17)}<span>${id === 'overview' ? 'Overview' : esc(p[1].replace('Early-warning radar', 'Radar').replace('Narratives & capital', 'Narratives'))}</span><em class="nbadge" data-b="${id}" hidden></em></a>`;
  }).join('')}</div>`).join('');
}

function pageHead(tab) {
  const [group, title, desc, , src] = PAGES[tab];
  const gen = src === 'ind' ? store.latest && store.latest.generated : src === 'trend' ? store.macro && store.macro.generated : null;
  const age = hoursOld(gen), stale = age != null && age > (src === 'ind' ? 80 : 26);
  const eyebrow = tab === 'overview' ? new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) : group;
  $('#pagehead').innerHTML = `<div class="ph-main"><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1><p>${esc(desc)}</p></div>
    ${gen ? `<div class="ph-meta"><span class="fresh ${stale ? 'stale' : ''}"><i></i>Updated ${esc(ago(gen))}</span></div>` : ''}`;
  $('#crumb').innerHTML = tab === 'overview' ? `<b>Overview</b>` : `<a href="#overview">Overview</a>${icon('chevron-right', 13)}<span>${esc(group)}</span>${icon('chevron-right', 13)}<b>${esc(title)}</b>`;
  document.title = `${title} · MarketPrism`;
}

function sync() {
  const tab = current();
  $$('.nav-item').forEach(a => { const on = a.dataset.tab === tab; a.classList.toggle('on', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
  pageHead(tab); closeDrawer(); moveSlider($('#nav'), $('.nav-item.on'));
}

function openDrawer() { document.body.classList.add('nav-open'); $('#scrim').hidden = false; $('#menuBtn').setAttribute('aria-expanded', 'true'); }
function closeDrawer() { document.body.classList.remove('nav-open'); $('#scrim').hidden = true; $('#menuBtn').setAttribute('aria-expanded', 'false'); }

function applyData() {
  const L = store.latest, M = store.macro;
  if (L) {
    const key = REGIME_KEY[L.regime];
    if (key) document.documentElement.dataset.regime = key;
    const chip = $('#regimeChip');
    if (L.composite != null && key) { chip.innerHTML = `<i></i>${esc(L.regime)}<b>${Math.round(L.composite)}</b>`; chip.className = 'regime-chip r-' + key; chip.hidden = false; chip.title = 'Composite risk score (0-100). Open the radar.'; }
    const warn = L.indicators.filter(i => i.status === 'yellow' || i.status === 'red').length;
    setBadge('radar', warn, 'warn', `${warn} indicators on warning or alert`);
  }
  if (M) {
    const high = (M.signals || []).filter(s => s.strength === 'High').length;
    setBadge('smart', high, 'ok', `${high} high-strength signals`);
  }
  const gens = [L && L.generated, M && M.generated].filter(Boolean).map(g => hoursOld(g)).filter(x => x != null);
  const oldest = gens.length ? Math.max(...gens) : null;
  const live = M ? Object.values(M.status || {}).filter(s => s.state === 'live' || s.state === 'partial').length : 0, total = M ? Object.keys(M.status || {}).length : 0;
  $('#railFoot').innerHTML = `<div class="foot-card"><div class="fc-top"><span class="fresh ${oldest != null && oldest > 26 ? 'stale' : ''}"><i></i>${oldest == null ? 'No data' : 'Data ' + (L && ago(L.generated) === ago(M && M.generated) ? ago(L.generated) : 'live')}</span></div>
    <div class="fc-sub">${total ? `${live} of ${total} sources reporting` : 'Waiting for the first data run'}</div><a href="#about">Source health</a></div>`;
  pageHead(current());
}
function setBadge(id, n, cls, title) { const b = $(`.nbadge[data-b="${id}"]`); if (!b) return; if (n > 0) { b.textContent = n; b.className = 'nbadge ' + cls; b.title = title; b.hidden = false; } else b.hidden = true; }

function renderDock() {
  const items = [['overview', 'Home', 'layout-dashboard'], ['radar', 'Radar', 'radar'], ['narratives', 'Trends', 'radio'], ['smart', 'Smart $', 'fish']];
  const d = document.createElement('nav'); d.className = 'dock'; d.setAttribute('aria-label', 'Quick navigation');
  d.innerHTML = items.map(([id, l, ic]) => `<a href="#${id}" data-dock="${id}">${icon(ic, 20)}<span>${l}</span></a>`).join('') + `<button type="button" id="dockMenu" aria-label="More pages">${icon('menu', 20)}<span>More</span></button>`;
  document.body.appendChild(d); $('#dockMenu').onclick = openDrawer;
}
function syncDock() { const t = current(); $$('.dock [data-dock]').forEach(a => { const on = a.dataset.dock === t; a.classList.toggle('on', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); }); }

export function initShell() {
  renderNav(); renderDock(); sync(); syncDock(); initDockAutoHide();
  if (document.fonts) document.fonts.ready.then(() => moveSlider($('#nav'), $('.nav-item.on')));
  addEventListener('resize', () => moveSlider($('#nav'), $('.nav-item.on')));
  addEventListener('hashchange', () => { sync(); syncDock(); requestAnimationFrame(() => scrollTo({ top: 0 })); });
  $('#menuBtn').addEventListener('click', () => document.body.classList.contains('nav-open') ? closeDrawer() : openDrawer());
  $('#scrim').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
  initPalette();
  Promise.all([getJSON('data/indicators/latest.json').catch(() => null), loadTrends()]).then(([L, M]) => { store.latest = L; store.macro = M; applyData(); });
}
