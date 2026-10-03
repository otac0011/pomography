#!/usr/bin/env python3
"""Validate variety JSON files:  python tools/validate.py data/varieties/*.json [--batch research/batches/X.json]"""
import argparse, glob, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from schema import validate_variety  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+")
    ap.add_argument("--batch", help="batch json: check that every requested id is present")
    ap.add_argument("--quiet", action="store_true", help="errors only")
    a = ap.parse_args()
    files = []
    for f in a.files:
        files += glob.glob(f) or [f]
    errs, warns, seen = [], [], {}
    for f in files:
        try:
            data = json.load(open(f, encoding="utf-8"))
        except Exception as ex:
            errs.append("%s: cannot parse JSON (%s)" % (f, ex))
            continue
        if not isinstance(data, list):
            errs.append("%s: top level must be an array" % f)
            continue
        for v in data:
            E, W = validate_variety(v)
            errs += E
            warns += W
            if v.get("id") in seen:
                errs.append("%s: duplicate id (also in %s)" % (v.get("id"), seen[v.get("id")]))
            seen[v.get("id")] = f
    if a.batch:
        want = [x["id"] for x in json.load(open(a.batch, encoding="utf-8"))["varieties"]]
        missing = [i for i in want if i not in seen]
        extra = [i for i in seen if i not in want]
        if missing:
            errs.append("batch: %d requested ids missing: %s" % (len(missing), ", ".join(missing)))
        if extra:
            warns.append("batch: ids not requested: %s" % ", ".join(extra))
    for m in errs:
        print("ERROR  ", m)
    if not a.quiet:
        for m in warns:
            print("warning", m)
    print("%d records, %d errors, %d warnings" % (len(seen), len(errs), len(warns)))
    sys.exit(1 if errs else 0)


if __name__ == "__main__":
    main()
