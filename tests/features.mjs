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
await browser.close();
if (failures.length) { console.error('FEATURES FAILED:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
console.log('features ok: permalink, copy link, CSV export, chart zoom, dock auto-hide, section pills');
