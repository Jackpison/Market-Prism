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

/** Toast stack: shows how much time is left (a draining bar), pauses while hovered or focused, can be swiped away (or closed with the button), and may carry one action such as Undo. */
export function toast(msg, opts = {}) {
  let st = $('#toasts');
  if (!st) { st = document.createElement('div'); st.id = 'toasts'; st.className = 'toasts'; st.setAttribute('role', 'status'); st.setAttribute('aria-live', 'polite'); document.body.appendChild(st); }
  const ms = opts.ms || (opts.action ? 6000 : 3600), el = document.createElement('div'); el.className = 'toast';
  el.innerHTML = `<span class="tmsg"></span>${opts.action ? '<button type="button" class="tact"></button>' : ''}<button type="button" class="tx" aria-label="Dismiss">&times;</button><i class="tbar"></i>`;
  el.querySelector('.tmsg').textContent = msg; if (opts.action) el.querySelector('.tact').textContent = opts.action;
  while (st.children.length >= 3) st.firstChild.remove();
  st.appendChild(el); requestAnimationFrame(() => el.classList.add('on'));
  let gone = false;
  const kill = (dx = 0) => { if (gone) return; gone = true; el.style.transform = `translateX(${dx || 0}px)`; el.classList.remove('on'); setTimeout(() => el.remove(), 220); };
  const bar = el.querySelector('.tbar'), an = bar.animate ? bar.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: ms, fill: 'forwards', easing: 'linear' }) : null;
  if (an) an.onfinish = () => kill(); else setTimeout(kill, ms);
  const hold = () => an && an.pause(), go = () => an && an.play();
  el.addEventListener('pointerenter', hold); el.addEventListener('pointerleave', go); el.addEventListener('focusin', hold); el.addEventListener('focusout', go);
  el.querySelector('.tx').onclick = () => kill();
  if (opts.action) el.querySelector('.tact').onclick = () => { kill(); if (opts.onAction) opts.onAction(); };
  let x0 = null, dx = 0;
  el.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; x0 = e.clientX; dx = 0; el.setPointerCapture(e.pointerId); hold(); el.style.transition = 'none'; });
  el.addEventListener('pointermove', e => { if (x0 == null) return; dx = e.clientX - x0; el.style.transform = `translateX(${dx}px)`; el.style.opacity = String(Math.max(.2, 1 - Math.abs(dx) / 240)); });
  const end = () => { if (x0 == null) return; x0 = null; el.style.transition = ''; if (Math.abs(dx) > 70) kill(dx * 2.5); else { el.style.transform = ''; el.style.opacity = ''; go(); } };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
}

export function initFx() { if (!reduced()) { spotlight(); } progress(); }
