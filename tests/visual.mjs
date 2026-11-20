// Visual regression for the pages whose content does not depend on live data (Learn, About), plus the shell chrome.
// Usage: node tests/visual.mjs <outDir> [baseUrl]            compare against tests/visual/*.png; writes diffs to <outDir> on failure
//        node tests/visual.mjs <outDir> [baseUrl] --update   rewrite the baselines (review the images in git before committing)
// Baselines must be generated on the CI runner (workflow "Visual baselines"), because font rendering differs slightly between machines.
// Not a general screenshot test: live-data pages move every run, so they are covered by the gallery (tests/screens.mjs) for human review.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const [, , OUT = 'visual-out', BASE = 'http://localhost:8000/index.html', mode] = process.argv;
// CI copies this script elsewhere, so it points VISUAL_DIR at the repo's baselines.
const DIR = process.env.VISUAL_DIR || join(dirname(fileURLToPath(import.meta.url)), 'visual'); mkdirSync(OUT, { recursive: true }); mkdirSync(DIR, { recursive: true });
const MAX_PIXELS = 0.004, CH_TOL = 24;   // up to 0.4% of pixels may differ by more than 24/255 in any channel (anti-aliasing noise)
const CASES = [['learn', 'dark', 1360, 900], ['learn', 'light', 1360, 900], ['learn', 'dark', 390, 844], ['learn', 'light', 390, 844], ['about', 'dark', 1360, 900], ['about', 'light', 390, 844]];
const HIDE = '#tickerbar,#healthbar,#railFoot,.live-badge,[data-live]{visibility:hidden!important}*{animation:none!important;transition:none!important;caret-color:transparent!important}';
const browser = await chromium.launch(); const failures = [];
const cmp = async (a, b) => { const pg = await browser.newPage(); const r = await pg.evaluate(async ([x, y, tol]) => {
  const load = async u => { const bm = await createImageBitmap(await (await fetch(u)).blob()); const c = new OffscreenCanvas(bm.width, bm.height), g = c.getContext('2d'); g.drawImage(bm, 0, 0); return g.getImageData(0, 0, bm.width, bm.height); };
  const A = await load(x), B = await load(y); if (A.width !== B.width || A.height !== B.height) return { size: [A.width, A.height, B.width, B.height] };
  let d = 0; for (let i = 0; i < A.data.length; i += 4) if (Math.abs(A.data[i] - B.data[i]) > tol || Math.abs(A.data[i + 1] - B.data[i + 1]) > tol || Math.abs(A.data[i + 2] - B.data[i + 2]) > tol) d++;
  return { frac: d / (A.width * A.height) }; }, ['data:image/png;base64,' + a.toString('base64'), 'data:image/png;base64,' + b.toString('base64'), CH_TOL]); await pg.close(); return r; };
for (const [tab, theme, w, h] of CASES) {
  const name = `${tab}-${theme}-${w}.png`;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: theme, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await ctx.addInitScript(t => { try { localStorage.setItem('mt-theme', t); localStorage.setItem('mt-tour-done', '1'); } catch (e) {} }, theme);
  const page = await ctx.newPage(); await page.goto(`${BASE}#${tab}`, { waitUntil: 'networkidle' }); await page.addStyleTag({ content: HIDE });
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(800);
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await page.waitForTimeout(150);   // the app scrolls a little on phone navigation, by a varying amount
  const shot = await page.screenshot({ fullPage: false }); await ctx.close();
  const base = join(DIR, name);
  if (mode === '--update') { writeFileSync(base, shot); console.log('baseline written', name); continue; }
  if (!existsSync(base)) { failures.push(`${name}: no baseline in ${DIR} (run with --update)`); continue; }
  const r = await cmp(readFileSync(base), shot);
  if (r.size) { failures.push(`${name}: size changed ${r.size.slice(0, 2)} -> ${r.size.slice(2)}`); writeFileSync(join(OUT, 'actual-' + name), shot); }
  else if (r.frac > MAX_PIXELS) { failures.push(`${name}: ${(r.frac * 100).toFixed(2)}% of pixels differ (limit ${MAX_PIXELS * 100}%)`); writeFileSync(join(OUT, 'actual-' + name), shot); }
}
await browser.close();
if (failures.length) { console.error('VISUAL CHANGES:\n' + failures.map(f => '  - ' + f).join('\n') + '\nIf intended, run with --update and commit the new baselines.'); process.exit(1); }
console.log('visual ok:', CASES.length, 'screens match their baselines');
