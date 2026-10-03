#!/usr/bin/env python3
"""Check that a taste patch only uses allowed tags/ranges:  python tools/validate_patch.py research/patches/flavour-N.json"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from schema import TASTE_TAGS

p = json.load(open(sys.argv[1], encoding="utf-8"))
ids = set()
import glob
for f in glob.glob(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "varieties", "*.json")):
    ids |= {r["id"] for r in json.load(open(f, encoding="utf-8"))}
bad = []
for k, v in p.items():
    if k.startswith("_"):
        continue
    if k not in ids:
        bad.append("%s: unknown id" % k)
        continue
    t = v.get("taste", {})
    extra = set(v) - {"taste"}
    if extra:
        bad.append("%s: only 'taste' may be patched (got %s)" % (k, sorted(extra)))
    for x in t.get("tags", []):
        if x not in TASTE_TAGS:
            bad.append("%s: bad tag %r" % (k, x))
    if len(t.get("tags", [])) > 8:
        bad.append("%s: more than 8 tags" % k)
    for f in ("sweet", "acid", "aroma", "crisp", "juicy"):
        if f in t and t[f] is not None and not (isinstance(t[f], int) and 1 <= t[f] <= 5):
            bad.append("%s: %s must be 1-5" % (k, f))
    for f in t:
        if f not in ("tags", "sweet", "acid", "aroma", "crisp", "juicy", "tannin", "summary", "best_eaten", "cider_class"):
            bad.append("%s: unexpected taste key %s" % (k, f))
for b in bad:
    print("ERROR", b)
print(len([k for k in p if not k.startswith("_")]), "records,", len(bad), "errors")
sys.exit(1 if bad else 0)
