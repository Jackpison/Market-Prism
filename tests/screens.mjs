// Screenshot tool. Usage:
//   node tests/screens.mjs <outDir> [baseUrl]            gallery: every page x dark/light x desktop/phone (CI uploads it as a review artifact; it is NOT a pixel-diff test)
//   node tests/screens.mjs <outDir> [baseUrl] --readme   the four README images (1440x900) written to <outDir> with their README file names
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const [, , OUT = 'screens', BASE = 'http://localhost:8000/index.html', mode] = process.argv;
mkdirSync(OUT, { recursive: true });
const TABS = ['overview', 'radar', 'yield', 'stress', 'narratives', 'capital', 'network', 'smart', 'timeline', 'months', 'markets', 'learn', 'about'];
const browser = await chromium.launch();
const shot = async (theme, vp, scale, jobs) => {
  const ctx = await browser.newContext({ viewport: vp, colorScheme: theme, deviceScaleFactor: scale, reducedMotion: 'reduce' });
  await ctx.addInitScript(t => { try { localStorage.setItem('mt-theme', t); localStorage.setItem('mt-tour-done', '1'); } catch (e) {} }, theme);
  const page = await ctx.newPage();
  for (const [tab, file, full] of jobs) { await page.goto(`${BASE}#${tab}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500); await page.screenshot({ path: `${OUT}/${file}`, fullPage: full }); }
  await ctx.close();
};
if (mode === '--readme') {
  await shot('dark', { width: 1440, height: 900 }, 1, [['overview', 'overview-dark.png', false], ['radar', 'radar-dark.png', false]]);
  await shot('light', { width: 1440, height: 900 }, 1, [['overview', 'overview-light.png', false], ['narratives', 'narratives-light.png', false]]);
} else {
  for (const theme of ['dark', 'light']) {
    await shot(theme, { width: 1360, height: 900 }, 1, TABS.map(t => [t, `${t}-${theme}-desktop.png`, true]));
    await shot(theme, { width: 390, height: 844 }, 1, TABS.map(t => [t, `${t}-${theme}-phone.png`, true]));
  }
}
await browser.close(); console.log('screenshots written to', OUT);
