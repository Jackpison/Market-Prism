"""Offline tests for scripts/digest.py. Run: python3 tests/test_digest.py"""
import datetime as dt, json, os, sys, tempfile
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
import digest as D
NOW = dt.datetime(2026, 11, 16, 8, 0, tzinfo=dt.timezone.utc)

def tree(indicators, events):
    d = tempfile.mkdtemp(); os.makedirs(os.path.join(d, "data/indicators"))
    json.dump({"generated": "2026-11-16T06:00:00Z", "regime": "Watch", "composite": 32.5, "indicators": indicators}, open(os.path.join(d, "data/indicators/latest.json"), "w"))
    json.dump({"events": events}, open(os.path.join(d, "data/alerts.json"), "w")); return d

def test_digest_lists_red_before_yellow_and_only_recent_alerts():
    ind = [{"name": "Y", "status": "yellow", "score": 55, "value": 1, "unit": "pp", "asof": "2026-11-13"}, {"name": "R", "status": "red", "score": 80, "value": 2, "unit": "%", "asof": "2026-11-13"}, {"name": "G", "status": "green", "score": 5}, {"name": "X", "status": "red", "weight": 0, "score": 100}]
    ev = [{"ts": "2026-11-14T03:10Z", "severity": "warn", "title": "recent"}, {"ts": "2026-10-01T03:10Z", "severity": "info", "title": "old"}]
    t = D.build(NOW, tree(ind, ev))
    assert t.index("**R**") < t.index("**Y**") and "**G**" not in t and "**X**" not in t and "(2)" in t
    assert "recent" in t and "old" not in t and "Regime: Watch" in t and "Not financial advice" in t

def test_quiet_week_and_missing_data():
    t = D.build(NOW, tree([{"name": "G", "status": "green"}], [])); assert "None: every scored" in t and "(0)" in t
    assert D.build(NOW, tempfile.mkdtemp()) is None

if __name__ == "__main__":
    for n, f in list(globals().items()):
        if n.startswith("test_"): f(); print("ok", n)
