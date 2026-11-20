# Market Trends: 100 years of cycles

A research dataset and analysis project on how markets, technologies and policy shocks have played out over the last century (1926-2026), built as the foundation for an interactive website.

> Research and education only. Not financial advice. Entries are curated summaries; verify against primary sources before relying on any figure.

Live site: https://jackpison.github.io/Market-Trends/

## Status
| Layer | Coverage | State |
|---|---|---|
| Yearly overview | 1926-2026 | Drafted (2026 partial) |
| Monthly detail | 1996-2005 | Drafted (sample decade) |
| Monthly detail | 1926-1995, 2006-2026 | To do |
| Market + macro series | FRED, Yahoo (daily, automated) | Runs via GitHub Actions |
| Early-warning system | 23 indicators, radar, heatmap, yield curve, stress test | Live (see Radar tab) |
| Cycle analysis | Frameworks, signals, case studies | First pass |

## Architecture
```
GitHub Actions (weekdays, UTC evening)            Static site (GitHub Pages, no build step)
  scripts/fetch_market_data.py  -> data/market/*.csv        index.html + css/ + js/ (ES modules)
  scripts/fetch_macro.py        -> data/macro/*.csv           js/widgets: earlyWarning, yieldCurve, stressTest
  scripts/build_indicators.py   -> data/indicators/*.json     js/charts: radar, heatmap, linechart, yieldchart, spark
        reads config/indicators.json (thresholds)             js/legacy.js: 100-year history, monthly, markets, learn
```

## Speculative-trend intelligence (Trends tabs)
`scripts/fetch_trends.py` (every 6 hours via `.github/workflows/update_trends.yml`) measures narrative velocity (NVS), infiltration stage, Smart Money Inflow Index (SMII), DeFi liquidity, VC clusters and smart-money signals for 13 editorial trend definitions in `config/trends.json`, writing `data/macro_data.json`. Methodology, formulas and an honest list of what is measured vs proxied vs unavailable: `docs/07-narrative-engine.md`. Chart.js, Vis Network and JetBrains Mono are vendored in `vendor/` (licenses in `vendor/LICENSES.md`).

## Design system
**Layout (v4, "Atlas").** A left sidebar (grouped pages, live badges, data-freshness card; a slide-in drawer on phones), a sticky top bar with breadcrumb, command palette (`Ctrl/Cmd+K` or `/`: pages, indicators, trends) and a regime chip, and a new **Overview** home page (bento layout: regime gauge and 5-year composite chart, six key indicator tiles, "needs attention", yield-curve comparison, trend radar, what changed). The whole page takes an ambient tint from the current regime. Navigation metadata lives in `js/pages.js`; shell in `js/shell.js`; palette in `js/palette.js`; overview in `js/widgets/overview.js`. Display type is Instrument Serif (OFL), body Inter.

`css/theme.css` is loaded last and defines the tokens for both themes. Component conventions still follow the public documentation of the [AlignUI](https://www.alignui.com/) design system: semantic token names (`--bg-weak-50`, `--text-strong-950`, `--stroke-soft-200`), the published type scale (14/20 body, Medium-weight headings), button modes (stroke, filled, lighter, ghost), flat surfaces with soft strokes, and a segmented-control navigation. It is an independent implementation: no AlignUI code or assets are used, all colour values were chosen here, and the project is not affiliated with AlignUI. Status is never colour-only (every state has a label and a distinct shape), and every text pair is at least WCAG AA (`tests/check_contrast.py`). Corner radius presets: set `data-radius="sm"` or `"lg"` on `<html>`. Fonts (Inter variable, JetBrains Mono) and icons (an inlined Lucide subset in `js/icons.js`) are vendored, so the site makes no third-party requests. Motion respects `prefers-reduced-motion`.

## Single-file build
`python3 scripts/build_single.py` writes `dist/market-trends.html` (about 1.8 MB): the whole site with fonts, libraries and current data embedded. It works offline and from `file://`. Needs Node at build time only (esbuild). The output is git-ignored; `.github/workflows/release-single.yml` also publishes it to a rolling `snapshot` release each weekday.

## Track record (backtest)
`scripts/backtest.py` scores every indicator at each month-end since 1990 with the live scoring rules and measures it against NBER recessions and S&P 500 bear markets: AUC (0.5 = coin flip), hit rate, median lead time and false-alarm share. Results are written to `data/indicators/backtest.json` and shown in the Radar tab. Read `docs/08-backtest.md` for method and limits: there are only four recessions in the sample, so treat every rate as a sanity check, not proof of skill.

## Alerts
`scripts/alerts.py` runs after each data workflow (`.github/workflows/alerts.yml`). It logs regime changes, indicators turning red and trend quadrant moves to `data/alerts.json`, publishes an Atom feed at `data/feed.xml`, and opens a GitHub issue (label `alert`) for warnings and critical changes, so repository watchers get an email. The first run only records state.

## Data health and tests
The site shows a banner when its data is stale or sources are failing. CI (`.github/workflows/ci.yml`) runs the Python tests, validates all data and config structure, checks WCAG contrast of the design tokens and runs a browser smoke test over every tab (dark/light, desktop/phone, no console errors, no horizontal overflow on phones).

## Known limitations
- GDELT (news volume and tone) is rate-limited from GitHub-hosted runner IPs; retries with backoff are in place but it can still report `failed`. The narrative score falls back to the other sources.
- Form D uses EDGAR's daily index and matches filer *names* to trend keywords, a coarse proxy (Form D has no business description). It needs a real contact address in the repository variable `SEC_CONTACT`.
- FRED serves only about 3 years of credit-spread data, so HY/IG OAS cannot be backtested.
- Stress-test sensitivities have low explanatory power (R-squared roughly 0.02 to 0.27); the page shows model uncertainty and a low-fit flag.
- Every scheduled data commit lands on `main`; this grows git history over time (a dedicated `data` branch would avoid it but changes how Pages serves the data).

## Optional sources
Reddit narrative data needs a free app: add repo secrets `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET`. Without them the source shows as `unconfigured` (not `failed`) on the Data & sources tab.

## Layout
```
index.html            single page; every view is a <section id="view-...">
css/                  base.css (legacy views) · terminal.css · trends.css · theme.css (v4 tokens + shell, loaded last)
js/                   main.js boots everything; shell.js, palette.js, pages.js (navigation metadata), legacy.js (history/markets/learn views)
  widgets/            one module per page: overview, earlyWarning, yieldCurve, stressTest, narratives, capitalFlows, network, smartMoney, ticker
  charts/             small SVG chart helpers (radar, heatmap, line, yield, spark)
vendor/               Chart.js, vis-network, fonts, icons licences (no third-party requests at runtime)
config/               indicators.json (generated from scripts/_indicator_defs.py), trends.json, network.json
scripts/              data pipeline: fetch_*.py, build_*.py, backtest.py, alerts.py (+ _*defs/_years data modules)
data/                 macro/ market/ (raw series) · indicators/ (computed) · yearly/ monthly/ (curated history) · alerts.json, feed.xml
docs/                 research notes 01-08 and data-schema.md
tests/                unit tests, data validation, contrast gate, browser smoke test
.github/workflows/    scheduled data runs, alerts, CI, single-file release
dist/                 generated single-file build (git-ignored)
```

## Quick start
```bash
python3 scripts/fetch_market_data.py   # long-history monthly series
python3 scripts/fetch_macro.py         # daily macro series (FRED, Yahoo)
python3 scripts/build_indicators.py    # indicators, heatmap, yield curve, stress betas
python3 -m http.server                 # then open http://localhost:8000
python3 scripts/build_yearly.py        # rebuilds data/yearly/overview.json
python3 scripts/build_monthly.py       # rebuilds monthly files
python3 tests/test_pipeline_fixes.py   # offline tests for source health
python3 tests/test_alerts.py           # alert detection
python3 tests/validate_data.py         # structure of every data/config file the site reads
python3 tests/check_contrast.py        # WCAG AA gate for css/theme.css
python3 scripts/backtest.py            # indicator track record -> data/indicators/backtest.json
python3 scripts/alerts.py              # regime / indicator / quadrant change log + feed
TRENDS_OUT=/tmp/t/data python3 tests/selftest_trends.py   # always set TRENDS_OUT, or it overwrites data/
python3 scripts/build_single.py        # one-file offline build -> dist/
```

## Method and honesty rules
- Qualitative text is written from general historical knowledge and is marked with a `confidence` field.
- Months without a clearly identified standout event are marked `context-only` instead of being filled with guesses.
- Numeric returns are not hand-typed; they come from the downloaded series.

## Roadmap
1. Run the fetcher and merge metrics into the JSON
2. Extend monthly coverage decade by decade
3. Score each major cycle against `docs/02-signals-checklist.md`
4. Build the interactive site (timeline, filters by tag/regime, cycle overlays)

Licensed under the repository LICENSE.
