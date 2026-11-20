// Pure-node tests for js/history.js (parsing, resampling, "where today sits"). Run: node tests/history_resample.mjs
import { parseHistory, resample, lastYears, weekKey, autoRes, outlook, parseSeries, nativeRes, allowedRes } from '../js/history.js';
import fs from 'node:fs';
const fail = []; const check = (ok, msg) => { if (!ok) fail.push(msg); };

const csv = ['date,composite,curve,liquidity,n,src',
  '2026-11-02,20.0,10.0,,5,recon', '2026-11-03,22.5,12.5,30.0,5,recon', '2026-11-06,25.0,15.0,35.0,6,recon', '2026-11-09,30.0,,,6,fill', '2026-11-10,31.0,50.5,40.0,6,live', 'bad,row,x', ''].join('\n');
const H = parseHistory(csv);
check(H && H.rows.length === 5 && H.categories.join() === 'curve,liquidity', 'parse should keep 5 good rows and the category columns');
check(H.rows[0].cats.liquidity === null && H.rows[1].cats.liquidity === 30 && H.rows[4].src === 'live' && H.rows[4].n === 6, 'parse should read blanks as null, numbers, n and src');
check(parseHistory('') === null && parseHistory('date,composite\n2026-01-01,5') === null && parseHistory('a,b\n1,2\n3,4\n5,6') === null, 'unusable input should give null');

check(weekKey('2026-11-09') === '2026-11-09' && weekKey('2026-11-15') === '2026-11-09' && weekKey('2026-11-08') === '2026-11-02' && weekKey('2026-01-01') === '2025-12-29', 'weekKey should return the Monday');
const W = resample(H.rows, 'W'); check(W.map(r => r.d).join() === '2026-11-06,2026-11-10', 'weekly keeps the last row of each week, got ' + W.map(r => r.d));
const M = resample(H.rows, 'M'); check(M.length === 1 && M[0].d === '2026-11-10' && M[0].c === 31, 'monthly keeps the last row of the month');
const D = resample(H.rows, 'D'); check(D.length === 5 && D !== H.rows, 'daily returns a copy of every row');
check(resample(H.rows, 'W')[resample(H.rows, 'W').length - 1].d === H.rows[H.rows.length - 1].d, 'the newest point must always be the final day');

const long = []; for (let y = 2000; y <= 2026; y++) for (const m of ['03', '09']) long.push({ d: `${y}-${m}-15`, c: 10 + (y % 10) * 5, n: 20, src: 'recon', cats: {} });
check(lastYears(long, 0).length === long.length && lastYears(long, 1).length === 3 && lastYears(long, 10)[0].d >= '2016-', 'lastYears should cut counting back from the final date');
check(autoRes(1) === 'D' && autoRes(5) === 'W' && autoRes(10) === 'W' && autoRes(0) === 'M' && autoRes(30) === 'M', 'autoRes picks day/week/month by range');

// outlook on synthetic data with known answers: 40 days, composite 10 for 20 days then 30 for 19 days then 50 on the final day
const regimes = [{ max: 25, label: 'Calm' }, { max: 45, label: 'Watch' }, { max: 65, label: 'Elevated' }, { max: 101, label: 'Critical' }];
const syn = []; for (let i = 0; i < 40; i++) { const d = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10); syn.push({ d, c: i < 20 ? 10 : i < 39 ? 30 : 50, n: 10 + (i >> 3), src: i === 39 ? 'live' : 'recon', cats: {} }); }
const O = outlook(syn, regimes);
check(O.regime === 'Elevated' && O.now === 50 && O.pctLower === 98 && O.days === 40, 'outlook headline: regime, value, share of lower days (39/40 = 98%)');
check(O.spell.days === 0 && O.spell.since === syn[39].d && !O.spell.fromStart, 'current spell starts on the final day');
check(Math.abs(O.share.find(s => s.label === 'Calm').pct - 50) < 1e-9 && Math.abs(O.share.find(s => s.label === 'Watch').pct - 47.5) < 1e-9 && Math.abs(O.share.reduce((a, s) => a + s.pct, 0) - 100) < 1e-9, 'regime shares add up to 100%');
check(O.coverage.first.n === 10 && O.coverage.last.n === 14 && O.live === syn[39].d, 'coverage and first live day');
check(outlook(syn.slice(0, 10), regimes) === null && outlook(null, regimes) === null, 'too little data gives null');
const calm = syn.slice(0, 20).map(r => ({ ...r })); for (let i = 20; i < 35; i++) calm.push({ ...syn[0], d: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10) }); const OC = outlook(calm, regimes); check(OC.spell.fromStart && OC.spell.days === 34 && OC.regime === 'Calm', 'a regime that spans the whole file is flagged as starting at the beginning');

// the committed file parses, is ascending, and the newest point equals the dashboard's composite
const real = parseHistory(fs.readFileSync(new URL('../data/history/composite_daily.csv', import.meta.url), 'utf8'));
const L = JSON.parse(fs.readFileSync(new URL('../data/indicators/latest.json', import.meta.url), 'utf8'));
check(real && real.rows.length > 9000 && real.rows.every((r, i) => i === 0 || r.d > real.rows[i - 1].d), 'the committed history parses and is strictly ascending');
check(Math.abs(real.rows[real.rows.length - 1].c - L.composite) < 0.11, `latest history row (${real.rows[real.rows.length - 1].c}) must equal latest.json composite (${L.composite})`);
const RO = outlook(real.rows, L.regimes); check(RO && RO.regime === L.regime, 'outlook regime should equal latest.json regime');

// per-indicator series
const ps = parseSeries('date,value\n2026-01-01,1.5\n2026-01-02,2\nbad,x\n2026-01-05,-3\n'); check(ps && ps.length === 3 && ps[2].c === -3, 'parseSeries keeps good rows');
check(parseSeries('') === null && parseSeries('a,b\n1,2\n3,4\n5,6') === null && parseSeries('date,value\n2026-01-01,1') === null, 'parseSeries rejects unusable input');
const mk = (step, n) => Array.from({ length: n }, (_, i) => ({ d: new Date(Date.UTC(2020, 0, 1 + i * step)).toISOString().slice(0, 10), c: i }));
check(nativeRes(mk(1, 80)) === 'D' && nativeRes(mk(7, 80)) === 'W' && nativeRes(mk(31, 80)) === 'M', 'nativeRes from median spacing');
check(allowedRes('D').join() === 'D,W,M' && allowedRes('W').join() === 'W,M' && allowedRes('M').join() === 'M', 'allowedRes never offers finer than native');
const realInd = parseSeries(fs.readFileSync(new URL('../data/history/ind/' + L.indicators[0].id + '.csv', import.meta.url), 'utf8')); check(realInd && realInd.length > 100, 'committed indicator file parses');

if (fail.length) { console.error('history tests FAILED:\n - ' + fail.join('\n - ')); process.exit(1); }
console.log('history tests ok: parse, week and month resampling, ranges, outlook statistics, committed file agrees with latest.json');
