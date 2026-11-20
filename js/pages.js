// Single source of truth for navigation: groups, page titles and one-line descriptions (used by the sidebar, page header, breadcrumb and the command palette).
// Each page: [group label, title, description, icon, freshness source ('ind' = indicators run, 'trend' = trends run, null = static)]
export const PAGES = {
  overview: ['Overview', 'Overview', 'Where the market stands today: the regime, what is driving it, and what changed since you last looked.', 'layout-dashboard', 'ind'],
  radar: ['Macro', 'Early-warning radar', 'Seventeen leading indicators scored against warning and critical thresholds, with each one’s historical track record.', 'radar', 'ind'],
  yield: ['Macro', 'Yield curve', 'Month-end Treasury curves since 1990. Scrub through inversions and steepenings.', 'chart-line', 'ind'],
  stress: ['Macro', 'Stress test', 'Apply an inflation, rates, oil or credit shock and see the modelled impact, with its uncertainty.', 'sliders-horizontal', 'ind'],
  narratives: ['Trends', 'Narratives & capital', 'Which themes are heating up in attention, and whether money is following.', 'radio', 'trend'],
  capital: ['Trends', 'Capital & DeFi', 'Smart-money inflow, on-chain liquidity and venture activity.', 'coins', 'trend'],
  network: ['Trends', 'Asset network', 'How a trend could propagate: drivers, enablers, bottlenecks and risks.', 'network', 'trend'],
  smart: ['Trends', 'Smart money', 'Institutional and on-chain footprints, with strength and estimated lead time.', 'fish', 'trend'],
  timeline: ['History', 'Timeline', 'A century of cycles, crashes and technology waves.', 'history', null],
  months: ['History', 'Monthly explorer', 'Month-by-month detail for the years covered so far.', 'clock', null],
  markets: ['History', 'Markets', 'Long-run series with major events and recessions marked.', 'chart-column', null],
  learn: ['Learn', 'Docs', 'Frameworks, methods and what each indicator means.', 'book-open', null],
  about: ['Learn', 'Data & sources', 'Where every number comes from, and how healthy each source is.', 'database', 'trend'],
};
export const GROUPS = [
  { label: null, tabs: ['overview'] },
  { label: 'Macro', tabs: ['radar', 'yield', 'stress'] },
  { label: 'Trends', tabs: ['narratives', 'capital', 'network', 'smart'] },
  { label: 'History', tabs: ['timeline', 'months', 'markets'] },
  { label: 'Learn', tabs: ['learn', 'about'] },
];
export const REGIME_KEY = { Calm: 'calm', Watch: 'watch', Elevated: 'elevated', Critical: 'critical' };

/** Data the shell and palette share (filled asynchronously by shell.js; every consumer must tolerate nulls). */
export const store = { latest: null, macro: null };
