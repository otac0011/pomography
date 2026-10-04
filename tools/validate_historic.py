#!/usr/bin/env python3
"""Validate data/historic/<book>.json files (entries found in the public-domain library books).

    python tools/validate_historic.py data/historic/hogg-1884.json [...]

Checks the shape, that the variety ids exist, that the line range is inside the book, and - the important part - that
every quoted field ("flavour", "quality", "storage", "climate") really is in the book: at least 80% of the quote's words
must occur in the entry's own lines (OCR-corrected quotes still pass; invented ones do not).
"""
import difflib, json, os, re, sys, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from schema import TASTE_TAGS  # noqa: E402

FIELDS = {"line", "end", "heading", "match", "flavour", "flavour_en", "quality", "storage", "climate", "tags", "against",
          "sweet", "acid", "note"}
QUOTES = ("flavour", "quality", "storage", "climate")


def words(s):
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    s = re.sub(r"-\s*\n\s*", "", s)                  # re-join hyphenated line breaks
    return [w for w in re.findall(r"[a-z]+", s) if len(w) > 2]


def found(x, i, w, pool):
    """A quote word counts as in the book if it is there verbatim, run together with a neighbour by the OCR
    ("till january" -> "tilljanuary"), or an OCR-corrected spelling one or two letters away ("Fmit" -> "fruit")."""
    if x in pool:
        return True
    if (i + 1 < len(w) and x + w[i + 1] in pool) or (i and w[i - 1] + x in pool):
        return True
    return len(x) >= 4 and any(abs(len(p) - len(x)) <= 2 and difflib.SequenceMatcher(None, x, p).ratio() >= 0.8 for p in pool)


def check(path, ids, books):
    E = []
    key = os.path.splitext(os.path.basename(path))[0]
    if key not in books:
        return ["%s: no book with key %r in library/books.json" % (path, key)]
    lines = open(os.path.join(ROOT, books[key]["text"]), encoding="utf-8", errors="replace").read().splitlines()
    try:
        d = json.load(open(path, encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        return ["%s: not valid JSON: %s" % (path, e)]
    for vid, r in d.items():
        if vid.startswith("_"):
            continue
        p = "%s:%s" % (key, vid)
        if vid not in ids:
            E.append(p + ": unknown variety id")
        if not isinstance(r, dict):
            E.append(p + ": not an object"); continue
        extra = set(r) - FIELDS
        if extra:
            E.append(p + ": unknown fields %s" % sorted(extra))
        a, b = r.get("line"), r.get("end")
        if not (isinstance(a, int) and isinstance(b, int) and 1 <= a <= b <= len(lines)):
            E.append(p + ": line/end must be integers with 1 <= line <= end <= %d" % len(lines)); continue
        if b - a > 400:
            E.append(p + ": entry spans %d lines - too long, check the end line" % (b - a))
        if r.get("match") not in ("exact", "synonym", "probable"):
            E.append(p + ": match must be exact | synonym | probable")
        for t in r.get("tags") or []:
            if t not in TASTE_TAGS:
                E.append(p + ": tag %r not in the taste-tag list" % t)
        for t in r.get("against") or []:
            if t not in TASTE_TAGS:
                E.append(p + ": against-tag %r not in the taste-tag list" % t)
        for k in ("sweet", "acid"):
            if r.get(k) is not None and r[k] not in (1, 2, 3, 4, 5):
                E.append(p + ": %s must be 1-5 or null" % k)
        chunk = "\n".join(lines[max(0, a - 3):b + 2])
        # a word split by a line-break hyphen ("greenish-/white") counts both re-joined and as its two halves
        pool = set(words(chunk)) | set(re.findall(r"[a-z]+", chunk.lower()))
        for q in QUOTES:
            s = r.get(q)
            if s is None:
                continue
            if not isinstance(s, str) or not s.strip():
                E.append(p + ": %s must be a non-empty string or null" % q); continue
            w = words(s)
            if not w:
                continue
            hit = sum(found(x, i, w, pool) for i, x in enumerate(w)) / len(w)
            if hit < 0.8:
                E.append(p + ": %s quote not found in lines %d-%d (%.0f%% of words match): %r" % (q, a, b, hit * 100, s[:80]))
    return E


def main():
    data = json.load(open(os.path.join(ROOT, "assets", "data.json"), encoding="utf-8"))
    ids = {v["id"] for v in data["varieties"]}
    books = {b["key"]: b for b in json.load(open(os.path.join(ROOT, "library", "books.json"), encoding="utf-8"))}
    E = []
    for f in sys.argv[1:]:
        E += check(f, ids, books)
    for e in E:
        print("ERROR", e)
    print("%d error(s)" % len(E))
    sys.exit(1 if E else 0)


if __name__ == "__main__":
    main()
