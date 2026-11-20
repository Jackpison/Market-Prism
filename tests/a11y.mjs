// Accessibility scan with axe-core over every page, dark and light, desktop. Fails on serious or critical violations.
// Usage: node tests/a11y.mjs [baseUrl]   (needs playwright and axe-core installed next to this script, and a running static server)
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const BASE = process.argv[2] || 'http://localhost:8000/index.html';
const TABS = ['overview', 'radar', 'yield', 'stress', 'narratives', 'capital', 'network', 'smart', 'timeline', 'months', 'markets', 'learn', 'about'];
const IMPACT = new Set(['serious', 'critical']); const found = new Map();
const browser = await chromium.launch();
for (const theme of ['dark', 'light']) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, colorScheme: theme, reducedMotion: 'reduce' });
  await ctx.addInitScript(t => { try { localStorage.setItem('mt-theme', t); localStorage.setItem('mt-tour-done', '1'); } catch (e) {} }, theme);
  const page = await ctx.newPage();
  for (const tab of TABS) {
    await page.goto(`${BASE}#${tab}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(900);
    await page.evaluate(axeSource);
    const res = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }, resultTypes: ['violations'] }));
    for (const v of res.violations) if (IMPACT.has(v.impact)) { const k = v.id; const e = found.get(k) || { v, where: new Set(), nodes: new Set() }; e.where.add(`${theme}/${tab}`); v.nodes.slice(0, 3).forEach(n => e.nodes.add(n.target.join(' '))); found.set(k, e); }
  }
  await ctx.close();
}
await browser.close();
if (found.size) { console.error('A11Y VIOLATIONS (serious/critical):'); for (const [id, e] of found) console.error(`  - ${id} (${e.v.impact}): ${e.v.help}\n      pages: ${[...e.where].join(', ')}\n      e.g. ${[...e.nodes].slice(0, 3).join(' | ')}`); process.exit(1); }
console.log('a11y ok: no serious or critical axe violations on 13 pages x dark/light');
