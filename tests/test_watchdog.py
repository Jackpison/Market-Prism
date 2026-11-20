"""Offline tests for scripts/watchdog.py. Run: python3 tests/test_watchdog.py"""
import datetime as dt, json, os, sys, tempfile
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
import watchdog as W
NOW = dt.datetime(2026, 11, 9, 12, 0, tzinfo=dt.timezone.utc)
iso = lambda hours: (NOW - dt.timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%M:%SZ")

def tree(macro_age, trend_age, raw=None, base=NOW):
    iso = lambda h: (base - dt.timedelta(hours=h)).strftime("%Y-%m-%dT%H:%M:%SZ")
    d = tempfile.mkdtemp()
    for rel, age in (("data/indicators/latest.json", macro_age), ("data/macro_data.json", trend_age)):
        if age is None: continue                                   # file left out on purpose
        os.makedirs(os.path.dirname(os.path.join(d, rel)), exist_ok=True)
        json.dump({"generated": raw if raw is not None else iso(age)}, open(os.path.join(d, rel), "w"))
    return d

def test_parse_formats():
    assert W.parse("2026-11-09T12:00:00Z").hour == 12 and W.parse("2026-11-09T12:00Z").minute == 0
    assert W.parse("2026-11-09").day == 9
    assert W.parse("not a date") is None and W.parse(None) is None

def test_fresh_data_has_no_problems():
    assert W.check(NOW, tree(10, 3)) == []

def test_limits_are_inclusive_of_the_limit():
    assert W.check(NOW, tree(96, 18)) == []                        # exactly at the limit is still fresh
    p = W.check(NOW, tree(97, 19)); assert [x[0] for x in p] == ["Macro indicators", "Trend signals"], p

def test_only_the_stale_source_is_reported():
    p = W.check(NOW, tree(5, 40)); assert len(p) == 1 and p[0][0] == "Trend signals" and "40 hours ago" in p[0][1], p

def test_missing_and_unreadable_files_are_problems():
    p = W.check(NOW, tree(None, 3)); assert len(p) == 1 and "could not read" in p[0][1], p
    p = W.check(NOW, tree(5, 3, raw="garbage")); assert len(p) == 2 and all("no readable" in x[1] for x in p), p

def test_per_source_checks():
    d = tree(5, 3)
    json.dump({"generated": iso(3), "status": {"fred": {"state": "failed"}, "gdelt": {"state": "failed"}, "arxiv": {"state": "live"}}}, open(os.path.join(d, "data/macro_data.json"), "w"))
    json.dump({"generated": iso(5), "indicators": [{"name": "A", "freq": "daily", "age_days": 30, "status": "green"}, {"name": "B", "freq": "monthly", "age_days": 80, "status": "green"}, {"name": "C", "freq": "daily", "age_days": None, "status": "nodata"}]}, open(os.path.join(d, "data/indicators/latest.json"), "w"))
    p = dict(W.check_sources(d))
    assert p["Core sources"].endswith("fred") and "gdelt" not in p["Core sources"], p      # optional failures are ignored
    assert "A (30 days)" in p["Old observations"] and "B (" not in p["Old observations"], p  # a monthly series at 80 days is normal
    assert p["No data"].endswith("C"), p
    assert W.check_sources(tempfile.mkdtemp()) == []                                          # missing files are not this check's job

def test_main_writes_outputs_and_body():
    real = dt.datetime.now(dt.timezone.utc)                         # main() reads the real clock
    d = tree(200, 3, base=real); out = os.path.join(d, "out.txt"); body = os.path.join(d, "body.md")
    old = (W.ROOT, dict(os.environ)); W.ROOT = d
    W.check.__defaults__ = (None, d)                               # point the default root at the temp tree
    try:
        os.environ.update(GITHUB_OUTPUT=out, WATCHDOG_BODY=body)
        probs = W.main(); assert len(probs) == 1
        o = open(out).read(); assert "stale=true" in o and "Macro indicators" in o, o
        assert "Macro indicators" in open(body).read()
        json.dump({"generated": real.strftime("%Y-%m-%dT%H:%M:%SZ")}, open(os.path.join(d, "data/indicators/latest.json"), "w")); open(out, "w").close()
        assert W.main() == [] and "stale=false" in open(out).read()
    finally:
        W.ROOT = old[0]; W.check.__defaults__ = (None, old[0]); os.environ.clear(); os.environ.update(old[1])

if __name__ == "__main__":
    for n, f in list(globals().items()):
        if n.startswith("test_"): f(); print("ok", n)
