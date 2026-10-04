#!/usr/bin/env python3
"""Find where each of our varieties is described in each library book (candidate entry headings).

    python tools/locate_library.py          # -> research/library/candidates-<book>.json

OCR text is messy (double spaces, broken hyphenation, odd capitals), so this only proposes candidates: lines that START
with one of the variety's names (or synonyms), scored higher when the heading is in capitals and followed by
punctuation, as dictionary-style pomologies print them. A research agent then confirms the real entry and its extent
(research/LIBRARY_BRIEF.md). Page numbers are inferred from the running page numbers printed on their own lines.
"""
import json, os, re, unicodedata
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def norm(s):
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.replace("’", "").replace("'", "").replace("`", "")
    s = re.sub(r"[^A-Za-z0-9]+", " ", s).strip().upper()
    return s


def keys_for(v):
    out = set()
    for nm in [v["name"]] + (v.get("aka") or []):
        k = norm(nm)
        if len(k) >= 5:
            out.add(k)
            # Beach and others drop the possessive and "Pippin": COX ORANGE for Cox's Orange Pippin
            k2 = re.sub(r"\bS\b", "", k).replace("  ", " ").strip()
            k3 = re.sub(r" (PIPPIN|PEARMAIN|SEEDLING|APPLE)$", "", k2)
            for x in (k2, k3):
                if len(x) >= 5 and len(x.split()) >= 1:
                    out.add(x)
    # a lone single short word (e.g. "COX") would match prose; keep single words only when long
    return {k for k in out if " " in k or len(k) >= 7}


def pages(lines):
    """Running page number for each line: standalone numbers that roughly increase."""
    pg, last, out = None, 0, []
    for ln in lines:
        s = ln.strip()
        if re.fullmatch(r"\d{1,4}", s):
            n = int(s)
            if last < n <= last + 40 or (last == 0 and n <= 40):
                pg, last = n, n
        out.append(pg)
    return out


def main():
    data = json.load(open(os.path.join(ROOT, "assets", "data.json"), encoding="utf-8"))
    books = json.load(open(os.path.join(ROOT, "library", "books.json"), encoding="utf-8"))
    vkeys = {v["id"]: keys_for(v) for v in data["varieties"]}
    first = defaultdict(list)            # first word -> [(key, id)]
    for vid, ks in vkeys.items():
        for k in ks:
            first[k.split()[0]].append((k, vid))
    os.makedirs(os.path.join(ROOT, "research", "library"), exist_ok=True)
    summary = []
    for b in books:
        path = os.path.join(ROOT, b["text"])
        if not os.path.exists(path):
            continue
        lines = open(path, encoding="utf-8", errors="replace").read().splitlines()
        pg = pages(lines)
        hits = defaultdict(list)
        for i, ln in enumerate(lines):
            raw = ln.strip()
            if not raw or len(raw) < 5:
                continue
            n = norm(raw)
            w = n.split(" ", 1)[0]
            for k, vid in first.get(w, ()):
                if not (n == k or n.startswith(k + " ")):
                    continue
                head = raw[:len(k) + 6]
                letters = [c for c in head if c.isalpha()]
                caps = sum(c.isupper() for c in letters) / max(1, len(letters))
                after = raw[len(raw) - len(raw.lstrip()):]
                score = 1.0 + 2.0 * (caps > 0.8) + 0.5 * bool(re.match(r"^[^a-z]*[.,—:;-]", raw[len(k):len(k) + 8] if len(raw) > len(k) else ".")) \
                    + 0.3 * (len(k.split()) > 1)
                hits[vid].append({"line": i + 1, "page": pg[i], "score": round(score, 2), "key": k, "text": raw[:160]})
        out = {}
        for vid, hs in hits.items():
            hs.sort(key=lambda h: (-h["score"], h["line"]))
            seen, uniq = set(), []
            for h in hs:
                if h["line"] not in seen:
                    seen.add(h["line"])
                    uniq.append(h)
            out[vid] = uniq[:6]
        json.dump(out, open(os.path.join(ROOT, "research", "library", "candidates-%s.json" % b["key"]), "w", encoding="utf-8"),
                  indent=1, ensure_ascii=False)
        strong = sum(1 for hs in out.values() if hs[0]["score"] >= 3)
        summary.append((b["key"], len(out), strong))
    for k, n, s in summary:
        print("%-24s varieties with candidates %4d  strong (capitalised heading) %4d" % (k, n, s))


if __name__ == "__main__":
    main()
