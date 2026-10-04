"""Flavour evidence: merge the library books, modern sources, lab measurements and visitors' tastings into the variety
records (light fields, in assets/data.json) and assets/flavour.json (quotes, excerpts, source lists; loaded on demand).

Called from tools/build.py. Rules (docs/decisions/0005):
* Each tag's support is the set of INDEPENDENT sources that use the word. One author is one voice: Hogg 1851, Hogg 1884
  and the Herefordshire Pomona (Hogg co-edited) count once; the two volumes of Beach and of Leroy count once; modern
  pages count once per organisation.
* Our existing tag is dropped as contested when more sources contradict it than support it (at least two, or one once
  a modern source has also been checked). Otherwise it is kept if at least one source supports it. With no support it is kept only while the variety has fewer than two sources at all, or no modern source (the old
  books do not use words like "pear-drop"), because then we cannot judge; otherwise it moves to `unverified` and is no
  longer shown as a flavour of the apple.
* A tag that we did not have is added when two or more independent sources support it.
* Level: 3+ sources "firm", 2 "supported", 1 "reported", 0 "unsourced".
"""
import glob, json, os, re
from collections import defaultdict
from urllib.parse import quote, urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

VOICE = {"hogg-1851": "hogg", "hogg-1884": "hogg", "herefordshire-pomona-1": "hogg", "herefordshire-pomona-2": "hogg",
         "beach-1905-1": "beach", "beach-1905-2": "beach", "leroy-3": "leroy", "leroy-4": "leroy"}
VOICE_LABEL = {"hogg": "Robert Hogg (1851-1884)", "beach": "Beach, The Apples of New York (1905)",
               "leroy": "Leroy, Dictionnaire de pomologie (1873)"}
MODERN_LABEL = {"orangepippin": "Orange Pippin", "wikipedia": "Wikipedia", "nfc": "National Fruit Collection (UK)"}
MIN_TASTINGS = 3


def _load_json(path, default):
    return json.load(open(path, encoding="utf-8")) if os.path.exists(path) else default



def _clean(lines):
    """OCR lines -> readable paragraphs: drop page numbers, re-join hyphenation, collapse spaces."""
    paras, cur = [], []
    for ln in lines:
        s = ln.strip()
        if re.fullmatch(r"\d{1,4}", s):
            continue
        if not s:
            if cur:
                paras.append(cur); cur = []
            continue
        cur.append(re.sub(r"\s+", " ", s))
    if cur:
        paras.append(cur)
    out = []
    for p in paras:
        t = ""
        for s in p:
            if t.endswith("-") and s[:1].islower():
                t = t[:-1] + s
            else:
                t = (t + " " + s) if t else s
        out.append(t.replace("�", "—"))
    text = "\n\n".join(out)
    return text if len(text) <= 5000 else text[:5000].rsplit(" ", 1)[0] + " …"


def _modern_key(s):
    src = s.get("src")
    if src in MODERN_LABEL:
        return src, MODERN_LABEL[src]
    host = urlparse(s.get("url", "")).netloc.lower().removeprefix("www.")
    return "%s:%s" % (src, host), host or src


def implied(r):
    """A source's 1-5 sweet/acid rating supports the structural tags even when it does not use the word."""
    out = []
    if (r.get("sweet") or 0) >= 4:
        out.append("sweet")
    if (r.get("acid") or 0) >= 4:
        out.append("sharp")
    if r.get("acid") is not None and r["acid"] <= 2:
        out.append("mild")
    return [t for t in out if t not in (r.get("tags") or [])]


def attach(varieties, warnings):
    books = {b["key"]: b for b in _load_json(os.path.join(ROOT, "library", "books.json"), [])}
    vocab = _load_json(os.path.join(ROOT, "data", "flavour_vocab.json"), {})
    tastings = _load_json(os.path.join(ROOT, "data", "tastings.json"), {})
    byid = {v["id"]: v for v in varieties}

    # ---- library books
    hist = defaultdict(list)
    for path in sorted(glob.glob(os.path.join(ROOT, "data", "historic", "*.json"))):
        key = os.path.splitext(os.path.basename(path))[0]
        b = books.get(key)
        if not b:
            warnings.append("historic file %s has no book in library/books.json" % key); continue
        lines = open(os.path.join(ROOT, b["text"]), encoding="utf-8", errors="replace").read().splitlines()
        ia = b["archive_org"].rsplit("/", 1)[-1]
        for vid, r in _load_json(path, {}).items():
            if vid.startswith("_"):
                continue
            if vid not in byid:
                warnings.append("historic %s: unknown variety %s" % (key, vid)); continue
            page = None      # the OCR's running page numbers are too patchy to trust; the in-book search link finds the entry
            q = quote('"%s"' % re.sub(r"\s+", " ", r.get("heading") or byid[vid]["name"]).strip(" .")[:40])
            hist[vid].append({
                "book": key, "voice": VOICE.get(key, key), "author": b["author"], "year": b["year"], "title": b["title"],
                "lang": b.get("lang", "en"), "heading": r.get("heading"), "match": r.get("match"), "page": page,
                "link": "https://archive.org/details/%s%s?q=%s" % (ia, "/page/%d/mode/1up" % page if page else "", q),
                "flavour": r.get("flavour"), "flavour_en": r.get("flavour_en"), "quality": r.get("quality"),
                "storage": r.get("storage"), "climate": r.get("climate"), "tags": r.get("tags") or [],
                "against": r.get("against") or [], "sweet": r.get("sweet"), "acid": r.get("acid"), "note": r.get("note") or "",
                "text": _clean(lines[r["line"] - 1:r["end"]]),
            })
    for vid in hist:
        hist[vid].sort(key=lambda h: h["year"])

    # ---- modern sources
    modern = {}
    for path in sorted(glob.glob(os.path.join(ROOT, "data", "evidence", "*.json"))):
        for vid, r in _load_json(path, {}).items():
            if vid.startswith("_"):
                continue
            if vid not in byid:
                warnings.append("evidence %s: unknown variety %s" % (os.path.basename(path), vid)); continue
            modern[vid] = r

    # ---- expert tasting scores (National Fruit Collection C&E data, ECPGR 1-9 scales; one assessor)
    panel, panel_src = {}, []
    for path in sorted(glob.glob(os.path.join(ROOT, "data", "panel", "*.json"))):
        d = _load_json(path, {})
        panel_src.append(d.get("_source", {}))
        for vid, r in d.get("records", {}).items():
            if vid in byid:
                panel[vid] = dict(r, _source=d.get("_source", {}))

    # ---- lab measurements: average within each source, then percentile within that source (methods differ)
    chem_src = []
    for path in sorted(glob.glob(os.path.join(ROOT, "data", "chemistry", "*.json"))):
        d = _load_json(path, {})
        if "_source" in d:
            chem_src.append(d)
    chem = defaultdict(list)
    for d in chem_src:
        recs = d.get("records", {})
        for k in ("ssc", "ta"):
            vals = sorted(r[k] for r in recs.values() if isinstance(r.get(k), (int, float)))
            for vid, r in recs.items():
                if isinstance(r.get(k), (int, float)) and vals:
                    below = sum(1 for x in vals if x < r[k]) + 0.5 * sum(1 for x in vals if x == r[k])
                    r["_pct_" + k] = round(100 * below / len(vals))
        for vid, r in recs.items():
            if vid in byid:
                chem[vid].append({"source": d["_source"].get("key"), "title": d["_source"].get("title"),
                                  "year": d["_source"].get("year"), "url": d["_source"].get("url"),
                                  "where": d["_source"].get("where"), "stage": r.get("stage"),
                                  "ssc": r.get("ssc"), "ta": r.get("ta"), "firmness": r.get("firmness"),
                                  "firmness_units": r.get("firmness_units"), "n": r.get("n"), "match": r.get("match"),
                                  "pct_ssc": r.get("_pct_ssc"), "pct_ta": r.get("_pct_ta"), "of": len(recs)})

    detail = {}
    stats = defaultdict(int)
    for v in varieties:
        vid, t = v["id"], v["taste"]
        support, contra, sources = defaultdict(set), defaultdict(set), []
        for h in hist.get(vid, []):
            sources.append({"key": h["voice"], "label": VOICE_LABEL.get(h["voice"], "%s (%s)" % (h["author"], h["year"])),
                            "kind": "book", "tags": h["tags"], "url": h["link"]})
            for tg in h["tags"] + implied(h):
                support[tg].add(h["voice"])
            for tg in h["against"]:
                contra[tg].add(h["voice"])
        m = modern.get(vid) or {}
        for s in m.get("sources") or []:
            k, label = _modern_key(s)
            sources.append({"key": k, "label": label, "kind": "web", "tags": s.get("tags") or [], "url": s.get("url"),
                            "words": s.get("words") or []})
            for tg in (s.get("tags") or []) + implied(s):
                support[tg].add(k)
            for tg in s.get("against") or []:
                contra[tg].add(k)
        pr = panel.get(vid)
        if pr:
            ptags = (["sweet"] if (pr.get("sweet") or 0) >= 7 else []) + (["sharp"] if (pr.get("acid") or 0) >= 7 else [])                 + (["mild"] if pr.get("acid") is not None and pr["acid"] <= 3 else []) + (["perfumed"] if (pr.get("aroma") or 0) >= 7 else [])
            # same organisation as the NFC web pages, so the same voice
            sources.append({"key": "nfc", "label": "National Fruit Collection tasting (1-9 scores)", "kind": "panel",
                            "tags": ptags, "url": pr["_source"].get("url"),
                            "words": ["sweetness %s/9" % pr.get("sweet"), "acidity %s/9" % pr.get("acid"), "aroma %s/9" % pr.get("aroma")]})
            for tg in ptags:
                support[tg].add("nfc")
        voices = {s["key"] for s in sources}
        web = {s["key"] for s in sources if s["kind"] == "web"}
        written = {s["key"] for s in sources if s["kind"] != "panel"}   # the 1-9 panel cannot speak to notes like pear-drop
        old = list(t.get("tags") or [])
        kept, unverified, contested = [], [], []
        for tg in old:
            n, c = len(support[tg]), len(contra[tg] - support[tg])
            if c > n and (c >= 2 or (web and len(written) >= 2)):   # one lone contradiction is not enough
                contested.append(tg)
            elif n or len(written) < 2 or not web:      # old books rarely use modern words (pear-drop): need a modern source too
                kept.append(tg)
            else:
                unverified.append(tg)
        added = [tg for tg in support if tg not in old and len(support[tg]) >= 2 and len(contra[tg]) < len(support[tg])]
        added.sort(key=lambda tg: -len(support[tg]))
        order = {tg: i for i, tg in enumerate(old)}
        final = sorted(kept + added, key=lambda tg: (-len(support[tg]), order.get(tg, 99)))
        t["tags_before"] = old
        t["tags"] = final[:8]
        t["support"] = {tg: len(support[tg]) for tg in final[:8]}
        t["unverified"] = unverified + contested
        t["n_sources"] = len(voices)
        t["n_books"] = len({h["voice"] for h in hist.get(vid, [])})
        if m.get("storage_change"):
            t["storage_change"] = m["storage_change"]
        if m.get("peak"):
            t["peak"] = m["peak"]
        cf = m.get("climate_flavour")
        if cf and (cf.get("needs") or cf.get("note")):
            t["climate_flavour"] = {"needs": cf.get("needs"), "note": cf.get("note") or ""}
        ch = chem.get(vid)
        if ch:
            def mean(k):
                xs = [c[k] for c in ch if isinstance(c.get(k), (int, float))]
                return round(sum(xs) / len(xs), 1) if xs else None
            t["measured"] = {"ssc": mean("ssc"), "ta": mean("ta"), "pct_ssc": mean("pct_ssc"), "pct_ta": mean("pct_ta"),
                             "n": len(ch)}
        if pr:
            t["panel"] = {k: pr.get(k) for k in ("sweet", "acid", "balance", "aroma", "juice", "quality")}
            t["panel"]["tasted"] = (pr.get("assessed") or [{}])[0].get("tasted")
        tv = tastings.get(vid)
        if tv and tv.get("n", 0) >= MIN_TASTINGS:
            t["visitors"] = tv
        stats["with sources"] += bool(voices)
        stats["unverified tags"] += len(unverified)
        stats["contested tags"] += len(contested)
        stats["added tags"] += len(added)
        stats["with measurements"] += bool(ch)
        stats["with book entries"] += bool(hist.get(vid))
        if hist.get(vid) or m or ch or tv or pr:
            merged = {}                      # one row per voice (Hogg's three books, both Beach volumes ...)
            for src in sources:
                m0 = merged.setdefault(src["key"], dict(src, tags=[]))
                m0["tags"] += [tg for tg in src["tags"] if tg not in m0["tags"]]
            detail[vid] = {"books": hist.get(vid, []), "sources": list(merged.values()),
                           "support": {tg: sorted(s) for tg, s in support.items()},
                           "contra": {tg: sorted(s) for tg, s in contra.items() if s},
                           "added": added, "unverified": unverified, "contested": contested,
                           "notes": m.get("notes") or "", "chemistry": ch or [], "tastings": tv or None,
                           "panel": {k: v for k, v in pr.items() if k != "_source"} if pr else None}
    out = {"books": list(books.values()), "vocab": vocab, "chemistry_sources": [d["_source"] for d in chem_src], "panel_sources": panel_src,
           "varieties": detail}
    with open(os.path.join(ROOT, "assets", "flavour.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    return dict(stats)
