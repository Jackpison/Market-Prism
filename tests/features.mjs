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
// 1b. drawer: distance to next level, compare with another indicator, history downloads
{
  const { ctx, page, errs } = await mk({ viewport: { width: 1360, height: 900 } });
  await page.goto(`${BASE}#radar/vix`, { waitUntil: 'networkidle' });
  try {
    await page.waitForSelector('#ewDetail:not([hidden]) #cmpD', { timeout: 8000 });
    check(await page.locator('.to-next').count() === 1 && /level|critical/.test(await page.textContent('.to-next')), 'drawer is missing the distance-to-next-level line');
    await page.selectOption('#cmpD', { index: 1 }); await page.waitForSelector('#cchart polyline.ln'); check(await page.locator('#cchart polyline').count() === 2, 'compare chart should draw both series'); const txt = await page.textContent('#cmpOut');
    check(/Correlation of month-on-month changes|Not enough overlapping/.test(txt), 'compare panel text missing: ' + txt.slice(0, 80));
    const [d1] = await Promise.all([page.waitForEvent('download'), page.click('#histD')]); check(/^marketprism-vix-monthly\.csv$/.test(d1.suggestedFilename()), 'indicator history filename: ' + d1.suggestedFilename());
    await page.keyboard.press('Escape'); await page.waitForSelector('#ewDetail', { state: 'hidden' });
    const [d2] = await Promise.all([page.waitForEvent('download'), page.click('#histBtn')]); const t2 = await (await import('node:fs/promises')).readFile(await d2.path(), 'utf8');
    check(t2.split('\n')[0].startsWith('month,') && t2.split('\n').length > 100, 'all-history CSV looks wrong');
  } catch (e) { failures.push('[drawer extras] ' + e.message.split('\n')[0]); }
  errs.forEach(e => failures.push('[drawer extras] ' + e)); await ctx.close();
}
// 1d. overview: "what would move the regime" panel
{
  const { ctx, page, errs } = await mk({ viewport: { width: 1360, height: 900 } });
  await page.goto(`${BASE}#overview`, { waitUntil: 'networkidle' });
  try {
    await page.waitForSelector('.rx .rx-cols li');
    check(await page.locator('.rx .rx-cols > div').count() === 2 && await page.locator('.rx li').count() >= 2, 'regime sensitivity panel is incomplete');
    check(/points/.test(await page.textContent('.rx')) && /not a forecast/i.test(await page.textContent('.rx')), 'regime panel lacks its caveat');
  } catch (e) { failures.push('[regime panel] ' + e.message.split('\n')[0]); }
  errs.forEach(e => failures.push('[regime panel] ' + e)); await ctx.close();
}
// 1e. glossary: terms in the indicator drawer explain themselves on focus and close with Escape
{
  const { ctx, page, errs } = await mk({ viewport: { width: 1360, height: 900 } });
  await page.goto(`${BASE}#radar/hyoas`, { waitUntil: 'networkidle' });
  try {
    await page.waitForSelector('#ewDetail:not([hidden]) abbr.term', { timeout: 8000 });
    await page.locator('#ewDetail abbr.term').first().focus(); await page.waitForSelector('#termTip:not([hidden])');
    check((await page.textContent('#termTip')).length > 30, 'glossary tooltip is empty');
    await page.keyboard.press('Escape'); check(await page.locator('#termTip').isHidden(), 'Escape should close the glossary tooltip');
    check(await page.evaluate(() => document.querySelector('#ewDetail') && !document.querySelector('#ewDetail').hidden), 'Escape closed the glossary tip but the drawer should stay for a first Escape');
  } catch (e) { failures.push('[glossary] ' + e.message.split('\n')[0]); }
  errs.forEach(e => failures.push('[glossary] ' + e)); await ctx.close();
}
// 1c. stress test: the slider rows sit inside the page content (a CSS class collision once pinned them over the sidebar)
{
  const { ctx, page, errs } = await mk({ viewport: { width: 1360, height: 900 } });
  await page.goto(`${BASE}#stress`, { waitUntil: 'networkidle' });
  try {
    await page.waitForSelector('#view-stress .slider input[type=range]');
    const g = await page.evaluate(() => { const r = document.querySelector('#view-stress .slider').getBoundingClientRect(), m = document.querySelector('#view-stress').getBoundingClientRect(); return { pos: getComputedStyle(document.querySelector('#view-stress .slider')).position, left: r.left, mainLeft: m.left, top: r.top, mainTop: m.top }; });
    check(g.pos !== 'absolute' && g.left >= g.mainLeft - 1 && g.top >= g.mainTop - 1, 'stress sliders are not inside the page content: ' + JSON.stringify(g));
  } catch (e) { failures.push('[stress layout] ' + e.message.split('\n')[0]); }
  errs.forEach(e => failures.push('[stress layout] ' + e)); await ctx.close();
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
  { // markets chart must not be clipped by its container, and its range must match the series
    await page.setViewportSize({ width: 1280, height: 900 }); await page.goto(`${BASE}#markets`, { waitUntil: 'networkidle' }); await page.waitForSelector('#line path.ser');
    const m = await page.evaluate(() => { const s = document.querySelector('#line').getBoundingClientRect(), c = document.querySelector('#line').parentElement.getBoundingClientRect(); return { clipped: s.bottom > c.bottom + 1, from: +document.querySelector('#from').value }; });
    check(!m.clipped, 'markets chart is clipped by its container'); check(m.from > 1930, 'markets range should snap to the S&P 500 series start (1985), got ' + m.from);
  }
  { // layout regressions: overview tile grid, timeline chips, light ticker, print, phone network map
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${BASE}#overview`, { waitUntil: 'networkidle' }); await page.waitForSelector('.kpi-tiles .tile');
    const g = await page.$eval('.kpi-tiles', el => ({ cols: getComputedStyle(el).gridTemplateColumns.split(' ').length, n: el.children.length }));
    check(g.n % g.cols === 0, `overview tiles leave an orphan row: ${g.n} tiles in ${g.cols} columns`);
    await page.goto(`${BASE}#timeline`, { waitUntil: 'networkidle' }); await page.waitForSelector('#chips .chip');
    const vis = () => page.$$eval('#chips .chip:not([hidden])', c => c.length);
    const v0 = await vis(); check(v0 <= 10, 'timeline topic chips should start collapsed, showing ' + v0);
    await page.click('#chips [data-more]'); const v1 = await vis(); check(v1 > v0 && (await page.getAttribute('#chips [data-more]', 'aria-expanded')) === 'true', 'More topics should expand the chips');
    await page.click('#chips [data-more]'); check((await vis()) === v0, 'Fewer topics should collapse the chips again');
    await page.click('#chips .chip:not([hidden]):not([data-more])'); await page.waitForTimeout(200);
    check((await page.$$eval('#chips .chip.on', c => c.length)) === 1, 'clicking a topic chip should select it'); await page.click('#reset');
    check((await page.$$eval('#chips .chip.on', c => c.length)) === 0, 'Reset should clear selected chips');
    await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
    const bg = await page.$eval('#tickerbar', el => getComputedStyle(el).backgroundColor); const lum = bg.match(/\d+/g).slice(0, 3).map(Number).reduce((x, y) => x + y, 0) / 3;
    check(lum > 200, 'ticker should be light in light mode, got ' + bg); await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    await page.goto(`${BASE}#radar`, { waitUntil: 'networkidle' }); await page.waitForSelector('.cat-tile'); await page.emulateMedia({ media: 'print' });
    check(await page.$eval('.rail', el => getComputedStyle(el).display) === 'none', 'print should hide the sidebar');
    check(await page.$eval('.cat-tile', el => getComputedStyle(el).display) !== 'none', 'print must keep the category tiles');
    await page.emulateMedia({ media: 'screen' });
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto(`${BASE}#network`, { waitUntil: 'networkidle' }); await page.waitForSelector('.vis-scroll #vis canvas');
    const n = await page.evaluate(() => { const w = document.querySelector('.vis-scroll'); return { scrolls: w.scrollWidth > w.clientWidth + 50, page: document.documentElement.scrollWidth <= innerWidth }; });
    check(n.scrolls, 'phone network map should scroll sideways inside its frame'); check(n.page, 'phone network map must not make the page overflow');
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  { // daily history: resolution switching, outlook card, graceful fallback
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${BASE}#overview`, { waitUntil: 'networkidle' }); await page.waitForSelector('#resRow:not([hidden])'); await page.waitForSelector('#outlookSlot .ol');
    const pts = () => page.evaluate(() => { const c = Chart.getChart(document.getElementById('ovComposite')); return { n: c.data.labels.length, last: c.data.labels[c.data.labels.length - 1] }; });
    await page.click('[data-range="0"]'); await page.waitForTimeout(400);
    const auto = await pts(); check((await page.getAttribute('[data-res="M"]', 'aria-pressed')) === 'true', 'Max range should default to monthly resolution');
    await page.click('[data-res="W"]'); await page.waitForTimeout(300); const wk = await pts();
    await page.click('[data-res="D"]'); await page.waitForTimeout(300); const dy = await pts();
    check(dy.n > wk.n && wk.n > auto.n && auto.n > 400 && dy.n > 9000, `day/week/month point counts should grow with resolution: ${dy.n}/${wk.n}/${auto.n}`);
    check(dy.last === wk.last && wk.last === auto.last, `the newest point must be the same day at every resolution: ${dy.last} ${wk.last} ${auto.last}`);
    await page.click('[data-range="12"]'); await page.waitForTimeout(300); const y1 = await pts();
    check(y1.n < 300 && y1.n > 200, 'one year at day resolution should be about 260 points, got ' + y1.n);
    const txt = await page.innerText('#outlookSlot'); check(/of days since 1990 had a lower composite/.test(txt) && /Reconstructed from today/.test(txt) && /Calm\s+\d+%/.test(txt), 'outlook card should state its figures and its reconstruction caveat');
    const csv = await page.evaluate(async () => (await fetch('data/history/composite_daily.csv')).ok); check(csv, 'history csv should be served');
    const ctx2 = await page.context().browser().newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' }); await ctx2.addInitScript(() => { try { localStorage.setItem('mt-tour-done', '1'); } catch (e) {} });
    const p2 = await ctx2.newPage(); await p2.route('**/composite_daily.csv', r => r.fulfill({ status: 404, body: 'nope' })); const errs2 = []; p2.on('pageerror', e => errs2.push(String(e)));
    await p2.goto(`${BASE}#overview`, { waitUntil: 'networkidle' }); await p2.waitForSelector('#ovComposite'); await p2.waitForTimeout(800);
    check(await p2.$eval('#resRow', el => el.hidden), 'resolution control must stay hidden when the history file is missing');
    check((await p2.evaluate(() => Chart.getChart(document.getElementById('ovComposite')).data.labels.length)) > 20, 'the monthly chart must still draw when the history file is missing');
    check(errs2.length === 0, 'no page errors when the history file is missing: ' + errs2.join('; ')); await ctx2.close();
  }
  { // radar + drawer history: resolution/range controls, native-frequency limits, graceful fallback
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${BASE}#radar`, { waitUntil: 'networkidle' }); await page.waitForSelector('#compBox .hc-ctl');
    const n = () => page.$eval('#compBox .hc-n', e => +e.textContent.replace(/[^0-9]/g, ''));
    await page.click('#compBox [data-k=res] [data-v=M]'); const m = await n(); await page.click('#compBox [data-k=res] [data-v=D]'); const d = await n();
    check(d > m * 5, `radar composite: daily should have far more points than monthly (${d} vs ${m})`);
    await page.click('#compBox [data-k=range] [data-v="1"]'); check((await n()) > 200 && (await n()) < 300, 'radar composite 1Y daily should be about 260 points');
    await page.goto(`${BASE}#radar/hyoas`, { waitUntil: 'networkidle' }); await page.waitForSelector('#dchartBox .hc-ctl');
    check(await page.$eval('#dchartBox [data-k=res] [data-v=D]', b => !b.disabled), 'a daily indicator should offer day resolution');
    await page.goto(`${BASE}#radar/m2yoy`, { waitUntil: 'networkidle' }); await page.waitForSelector('#dchartBox .hc-ctl');
    check(await page.$eval('#dchartBox [data-k=res] [data-v=D]', b => b.disabled) && await page.$eval('#dchartBox [data-k=res] [data-v=W]', b => b.disabled), 'a monthly indicator must not offer day or week resolution');
    check(await page.$$eval('#dchartBox svg .ln, #dchartBox svg path', e => e.length) > 0, 'the drawer history chart should draw');
    const ctx3 = await page.context().browser().newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' }); await ctx3.addInitScript(() => { try { localStorage.setItem('mt-tour-done', '1'); } catch (e) {} });
    const p3 = await ctx3.newPage(); await p3.route(/\/data\/history\//, r => r.fulfill({ status: 404, body: 'nope' })); const errs3 = []; p3.on('pageerror', e => errs3.push(String(e)));
    await p3.goto(`${BASE}#radar/hyoas`, { waitUntil: 'networkidle' }); await p3.waitForSelector('#dchart', { state: 'attached' }); await p3.waitForTimeout(600);
    check(!(await p3.$('#dchartBox'))  && !(await p3.$('#compBox .hc-ctl')) && errs3.length === 0, 'radar and drawer must keep their monthly charts when the history files are missing: ' + errs3.join('; ')); await ctx3.close();
    await page.goto('about:blank');   // leave no open drawer or hash state for the blocks that follow
  }
  { // experimental (weight 0) indicators must never be named as a source of pressure or as a category's highest
    const L = await (await fetch(new URL('data/indicators/latest.json', BASE))).json();
    const exp = L.indicators.filter(i => i.weight === 0).map(i => i.name.split(',')[0].split('(')[0].trim());
    await page.goto(`${BASE}#overview`, { waitUntil: 'networkidle' }); await page.waitForSelector('.oh-lead');
    const lead = await page.innerText('.oh-lead'); exp.forEach(n => check(!lead.includes(n), 'Overview headline names experimental indicator ' + n));
    await page.goto(`${BASE}#radar`, { waitUntil: 'networkidle' }); await page.waitForSelector('.cat-tile');
    const tiles = (await page.$$eval('.cat-tile .t-d', e => e.map(x => x.textContent))).join(' | '); exp.forEach(n => check(!tiles.includes('highest: ' + n), 'a category tile names experimental indicator ' + n));
  }
  await page.goto(`${BASE}#capital`, { waitUntil: 'networkidle' }); await page.waitForSelector('.secnav a');
  check(await page.$eval('.secnav', n => getComputedStyle(n).position) === 'sticky', 'section bar must stay position:sticky (a later .has-slider rule once overrode it)');
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
    // filter, quick links, reading progress
    await page.fill('#lnQ', 'backtest'); check(await page.locator('#docnav .ln-item:visible').count() === 1, 'filtering by "backtest" should leave one document');
    await page.fill('#lnQ', 'hindsight'); await page.waitForSelector('#docnav .ln-hit'); check(await page.locator('#docnav .ln-item:visible').count() >= 2, 'full-text search for "hindsight" should find several documents');
    check(await page.locator('#docnav .ln-snip mark').count() >= 1, 'full-text results should show a highlighted excerpt');
    await page.fill('#lnQ', 'zzzz'); check(await page.locator('#docnav .ln-none:visible').count() === 1, 'an empty filter result should say so'); await page.fill('#lnQ', '');
    await page.locator('#docnav .ln-item').first().click(); await page.waitForSelector('.doc-links a'); check(await page.locator('.doc-links a').count() >= 4, 'guide quick links missing');
    check(await page.locator('#doc p.lead').count() === 1, 'lead paragraph class missing');
    // outline, deep link, prev/next
    await page.locator('#docnav .ln-item').first().click(); await page.waitForSelector('#doctoc a');
    check(await page.locator('#doctoc a').count() >= 3, 'guide should have an on-page outline');
    await page.click('#doctoc a:nth-of-type(2)'); try { await page.waitForFunction(() => scrollY > 50, null, { timeout: 3000 }); } catch (e) { failures.push('outline link did not scroll to its section'); }
    await page.click('#docpager .next'); await page.waitForFunction(() => /Methodology/.test(document.querySelector('#doc h2')?.textContent || ''), null, { timeout: 5000 });
    check(await page.evaluate(() => location.hash) === '#learn/methodology', 'next did not update the link: ' + await page.evaluate(() => location.hash));
    await page.goto(`${BASE}#learn/backtest`, { waitUntil: 'networkidle' }); await page.waitForFunction(() => /Backtest/.test(document.querySelector('#doc h2')?.textContent || ''), null, { timeout: 5000 });
    check(await page.locator('.ln-item.on').count() === 1 && /Backtest/.test(await page.textContent('.ln-item.on')), 'deep link #learn/backtest did not select its entry');
  } catch (e) { failures.push('[guide] ' + e.message.split('\n')[0]); }
  errs.forEach(e => failures.push('[guide] ' + e)); await ctx.close();
}
await browser.close();
if (failures.length) { console.error('FEATURES FAILED:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
console.log('features ok: permalink, copy link, CSV export, chart zoom, dock auto-hide, section pills, offline cache, guide, compare and history');
