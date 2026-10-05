#!/usr/bin/env python3
"""Which well-known apples are missing from the atlas? Writes research/coverage-gaps.md and .json.

    python tools/coverage_gaps.py --fetch     # download the reference lists into cache/coverage/ (slow, paced)
    python tools/coverage_gaps.py             # compare them with data/varieties
    python tools/coverage_gaps.py --batches   # also write research/batches/coverage-N.json for research agents

Selection for --batches: every missing name scoring 4+, plus score-3 names with their own Wikipedia article, minus
SKIP (sports and strains of apples we already have, or names that are not a single cultivar); RENAME tidies list names.

A name scores one point for each independent list it appears on, and two for having its own Wikipedia article:
  Wikipedia article (category "Apple cultivars" and sub-categories), Wikipedia's "List of apple cultivars" tables,
  Orange Pippin's A-Z index, the National Fruit Collection (Brogdale), and the research collections in data/chemistry
  (Apple Biodiversity Collection, USDA Geneva, REFPOP). Only names are read from these lists; nothing else is copied.
Names are compared with every variety name and synonym we hold (accent-, case- and possessive-insensitive).
"""
import csv, glob, html, json, os, re, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from import_chemistry import norm, norm_loose  # noqa: E402

CACHE = os.path.join(ROOT, "cache", "coverage")
CHEM = os.path.join(ROOT, "cache", "chem")
UA = "Pomography/1.0 (https://otac0011.github.io/pomography/)"
WEIGHT = {"wikipedia-article": 2, "wikipedia-list": 1, "orangepippin": 1, "nfc": 1, "abc": 1, "grin": 1, "refpop": 1,
          "toc": 1, "pomiferous": 1, "eurisco": 1}
# the heirloom lists (decision 0008): collections and databases that hold thousands of old apples
HEIRLOOM = ("toc", "pomiferous", "eurisco")
TOC_PDF = "https://www.temperateorchardconservancy.org/wp-content/uploads/BotnerAppleCollection.pdf"
POM_USES = ("canning", "cider", "cooking", "culinary", "dessert", "eating", "jelly", "juice", "ornamental", "pie",
            "pollinization", "sauce")


def get(url, dest, pause=0):
    if os.path.exists(dest) and os.path.getsize(dest) > 1000:
        return
    req = urllib.request.Request(url, headers={"User-Agent": UA if "wikipedia" in url else "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        open(dest, "wb").write(r.read())
    time.sleep(pause)


def fetch():
    os.makedirs(CACHE, exist_ok=True)
    w = "https://en.wikipedia.org/w/index.php?action=raw&title="
    get(w + urllib.parse.quote("List_of_apple_cultivars_(A–K)"), os.path.join(CACHE, "wiki-ak.txt"))
    get(w + urllib.parse.quote("List_of_apple_cultivars_(L–Z)"), os.path.join(CACHE, "wiki-lz.txt"))
    # the category tree: article titles under Category:Apple cultivars, two levels down
    seen, titles, todo = set(), set(), [("Category:Apple cultivars", 0)]
    while todo:
        cat, depth = todo.pop()
        if cat in seen:
            continue
        seen.add(cat)
        cont = ""
        while True:
            url = ("https://en.wikipedia.org/w/api.php?action=query&list=categorymembers&cmlimit=500&format=json&cmtitle="
                   + urllib.parse.quote(cat) + cont)
            d = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60))
            for m in d["query"]["categorymembers"]:
                if m["ns"] == 0:
                    titles.add(m["title"])
                elif m["ns"] == 14 and depth < 2:
                    todo.append((m["title"], depth + 1))
            if "continue" not in d:
                break
            cont = "&cmcontinue=" + urllib.parse.quote(d["continue"]["cmcontinue"])
            time.sleep(0.5)
    json.dump(sorted(titles), open(os.path.join(CACHE, "wiki-articles.json"), "w", encoding="utf-8"), indent=0)
    for L in "abcdefghijklmnopqrstuvwxyz":          # Orange Pippin rate-limits parallel requests: one every 3 s
        get("https://www.orangepippin.com/varieties/apples/" + L, os.path.join(CACHE, "op-%s.html" % L), pause=3)
    get(TOC_PDF, os.path.join(CACHE, "toc-BotnerAppleCollection.pdf"))
    # Pomiferous has no A-Z index; its twelve "apples by use" lists, 30 a page, one page every 2 s
    os.makedirs(os.path.join(CACHE, "pomiferous"), exist_ok=True)
    for use in POM_USES:
        p = 1
        while True:
            dest = os.path.join(CACHE, "pomiferous", "%s-%d.html" % (use, p))
            get("https://pomiferous.com/applebyuse/%s?page=%d" % (use, p), dest, pause=2)
            last = max([int(x) for x in re.findall(r"page=(\d+)", open(dest, encoding="utf-8", errors="replace").read())] or [1])
            if p >= last:
                break
            p += 1
    # EURISCO is an Oracle APEX app without a plain download URL: export Malus domestica from the "Ex situ" search by hand
    # (Taxonomy > Species "Malus domestica" > Accessions > Download) and save the CSV as cache/coverage/eurisco-malus.csv
    print("fetched; %d Wikipedia articles" % len(titles))


NOT_CULTIVAR = re.compile(r"^(list of|lists of|malling series|cider apple|pearmain|lost apple project|arctic apples|"
                          r"redlove apples|crab ?apple|apple|cooking apple|.*rootstock.*|geneva series|budagovsky.*|"
                          r"pomological watercolor collection)$", re.I)


def clean_title(t):
    t = re.sub(r"\s*\((apple|cultivar|apple cultivar|malus)\)$", "", t, flags=re.I)
    t = re.sub(r"^Malus\s+['‘]?(.+?)['’]?$", r"\1", t)
    t = re.sub(r"\s+(apple|apples)$", "", t, flags=re.I) if not re.match(r"^(lady|crab|pine|winter|summer)\b", t, re.I) else t
    return t.strip()


def wiki_list():
    out = {}
    for f in ("wiki-ak.txt", "wiki-lz.txt"):
        lines = open(os.path.join(CACHE, f), encoding="utf-8").read().splitlines()
        for i, ln in enumerate(lines):
            if ln.strip() != "|-" or i + 1 >= len(lines):
                continue
            cell = lines[i + 1]
            if not cell.startswith("|") or cell.startswith("|-") or cell.startswith("|}") or "(see " in cell.lower():
                continue
            cell = re.sub(r"<ref[^>]*/>|<ref[^>]*>.*?</ref>", "", cell[1:])
            aka = []
            m = re.search(r"\(\{\{aka\}\}\s*(.*?)\)\s*$", cell)
            if m:
                aka = [a.strip(" '[]") for a in re.split(r",|;|\bor\b", re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", m.group(1))) if a.strip(" '[]")]
                cell = cell[:m.start()]
            cell = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", cell)
            name = clean_title(html.unescape(re.sub(r"'{2,}|\{\{.*?\}\}", "", cell)).strip(" |"))
            if 2 <= len(name) <= 60 and not name.lower().startswith("file:"):
                out[name] = aka
    return out


def orangepippin():
    names = {}
    for f in glob.glob(os.path.join(CACHE, "op-?.html")):
        for slug, name in re.findall(r'href="[^"]*varieties/apples/([a-z0-9-]+)" itemprop="url">([^<]+)', open(f, encoding="utf-8", errors="replace").read()):
            names[html.unescape(name).strip()] = "https://www.orangepippin.com/varieties/apples/" + slug
    return names


def collections():
    out = {"nfc": set(), "abc": set(), "grin": set(), "refpop": set()}
    f = os.path.join(CHEM, "nfc", "NFC_C_E_data_Apple_22_08_25.csv")
    if os.path.exists(f):
        rows = csv.reader(open(f, encoding="utf-8-sig"))
        head = next(rows)
        col, typ = head.index("Accession Name"), head.index("Type")
        for r in rows:
            if len(r) > col and r[col].strip() and "rootstock" not in r[typ].lower():
                out["nfc"].add(r[col].strip())
    f = os.path.join(CHEM, "abc", "pheno_meta_data.csv")
    if os.path.exists(f):
        for r in csv.DictReader(open(f, encoding="utf-8")):
            if r["PLANTID"].strip() and (r.get("species") or "").lower() in ("", "domestica", "malus domestica", "m. domestica"):
                out["abc"].add(r["PLANTID"].strip())
    for f in glob.glob(os.path.join(CHEM, "grin", "grin_*.dat")):
        lines = open(f, encoding="utf-8", errors="replace").read().splitlines()
        for r in csv.DictReader(lines[2:]):
            n = (r.get("plant_name") or "").strip()
            if n and not re.match(r"^(PI|GMAL|MAL)\s*\d", n) and "malus" not in (r.get("taxon") or "").lower().replace("malus domestica", ""):
                out["grin"].add(re.sub(r"\s*\([^)]*\)$", "", n))
    try:
        import xlrd
        book = xlrd.open_workbook(os.path.join(CHEM, "refpop", "supp2020", "41438_2020_408_MOESM2_ESM.xls"))
        sh = book.sheet_by_index(0)
        for i in range(1, sh.nrows):
            n = str(sh.row_values(i)[3]).strip()
            if n:
                out["refpop"].add(re.sub(r"-(NL|IT|ES|CH|BE|FR|PL|DE)$", "", n))
    except Exception:
        pass
    return out


def heirloom_lists():
    """Names from the Temperate Orchard Conservancy (Botner collection PDF), Pomiferous and EURISCO."""
    out = {"toc": set(), "pomiferous": {}, "eurisco": set()}
    f = os.path.join(CACHE, "toc-BotnerAppleCollection.pdf")
    if os.path.exists(f):
        import fitz
        for page in fitz.open(f):
            for blk in page.get_text("dict")["blocks"]:
                for ln in blk.get("lines", []):
                    t = re.sub(r"\s+", " ", "".join(s["text"] for s in ln["spans"])).strip()
                    if t and not re.search(r"P a g e|Botner Collection|^[\d\s.()-]+$", t):
                        out["toc"].add(t)
    for f in glob.glob(os.path.join(CACHE, "pomiferous", "*.html")):
        raw = open(f, "rb").read()
        # each card: <h3 ...>Name</h3> ... the card's own "Learn more" link; some titles are Windows-1252, not UTF-8
        for title, link, slug in re.findall(rb'<h3 class="text-lg[^>]*>\s*([^<]+?)\s*</h3>.*?applebyname/(([a-z0-9-]+)-id-\d+)" type="button"', raw, re.S):
            try:
                name = title.decode("utf-8")
            except UnicodeDecodeError:
                name = title.decode("cp1252", errors="replace")
            name = re.sub(r"^R[FD]:\s*", "", html.unescape(name).strip())          # "RF:" = their red-flesh group
            name = re.sub(r"\s*>{2,}.*$", "", name)                                 # "Northwood >>>>>cider"
            name = re.sub("(\\w)�(s\\b)", r"\1'\2", name)
            if "�" in name:                       # an accent lost on their side: the link slug spells it plainly
                name = slug.decode().replace("-", " ").title()
            out["pomiferous"][name] = "https://pomiferous.com/applebyname/" + link.decode()
    f = os.path.join(CACHE, "eurisco-malus.csv")
    if os.path.exists(f):
        text = open(f, encoding="utf-8-sig", errors="replace").read()
        rows = csv.DictReader(text.splitlines(), dialect=csv.Sniffer().sniff(text[:5000], delimiters=",;\t"))
        for r in rows:
            r = {k.strip().upper(): (v or "").strip() for k, v in r.items() if k}
            status = r.get("SAMPSTAT") or r.get("BIOLOGICAL STATUS") or ""
            if status and not re.match(r"^(3|4|5)\d\d|cultivar|landrace|breeding", status, re.I):
                continue                         # wild material and unknowns are not cultivar names
            for n in re.split(r"\s*;\s*", r.get("ACCENAME") or r.get("ACCESSION NAME") or ""):
                if n and not re.match(r"^[\d\s/.-]+$", n):
                    out["eurisco"].add(n)
    return out


SKIP = {
    "Starking": "a red sport of Red Delicious",
    "Goldspur Golden Delicious": "a spur sport of Golden Delicious",
    "Empress Spur Golden Delicious": "a spur sport of Golden Delicious",
    "Red Dougherty": "a red sport of Dougherty (Dougherty itself is added)",
    "Jonared": "a red sport of Jonathan",
    "Antonovka Kamenichka": "a strain of Antonovka",
    "Ó:IASE": "not a cultivar name",
    "Mulga": "an insect gall on the mulga tree (Acacia aneura), not an apple",
}
RENAME = {
    "Melon American": "Melon", "Surprise Reinette": "Surprise", "Boiken (cs. Boikovo)": "Boiken",
    "Dukat Spur type": "Dukat", "Ontario (4x 2-4-4)": "Ontario", "Rambo-Red Summer": "Summer Rambo",
    "Splendour/Splendor": "Splendour", "Summer Pearmain American": "American Summer Pearmain",
    "Spigold (LA 68A)": "Spigold", "Delgollune (syn Jubile)": "Delbard Jubilée", "Oliver or Senator": "Oliver",
    "Spencer Seedless": "Spencer Seedless", "Dougherty/Red Dougherty": "Dougherty", "Lady": "Lady (Api)",
}
PER_BATCH = 20


def write_batches(missing):
    # the 0007 rule, scored on the original lists only (the heirloom lists of 0008 have their own report)
    for m in missing:
        m["score0"] = sum(WEIGHT[s] for s in m["sources"] if s not in HEIRLOOM)
    pick = [m for m in missing if (m["score0"] >= 4 or (m["score0"] == 3 and "wikipedia-article" in m["sources"]))
            and m["name"] not in SKIP]
    seen, items = set(), []
    for m in pick:
        name = RENAME.get(m["name"], m["name"])
        vid = re.sub(r"[^a-z0-9]+", "-", re.sub(r"['’`]", "", norm(name.replace("(", " ").replace(")", " ")))).strip("-")
        if vid in seen:
            continue
        seen.add(vid)
        items.append({"id": vid, "name": name, "theme": "coverage", "keepers": False, "aka_hint": m["aka"][:4],
                      "listed_in": m["sources"], "ref": m["url"]})
    ids_path = os.path.join(ROOT, "research", "all_ids.json")
    allids = json.load(open(ids_path, encoding="utf-8"))
    known = {e["id"] for e in allids}
    items = [i for i in items if i["id"] not in known]
    for n in range(0, len(items), PER_BATCH):
        bid = "coverage-%d" % (n // PER_BATCH + 1)
        chunk = items[n:n + PER_BATCH]
        json.dump({"batch": bid, "theme": "coverage", "count": len(chunk), "varieties": chunk},
                  open(os.path.join(ROOT, "research", "batches", bid + ".json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    allids += [{k: i[k] for k in ("id", "name", "theme", "keepers")} for i in items]
    json.dump(allids, open(ids_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print("wrote %d coverage batches, %d varieties" % ((len(items) + PER_BATCH - 1) // PER_BATCH, len(items)))


def main():
    if "--fetch" in sys.argv:
        fetch()
    vs = []
    for f in sorted(glob.glob(os.path.join(ROOT, "data", "varieties", "*.json"))):
        vs += json.load(open(f, encoding="utf-8"))
    have = {}
    for v in vs:
        for n in [v["name"]] + (v.get("aka") or []):
            have.setdefault(norm(n), v["id"])
            have.setdefault("~" + norm_loose(n), v["id"])

    def ours(n):
        return have.get(norm(n)) or have.get("~" + norm_loose(n))

    cand = {}          # key -> {name, aka:set, src:set, url}

    def add(name, src, aka=(), url=None):
        name = clean_title(re.sub(r"\s*\((3n|2n|4n|\d+x|triploid|tetraploid|[A-Z][a-z]+)\)\s*$", "", name))
        if not name or NOT_CULTIVAR.match(name) or re.match(r"^[A-Z]{1,4}[ -]?\d", name):
            return
        k = norm_loose(name)
        c = cand.setdefault(k, {"name": name, "aka": set(), "src": set(), "url": None})
        c["src"].add(src)
        c["aka"].update(a for a in aka if a)
        if url and not c["url"]:
            c["url"] = url

    titles = json.load(open(os.path.join(CACHE, "wiki-articles.json"), encoding="utf-8"))
    for t in titles:
        add(t, "wikipedia-article", url="https://en.wikipedia.org/wiki/" + urllib.parse.quote(t.replace(" ", "_")))
    for n, aka in wiki_list().items():
        add(n, "wikipedia-list", aka)
    for n, url in orangepippin().items():
        add(n, "orangepippin", url=url)
    for src, names in collections().items():
        for n in names:
            add(n, src)
    for src, names in heirloom_lists().items():
        for n in names:
            add(n, src, url=names[n] if isinstance(names, dict) else None)
    # merge a candidate into another when one's synonym is the other's name
    for k, c in list(cand.items()):
        for a in c["aka"]:
            k2 = norm_loose(a)
            if k2 in cand and k2 != k and k in cand:
                cand[k]["src"] |= cand[k2]["src"]
                cand[k]["url"] = cand[k]["url"] or cand[k2]["url"]
                del cand[k2]
    # "Paula Red" = "Paulared": merge names that differ only by spaces
    nospace = {}
    for k in list(cand):
        k0 = k.replace(" ", "")
        if k0 in nospace and nospace[k0] in cand:
            keep = nospace[k0]
            cand[keep]["src"] |= cand[k]["src"]
            cand[keep]["url"] = cand[keep]["url"] or cand[k]["url"]
            del cand[k]
        else:
            nospace[k0] = k
    # a one-word name that starts exactly one longer name is that apple's short form ("Karmijn" = Karmijn de Sonnaville)
    for k in [k for k in cand if " " not in k and len(k) >= 5]:
        longer = [k2 for k2 in cand if k2.startswith(k + " ")]
        if len(longer) == 1 and k in cand and not ours(cand[k]["name"]):
            cand[longer[0]]["src"] |= cand[k]["src"]
            del cand[k]
    missing = []
    for k, c in cand.items():
        if ours(c["name"]) or any(ours(a) for a in c["aka"]):
            continue
        score = sum(WEIGHT[s] for s in c["src"])
        missing.append({"name": c["name"], "aka": sorted(c["aka"]), "score": score, "sources": sorted(c["src"]), "url": c["url"]})
    missing.sort(key=lambda m: (-m["score"], m["name"].lower()))
    total_lists = {s: sum(1 for c in cand.values() if s in c["src"]) for s in WEIGHT}
    covered = {s: sum(1 for c in cand.values() if s in c["src"] and (ours(c["name"]) or any(ours(a) for a in c["aka"]))) for s in WEIGHT}
    json.dump({"lists": total_lists, "covered": covered, "missing": missing}, open(os.path.join(ROOT, "research", "coverage-gaps.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    L = ["# Coverage gaps\n", "Generated by `tools/coverage_gaps.py`. Score: Wikipedia article 2, each other list 1 "
         "(Wikipedia list, Orange Pippin, National Fruit Collection, ABC, USDA Geneva, REFPOP, and since decision 0008 "
         "the Temperate Orchard Conservancy, Pomiferous and EURISCO; see research/heirloom-gaps.md for those).\n",
         "| List | names | already in the atlas |", "|---|---|---|"]
    L += ["| %s | %d | %d (%d%%) |" % (s, total_lists[s], covered[s], round(100 * covered[s] / max(1, total_lists[s]))) for s in WEIGHT]
    for lo, title in ((5, "Score 5+ (on most lists)"), (4, "Score 4"), (3, "Score 3")):
        rows = [m for m in missing if (m["score"] >= lo if lo == 5 else m["score"] == lo)]
        L.append("\n## %s: %d\n" % (title, len(rows)))
        L.append(", ".join("%s%s" % (m["name"], " (%s)" % ", ".join(m["aka"][:2]) if m["aka"] else "") for m in rows))
    open(os.path.join(ROOT, "research", "coverage-gaps.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")
    print("lists:", total_lists)
    print("covered:", covered)
    for lo in (6, 5, 4, 3):
        print("missing with score >= %d: %d" % (lo, sum(1 for m in missing if m["score"] >= lo)))
    if "--batches" in sys.argv:
        write_batches(missing)


if __name__ == "__main__":
    main()
