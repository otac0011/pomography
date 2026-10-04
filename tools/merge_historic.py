#!/usr/bin/env python3
"""Merge new book entries into data/historic/<book>.json (used when varieties are added after the library pass).

    python tools/validate_historic.py research/library/new/hogg-1884.json    # check first: same rules, same book key
    python tools/merge_historic.py research/library/new/hogg-1884.json [...]

Entries for ids the book file already has are skipped (the earlier, reviewed entry wins) and reported.
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    for path in sys.argv[1:]:
        key = os.path.splitext(os.path.basename(path))[0]
        new = json.load(open(path, encoding="utf-8"))
        dest = os.path.join(ROOT, "data", "historic", key + ".json")
        cur = json.load(open(dest, encoding="utf-8")) if os.path.exists(dest) else {"_book": key}
        added, skipped = [], []
        for vid, e in new.items():
            if vid.startswith("_"):
                continue
            (skipped if vid in cur else added).append(vid)
            cur.setdefault(vid, e)
        json.dump(cur, open(dest, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
        print("%s: +%d entries%s" % (key, len(added), (", skipped (already present): " + ", ".join(skipped)) if skipped else ""))


if __name__ == "__main__":
    main()
