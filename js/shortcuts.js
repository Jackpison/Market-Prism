import { $, esc } from './util.js';
import { icon } from './icons.js';

// Keyboard shortcuts: "g" then a letter jumps to a page, "t" toggles the theme, "?" lists them. Ignored while typing or when a dialog is open.
const GO = { o: ['overview', 'Overview'], r: ['radar', 'Radar'], y: ['yield', 'Yield curve'], s: ['stress', 'Stress test'], n: ['narratives', 'Narratives'], c: ['capital', 'Capital & DeFi'], m: ['smart', 'Smart money'], h: ['timeline', 'History timeline'] };
let armed = 0, dlg = null, prev = null;

function open() {
  if (!dlg) {
    dlg = document.createElement('div'); dlg.className = 'pal'; dlg.hidden = true;
    dlg.innerHTML = `<div class="pal-box help" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts"><div class="pal-in">${icon('command', 18)}<b class="help-t">Keyboard shortcuts</b><kbd>Esc</kbd></div>
      <div class="help-body"><div><h3>Search</h3><p><span><kbd>Ctrl</kbd> <kbd>K</kbd> or <kbd>/</kbd></span>Open the command palette</p><h3>Go to</h3>${Object.entries(GO).map(([k, [, l]]) => `<p><span><kbd>g</kbd> <kbd>${k}</kbd></span>${esc(l)}</p>`).join('')}</div>
      <div><h3>Other</h3><p><span><kbd>t</kbd></span>Toggle light / dark</p><p><span><kbd>?</kbd></span>This list</p><p><span><kbd>Esc</kbd></span>Close dialogs and drawers</p><h3>On a radar row</h3><p><span><kbd>Enter</kbd></span>Open indicator details</p></div></div></div>`;
    document.body.appendChild(dlg); dlg.addEventListener('mousedown', e => { if (e.target === dlg) close(); });
  }
  prev = document.activeElement; dlg.hidden = false; document.body.classList.add('pal-open'); $('.pal-box', dlg).setAttribute('tabindex', '-1'); $('.pal-box', dlg).focus();
}
function close() { if (!dlg || dlg.hidden) return; dlg.hidden = true; document.body.classList.remove('pal-open'); if (prev && prev.focus) prev.focus(); }

export function initShortcuts() {
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '') || e.target.isContentEditable;
    if (e.key === 'Escape') { close(); return; }
    if (typing || document.body.classList.contains('pal-open') || document.body.classList.contains('drawer-open')) return;
    if (e.key === '?') { e.preventDefault(); open(); return; }
    if (e.key === 't') { const b = $('#themeBtn'); if (b) b.click(); return; }
    if (armed && GO[e.key]) { e.preventDefault(); armed = 0; location.hash = '#' + GO[e.key][0]; return; }
    if (e.key === 'g') { armed = Date.now(); setTimeout(() => { if (Date.now() - armed >= 1000) armed = 0; }, 1050); } else armed = 0;
  });
  const palItem = $('#searchBtn'); if (palItem) palItem.title = 'Search (Ctrl K). Press ? for all shortcuts.';
}
