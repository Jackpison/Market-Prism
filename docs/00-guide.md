# Guide: how to use MarketPrism

MarketPrism watches public economic data and turns it into an early-warning picture. It is for research and education. It does not forecast and it is not financial advice.

## Start here (60 seconds)
1. **Overview** shows the regime gauge (Calm, Watch, Elevated, Critical), the indicators that changed, and any trends heating up. Start with the gauge and the "What changed" list.
2. **Radar** lists all 23 indicators. Green is normal, yellow is a warning, orange or red is stress. Every status also has a label and a shape, so you never depend on colour alone.
3. Open any indicator to see its chart, why it matters, how it behaved before past downturns, and where the data comes from.
4. Press **?** for keyboard shortcuts, or **Ctrl/Cmd + K** to search and jump anywhere. Search also has "Take the quick tour".

## What each page is for
| Page | Use it to |
|---|---|
| Overview | Get the one-screen summary: regime, biggest movers, trends, alerts |
| Radar | Check every indicator, filter by category, export CSV, read the track record |
| Yield curve | See whether the curve is inverted and how it has moved |
| Stress test | Try a rate, oil or credit shock and see rough asset sensitivities |
| Narratives | Follow speculative themes (AI, crypto, space, and so on) on a radar |
| Capital | See where money flows: ETFs, stablecoins, funds, and filings |
| Network | Explore links between themes and the companies behind them |
| Smart money | Read what large investors disclosed (delayed filings, not live) |
| Timeline, Months, Markets | Browse 100 years of history by year, month and market |
| Learn | Read the guide, methodology and the research notes |

## Features worth knowing
- **Daily history:** on Overview, switch the composite chart between day, week and month, and between 1 year, 5 years, 10 years and everything since 1990. The "Where today sits" card shows how today compares. Values before the first live day are reconstructed from today's data, and early years use fewer indicators, so treat them as context, not as what you would have seen then.
- **What would move the regime:** on Overview, a panel shows how many points the composite is from the next regime, which indicators could push it up most, and which are holding it up now. It is a sensitivity (one indicator at a time), not a forecast.
- **Compare indicators:** in an indicator's drawer, pick another indicator to overlay both on one chart (each in standard deviations from its own average) with the correlation of their monthly changes.
- **Hover a term:** dotted-underlined words such as OAS or Sahm rule explain themselves on hover, keyboard focus or tap.
- **Search the docs:** the filter box above the document list also searches inside every document.
- **Share an indicator:** open it, then press *Copy link*. The link (for example `#radar/vix`) opens straight to it.
- **Export:** *Export CSV* on Radar downloads the rows currently shown, respecting your filters.
- **Zoom charts:** drag across a line chart to zoom, then double-click or press *Reset zoom*.
- **Watchlist:** star an indicator to pin it; removal has an Undo.
- **Dark and light themes:** press **t**.
- **Offline:** after one visit, the last saved data still shows when you lose connection.
- **Alerts:** subscribe to the Atom feed (`data/feed.xml`) in a feed reader. There is no push or email service.
- **Stale data:** a clock icon with a date means that series is older than usual for its schedule.

## How to read a status
- **Green:** inside its normal range.
- **Yellow (warn):** crossed the warning level. Worth a look, not a signal by itself.
- **Red (critical):** crossed the critical level.
- **No data:** the source did not respond, so no status is shown rather than a guess.
One indicator rarely means much. The composite regime weighs many together, and even then it is a monitoring aid, not a prediction.

## Glossary
- **Regime:** the overall state (Calm to Critical) from the weighted indicator scores.
- **Percentile (10y):** where today's value sits against the last ten years. 90% means higher than 90% of days.
- **Yield curve inversion:** short-term rates above long-term rates; it has preceded most US recessions, with a variable lead time.
- **Spread / OAS:** the extra yield a corporate bond pays over Treasuries. Widening spreads signal stress in credit markets.
- **VIX / MOVE:** market-implied volatility for stocks / Treasury bonds.
- **Sahm rule:** a recession trigger when the unemployment rate's 3-month average rises 0.5pp above its 12-month low.
- **Net liquidity:** the Fed balance sheet minus the Treasury cash account and reverse repo, a rough gauge of liquidity in markets.
- **AUC:** in the track record, the chance a pre-recession month scores higher than a normal month. 0.5 is a coin flip, 1.0 is perfect.
- **Hit rate / false alarms:** how many downturns were preceded by an alert, and how many alert episodes were followed by nothing.
- **Quadrant (Narratives):** where a trend sits on momentum versus attention. Experimental and proxy data is labelled as such.
- **R-squared (Stress test):** how much of past returns the model explains. Low values mean treat results as direction only.
- **13F / Form D:** quarterly holdings disclosures by large funds / notices of private fundraising. Both are delayed.

## Limits you should keep in mind
Thresholds are the maintainer's heuristics, tuned with hindsight. Few recessions exist in the sample. Some sources are blocked or rate limited at times and show as optional. See *Methodology and limits* for the details.
