import { $, esc } from './util.js';
import { icon } from './icons.js';
import { PAGES, store } from './pages.js';

// Command palette: Ctrl/Cmd+K (or "/") opens it; search pages, indicators and trends; arrows + Enter; Esc closes.
let root, input, list, items = [], idx = 0, prevFocus = null;

function buildIndex() {
  const out = [];
  Object.entries(PAGES).forEach(([id, p]) => out.push({ label: p[1], hint: p[0] === 'Overview' ? 'Page' : p[0] + ' page', ic: p[3], run: () => { location.hash = '#' + id; } }));
  ((store.latest && store.latest.indicators) || []).forEach(i => out.push({ label: i.name, hint: 'Indicator · ' + (i.status === 'nodata' ? 'no data' : i.status === 'green' ? 'OK' : i.status === 'yellow' ? 'Warning' : String(i.status)), ic: 'gauge',
    run: () => { window.__focusIndicator = i.id; location.hash = '#radar'; document.dispatchEvent(new CustomEvent('focus-indicator', { detail: i.id })); } }));
  ((store.macro && store.macro.trends) || []).forEach(t => out.push({ label: t.name, hint: 'Trend · ' + (t.quadrant || t.sector), ic: 'trending-up', run: () => { location.hash = '#narratives'; } }));
  out.push({ label: 'Toggle light / dark theme', hint: 'Action', ic: 'sun', run: () => $('#themeBtn').click() });
  out.push({ label: 'Open alerts feed (Atom)', hint: 'Action', ic: 'bell', run: () => { location.href = 'data/feed.xml'; } });
  return out;
}
function rank(it, q) { const l = it.label.toLowerCase(); if (!q) return it.hint.includes('Page') || it.hint === 'Action' ? 1 : 0; if (l.startsWith(q)) return 3; if (l.split(/\s+/).some(w => w.startsWith(q))) return 2; return l.includes(q) || it.hint.toLowerCase().includes(q) ? 1 : 0; }
function render() {
  const q = input.value.trim().toLowerCase();
  items = buildIndex().map(it => [rank(it, q), it]).filter(x => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, 12).map(x => x[1]);
  idx = Math.min(idx, Math.max(0, items.length - 1));
  list.innerHTML = items.length ? items.map((it, i) => `<li role="option" id="pal-${i}" data-i="${i}" aria-selected="${i === idx}" class="${i === idx ? 'on' : ''}">${icon(it.ic, 16)}<span class="pl">${esc(it.label)}</span><span class="ph">${esc(it.hint)}</span></li>`).join('') : '<li class="empty">No matches</li>';
  input.setAttribute('aria-activedescendant', items.length ? 'pal-' + idx : '');
  const on = list.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
}
function open() {
  if (!root.hidden) return; prevFocus = document.activeElement; root.hidden = false; document.body.classList.add('pal-open'); input.value = ''; idx = 0; render(); input.focus();
}
function close() { if (root.hidden) return; root.hidden = true; document.body.classList.remove('pal-open'); if (prevFocus && prevFocus.focus) prevFocus.focus(); }
function choose(i) { const it = items[i]; if (!it) return; close(); it.run(); }

export function initPalette() {
  root = document.createElement('div'); root.className = 'pal'; root.hidden = true;
  root.innerHTML = `<div class="pal-box" role="dialog" aria-modal="true" aria-label="Search"><div class="pal-in">${icon('search', 18)}<input id="palInput" type="text" autocomplete="off" spellcheck="false" placeholder="Search pages, indicators and trends…" role="combobox" aria-expanded="true" aria-controls="palList" aria-autocomplete="list"><kbd>Esc</kbd></div>
    <ul id="palList" role="listbox" aria-label="Results"></ul><div class="pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>Esc</kbd> close</span></div></div>`;
  document.body.appendChild(root); input = $('#palInput', root); list = $('#palList', root);
  input.addEventListener('input', () => { idx = 0; render(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(items.length - 1, idx + 1); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(0, idx - 1); render(); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(idx); }
  });
  list.addEventListener('click', e => { const li = e.target.closest('li[data-i]'); if (li) choose(+li.dataset.i); });
  root.addEventListener('mousedown', e => { if (e.target === root) close(); });
  $('#searchBtn').addEventListener('click', open);
  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || '')) || e.target.isContentEditable;
    if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); root.hidden ? open() : close(); }
    else if (e.key === '/' && !typing && root.hidden) { e.preventDefault(); open(); }
    else if (e.key === 'Escape') close();
  });
}
