#!/usr/bin/env python3
"""Validate region-note JSON:  python tools/validate_regions.py "data/regions/*.json" [--batch research/region_batches/X.json]"""
import glob, json, os, sys

CONF = ["high", "medium", "low"]


def validate_region(r):
    E = []
    rid = r.get("id", "?")
    for k in ("id", "summary", "apple_culture", "local_varieties", "pests_diseases", "tips", "confidence"):
        if k not in r:
            E.append("%s: missing %s" % (rid, k))
    if E:
        return E
    for k in ("summary", "apple_culture", "pests_diseases", "tips"):
        if not isinstance(r[k], str) or len(r[k]) < 20:
            E.append("%s: %s too short" % (rid, k))
    if not isinstance(r["local_varieties"], list) or any(not isinstance(x, str) for x in r["local_varieties"]):
        E.append("%s: local_varieties must be a list of strings" % rid)
    if r["confidence"] not in CONF:
        E.append("%s: confidence" % rid)
    return E


def main():
    files, batch = [], None
    args = sys.argv[1:]
    if "--batch" in args:
        i = args.index("--batch")
        batch = args[i + 1]
        args = args[:i] + args[i + 2:]
    for a in args:
        files += glob.glob(a) or [a]
    errs, seen = [], {}
    for f in files:
        try:
            data = json.load(open(f, encoding="utf-8"))
        except Exception as ex:
            errs.append("%s: cannot parse (%s)" % (f, ex))
            continue
        for r in data:
            errs += validate_region(r)
            if r.get("id") in seen:
                errs.append("%s: duplicate" % r.get("id"))
            seen[r.get("id")] = f
    if batch:
        want = [x["id"] for x in json.load(open(batch, encoding="utf-8"))["regions"]]
        miss = [i for i in want if i not in seen]
        extra = [i for i in seen if i not in want]
        if miss:
            errs.append("missing ids: %s" % ", ".join(miss))
        if extra:
            errs.append("unknown ids: %s" % ", ".join(extra))
    for m in errs:
        print("ERROR  ", m)
    print("%d records, %d errors" % (len(seen), len(errs)))
    sys.exit(1 if errs else 0)


if __name__ == "__main__":
    main()
