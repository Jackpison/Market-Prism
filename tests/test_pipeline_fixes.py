"""Offline regression tests for the source-health fixes. Run: python3 tests/test_pipeline_fixes.py"""
import json, os, re, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
import fetch_trends as F
ROOT = os.path.join(os.path.dirname(__file__), "..")

def gdelt_query_ok(q):
    """GDELT DOC API rejects nested parentheses and AND inside parentheses ('Parentheses may only be used around OR'd statements')."""
    depth = 0
    for m in re.finditer(r"[()]", q):
        depth += 1 if m.group() == "(" else -1
        if depth > 1 or depth < 0: return False
    return all(" AND " not in g for g in re.findall(r"\(([^)]*)\)", q))

def test_news_queries():
    cfg = json.load(open(os.path.join(ROOT, "config", "trends.json")))
    bad = [t["id"] for t in cfg["trends"] if not gdelt_query_ok(t["news_query"])]
    assert not bad, "invalid GDELT queries: %s" % bad
    assert not gdelt_query_ok("(copper AND (shortage OR deficit))")        # the original bug must be detected

def test_source_state():
    assert F.source_state({"ok": 3, "fail": 0, "errors": []}) == "live"
    assert F.source_state({"ok": 3, "fail": 1, "errors": ["x"]}) == "partial"
    assert F.source_state({"ok": 0, "fail": 2, "errors": ["a: HTTP 429"]}) == "failed"
    assert F.source_state({"ok": 0, "fail": 4, "errors": ["ai_infra: no REDDIT_CLIENT_ID/SECRET set (blocked)"]}) == "unconfigured"
    assert F.source_state({"ok": 0, "fail": 2, "errors": ["a: no REDDIT_CLIENT_ID/SECRET set", "b: HTTP 500"]}) == "failed"

def test_gdelt_backoff():
    calls, sleeps = [], []
    body = json.dumps({"timeline": [{"data": [{"date": "20260101T000000Z", "value": 1.5}]}]})
    def fake_get(url, **kw):
        calls.append(url)
        if len(calls) < 3: raise RuntimeError("HTTP Error 429: Too Many Requests")
        return body
    og, os_, ot = F.get, F.time.sleep, {k: v.i for k, v in F.TH.items()}
    F.get, F.time.sleep = fake_get, sleeps.append
    for v in F.TH.values(): v.i = 0
    try: acc = F._gdelt("uranium (price OR supply)", "timelinevol")
    finally: F.get, F.time.sleep = og, os_
    assert len(calls) == 3 and sleeps == [20, 40] and acc, (calls, sleeps)

def test_form_idx_parser():
    fx = ("Form Type   Company Name                                                  CIK         Date Filed  File Name\n" + "-" * 100 + "\n"
          "10-K        ACME CORP                                                     12345       20261105    edgar/data/12345/0001.txt\n"
          "D           Fusion Energy Fund I LP                                       1999999     20261105    edgar/data/1999999/0002.txt\n"
          "D/A         Nuclear Ventures LLC                                          2000000     20261105    edgar/data/2000000/0003.txt\n")
    rows = F.parse_form_idx(fx)
    assert [r[1] for r in rows] == ["Fusion Energy Fund I LP"], rows                 # amendments and other forms excluded
    rx = F.formd_terms({"query": '"copper" shortage', "vc_terms": []})
    assert any(r.search("Copper Basin Mining LP") for r in rx) and not any(r.search("Copperfield Estates") for r in rx)   # whole-word match, generic words dropped

def test_formd_failure_is_cached():
    calls = []
    def deny(url, **kw): calls.append(url); raise RuntimeError("HTTP Error 403: Forbidden")
    og = F.get; F.get = deny; F._FORMD.clear()
    for v in F.TH.values(): v.i = 0
    try:
        for _ in range(3):
            try: F.formd_filings(); assert False, "should have raised"
            except RuntimeError as e: assert "403" in str(e)
    finally: F.get = og; F._FORMD.clear()
    assert len(calls) == 1, "a refusing source must be tried once per run, got %d calls" % len(calls)

def test_f13_outlier_holder_cannot_swamp_the_average():
    rows = [(1000.0, 0.05), (800.0, -0.02), (500.0, 0.10), (3000.0, 25.0)]       # the last holder went from ~115 shares to 3000 (+2500%)
    old = sum(p * c for p, c in rows) / sum(p for p, _ in rows)                     # the previous, position-weighted formula
    v = F.f13_change(rows)
    assert old > 10, old                                                            # the bug: a +1000% reading from one tiny prior stake
    assert 0.0 < v < 0.1, v                                                         # fixed: a modest net accumulation
    assert F.f13_change([(10.0, 0.2), (5.0, 0.1)]) is None                          # too few holders to say anything
    assert F.f13_change([(10.0, -1.0), (0.0, 0.5), (None, 0.2), (7.0, None)]) is None  # exits, zero and missing rows are ignored

def test_market_csv_rejects_html_and_keeps_previous_file():
    import tempfile, fetch_market_data as M
    d = tempfile.mkdtemp(); og = M.OUT; M.OUT = d
    try:
        good = "DATE,VALUE\n2020-01-01,1\n2020-02-01,2\n2020-03-01,3\n"
        assert M.save("x", good, "date,value") == 3
        for bad in ('<!DOCTYPE html><html><head></head><body>challenge</body></html>', "", "DATE,VALUE\n2020-01-01,1\n"):
            try: M.save("x", bad, "date,value"); assert False, "should have been rejected: %r" % bad[:20]
            except M.BadDownload: pass
        assert open(os.path.join(d, "x.csv")).read() == good, "the previous file must survive a bad download"
        assert not [f for f in os.listdir(d) if f.endswith(".tmp")]
    finally: M.OUT = og
    assert not os.path.exists(os.path.join(ROOT, "data", "market", "dow_jones_long.csv")), "the Stooq challenge page must not be committed"
def test_gdelt_circuit_breaker_and_arxiv_backoff():
    sleeps, calls = [], []
    og, os_ = F.get, F.time.sleep
    F.time.sleep = sleeps.append; F._GD.update(exhausted=0, dead=None)
    for v in F.TH.values(): v.i = 0
    def deny(url, **kw): calls.append(url); raise RuntimeError("HTTP Error 429: Too Many Requests")
    F.get = deny
    try:
        for _ in range(2):
            try: F._gdelt("ai", "timelinevol"); assert False
            except RuntimeError as e: assert "rate limited" in str(e), e
        n = len(calls); assert n == 8, n                                     # 4 attempts each for the first two trends
        try: F._gdelt("ai", "timelinevol"); assert False
        except RuntimeError as e: assert "skipped for the rest of this run" in str(e), e
        assert len(calls) == n, "after the breaker opens GDELT must not be called again"
        # arXiv: a 429 is retried with backoff, then succeeds
        seq = iter([RuntimeError("HTTP Error 429"), '<feed xmlns="http://www.w3.org/2005/Atom"></feed>']); sleeps.clear()
        def flaky(url, **kw):
            r = next(seq)
            if isinstance(r, Exception): raise r
            return r
        F.get = flaky
        try: F.src_arxiv({"arxiv": "x"})
        except Exception as e: assert "429" not in str(e), e              # an empty feed may fail later in zstat, but not on the 429
        assert 15 in sleeps, sleeps
    finally: F.get, F.time.sleep = og, os_; F._GD.update(exhausted=0, dead=None)
if __name__ == "__main__":
    for n, f in list(globals().items()):
        if n.startswith("test_"): f(); print("ok", n)
