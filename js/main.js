import { $ } from './util.js';
import { icon, hydrateIcons } from './icons.js';
import { initEarlyWarning } from './widgets/earlyWarning.js';
import { initYieldCurve } from './widgets/yieldCurve.js';
import { initStressTest } from './widgets/stressTest.js';
import { initShell } from './shell.js';
import { initSecNav } from './secnav.js';
import { initFx } from './fx.js';
import { initShortcuts } from './shortcuts.js';
import { initOverview } from './widgets/overview.js';
import { initTicker } from './widgets/ticker.js';
import { initNarratives } from './widgets/narratives.js';
import { initCapital } from './widgets/capitalFlows.js';
import { initNetwork } from './widgets/network.js';
import { initSmartMoney } from './widgets/smartMoney.js';
import { initHealth } from './health.js';
import { initA11y } from './a11y.js';

function initTheme() {
  const root = document.documentElement; let saved = null;
  try { saved = localStorage.getItem('mt-theme'); } catch (e) {}
  const apply = m => { root.dataset.theme = m; root.dataset.mode = m; document.dispatchEvent(new CustomEvent('themechange', { detail: m })); const b = $('#themeBtn'); if (b) b.innerHTML = m === 'dark' ? icon('sun', 15) + ' Light' : icon('moon', 15) + ' Dark'; };
  apply(saved || 'dark');
  $('#themeBtn').onclick = e => {
    const n = root.dataset.mode === 'dark' ? 'light' : 'dark'; try { localStorage.setItem('mt-theme', n); } catch (err) {}
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!document.startViewTransition || reduce) { apply(n); return; }
    const r = e.currentTarget.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, rad = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.startViewTransition(() => apply(n)).ready.then(() => root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${rad}px at ${x}px ${y}px)`] }, { duration: 520, easing: 'cubic-bezier(.2,.7,.2,1)', pseudoElement: '::view-transition-new(root)' })).catch(() => {});
  };
}
hydrateIcons(); initTheme(); initShell(); initOverview(); initTicker(); initEarlyWarning(); initYieldCurve(); initStressTest(); initNarratives(); initCapital(); initNetwork(); initSmartMoney();
initA11y(); initHealth(); initSecNav(); initFx(); initShortcuts();
