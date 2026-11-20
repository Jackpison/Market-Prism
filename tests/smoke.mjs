// Browser smoke test. Usage: node tests/smoke.mjs [baseUrl]   (needs `playwright` installed; a static server must already be running)
// For every tab, at desktop AND phone width, in dark and light themes: no console errors / page errors / failed requests,
// the view renders real content (not the loading skeleton), and nothing causes horizontal page scroll on a phone.
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:8000/index.html';
const TABS = { overview: '#view-overview .ov-hero .g-num', radar: '#view-radar .matrix tbody tr', yield: '#view-yield svg', stress: '#view-stress .slider', narratives: '#view-narratives .tcard', capital: '#view-capital svg',
  network: '#view-network #nSide .nitem', smart: '#view-smart .sig', timeline: '#view-timeline #list .row', months: '#view-months #monthGrid .mcard', markets: '#view-markets svg', learn: '#view-learn #doc h2', about: '#view-about h2' };
const failures = [];
const browser = await chromium.launch();
for (const theme of ['dark', 'light']) for (const [label, vp] of [['desktop', { width: 1360, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: vp, colorScheme: theme }); const page = await ctx.newPage(); const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('requestfailed', r => errs.push('request failed: ' + r.url()));
  await page.addInitScript(t => { try { localStorage.setItem('mt-theme', t); localStorage.setItem('mt-tour-done', '1'); } catch (e) {} }, theme);
  for (const [tab, sel] of Object.entries(TABS)) {
    await page.goto(`${BASE}#${tab}`, { waitUntil: 'networkidle' });
    try { await page.waitForSelector(sel, { timeout: 8000 }); } catch { failures.push(`[${theme}/${label}] ${tab}: expected content '${sel}' never rendered`); continue; }
    if (label === 'phone') {
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (over > 2) failures.push(`[${theme}/phone] ${tab}: horizontal page overflow of ${over}px`);
    }
  }
  if (label === 'desktop') { // command palette: Ctrl+K opens, typing filters, Enter navigates
    await page.goto(`${BASE}#overview`, { waitUntil: 'networkidle' }); await page.keyboard.press('Control+k');
    try { await page.waitForSelector('#palInput', { state: 'visible', timeout: 3000 }); await page.keyboard.type('yield'); await page.keyboard.press('Enter');
      await page.waitForFunction(() => location.hash === '#yield', null, { timeout: 3000 }); } catch { failures.push(`[${theme}/${label}] command palette did not navigate`); }
  }
  if (label === 'desktop' && theme === 'dark') { // first-run tour: appears on a clean profile, steps through, Esc closes and is remembered
    const fresh = await browser.newContext({ viewport: vp }); const fp = await fresh.newPage(); fp.on('pageerror', e => errs.push('pageerror(tour): ' + e.message));
    await fp.goto(`${BASE}#overview`, { waitUntil: 'networkidle' });
    try { await fp.waitForSelector('.tour-box', { timeout: 9000 }); await fp.click('[data-a=next]'); await fp.waitForFunction(() => /Step 2 of/.test(document.querySelector('.tour-n').textContent));
      await fp.keyboard.press('Escape'); await fp.waitForSelector('.tour-box', { state: 'detached', timeout: 3000 });
      await fp.reload({ waitUntil: 'networkidle' }); await fp.waitForTimeout(3500); if (await fp.$('.tour-box')) failures.push('tour reappeared after being dismissed');
    } catch (e) { failures.push(`[tour] first-run tour did not behave: ${e.message.split('\n')[0]}`); }
    await fresh.close();
    // toast: swipe-to-dismiss and Undo are wired
    await page.goto(`${BASE}#overview`, { waitUntil: 'networkidle' });
    try { await page.evaluate(async () => { const m = await import('./js/fx.js'); m.toast('Smoke toast', { action: 'Undo', onAction: () => { window.__undone = 1; } }); });
      await page.waitForSelector('.toast.on .tbar'); await page.click('.toast .tact'); await page.waitForFunction(() => window.__undone === 1);
    } catch (e) { failures.push(`[toast] ${e.message.split('\n')[0]}`); }
  }
  const unique = [...new Set(errs)]; unique.forEach(e => failures.push(`[${theme}/${label}] ${e}`));
  await ctx.close();
}
await browser.close();
if (failures.length) { console.error('SMOKE FAILED:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
console.log(`smoke ok: ${Object.keys(TABS).length} tabs x dark/light x desktop/phone`);
