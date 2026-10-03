#!/usr/bin/env python3
"""Deep-merge a patch into variety records, in place.

    python tools/apply_patch.py research/patches/001-keepers-seedlings.json

Patch format: {"variety-id": {"origin": {"year": 2022}, "tags": ["keepers-bred"], ...}, ...}
Dicts merge recursively, every other value (lists, scalars, null) replaces. A record whose patch value is
null is DELETED (used to merge duplicate cards of one apple; put the synonym in the survivor's `aka`). The patch file stays in
research/patches/ as the provenance record of hand corrections; re-running it is idempotent.
"""
import glob, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def merge(dst, src):
    for k, v in src.items():
        if isinstance(v, dict) and isinstance(dst.get(k), dict):
            merge(dst[k], v)
        else:
            dst[k] = v


def main():
    patch = json.load(open(sys.argv[1], encoding="utf-8"))
    patch.pop("_note", None)
    todo = dict(patch)
    for f in sorted(glob.glob(os.path.join(ROOT, "data", "varieties", "*.json"))):
        data = json.load(open(f, encoding="utf-8"))
        changed = False
        keep = []
        for rec in data:
            if rec["id"] in todo:
                p = todo.pop(rec["id"])
                changed = True
                if p is None:
                    continue
                merge(rec, p)
            keep.append(rec)
        data = keep
        if changed:
            with open(f, "w", encoding="utf-8", newline="\n") as fh:
                json.dump(data, fh, ensure_ascii=False, indent=2)
                fh.write("\n")
    if todo:
        print("NOT FOUND:", ", ".join(todo))
        sys.exit(1)
    print("patched", len(patch), "records")


if __name__ == "__main__":
    main()
