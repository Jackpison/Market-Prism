#!/usr/bin/env python3
"""Daily composite history and append-only logs. Pure stdlib; reuses the scoring in build_indicators.py so every number matches the dashboard and the backtest.

Writes data/history/:
  composite_daily.csv   one row per weekday since 1990: composite, the six category scores, `n` (how many indicators had data that day: early years rest on fewer) and `src`
                        recon = reconstructed once from the data as it stands today (final, revised values: not what was published at the time)
                        live  = computed on the day itself, then never rewritten
                        fill  = a skipped day computed later (a run was missed)
  indicators_log.csv    one row per indicator per day as the pipeline reported it (value, score, status, observation date, age): grows from the day it is first run
  sources_log.csv       one row per data source per day: how many requests worked, how many failed, and its state

Usage:  python3 scripts/build_history.py            append new days and today's log rows (rebuilds the composite file if it does not exist yet)
        python3 scripts/build_history.py --rebuild  recompute the whole composite file as `recon` (keeps nothing: use only when scoring rules change)
Rows already written are never changed, except today's own rows when the script runs again on the same day."""
import csv, datetime as dt, json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import build_indicators as B

START = dt.date(1990, 1, 1)
HIST = B.P("data", "history")
COMPOSITE = os.path.join(HIST, "composite_daily.csv")
IND_LOG = os.path.join(HIST, "indicators_log.csv")
SRC_LOG = os.path.join(HIST, "sources_log.csv")
IND_HEAD = ["date", "id", "value", "score", "status", "asof", "age_days"]
SRC_HEAD = ["date", "source", "ok", "fail", "state"]
SRC_VALUES = ("recon", "live", "fill")


def weekdays(a, b):
    """Every Monday-Friday from a to b inclusive."""
    d, out = a, []
    while d <= b:
        if d.weekday() < 5: out.append(d)
        d += dt.timedelta(days=1)
    return out


def composite_header(cfg):
    return ["date", "composite"] + [c["id"] for c in cfg["categories"]] + ["n", "src"]


def score_days(cfg, days):
    """[(date, composite, {category: score}, n_indicators)] for each day, scoring every indicator from the latest observation available that day.
    Same method as the backtest (stale limit + 45 days), so month-end values equal backtest composite_series."""
    series = [(i, B.metric(i), cfg["stale_days"][i["freq"]] + 45) for i in cfg["indicators"]]
    out = []
    for d in days:
        sc = {}
        for ind, s, age in series:
            x = B.score(ind, s.at(d, max_age=age))
            if x is not None: sc[ind["id"]] = x
        c, cats = B.composite(cfg, sc)
        if c is not None: out.append((d, c, cats, sum(1 for i in cfg["indicators"] if i.get("weight", 1.0) > 0 and sc.get(i["id"]) is not None)))
    return out


def to_row(cfg, d, c, cats, n, src):
    return [d.isoformat(), "%.1f" % c] + ["" if cats.get(k["id"]) is None else "%.1f" % cats[k["id"]] for k in cfg["categories"]] + [n, src]


def read_rows(path):
    if not os.path.exists(path): return None, []
    with open(path, newline="") as f:
        rd = csv.reader(f); head = next(rd, None)
        return head, [r for r in rd if r]


def write_rows(path, head, rows):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", newline="") as f:
        w = csv.writer(f, lineterminator="\n"); w.writerow(head); w.writerows(rows)
    os.replace(tmp, path)


def merge_composite(existing, new, today):
    """Keep every existing row; add rows for new dates; replace only today's own `live` row (a second run on the same day). Returns rows sorted by date."""
    by = {r[0]: r for r in existing}
    for r in new:
        if r[0] not in by or (r[0] == today.isoformat() and by[r[0]][-1] == "live"): by[r[0]] = r
    return [by[k] for k in sorted(by)]


def upsert(rows, new, key_cols=2):
    """Replace rows that share the first key_cols columns with a new row; append the rest; sorted by key."""
    by = {tuple(r[:key_cols]): r for r in rows}
    for r in new: by[tuple(r[:key_cols])] = r
    return [by[k] for k in sorted(by)]


def indicator_rows(L):
    day = (L.get("generated") or "")[:10]
    if not day: return []
    def cell(v, nd=None): return "" if v is None else (v if nd is None else round(v, nd))
    return [[day, i["id"], cell(i.get("value"), 4), cell(i.get("score"), 1), i.get("status") or "", i.get("asof") or "", cell(i.get("age_days"))]
            for i in L.get("indicators", [])]


def source_rows(day, M, idx):
    rows = [[day, k, v.get("ok", 0), v.get("fail", 0), v.get("state") or ""] for k, v in sorted((M or {}).get("status", {}).items())]
    if idx:
        ok, bad = len(idx.get("ok", [])), len(idx.get("failed", []))
        rows.append([day, "fred", ok, bad, "failed" if bad and not ok else "partial" if bad else "live"])
    return rows


def load_json(rel):
    try:
        with open(B.P(*rel.split("/"))) as f: return json.load(f)
    except Exception: return None


IND_DIR = os.path.join(HIST, "ind")


def write_indicator_series(cfg):
    """data/history/ind/<id>.csv: the indicator's derived value (the number the dashboard shows) at its own native frequency since START.
    Regenerated from the raw data every run, so data revisions flow through. Returns the number of files written."""
    os.makedirs(IND_DIR, exist_ok=True); n = 0
    for ind in cfg["indicators"]:
        s = B.metric(ind); rows = [(d, v) for d, v in zip(s.d, s.v) if d >= START and v == v]
        if len(rows) < 3: continue
        tmp = os.path.join(IND_DIR, ind["id"] + ".csv.tmp")
        with open(tmp, "w", newline="") as f:
            f.write("date,value\n"); f.writelines("%s,%s\n" % (d.isoformat(), ("%.4f" % v).rstrip("0").rstrip(".")) for d, v in rows)
        os.replace(tmp, os.path.join(IND_DIR, ind["id"] + ".csv")); n += 1
    return n


def main():
    cfg = json.load(open(B.P("config", "indicators.json"))); today = B.TODAY
    head = composite_header(cfg); old_head, old = read_rows(COMPOSITE)
    if "--rebuild" in sys.argv or not old or old_head != head:
        days = weekdays(START, today)
        rows = [to_row(cfg, d, c, k, n, "live" if d == today else "recon") for d, c, k, n in score_days(cfg, days)]
        print("composite: rebuilt %d rows (%s to %s) as recon" % (len(rows), rows[0][0], rows[-1][0]))
    else:
        last = dt.date.fromisoformat(old[-1][0]); days = weekdays(last + dt.timedelta(days=1), today)
        new = [to_row(cfg, d, c, k, n, "live" if d == today else "fill") for d, c, k, n in score_days(cfg, days)]
        if today.weekday() < 5 and old[-1][0] == today.isoformat() and old[-1][-1] == "live":     # same-day re-run: refresh today's row
            new += [to_row(cfg, d, c, k, n, "live") for d, c, k, n in score_days(cfg, [today])]
        rows = merge_composite(old, new, today)
        print("composite: %d new rows, %d total" % (len(rows) - len(old), len(rows)))
    write_rows(COMPOSITE, head, rows)

    print("indicator series: %d files in data/history/ind" % write_indicator_series(cfg))

    L = load_json("data/indicators/latest.json")
    if L:
        h, r = read_rows(IND_LOG); n = indicator_rows(L); write_rows(IND_LOG, IND_HEAD, upsert(r if h == IND_HEAD else [], n)); print("indicators_log: %d rows for %s" % (len(n), n[0][0] if n else "-"))
    M = load_json("data/macro_data.json"); idx = load_json("data/macro/index.json")
    if M or idx:
        day = ((M or {}).get("generated") or (idx or {}).get("updated") or today.isoformat())[:10]
        h, r = read_rows(SRC_LOG); n = source_rows(day, M, idx); write_rows(SRC_LOG, SRC_HEAD, upsert(r if h == SRC_HEAD else [], n)); print("sources_log: %d rows for %s" % (len(n), day))


if __name__ == "__main__":
    main()
