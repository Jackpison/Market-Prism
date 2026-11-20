# Contributing to MarketPrism

Thanks for helping. This is a static site (vanilla ES modules, no build step) with a Python data pipeline run by GitHub Actions.

## Ground rules
- **No hand-typed market numbers.** Every figure comes from a fetched series or a computed value. Historical text is curated and carries a confidence marker.
- **No invented data sources.** Use free, citable sources; label proxies and experimental data as such.
- **Status is never colour alone** (label plus shape), text meets WCAG AA in both themes, and motion respects `prefers-reduced-motion`.
- Keep `css/theme.css` loading last, tokens as hex, and the legacy token names.
- Thresholds in `scripts/_indicator_defs.py` are heuristics. If you change one, explain why and regenerate with `scripts/build_indicators.py` and `scripts/build_methodology.py`.

## Set up
```bash
python3 -m http.server              # then open http://localhost:8000
```
See the README for the full command list. Browser tests need `playwright` (and `axe-core` for the accessibility scan) installed in a folder outside the repo.

## Before you open a pull request
```bash
python3 tests/check_contrast.py && python3 tests/validate_data.py
python3 tests/test_pipeline_fixes.py && python3 tests/test_alerts.py && python3 tests/test_watchdog.py
python3 tests/test_scoring.py && python3 tests/test_digest.py && python3 tests/test_history.py && python3 tests/check_workflows.py && node tests/regime_explain.mjs . && node tests/history_resample.mjs
node tests/smoke.mjs <url> && node tests/features.mjs <url> && node tests/a11y.mjs <url>
VISUAL_DIR=tests/visual node tests/visual.mjs out <url>   # local runs can differ slightly from CI; after an intended change to Learn or About, run the "Visual baselines" workflow and review its commit
python3 scripts/build_single.py
```
For layout, motion or service-worker changes also go through `docs/device-checklist.md` on a real phone.
Do not commit regenerated data files with an unrelated change: the scheduled workflows own `data/`.
CI runs the same checks and uploads a screenshot gallery; look at it for visual changes.

## Reporting problems
Use the issue templates. For a data problem, link the primary source. Security-sensitive reports: open a private advisory on the repository rather than a public issue.
