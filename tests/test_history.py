"""Offline tests for scripts/build_history.py and the committed history files. Run: python3 tests/test_history.py"""
import csv, datetime as dt, json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
import build_history as H
D = dt.date
ROOT = os.path.join(os.path.dirname(__file__), "..")


def test_weekdays_skip_weekends_and_include_both_ends():
    days = H.weekdays(D(2026, 11, 13), D(2026, 11, 17))            # Fri .. Tue
    assert days == [D(2026, 11, 13), D(2026, 11, 16), D(2026, 11, 17)]
    assert H.weekdays(D(2026, 11, 14), D(2026, 11, 15)) == []      # a weekend only


def test_merge_never_rewrites_history_but_refreshes_todays_live_row():
    today = D(2026, 11, 20)
    old = [["2026-11-18", "30.0", "x", "recon"], ["2026-11-19", "31.0", "x", "fill"], ["2026-11-20", "32.0", "x", "live"]]
    new = [["2026-11-18", "99.0", "x", "live"], ["2026-11-19", "99.0", "x", "live"], ["2026-11-20", "33.0", "x", "live"], ["2026-11-23", "34.0", "x", "live"]]
    got = {r[0]: r for r in H.merge_composite(old, new, today)}
    assert got["2026-11-18"][1] == "30.0" and got["2026-11-19"][1] == "31.0"      # frozen
    assert got["2026-11-20"][1] == "33.0"                                           # today's live row refreshed
    assert got["2026-11-23"][1] == "34.0" and list(got) == sorted(got)            # new day appended, still sorted
    old2 = [["2026-11-20", "32.0", "x", "fill"]]
    assert H.merge_composite(old2, [["2026-11-20", "40.0", "x", "live"]], today)[0][1] == "32.0"   # only a live row is replaceable


def test_upsert_is_idempotent_and_replaces_by_key():
    rows = [["2026-11-19", "a", "1"], ["2026-11-20", "a", "2"]]
    new = [["2026-11-20", "a", "9"], ["2026-11-20", "b", "3"]]
    once = H.upsert(rows, new); twice = H.upsert(once, new)
    assert once == twice and len(once) == 3 and ["2026-11-20", "a", "9"] in once and ["2026-11-19", "a", "1"] in once


def test_indicator_and_source_rows():
    L = {"generated": "2026-11-20T03:35Z", "indicators": [{"id": "vix", "value": 28.4412345, "score": 55.04, "status": "yellow", "asof": "2026-11-19", "age_days": 1},
                                                          {"id": "gex", "value": None, "score": None, "status": "nodata"}]}
    r = H.indicator_rows(L)
    assert r[0] == ["2026-11-20", "vix", 28.4412, 55.0, "yellow", "2026-11-19", 1] and r[1][:6] == ["2026-11-20", "gex", "", "", "nodata", ""]
    assert H.indicator_rows({"indicators": []}) == []
    s = H.source_rows("2026-11-20", {"status": {"sec": {"ok": 0, "fail": 3, "state": "failed"}}}, {"ok": ["a", "b"], "failed": ["c"]})
    assert s == [["2026-11-20", "sec", 0, 3, "failed"], ["2026-11-20", "fred", 2, 1, "partial"]]
    assert H.source_rows("d", None, {"ok": [], "failed": ["c"]})[0][-1] == "failed" and H.source_rows("d", None, {"ok": ["a"], "failed": []})[0][-1] == "live"


def test_committed_composite_file_is_well_formed():
    cfg = json.load(open(os.path.join(ROOT, "config", "indicators.json")))
    with open(H.COMPOSITE, newline="") as f: rd = list(csv.DictReader(f))
    assert list(rd[0]) == H.composite_header(cfg)
    dates = [r["date"] for r in rd]; assert dates == sorted(set(dates)), "dates must be unique and ascending"
    assert dt.date.fromisoformat(dates[0]).year == 1990 and all(dt.date.fromisoformat(d).weekday() < 5 for d in dates)
    assert all(0 <= float(r["composite"]) <= 100 and r["src"] in H.SRC_VALUES and 2 <= int(r["n"]) <= len(cfg["indicators"]) for r in rd)
    for r in rd:
        for c in cfg["categories"]:
            if r[c["id"]] != "": assert 0 <= float(r[c["id"]]) <= 100


def test_scoring_matches_the_backtest_exactly_at_the_backtests_own_dates():
    """score_days must be the backtest's method: the same dates give the same composite (to the backtest's 1-decimal rounding). Catches drift between the two scripts."""
    import build_indicators as B
    cfg = json.load(open(os.path.join(ROOT, "config", "indicators.json")))
    bt = {ym: v for ym, v in json.load(open(os.path.join(ROOT, "data", "indicators", "backtest.json")))["composite_series"]}
    ends = [d for d in B.month_ends(12 * 37) if d >= H.START and "%04d-%02d" % (d.year, d.month) in bt][:-1]     # the last backtest point is a partial month
    got = {"%04d-%02d" % (d.year, d.month): c for d, c, _k, _n in H.score_days(cfg, ends)}
    assert len(got) > 300 and all(abs(round(got[k], 1) - bt[k]) < 1e-9 for k in got), [(k, round(got[k], 1), bt[k]) for k in got if abs(round(got[k], 1) - bt[k]) > 1e-9][:3]


def test_weekday_rows_stay_close_to_the_backtest_month_ends():
    """The file has weekday rows only, so a month ending on a weekend differs slightly (weekly series are dated on Saturdays). It must stay close, never drift."""
    bt = json.load(open(os.path.join(ROOT, "data", "indicators", "backtest.json")))
    with open(H.COMPOSITE, newline="") as f: rows = {r["date"]: r for r in csv.DictReader(f)}
    by_month = {}
    for d in sorted(rows): by_month[d[:7]] = d
    diffs = [abs(float(rows[by_month[ym]]["composite"]) - v) for ym, v in bt["composite_series"][:-1] if ym in by_month and rows[by_month[ym]]["src"] == "recon"]
    assert len(diffs) > 300 and max(diffs) < 1.5 and sum(diffs) / len(diffs) < 0.2, (max(diffs), sum(diffs) / len(diffs))


def test_indicator_log_has_one_row_per_indicator_per_day():
    with open(H.IND_LOG, newline="") as f: rd = list(csv.DictReader(f))
    keys = [(r["date"], r["id"]) for r in rd]; assert len(keys) == len(set(keys)) and list(rd[0]) == H.IND_HEAD
    assert all(r["score"] == "" or 0 <= float(r["score"]) <= 100 for r in rd)


if __name__ == "__main__":
    for n, f in list(globals().items()):
        if n.startswith("test_"): f(); print("ok", n)
