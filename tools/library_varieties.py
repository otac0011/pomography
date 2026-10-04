#!/usr/bin/env python3
"""Write research/library/varieties.json: the compact variety list (id, name, synonyms, country, year, uses, recorded taste
tags) that the library, evidence and import tools match names against. Re-run after adding varieties.

    python tools/library_varieties.py
"""
import glob, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    vs = []
    for f in sorted(glob.glob(os.path.join(ROOT, "data", "varieties", "*.json"))):
        vs += json.load(open(f, encoding="utf-8"))
    out = [{"id": v["id"], "name": v["name"], "aka": v.get("aka") or [], "country": v["origin"].get("country"),
            "year": v["origin"].get("year"), "uses": v.get("uses") or [], "tags": v["taste"].get("tags") or []}
           for v in sorted(vs, key=lambda v: v["id"])]
    json.dump(out, open(os.path.join(ROOT, "research", "library", "varieties.json"), "w", encoding="utf-8"), indent=0, ensure_ascii=False)
    print("wrote research/library/varieties.json: %d varieties" % len(out))


if __name__ == "__main__":
    main()
