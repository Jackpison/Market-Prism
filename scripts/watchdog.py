"""Data freshness watchdog. Reads the timestamps the pipelines write and decides whether the site is serving stale data.
Writes GitHub Actions outputs: stale=true|false, title, and a markdown body (path in $WATCHDOG_BODY). Stdlib only.
Run: python3 scripts/watchdog.py"""
import datetime as dt, json, os, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
# (file, key, max age in hours, label). Macro refreshes on weekdays only, so allow the weekend plus a day; trends run every 6 hours.
CHECKS = [("data/indicators/latest.json", "generated", 96, "Macro indicators"), ("data/macro_data.json", "generated", 18, "Trend signals")]

def parse(s):
    for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%MZ", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try: return dt.datetime.strptime(s, fmt).replace(tzinfo=dt.timezone.utc)
        except (ValueError, TypeError): pass
    return None

def check(now=None, root=ROOT):
    now = now or dt.datetime.now(dt.timezone.utc); problems = []
    for rel, key, limit, label in CHECKS:
        try: ts = parse(json.load(open(os.path.join(root, rel))).get(key))
        except Exception as e: problems.append((label, "could not read %s (%s)" % (rel, e))); continue
        if ts is None: problems.append((label, "%s has no readable '%s' timestamp" % (rel, key))); continue
        age = (now - ts).total_seconds() / 3600
        if age > limit: problems.append((label, "last updated %s UTC, %.0f hours ago (limit %d)" % (ts.strftime("%Y-%m-%d %H:%M"), age, limit)))
    return problems

# Per-source checks. Optional sources mirror OPTIONAL_SRC in js/trendsData.js: they fail often from cloud IPs and must not open an issue.
OPTIONAL = {"gdelt", "gdelt_tone", "reddit", "formd", "sec"}
# An indicator is reported only when its latest observation is far older than its cadence implies (generous: publication lags are normal).
MAX_OBS_AGE_DAYS = {"daily": 10, "weekly": 21, "monthly": 100, "quarterly": 200}

def check_sources(root=ROOT):
    """Core data sources that failed in the last trend run, and indicators whose newest observation is unusually old."""
    problems = []
    try:
        st = json.load(open(os.path.join(root, "data/macro_data.json"))).get("status") or {}
        bad = sorted(k for k, v in st.items() if k not in OPTIONAL and isinstance(v, dict) and v.get("state") == "failed")
        if bad: problems.append(("Core sources", "failed in the last trend run: " + ", ".join(bad)))
    except Exception: pass                                           # unreadable files are already reported by check()
    try:
        rows = json.load(open(os.path.join(root, "data/indicators/latest.json"))).get("indicators") or []
        old = ["%s (%d days)" % (r["name"], r["age_days"]) for r in rows if r.get("age_days") is not None and r.get("status") != "nodata" and r["age_days"] > MAX_OBS_AGE_DAYS.get(r.get("freq"), 100)]
        if old: problems.append(("Old observations", "newest value is unusually old for: " + "; ".join(old)))
        nod = [r["name"] for r in rows if r.get("status") == "nodata"]
        if nod: problems.append(("No data", "no usable value for: " + ", ".join(nod)))
    except Exception: pass
    return problems

def main():
    problems = check() + check_sources()
    out = os.environ.get("GITHUB_OUTPUT"); body = os.environ.get("WATCHDOG_BODY")
    text = ("The site is serving data older than expected:\n\n" + "\n".join("- **%s**: %s" % p for p in problems) +
            "\n\nOpen the **Actions** tab and check the *Data · macro indicators* and *Data · trend signals* runs for failures. This issue closes itself when the data is fresh again.\n") if problems else ""
    if body and problems: open(body, "w").write(text)
    if out:
        with open(out, "a") as f: f.write("stale=%s\ntitle=Data is stale: %s\n" % ("true" if problems else "false", ", ".join(p[0] for p in problems)))
    print(text or "Data is fresh.")
    return problems

if __name__ == "__main__": main()
