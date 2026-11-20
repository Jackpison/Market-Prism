// Shared by the Overview and Radar pages: 270-degree composite-risk gauge and the regime vocabulary.
export const SEG = [[0, 25, '--ok'], [25, 45, '--warn'], [45, 65, '--orange'], [65, 100, '--bad']];
export const REGIMES = ['Calm', 'Watch', 'Elevated', 'Critical'];
export const REGIME_TEXT = {
  Calm: 'Conditions look benign: few indicators are near their warning thresholds.',
  Watch: 'Some stress is building, but there is no broad deterioration. Worth monitoring, not acting on.',
  Elevated: 'Multiple indicators are in warning territory at once. Late-cycle risks are rising.',
  Critical: 'Broad stress across indicators. Historically this is where drawdowns and credit events cluster.',
};
export const regimeVar = r => ({ Calm: '--ok', Watch: '--warn', Elevated: '--orange', Critical: '--bad' }[r] || '--acc');

const A0 = 135, SWEEP = 270, CX = 100, CY = 100, R = 78;
const ang = v => A0 + SWEEP * Math.max(0, Math.min(100, v)) / 100;
const pt = a => [CX + R * Math.cos(a * Math.PI / 180), CY + R * Math.sin(a * Math.PI / 180)];
function arc(v0, v1, gap = 0) { const a0 = ang(v0) + gap, a1 = ang(v1) - gap, [x0, y0] = pt(a0), [x1, y1] = pt(a1); return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`; }

export function gauge(score, rv) {
  const len = (R * Math.PI * SWEEP / 180 * score / 100).toFixed(1);
  return `<svg class="gauge-svg" viewBox="0 0 200 200" role="img" aria-label="Composite risk ${Math.round(score)} out of 100">
    ${SEG.map(([a, b, v]) => `<path d="${arc(a, b, 0.9)}" fill="none" stroke="var(${v})" stroke-width="11" opacity=".26"/>`).join('')}
    <path class="g-prog" d="${arc(0, score)}" fill="none" stroke="var(${rv})" stroke-width="11" stroke-linecap="round" style="--len:${len}"/>
    <text x="100" y="108" text-anchor="middle" class="g-num" data-count="${Math.round(score)}">${Math.round(score)}</text><text x="100" y="132" text-anchor="middle" class="g-sub">of 100</text></svg>`;
}

export function gaugeLegend(regime) {
  return `<div class="oh-legend">${SEG.map(([, , v], k) => `<span class="${REGIMES[k] === regime ? 'on' : ''}"><i style="background:var(${v})"></i>${REGIMES[k]}</span>`).join('')}</div>`;
}
