# Data schema

## data/yearly/overview.json (101 rows, 1926-2026)
| field | type | meaning |
|---|---|---|
| year | int | calendar year |
| headline | string | key events and market-relevant facts |
| summary | string (500-1000 chars) | curated narrative for the year, written in `scripts/_year_summaries_*.py`; 2026 is generated from data until the year closes |
| regime | string | short label for the market/cycle phase |
| impact | 0-5 | subjective market/economic significance (0 = not yet rated) |
| tags | string[] | topics for filtering (e.g. `dotcom`, `fed`, `oil`) |
| confidence | high / medium / low | how well-sourced the entry is |
| metrics | object or null | computed by `scripts/build_yearly.py` from `data/market/`: S&P 500 / Nasdaq / gold calendar-year % change (where the series exist), CPI Dec/Dec %, December-average fed funds and 10Y yield, average unemployment and WTI, recession months |

## data/monthly/YYYY.json (12 rows per file)
| field | type | meaning |
|---|---|---|
| month | `YYYY-MM` | month |
| event | string or null | the standout event(s); null = none confidently identified |
| market_effect | string | impact or context |
| metrics | object or null | filled later from `data/market/` |
| confidence | high / context-only | `context-only` = no standout event, regime context only |

## data/market/*.csv
Raw monthly series downloaded by `scripts/fetch_market_data.py` (FRED, Yahoo Finance, Stooq).

## data/history/composite_daily.csv

One row per weekday from 1990-01-01: `date, composite, <one column per category>, n, src`.

- `composite` and the category columns are 0 to 100, scored exactly like the dashboard and the backtest (`scripts/build_history.py` reuses `scripts/build_indicators.py`). Blank category = no data that day.
- `n` is how many scored indicators had data that day. It is 5 in 1990 and 22 today, so early values rest on much less evidence. Read them as a rough guide only.
- `src` says where the row came from: `recon` = reconstructed once from the data as it stands today (final, revised values, not what was published at the time); `live` = computed on the day itself; `fill` = a skipped day computed later because a run was missed.
- Rows are never rewritten. Only today's own `live` row is refreshed if the job runs twice in a day.
- Dates are observation dates, not release dates: a series is treated as known from the date it refers to, even though some (such as weekly claims or monthly surveys) are published days or weeks later. The backtest scores the same way and also uses revised data (see `docs/08-backtest.md`), so both inherit this optimism.

## data/history/indicators_log.csv

`date, id, value, score, status, asof, age_days`: one row per indicator per day as the pipeline reported it. It starts on the day the logging was added and only grows. Use it to study how readings, revisions and data staleness actually looked at the time.

## data/history/sources_log.csv

`date, source, ok, fail, state`: one row per data source per day (requests that worked, requests that failed, and the source state). The `fred` row summarises the FRED downloads. Use it to see how often a source such as GDELT or SEC Form D fails.

All three files are written by `python scripts/build_history.py`, which the daily workflow runs after the indicators and the backtest.

## data/history/ind/<id>.csv

One file per indicator: `date, value`. The value is the derived number the dashboard shows for that indicator (for example a year-on-year change or a drawdown, not the raw series), at the series' own native frequency since 1990, or since the source starts (FRED serves only about 3 years of credit spreads). Unlike the logs these files are regenerated from the raw data on every run, so data revisions flow through. The drawer draws the warn and critical lines from `latest.json`, and only offers day or week resolution when the series is really published that often.
