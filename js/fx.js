import { $ } from './util.js';

// Small interaction effects, all optional and all off for reduced-motion users: pointer spotlight on cards, scroll progress bar, toast messages.
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

function spotlight() {
  if (!fine()) return;
  let raf = 0, last = null;
  document.addEventListener('pointermove', e => {
    last = e; if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0; const el = last.target.closest && last.target.closest('.card, .tile, .tcard, .kpi'); if (!el) return;
      const r = el.getBoundingClientRect(); el.style.setProperty('--mx', (last.clientX - r.left) + 'px'); el.style.setProperty('--my', (last.clientY - r.top) + 'px');
    });
  }, { passive: true });
}

function progress() {
  const bar = document.createElement('div'); bar.className = 'progress'; bar.setAttribute('aria-hidden', 'true'); bar.innerHTML = '<i></i>';
  const host = $('.topbar'); if (!host) return; host.appendChild(bar);
  const fill = bar.firstChild; let raf = 0;
  const upd = () => { raf = 0; const h = document.documentElement.scrollHeight - innerHeight; fill.style.transform = `scaleX(${h > 8 ? Math.min(1, scrollY / h) : 0})`; };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true });
  addEventListener('hashchange', () => requestAnimationFrame(upd)); upd();
}

let toastTimer = 0;
export function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 2200);
}

export function initFx() { if (!reduced()) { spotlight(); } progress(); }
