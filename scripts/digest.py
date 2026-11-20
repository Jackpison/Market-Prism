"""Weekly digest: a plain-text summary of the regime, indicators that need attention and the last 7 days of alerts.
Everything comes from committed data files; no numbers are typed by hand. Stdlib only.
Run: python3 scripts/digest.py   (writes the markdown to $DIGEST_BODY if set and prints it)"""
import datetime as dt, json, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SITE = "https://jackpison.github.io/Market-Prism/"
WORD = {"yellow": "Warning", "red": "Critical"}

def load(rel, root=ROOT):
    try: return json.load(open(os.path.join(root, rel)))
    except Exception: return None

def build(now=None, root=ROOT):
    now = now or dt.datetime.now(dt.timezone.utc)
    L, A = load("data/indicators/latest.json", root), load("data/alerts.json", root)
    if not L: return None
    out = ["# MarketPrism weekly digest, %s" % now.strftime("%Y-%m-%d"), "",
           "**Regime: %s** (composite score %s). Data generated %s UTC." % (L.get("regime", "n/a"), L.get("composite", "n/a"), str(L.get("generated", "?"))[:16].replace("T", " ")), ""]
    hot = [r for r in L.get("indicators", []) if r.get("status") in WORD and r.get("weight") != 0]   # weight 0 = experimental, unscored
    hot.sort(key=lambda r: (r["status"] != "red", -(r.get("score") or 0)))
    out.append("## Indicators needing attention (%d)" % len(hot))
    out += ["- **%s**: %s, value %s%s (as of %s)" % (r["name"], WORD[r["status"]], r.get("value"), {"%": "%", "pp": "pp"}.get(r.get("unit"), ""), r.get("asof")) for r in hot] or ["None: every scored indicator is in its normal range."]
    cutoff = (now - dt.timedelta(days=7)).strftime("%Y-%m-%dT%H:%M")
    ev = [e for e in (A or {}).get("events", []) if str(e.get("ts", "")) >= cutoff]
    out += ["", "## Alerts in the last 7 days (%d)" % len(ev)]
    out += ["- `%s` [%s] %s" % (str(e["ts"])[:10], e.get("severity", "info"), e.get("title", "")) for e in ev[:25]] or ["None."]
    out += ["", "Open the dashboard: %s" % SITE, "", "_Research and education only. Not financial advice. Automated from the repository's data files._"]
    return "\n".join(out) + "\n"

def main():
    text = build()
    if text is None: print("No data to summarise."); return None
    if os.environ.get("DIGEST_BODY"): open(os.environ["DIGEST_BODY"], "w").write(text)
    print(text); return text

if __name__ == "__main__": main()
