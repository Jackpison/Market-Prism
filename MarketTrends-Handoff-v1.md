# MarketPrism handoff, v1 (Mon 23 Nov 2026)

## Project
MarketPrism: a static GitHub Pages site made of vanilla ES modules, with no build step. It has a 23-indicator early-warning dashboard, a trend radar, 100 years of history, alerts and GitHub Actions data pipelines.

- Repo: `Jackpison/Market-Prism`, cloned at `/home/user/market-prism`
- Live site: https://jackpison.github.io/Market-Prism/
- State: `main` is at 26fa360 (Radar and per-indicator history) plus the bots' data commits since. CI passed on 26fa360 and the Pages deploys since succeeded.

## Done this stretch
1. Site-wide design pass (Overview, Radar, Stress, Narratives, Capital, Timeline, Markets, Months, Smart money, light mode, phone).
2. GitHub tidy-up, tests for the new layouts, Timeline chips, Docs search snippets, print stylesheet, light-mode ticker.
3. Daily composite history since 1990.
   - `data/history/composite_daily.csv` has one row per weekday. Rows are `recon` (reconstructed from today's data), `live`, or `fill` (a missed day filled in later).
   - Append-only `indicators_log.csv` and `sources_log.csv`.
   - Built by `scripts/build_history.py`, which the daily workflow runs after the backtest (`continue-on-error`).
4. Overview: Day / Week / Month chart, range selector and a "Where today sits" card.
5. Radar composite chart and every indicator drawer: day / week / month and 1Y / 5Y / 10Y / Max controls.
   - 23 per-indicator files at `data/history/ind/<id>.csv`, about 1.8 MB in total.
   - The shared component is `js/charts/histchart.js`. The pure helpers are in `js/history.js`.
   - A series is never offered finer than its native frequency.
   - Each chart falls back to its monthly version if the files are missing.

## Verified
- Local: browser features, smoke and accessibility tests, the contrast check (6.59 dark, 4.90 light), Python and node tests, the data validator and the workflow check.
- CI passed on 26fa360.
- The scheduled 21 Nov run succeeded and committed the 20 Nov row as `live` (32.5, equal to the dashboard).

## Not verified or open
- Whether the scheduled run regenerates `data/history/ind/`. Check after the Monday 22:30 UTC run.
- Form D (403) and GDELT (429) fail from the runner IPs. Both are optional and the dashboard banner ignores them. Untestable from the sandbox.
- Real-device testing (`docs/device-checklist.md`) has not been run.
- Custom domain: deferred by the user.
- Removing the old repo name from the session needs a new session, whenever the user chooses.
- Releases are not needed. Pushing to `main` deploys the site, and the daily workflows run on their own.

## Standing rules
- Push straight to `main` after `git pull --rebase`. No PRs.
- End every commit message with:
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01HCoMPaPYRRk4yZ3abYCpML`
- Be concise and honest: say what failed, what was skipped and what is unverified. Never claim a run or deploy that wasn't seen.
- Use they/them for people. Keep the user's email and project details private.
- Design constraints:
  - keep the legacy CSS token names, with tokens as hex
  - `css/theme.css` loads last (the contrast test parses it)
  - status is never colour-only
  - no hand-typed market numbers
  - no invented data sources
  - label proxies and experimental data
  - respect prefers-reduced-motion
- Weight-0 (experimental) indicators, such as GEX, are excluded from the composite and every summary.
- Don't work around classifier denials. Deleting a remote branch was blocked once.

## How to test
- Scratch Playwright dir: `/tmp/claude-0/-home-user-Market-Trends/1b421f2c-2a99-5810-8ff9-8495e6142786/scratchpad/pw`. It may be gone after a reboot; reinstall playwright and axe-core there if so.
- Copy `tests/{smoke,features,a11y}.mjs` into it and run `node X.mjs`. The URL argument defaults to `http://localhost:8000/index.html`.
- Local server: `python3 -m http.server 8000` from the repo root. It dies often, so restart it with `nohup`.
- Tests that block a request must use `serviceWorkers: 'block'`, because the service worker bypasses `page.route`.
- Pure and Python tests:
  ```bash
  node tests/history_resample.mjs
  python3 tests/test_history.py
  python3 tests/validate_data.py
  python3 tests/check_contrast.py
  python3 tests/check_workflows.py
  ```
- Visual baselines (`tests/visual/`) come from the manual `visual-baselines.yml` workflow. The bot's push doesn't trigger CI, so push a real follow-up commit afterwards. Learn and About screenshots change when shared header, ticker, About text or guide text changes.

## Key technical notes
- Hash routing. `js/legacy.js` (history, markets, learn, about) coexists with the module entry `js/main.js`.
- The composite is a category-weighted mean of weighted indicator scores. Regimes: Calm below 25, Watch below 45, Elevated below 65, Critical above that.
- `scripts/build_indicators.py` (`B.metric`, `B.score`, `B.composite`) is reused by `build_history.py`. The reconstruction matches the backtest at month-ends.
- `daily workflow fetch-data.yml` runs weekdays at 22:30 UTC and commits `data/`.
- The service worker is network-first with no precache, so new files need no list changes.

## Suggested next steps
1. After the Monday run, confirm `data/history/ind/` and the logs updated.
2. Run the device checklist on a phone and a tablet.
3. Decide on a custom domain when ready.
4. Investigate Form D and GDELT from a different network, only if you want those sources.
