"""Builds data/yearly/overview.json from scripts/_years.py (headline, regime, tags), the hand-written narratives in scripts/_year_summaries_*.py,
and per-year numbers computed from data/market/*.csv (so the figures in the UI are never typed by hand).
Run: python3 scripts/build_yearly.py"""
import csv, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, "..")
sys.path.insert(0, HERE)
from _years import Y
import _year_summaries_1926_1950 as s1, _year_summaries_1951_1975 as s2, _year_summaries_1976_2000 as s3, _year_summaries_2001_2025 as s4
SUMMARIES = {**s1.S, **s2.S, **s3.S, **s4.S}
MIN_LEN, MAX_LEN = 500, 1000

def series(name, col=None):
    """{ 'YYYY-MM': value } from a monthly CSV with either DATE,VALUE or OHLC columns (uses close)."""
    path = os.path.join(ROOT, "data", "market", name + ".csv"); out = {}
    if not os.path.exists(path): return out
    with open(path, newline="") as f:
        r = csv.DictReader(f)
        for row in r:
            k = {c.lower(): c for c in row}
            c = col or ("close" if "close" in k else "value")
            try: out[(row[k["date"]])[:7]] = float(row[k[c]])
            except Exception: pass
    return out

def last_month(s): return max(s) if s else None

def ret(s, y, first_open=None):
    """Calendar-year % change: December close vs prior December close (latest month for a partial year)."""
    cur = [k for k in s if k.startswith(str(y))]; prev = s.get("%d-12" % (y - 1))
    if not cur or prev is None: return None
    return round((s[max(cur)] / prev - 1) * 100, 1)

def avg(s, y):
    v = [s[k] for k in s if k.startswith(str(y))]
    return round(sum(v) / len(v), 2) if v else None

def end(s, y):
    ks = sorted(k for k in s if k.startswith(str(y)))
    return round(s[ks[-1]], 2) if ks else None

def metrics_for(y, S):
    sp, nq, gold, cpi, ff, t10, un, oil, rec = S["sp"], S["nq"], S["gold"], S["cpi"], S["ff"], S["t10"], S["un"], S["oil"], S["rec"]
    m = {"sp500_return_pct": ret(sp, y), "nasdaq_return_pct": ret(nq, y), "gold_return_pct": ret(gold, y),
         "cpi_inflation_pct": ret(cpi, y), "fed_funds_end_pct": end(ff, y), "treasury_10y_end_pct": end(t10, y), "unemployment_avg_pct": avg(un, y),
         "wti_avg_usd": avg(oil, y), "recession_months": sum(1 for k, v in rec.items() if k.startswith(str(y)) and v >= 1) if rec else None}
    m = {k: v for k, v in m.items() if v is not None}
    return m or None

def summary_2026(S, m):
    """2026 is still in progress, so its narrative is generated from the data rather than written by hand, and says so."""
    parts = ["2026 is a partial year, so this entry is built from the data on this site rather than a finished narrative."]
    through = last_month(S["sp"])
    def sgn(v): return ("up %.1f%%" % v) if v >= 0 else ("down %.1f%%" % abs(v))
    bits = []
    if "sp500_return_pct" in m: bits.append("the S&P 500 is %s year to date" % sgn(m["sp500_return_pct"]))
    if "nasdaq_return_pct" in m: bits.append("the Nasdaq Composite %s" % sgn(m["nasdaq_return_pct"]))
    if "gold_return_pct" in m: bits.append("gold %s" % sgn(m["gold_return_pct"]))
    if bits: parts.append("Through %s, %s." % (through, ", ".join(bits)))
    macro = []
    if "unemployment_avg_pct" in m: macro.append("US unemployment has averaged %.1f%%" % m["unemployment_avg_pct"])
    if "fed_funds_end_pct" in m: macro.append("the federal funds rate stands at %.2f%%" % m["fed_funds_end_pct"])
    if "treasury_10y_end_pct" in m: macro.append("the 10-year Treasury yield at %.2f%%" % m["treasury_10y_end_pct"])
    if "wti_avg_usd" in m: macro.append("WTI crude has averaged about $%.0f a barrel" % m["wti_avg_usd"])
    if macro: parts.append("On the macro side, %s." % ", ".join(macro))
    try:
        L = json.load(open(os.path.join(ROOT, "data", "indicators", "latest.json")))
        parts.append("The early-warning composite currently reads %d (%s) across %d indicators; see the Overview and Radar pages for the live picture." % (round(L["composite"]), L["regime"], len(L["indicators"])))
    except Exception: pass
    parts.append("The headline themes above are provisional. A full, sourced narrative will replace this text once the year closes and its events can be checked against primary sources, so treat the entry as a work in progress rather than a settled account.")
    return " ".join(parts)

def main():
    S = {"sp": series("sp500"), "nq": series("nasdaq_composite"), "gold": series("gold_futures"), "cpi": series("cpi_all_items"), "ff": series("fed_funds_rate"),
         "t10": series("treasury_10y"), "un": series("unemployment_rate"), "oil": series("wti_oil"), "rec": series("recession_flag")}
    rows, problems = [], []
    for (y, h, r, i, t, c) in Y:
        m = metrics_for(y, S)
        text = SUMMARIES.get(y) or (summary_2026(S, m or {}) if y == max(yy for yy, *_ in Y) else None)
        if not text: problems.append("%d: no summary" % y)
        elif not (MIN_LEN <= len(text) <= MAX_LEN): problems.append("%d: summary is %d chars (want %d-%d)" % (y, len(text), MIN_LEN, MAX_LEN))
        rows.append(dict(year=y, headline=h, regime=r, impact=i, tags=t, confidence=c, summary=text, metrics=m))
    if problems: sys.exit("build_yearly: " + "; ".join(problems))
    out = os.path.join(ROOT, "data", "yearly", "overview.json")
    json.dump(rows, open(out, "w"), indent=1, ensure_ascii=False)
    print(len(rows), "years written;", sum(1 for r in rows if r["metrics"]), "with computed metrics")

if __name__ == "__main__": main()
