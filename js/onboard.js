import { $, esc } from './util.js';
import { icon } from './icons.js';

// First-run tour: four short steps, shown once (remembered in localStorage; blocked storage just means it can show again). Replay from the command palette.
const KEY = 'mt-tour-done';
const STEPS = [
  ['gauge', 'Start with the regime', 'The Overview opens with one composite score and a regime: Calm, Watch, Elevated or Critical. It blends 23 leading indicators. It is a heuristic gauge, not a forecast.'],
  ['radar', 'Open any indicator', 'On the Radar, select a row to see its trigger logic, thresholds, history and track record. Press Watch to pin it to your Overview. Pins stay in this browser only.'],
  ['radio', 'Follow attention and money', 'Narratives & capital compares how loudly a theme is discussed with whether money is following. Some inputs are free-data proxies and are labelled that way.'],
  ['command', 'Move quickly', 'Press Ctrl/Cmd+K or / to search, g then a letter to jump between pages, t for the theme and ? for every shortcut.'],
];
let root = null, step = 0, prev = null;
const seen = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
const mark = () => { try { localStorage.setItem(KEY, '1'); } catch (e) { /* storage blocked */ } };

function draw() {
  const [ic, title, body] = STEPS[step], last = step === STEPS.length - 1;
  $('.tour-box', root).innerHTML = `<div class="tour-ic">${icon(ic, 22)}</div><div class="tour-n">Step ${step + 1} of ${STEPS.length}</div><h2 id="tourT">${esc(title)}</h2><p>${esc(body)}</p>
    <ol class="tour-dots" aria-hidden="true">${STEPS.map((_, i) => `<li class="${i === step ? 'on' : i < step ? 'done' : ''}"></li>`).join('')}</ol>
    <div class="tour-act"><button type="button" class="tour-skip" data-a="skip">${last ? 'Close' : 'Skip tour'}</button><span>${step ? '<button type="button" class="btn-s" data-a="back">Back</button>' : ''}<button type="button" class="btn-p" data-a="next">${last ? 'Start exploring' : 'Next'}</button></span></div>`;
  $('[data-a=next]', root).focus();
}
function close() { if (!root) return; mark(); root.remove(); root = null; document.body.classList.remove('pal-open'); if (prev && prev.focus) prev.focus(); }

export function startTour() {
  if (root) return; step = 0; prev = document.activeElement;
  root = document.createElement('div'); root.className = 'pal tour';
  root.innerHTML = '<div class="tour-box" role="dialog" aria-modal="true" aria-labelledby="tourT"></div>';
  document.body.appendChild(root); document.body.classList.add('pal-open'); draw();
  root.addEventListener('click', e => { const a = e.target.closest('[data-a]'); if (!a) { if (e.target === root) close(); return; }
    if (a.dataset.a === 'skip') close(); else if (a.dataset.a === 'back') { step--; draw(); } else if (step === STEPS.length - 1) close(); else { step++; draw(); } });
  root.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    if (e.key === 'Tab') { const f = [...root.querySelectorAll('button')]; if (!f.length) return; const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } }
  });
}
export function initTour() {
  if (seen() || !/^(#overview)?$/.test(location.hash)) return;
  const go = () => { if (!document.body.classList.contains('pal-open')) startTour(); };
  const t = setInterval(() => { if ($('#view-overview .ov-hero')) { clearInterval(t); setTimeout(go, 700); } }, 400); setTimeout(() => clearInterval(t), 15000);
}
