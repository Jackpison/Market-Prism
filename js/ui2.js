import { $, esc } from './util.js';
import { icon } from './icons.js';

// UI round 2 helpers. Everything here is an independent implementation (no third-party code); motion is short and skipped under prefers-reduced-motion.
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Number ticker: briefly tweens the first number inside each element up to its final text. The final text is always the true value. */
export function tickNumbers(root, sel = '.t-val') {
  if (reduced()) return;
  root.querySelectorAll(sel).forEach(el => {
    const txt = el.textContent, m = txt.match(/-?\d[\d,]*\.?\d*/); if (!m) return;
    const to = parseFloat(m[0].replace(/,/g, '')); if (!isFinite(to) || to === 0) return;
    const dec = (m[0].split('.')[1] || '').length, a = to * 0.6, t0 = performance.now(), D = 650;
    const f = t => { const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3), v = a + (to - a) * e;
      el.textContent = k < 1 ? txt.replace(m[0], v.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec })) : txt; if (k < 1) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
}

/** Sliding indicator behind the active item of a pill/list nav. `container` must be positioned; the indicator is an <i class="nav-glide"> that glides between items. */
export function moveSlider(container, active, vertical = false) {
  if (!container || !active) return;
  let s = container.querySelector(':scope > .nav-glide');
  if (!s) { s = document.createElement('i'); s.className = 'nav-glide'; s.setAttribute('aria-hidden', 'true'); container.prepend(s); }
  if (!active.offsetWidth) return;                         // hidden container: measure later
  const first = !container.classList.contains('has-slider');
  if (first) s.style.transition = 'none';
  s.style.width = active.offsetWidth + 'px'; s.style.height = active.offsetHeight + 'px';
  s.style.transform = `translate(${active.offsetLeft}px,${active.offsetTop}px)`;
  container.classList.add('has-slider');
  if (first) { void s.offsetWidth; s.style.transition = ''; }
}

/** Proper empty state: icon, one-line title, helpful body, optional action html. */
export function emptyState(ic, title, body, action = '') {
  return `<div class="empty-state">${icon(ic, 22)}<b>${esc(title)}</b><p>${body}</p>${action}</div>`;
}

/** Floating-nav behaviour: the phone dock slides away while scrolling down and returns on scroll up, at the top, or when it receives focus. */
export function initDockAutoHide() {
  let last = scrollY, raf = 0;
  addEventListener('scroll', () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const y = scrollY, d = y - last; if (Math.abs(d) < 8) return; last = y;
    document.body.classList.toggle('dock-hide', d > 0 && y > 140); }); }, { passive: true });
  document.addEventListener('focusin', e => { if (e.target.closest && e.target.closest('.dock')) document.body.classList.remove('dock-hide'); });
  addEventListener('hashchange', () => document.body.classList.remove('dock-hide'));
}
