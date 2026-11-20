// Feature tests for interactions the page-level smoke test does not cover. Usage: node tests/features.mjs [baseUrl]  (needs playwright and a running static server)
import { chromium, devices } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:8000/index.html';
const failures = []; const check = (ok, msg) => { if (!ok) failures.push(msg); };
const browser = await chromium.launch();
const mk = async (opts = {}) => { const ctx = await browser.newContext(opts); await ctx.addInitScript(() => { try { localStorage.setItem('mt-tour-done', '1'); } catch (e) {} }); const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); return { ctx, page, errs }; };

// 1. indicator permalink, copy link, close restores the URL, CSV export
{
  const { ctx, page, errs } = await mk({ viewport: { width: 1360, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  await page.goto(`${BASE}#radar/vix`, { waitUntil: 'networkidle' });
  try {
    await page.waitForSelector('#ewDetail:not([hidden]) h2', { timeout: 8000 });
    check(/VIX/i.test(await page.textContent('#ewDetail h2')), 'permalink #radar/vix did not open the VIX drawer');
    await page.click('#copyD'); await page.waitForSelector('#toasts .toast.on');
    const clip = await page.evaluate(() => navigator.clipboard.readText()); check(/#radar\/vix$/.test(clip), 'copied link is wrong: ' + clip);
    await page.keyboard.press('Escape'); await page.waitForSelector('#ewDetail', { state: 'hidden' });
    check(await page.evaluate(() => location.hash) === '#radar', 'closing the drawer should drop the indicator from the URL');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#csvBtn')]);
    const csv = await (await import('node:fs/promises')).readFile(await dl.path(), 'utf8'); const lines = csv.trim().split('\n');
    check(lines[0].startsWith('id,name,category,frequency,unit,value,as_of'), 'CSV header wrong: ' + lines[0]);
    check(lines.length === 24, 'CSV should hold 23 indicators + header, got ' + lines.length); check(/^marketprism-indicators-\d{4}-\d{2}-\d{2}\.csv$/.test(dl.suggestedFilename()), 'CSV filename: ' + dl.suggestedFilename());
  } catch (e) { failures.push('[radar permalink/csv] ' + e.message.split('\n')[0]); }
  errs.forEach(e => failures.push('[radar] ' + e)); await ctx.close();
}
// 2. drag-to-zoom on a chart, reset by label
{
  const { ctx, page, errs } = await mk({ viewport: { width: 1360, height: 900 } });
  await page.goto(`${BASE}#radar/t10y3m`, { waitUntil: 'networkidle' });
  try {
    await page.waitForSelector('#dchart polyline.ln'); const n0 = (await page.getAttribute('#dchart polyline.ln', 'points')).trim().split(' ').length;
    const b = await page.locator('#dchart').boundingBox(); await page.mouse.move(b.x + b.width * .4, b.y + b.height * .5); await page.mouse.down(); await page.mouse.move(b.x + b.width * .7, b.y + b.height * .5, { steps: 6 }); await page.mouse.up();
    await page.waitForSelector('#dchart .zoomreset'); const n1 = (await page.getAttribute('#dchart polyline.ln', 'points')).trim().split(' ').length; check(n1 < n0, `zoom did not reduce the points (${n0} -> ${n1})`);
    await page.click('#dchart .zoomreset'); await page.waitForFunction(() => !document.querySelector('#dchart .zoomreset'));
    check((await page.getAttribute('#dchart polyline.ln', 'points')).trim().split(' ').length === n0, 'reset did not restore the full range');
  } catch (e) { failures.push('[chart zoom] ' + e.message.split('\n')[0]); }
  errs.forEach(e => failures.push('[zoom] ' + e)); await ctx.close();
}
// 3. phone (touch emulation, not a real device): dock hides on scroll down and returns on scroll up; section pills keep full labels
{
  const { ctx, page, errs } = await mk({ ...devices['iPhone 13'] });
  await page.goto(`${BASE}#overview`, { waitUntil: 'networkidle' }); await page.waitForSelector('.dock');
  await page.evaluate(() => scrollTo(0, 1200)); await page.waitForTimeout(200); await page.evaluate(() => scrollTo(0, 1300)); await page.waitForTimeout(400);
  check(await page.evaluate(() => document.body.classList.contains('dock-hide')), 'dock did not hide while scrolling down');
  await page.evaluate(() => scrollTo(0, 900)); await page.waitForTimeout(400);
  check(await page.evaluate(() => !document.body.classList.contains('dock-hide')), 'dock did not return on scroll up');
  await page.goto(`${BASE}#capital`, { waitUntil: 'networkidle' }); await page.waitForSelector('.secnav a');
  const labels = await page.$$eval('.secnav a', as => as.map(a => a.textContent)); check(labels.every(l => !/\s\S{0,3}$/.test(l) || l.endsWith('…')), 'a section pill label looks cut mid-word: ' + labels.join(' | '));
  errs.forEach(e => failures.push('[phone] ' + e)); await ctx.close();
}
// 4. offline: after one online visit the service worker serves the last saved copy
{
  const { ctx, page, errs } = await mk({ viewport: { width: 1360, height: 900 }, serviceWorkers: 'allow' });
  await page.goto(`${BASE}#overview`, { waitUntil: 'networkidle' });
  try {
    await page.evaluate(() => navigator.serviceWorker.ready); await page.reload({ waitUntil: 'networkidle' });       // the second load is controlled by the worker and fills the cache
    await page.waitForFunction(() => navigator.serviceWorker.controller); await page.waitForSelector('.ov-hero .g-num');
    await ctx.setOffline(true); await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.ov-hero .g-num', { timeout: 10000 });
    check(true, '');
  } catch (e) { failures.push('[offline] page did not render from the cache: ' + e.message.split('\n')[0]); }
  await ctx.close();
}
// 5. guide: Learn opens on the guide and the glossary renders; every doc loads
{
  const { ctx, page, errs } = await mk({ viewport: { width: 1360, height: 900 } });
  await page.goto(`${BASE}#learn`, { waitUntil: 'networkidle' });
  try {
    await page.waitForFunction(() => /Glossary/.test(document.querySelector('#doc')?.textContent || ''), null, { timeout: 8000 });
    const n = await page.locator('#docnav button').count();
    for (let i = 0; i < n; i++) { await page.locator('#docnav button').nth(i).click(); await page.waitForFunction(() => !/Loading|Could not load/.test(document.querySelector('#doc').textContent) && document.querySelector('#doc h1,#doc h2'), null, { timeout: 5000 }); }
  } catch (e) { failures.push('[guide] ' + e.message.split('\n')[0]); }
  errs.forEach(e => failures.push('[guide] ' + e)); await ctx.close();
}
await browser.close();
if (failures.length) { console.error('FEATURES FAILED:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
console.log('features ok: permalink, copy link, CSV export, chart zoom, dock auto-hide, section pills, offline cache, guide');
