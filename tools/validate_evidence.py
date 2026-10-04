#!/usr/bin/env python3
"""Validate data/evidence/ev-N.json (modern-source flavour evidence, research/EVIDENCE_BRIEF.md).

    python tools/validate_evidence.py data/evidence/ev-1.json [...]
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from schema import TASTE_TAGS  # noqa: E402

SRC = {"orangepippin", "wikipedia", "nfc", "university", "nursery", "pomology-site", "book", "other"}
VFIELDS = {"sources", "storage_change", "climate_flavour", "peak", "notes"}
SFIELDS = {"src", "url", "words", "tags", "sweet", "acid", "against"}


def check(path, ids):
    E = []
    try:
        d = json.load(open(path, encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        return ["%s: not valid JSON: %s" % (path, e)]
    for vid, r in d.items():
        if vid.startswith("_"):
            continue
        p = "%s:%s" % (os.path.basename(path), vid)
        if vid not in ids:
            E.append(p + ": unknown variety id")
        if not isinstance(r, dict):
            E.append(p + ": not an object"); continue
        if set(r) - VFIELDS:
            E.append(p + ": unknown fields %s" % sorted(set(r) - VFIELDS))
        if "keepers-nursery" in json.dumps(r):
            E.append(p + ": Keepers Nursery must not be used as a source")
        cf = r.get("climate_flavour")
        if cf is not None and (not isinstance(cf, dict) or cf.get("needs") not in ("cool", "warm", "any", None)):
            E.append(p + ": climate_flavour must be null or {needs: cool|warm|any|null, note}")
        for k in ("storage_change", "peak", "notes"):
            if r.get(k) is not None and not isinstance(r[k], str):
                E.append(p + ": %s must be a string or null" % k)
        srcs = r.get("sources")
        if not isinstance(srcs, list):
            E.append(p + ": sources must be a list"); continue
        for i, s in enumerate(srcs):
            q = "%s source %d" % (p, i)
            if not isinstance(s, dict):
                E.append(q + ": not an object"); continue
            if set(s) - SFIELDS:
                E.append(q + ": unknown fields %s" % sorted(set(s) - SFIELDS))
            if s.get("src") not in SRC:
                E.append(q + ": src must be one of %s" % sorted(SRC))
            if not str(s.get("url", "")).startswith("http"):
                E.append(q + ": url required")
            w = s.get("words")
            if not isinstance(w, list) or any(not isinstance(x, str) or len(x.split()) > 5 for x in w):
                E.append(q + ": words must be a list of short phrases (<= 5 words each)")
            for k in ("tags", "against"):
                for t in s.get(k) or []:
                    if t not in TASTE_TAGS:
                        E.append(q + ": %s %r not in the taste-tag list" % (k, t))
            for k in ("sweet", "acid"):
                if s.get(k) is not None and s[k] not in (1, 2, 3, 4, 5):
                    E.append(q + ": %s must be 1-5 or null" % k)
    return E


def main():
    data = json.load(open(os.path.join(ROOT, "assets", "data.json"), encoding="utf-8"))
    ids = {v["id"] for v in data["varieties"]}
    E = []
    for f in sys.argv[1:]:
        E += check(f, ids)
    for e in E:
        print("ERROR", e)
    print("%d error(s)" % len(E))
    sys.exit(1 if E else 0)


if __name__ == "__main__":
    main()
