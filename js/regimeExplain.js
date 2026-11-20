// Sensitivity of the composite score, computed from the published weights. Pure functions (no DOM) so they can be unit-tested with node.
// The composite is a category-weighted mean of within-category weighted means of indicator scores (see composite() in scripts/build_indicators.py).
// Weight-0 indicators (experimental) are excluded, exactly as the pipeline does.

/** Recompute the composite from latest.json. Returns null when fewer than two categories have data. */
export function composite(L) {
  const cat = categoryParts(L); const den = cat.reduce((s, c) => s + c.cw, 0);
  return cat.length >= 2 && den ? cat.reduce((s, c) => s + c.score * c.cw, 0) / den : null;
}

function categoryParts(L) {
  return (L.categories || []).map(c => {
    const m = (L.indicators || []).filter(i => i.cat === c.id && i.score != null && (i.weight ?? 1) > 0 && i.status !== 'nodata');
    const wsum = m.reduce((s, i) => s + (i.weight ?? 1), 0);
    return wsum ? { id: c.id, name: c.name, cw: c.weight, members: m, wsum, score: m.reduce((s, i) => s + i.score * (i.weight ?? 1), 0) / wsum } : null;
  }).filter(Boolean);
}

/** What would move the regime. Each indicator is moved alone to the extreme, all others held fixed: a sensitivity, not a forecast. */
export function explain(L) {
  const cats = categoryParts(L), den = cats.reduce((s, c) => s + c.cw, 0), comp = composite(L);
  if (comp == null || !L.regimes) return null;
  const idx = L.regimes.findIndex(r => comp < r.max), cur = L.regimes[idx], next = L.regimes[idx + 1] || null, prev = L.regimes[idx - 1] || null;
  const labelAt = v => (L.regimes.find(r => v < r.max) || L.regimes[L.regimes.length - 1]).label;
  const rows = [];
  cats.forEach(c => c.members.forEach(i => {
    const share = (i.weight ?? 1) / c.wsum * c.cw / den;                 // composite points per score point of this indicator
    rows.push({ id: i.id, name: i.name, score: i.score, status: i.status, up: (100 - i.score) * share, down: i.score * share });
  }));
  const lift = rows.filter(r => r.up > 0.05).sort((a, b) => b.up - a.up).slice(0, 3).map(r => ({ ...r, to: comp + r.up, regime: labelAt(comp + r.up) }));
  const hold = rows.filter(r => r.down > 0.05).sort((a, b) => b.down - a.down).slice(0, 3).map(r => ({ ...r, to: comp - r.down, regime: labelAt(comp - r.down) }));
  return {
    composite: comp, regime: cur.label,
    toNext: next ? { label: next.label, points: cur.max - comp, at: cur.max } : null,
    toPrev: prev ? { label: prev.label, points: comp - prev.max, at: prev.max } : null,
    lift, hold,
  };
}
