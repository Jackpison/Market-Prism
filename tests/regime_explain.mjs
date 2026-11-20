// Unit test for js/regimeExplain.js (pure maths, no browser). Usage: node tests/regime_explain.mjs [repoRoot]
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
const root = process.argv[2] || '.';
const { composite, explain } = await import(pathToFileURL(join(root, 'js/regimeExplain.js')).href);
const fails = []; const t = (ok, m) => { if (!ok) fails.push(m); };
const L = JSON.parse(readFileSync(join(root, 'data/indicators/latest.json'), 'utf8'));
// 1. the recomputed composite must match what the pipeline published
t(Math.abs(composite(L) - L.composite) < 0.15, `recomputed composite ${composite(L)} differs from published ${L.composite}`);
const E = explain(L); t(E && E.regime === L.regime, 'regime label differs from the published one');
// 2. moving an indicator alone to its extreme changes the composite by exactly the predicted amount
for (const r of E.lift) { const L2 = JSON.parse(JSON.stringify(L)); L2.indicators.find(i => i.id === r.id).score = 100; t(Math.abs(composite(L2) - r.to) < 1e-6, `lift for ${r.id} does not match a recomputation`); }
for (const r of E.hold) { const L2 = JSON.parse(JSON.stringify(L)); L2.indicators.find(i => i.id === r.id).score = 0; t(Math.abs(composite(L2) - r.to) < 1e-6, `hold for ${r.id} does not match a recomputation`); }
// 3. ordering, experimental indicators excluded, boundaries consistent
t(E.lift.every((r, i, a) => !i || a[i - 1].up >= r.up), 'lift is not sorted'); t(![...E.lift, ...E.hold].some(r => r.id === 'gex'), 'weight-0 (experimental) indicator must not appear');
if (E.toNext) t(E.composite + E.toNext.points - E.toNext.at < 1e-9, 'distance to next regime is inconsistent');
// 4. edge cases
t(explain({ categories: [], indicators: [], regimes: L.regimes }) === null, 'no data should return null');
const calm = JSON.parse(JSON.stringify(L)); calm.indicators.forEach(i => { i.score = 0; }); calm.categories.forEach(c => { c.score = 0; }); const C = explain(calm); t(C.regime === 'Calm' && C.toPrev === null && C.hold.length === 0, 'all-calm case wrong');
const hot = JSON.parse(JSON.stringify(L)); hot.indicators.forEach(i => { i.score = 100; }); const H = explain(hot); t(H.toNext === null && H.lift.length === 0, 'all-critical case wrong');
if (fails.length) { console.error('REGIME EXPLAIN FAILED:\n' + fails.map(f => '  - ' + f).join('\n')); process.exit(1); }
console.log('regime explain ok: composite reproduced (' + composite(L).toFixed(2) + ' vs ' + L.composite + '), sensitivities verified by recomputation');
