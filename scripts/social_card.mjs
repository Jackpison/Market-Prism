// Renders img/og-card.png (1200x630) for link previews. Static: it carries no market numbers, so it never goes stale.
// Usage (from a folder where playwright is installed):  node scripts/social_card.mjs <repoRoot>
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const root = process.argv[2] || '.';
const fav = readFileSync(`${root}/favicon.svg`, 'utf8').replace('width="64" height="64"', 'width="132" height="132"');
const fonts = ['fraunces-latin-wght', 'inter-latin-wght'].map(f => `data:font/woff2;base64,${readFileSync(`${root}/vendor/fonts/${f}.woff2`).toString('base64')}`);
const chips = ['23 leading indicators', 'Regime gauge', 'Trend radar', '100 years of history'];
const html = `<style>
@font-face{font-family:F;src:url(${fonts[0]});font-weight:100 900}@font-face{font-family:I;src:url(${fonts[1]});font-weight:100 900}
*{box-sizing:border-box;margin:0}body{width:1200px;height:630px;background:radial-gradient(900px 500px at 85% -10%,#2a3270 0%,transparent 60%),linear-gradient(160deg,#0b0d18,#07080b);color:#f4f5f7;font-family:I,sans-serif;padding:70px 80px 100px;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden}
.top{display:flex;align-items:center;gap:30px}.name{font:600 92px/1 F,serif;letter-spacing:-.02em}.tag{font:400 34px/1.35 I,sans-serif;color:#c9ced8;max-width:880px}
.chips{display:flex;gap:14px;flex-wrap:wrap}.chip{border:1px solid #2d3340;background:#10131c;border-radius:99px;padding:10px 20px;font:500 24px/1 I,sans-serif;color:#c9ced8}
.bar{position:absolute;left:0;right:0;bottom:0;height:10px;display:flex}.bar i{flex:1}.url{position:absolute;left:80px;bottom:34px;font:500 22px I,sans-serif;color:#979eac}
</style><body><div class="top">${fav}<div class="name">MarketPrism</div></div>
<div class="tag">An early-warning dashboard for the macro cycle, a radar for speculative trends, and a century of market history.</div>
<div class="chips">${chips.map(c => `<span class="chip">${c}</span>`).join('')}</div>
<div class="url">Research and education only. Not financial advice.</div>
<div class="bar"><i style="background:#43e0a0"></i><i style="background:#ffc94d"></i><i style="background:#ff9f55"></i><i style="background:#ff6f80"></i></div></body>`;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.setContent(html); await p.evaluate(() => document.fonts.ready); await p.screenshot({ path: `${root}/img/og-card.png` }); await b.close(); console.log('wrote img/og-card.png');
