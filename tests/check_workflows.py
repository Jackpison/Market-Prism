#!/usr/bin/env python3
"""Lints .github/workflows/*.yml and the local composite action: every job needs a timeout, every workflow needs least-privilege permissions and
a concurrency group (scheduled jobs must not overlap), steps that use third-party actions must pin a version, and workflow_run triggers must name
workflows that exist. Needs PyYAML (pip install pyyaml). Run: python3 tests/check_workflows.py"""
import glob, os, sys
try: import yaml
except ImportError: print("PyYAML missing: pip install pyyaml"); sys.exit(2)
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
errs = []; names = {}
files = sorted(glob.glob(os.path.join(ROOT, ".github", "workflows", "*.yml")))
docs = {f: yaml.safe_load(open(f)) for f in files}
for f, d in docs.items(): names[d.get("name")] = os.path.basename(f)
for f, d in docs.items():
    b = os.path.basename(f); on = d.get(True, d.get("on")) or {}
    if "permissions" not in d: errs.append("%s: no top-level permissions block" % b)
    if "concurrency" not in d: errs.append("%s: no concurrency group" % b)
    if not d.get("name"): errs.append("%s: no name" % b)
    for jn, j in (d.get("jobs") or {}).items():
        if "timeout-minutes" not in j: errs.append("%s: job '%s' has no timeout-minutes" % (b, jn))
        for st in j.get("steps", []):
            u = st.get("uses")
            if u and not u.startswith("./") and "@" not in u: errs.append("%s: '%s' is not pinned to a version" % (b, u))
    for w in (on.get("workflow_run") or {}).get("workflows", []) if isinstance(on, dict) else []:
        if w not in names: errs.append("%s: workflow_run names '%s', which does not exist (renamed?)" % (b, w))
    if isinstance(on, dict) and "schedule" in on:
        for s in on["schedule"]:
            if not s.get("cron"): errs.append("%s: schedule without cron" % b)
action = os.path.join(ROOT, ".github", "actions", "commit-data", "action.yml")
if not os.path.exists(action): errs.append("composite action .github/actions/commit-data/action.yml missing")
for f in files:
    if "uses: ./.github/actions/commit-data" in open(f).read() and not os.path.exists(action): errs.append("%s uses a missing local action" % os.path.basename(f))
if errs: print("WORKFLOW LINT FAILED (%d):" % len(errs)); [print("  -", e) for e in errs]; sys.exit(1)
print("workflows ok: %d files" % len(files))
