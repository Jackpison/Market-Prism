#!/usr/bin/env python3
"""Download monthly market/macro series into data/market/*.csv.

Run locally (needs internet):  python3 scripts/fetch_market_data.py
Sources are public; availability and URLs can change, so each series fails
independently and is reported at the end. Every download is validated (header row, at least
a few data rows, not an HTML page) before it replaces the committed file; a bad response keeps the previous file and is reported as FAIL.
"""
import csv, io, json, os, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

OUT = os.path.join(os.path.dirname(__file__), "..", "data", "market")
os.makedirs(OUT, exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0 (Market-Trends research script)"}

def get(url, timeout=20, tries=2):
    last = None
    for _ in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:
            last = e
    raise last

class BadDownload(ValueError): pass

def save(name, txt, header_starts):
    """Write data/market/<name>.csv only if txt looks like the CSV we expect; otherwise keep the previous file and raise.
    (A Stooq JavaScript-challenge page used to be committed daily as a "CSV".)"""
    lines = [l for l in txt.lstrip("\ufeff").splitlines() if l.strip()]
    if not lines or "<" in lines[0] or not lines[0].lower().startswith(header_starts):
        raise BadDownload("%s: unexpected header %r (expected to start with %r); kept previous file" % (name, (lines[0] if lines else "")[:60], header_starts))
    if len(lines) < 4: raise BadDownload("%s: only %d lines; kept previous file" % (name, len(lines)))
    path = os.path.join(OUT, name + ".csv"); tmp = path + ".tmp"
    open(tmp, "w", newline="").write("\n".join(lines) + "\n"); os.replace(tmp, path)
    return len(lines) - 1

# --- FRED (no API key needed for fredgraph.csv) ---
FRED = {
    "fed_funds_rate": "FEDFUNDS",      # monthly, 1954+
    "cpi_all_items": "CPIAUCSL",       # monthly, 1947+
    "unemployment_rate": "UNRATE",     # monthly, 1948+
    "treasury_10y": "GS10",            # monthly, 1953+
    "wti_oil": "WTISPLC",              # monthly, 1946+
    "industrial_production": "INDPRO", # monthly, 1919+
    "recession_flag": "USREC",         # NBER recession indicator, 1854+
}
def fred(name, sid):
    key = os.environ.get("FRED_API_KEY", "").strip()
    if key:  # official API: reliable from cloud servers (free key at fred.stlouisfed.org)
        d = json.loads(get("https://api.stlouisfed.org/fred/series/observations"
                           f"?series_id={sid}&api_key={key}&file_type=json"))
        rows = [(o["date"], o["value"]) for o in d["observations"] if o["value"] != "."]
        buf = io.StringIO(); w = csv.writer(buf, lineterminator="\n"); w.writerow(["DATE", "VALUE"]); w.writerows(rows)
        return save(name, buf.getvalue(), "date,value")
    txt = get(f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={sid}")
    return save(name, txt, ("date,", "observation_date,"))

# --- Yahoo Finance chart API (monthly closes) ---
YAHOO = {
    "sp500": "^GSPC",      # 1927+
    "nasdaq_composite": "^IXIC",  # 1971+
    "dow_jones_yahoo": "^DJI",    # ~1992+
    "gold_futures": "GC=F",       # ~2000+
    "bitcoin_usd": "BTC-USD",     # 2014+
}
def yahoo(name, sym):
    sym_q = urllib.request.quote(sym, safe="")
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{sym_q}"
           "?period1=-1325635200&period2=" + str(int(time.time())) +
           "&interval=1mo&events=history")
    d = json.loads(get(url))["chart"]["result"][0]
    ts, q = d["timestamp"], d["indicators"]["quote"][0]
    buf = io.StringIO(); w = csv.writer(buf, lineterminator="\n"); w.writerow(["date","open","high","low","close","volume"])
    for i, t in enumerate(ts):
        w.writerow([time.strftime("%Y-%m-%d", time.gmtime(t))] + [q[k][i] for k in ("open","high","low","close","volume")])
    return save(name, buf.getvalue(), "date,open,high,low,close,volume")

# Stooq's long Dow history was dropped: it answers automated clients with a JavaScript challenge page, never CSV. Yahoo ^DJI (1992+) is used instead.

jobs = [(n, lambda n=n, s=s: fred(n, s)) for n, s in FRED.items()]
jobs += [(n, lambda n=n, s=s: yahoo(n, s)) for n, s in YAHOO.items()]

def main():
    ok, bad = [], []
    def run(job):
        name, fn = job
        try:
            n = fn(); print(f"ok   {name}: {n} rows", flush=True); return (name, n, None)
        except Exception as e:
            print(f"FAIL {name}: {e}", file=sys.stderr, flush=True); return (name, 0, str(e))
    with ThreadPoolExecutor(max_workers=6) as ex:
        for name, n, err in ex.map(run, jobs):
            (bad if err else ok).append((name, err or n))
    keep = [n for n, _ in bad if os.path.exists(os.path.join(OUT, n + ".csv"))]   # a failed download keeps its previous file, so keep it listed
    json.dump({"series": [n for n, _ in ok] + keep, "updated": time.strftime("%Y-%m-%d")},
              open(os.path.join(OUT, "index.json"), "w"))
    print(f"\n{len(ok)} succeeded, {len(bad)} failed")
    if not ok:
        sys.exit(1)

if __name__ == "__main__":
    main()
