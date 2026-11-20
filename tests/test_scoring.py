"""Offline tests for the indicator scoring maths in scripts/build_indicators.py. Run: python3 tests/test_scoring.py"""
import datetime as dt, json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
import build_indicators as B
CFG = json.load(open(os.path.join(os.path.dirname(__file__), "..", "config", "indicators.json")))
approx = lambda a, b, t=1e-6: abs(a - b) <= t

def test_score_lower_is_worse_spread():
    ind = {"warn": 0.5, "crit": 0.0}                       # 10Y-3M style: yellow below +0.5pp, red when inverted
    assert approx(B.score(ind, 0.5), 50) and approx(B.score(ind, 0.0), 100)
    assert approx(B.score(ind, 0.25), 75) and B.score(ind, 2.0) == 0 and B.score(ind, -1.0) == 100   # clamped to 0..100

def test_score_higher_is_worse():
    ind = {"warn": 20, "crit": 30}
    assert approx(B.score(ind, 20), 50) and approx(B.score(ind, 30), 100) and approx(B.score(ind, 25), 75)
    assert B.score(ind, 5) == 0 and B.score(ind, 99) == 100

def test_score_two_sided_and_centered():
    assert approx(B.score({"warn": 1, "crit": 3, "two_sided": True}, -2), 75)          # |-2| scored like +2
    assert approx(B.score({"warn": 1, "crit": 3, "center": 10}, 8), 75)               # distance from the centre
    assert B.score({"warn": 1, "crit": 3}, None) is None

def test_status_thresholds():
    s = B.status_of
    assert s(None) is None and s(0) == "green" and s(49.99) == "green" and s(50) == "yellow" and s(99.99) == "yellow" and s(100) == "red"

def test_composite_weights_and_minimum_coverage():
    cfg = {"categories": [{"id": "a", "weight": 0.5}, {"id": "b", "weight": 0.5}, {"id": "c", "weight": 0.5}],
           "indicators": [{"id": "a1", "cat": "a", "weight": 1}, {"id": "a2", "cat": "a", "weight": 3}, {"id": "b1", "cat": "b"}, {"id": "c1", "cat": "c", "weight": 0}]}
    v, cats = B.composite(cfg, {"a1": 0, "a2": 100, "b1": 50, "c1": 100})
    assert approx(cats["a"], 75) and approx(cats["b"], 50) and "c" not in cats, cats       # weight 0 (unscored) never counts
    assert approx(v, (75 + 50) / 2)
    assert B.composite(cfg, {"a1": 10, "a2": 10, "b1": None, "c1": None})[0] is None        # one category alone is not enough to publish a composite
    v2, _ = B.composite(cfg, {"a1": None, "a2": None, "b1": 40, "c1": 90}); assert v2 is None

def test_regime_bands_from_the_real_config():
    r = lambda v: B.regime(CFG, v)
    assert r(0) == "Calm" and r(24.9) == "Calm" and r(25) == "Watch" and r(44.9) == "Watch" and r(45) == "Elevated" and r(64.9) == "Elevated" and r(65) == "Critical" and r(100) == "Critical" and r(None) is None

def test_changes_use_calendar_days_and_observations():
    d0 = dt.date(2024, 1, 1); s = B.Ser([(d0 + dt.timedelta(days=i), 100 + i) for i in range(0, 400)])
    c = B.chg(s, 30); assert approx(c.v[-1], (499 / 469 - 1) * 100, 1e-9), c.v[-1]
    o = B.chg_obs(s, 12, pct=False); assert o.v[-1] == 12 and len(o) == len(s) - 12
    z = B.Ser([(d0, 0.0), (d0 + dt.timedelta(days=40), 5.0)]); assert len(B.chg(z, 40)) == 0       # a zero base never yields a percentage change

def test_ols_recovers_known_coefficients_and_rejects_singular():
    X = [[i, (i * 7) % 5 + 0.1 * i] for i in range(1, 30)]; y = [1 + 2 * a - 3 * b for a, b in X]
    f = B.ols(X, y); assert f and all(approx(a, b, 1e-6) for a, b in zip(f["b"], [1, 2, -3])) and f["r2"] > 0.999999
    dup = [[i, 2 * i] for i in range(1, 20)]; assert B.ols(dup, [float(i) for i in range(1, 20)]) is None   # perfectly collinear inputs

def test_every_configured_indicator_has_sane_thresholds():
    cats = {c["id"] for c in CFG["categories"]}; ids = set()
    assert approx(sum(c["weight"] for c in CFG["categories"]), 1.0, 1e-9), "category weights must sum to 1"
    for i in CFG["indicators"]:
        assert i["id"] not in ids, "duplicate id " + i["id"]; ids.add(i["id"])
        assert i["cat"] in cats and i["warn"] != i["crit"], i["id"]
        assert i["freq"] in CFG["stale_days"], "no stale window for " + i["id"]
        if "center" not in i and not i.get("two_sided"):
            worse_up = i["direction"] == "higher_worse"
            assert (i["crit"] > i["warn"]) == worse_up, "%s: crit must lie beyond warn in the 'worse' direction" % i["id"]
    assert len(CFG["indicators"]) == 23, len(CFG["indicators"])
if __name__ == "__main__":
    for n, f in list(globals().items()):
        if n.startswith("test_"): f(); print("ok", n)
