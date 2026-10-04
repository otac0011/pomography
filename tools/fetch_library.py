#!/usr/bin/env python3
"""Download the public-domain pomology books into library/ (resumable; skips files already present).

    python tools/fetch_library.py            # text + scanned PDF of every book
    python tools/fetch_library.py --text     # text only

Text (OCR from the Internet Archive, or the proof-read Project Gutenberg edition where one exists) goes to
library/text/<key>.txt and is committed; the page-image PDFs go to library/pdf/<key>.pdf and are git-ignored
(about 600 MB). library/books.json describes every book and is what tools/extract_library.py reads.
"""
import json, os, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.path.join(ROOT, "library")
IA = "https://archive.org/download/%s/%s"
GUT = "https://www.gutenberg.org/cache/epub/%d/pg%d.txt"

# key, author, year, title, archive.org identifier, Gutenberg id (preferred text), language, note
BOOKS = [
    ("hogg-1884", "Robert Hogg", 1884, "The Fruit Manual (5th edition)", "fruitmanualguide00hoggrich", None, "en",
     "The standard Victorian reference for British fruit; descriptions, synonyms and flavour of ~1,500 apples."),
    ("hogg-1851", "Robert Hogg", 1851, "British Pomology: The Apple", "britishpomologyo00hogg", 47367, "en",
     "Hogg's first, longer apple monograph."),
    ("herefordshire-pomona-1", "Robert Hogg & Henry Graves Bull (eds.)", 1876, "The Herefordshire Pomona, vol. 1",
     "herefordshirepo00bull", None, "en", "Coloured plates and long descriptions, strong on cider and old West Country apples."),
    ("herefordshire-pomona-2", "Robert Hogg & Henry Graves Bull (eds.)", 1885, "The Herefordshire Pomona, vol. 2",
     "herefordshirepo00bulla", None, "en", ""),
    ("bunyard-1920", "Edward A. Bunyard", 1920, "A Handbook of Hardy Fruits: Apples and Pears", "handbookofhardyf01bunyrich",
     None, "en", "Bunyard's tasting-led notes on the apples grown in Britain around 1920."),
    ("lindley-1831", "George Lindley", 1831, "A Guide to the Orchard and Fruit Garden", "guidetoorchardfr00lindrich",
     None, "en", "Late-Georgian English descriptions."),
    ("beach-1905-1", "S. A. Beach", 1905, "The Apples of New York, vol. 1", "applesofnewyork01beacrich", None, "en",
     "Detailed descriptions of the major North American apples (and many European ones) with flavour, quality and season."),
    ("beach-1905-2", "S. A. Beach", 1905, "The Apples of New York, vol. 2", "applesofnewyork02beacrich", None, "en",
     "Minor varieties."),
    ("downing-1900", "A. J. & Charles Downing", 1900, "The Fruits and Fruit-Trees of America (revised)", "fruitsfruittree00down",
     None, "en", "The standard 19th-century American catalogue."),
    ("warder-1867", "J. A. Warder", 1867, "American Pomology: Apples", "americanpomology00wardrich", 37596, "en", ""),
    ("ragan-1905", "W. H. Ragan", 1905, "Nomenclature of the Apple (USDA Bulletin 56)", "nomenclatureofap56raga", None, "en",
     "A catalogue of ~17,000 names and synonyms with short notes and the books they appear in; used for synonyms."),
    ("leroy-3", "André Leroy", 1873, "Dictionnaire de pomologie, vol. 3 (Pommes A-L)", "dictionnairedepo03lero", None, "fr",
     "French; history and taste of French and other European apples."),
    ("leroy-4", "André Leroy", 1873, "Dictionnaire de pomologie, vol. 4 (Pommes M-Z)", "dictionnairedepo04lero", None, "fr", ""),
]


def get(url, dest, tries=4):
    if os.path.exists(dest) and os.path.getsize(dest) > 1000:
        return "have"
    tmp = dest + ".part"
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "pomography-library/1.0 (one-off download)"})
            with urllib.request.urlopen(req, timeout=300) as r, open(tmp, "wb") as f:
                while True:
                    b = r.read(1 << 20)
                    if not b:
                        break
                    f.write(b)
            os.replace(tmp, dest)
            return "ok %.1f MB" % (os.path.getsize(dest) / 1e6)
        except Exception as e:  # noqa: BLE001
            print("   retry", k + 1, url, e)
            time.sleep(10 * (k + 1))
    return "FAILED"


def main():
    text_only = "--text" in sys.argv
    os.makedirs(os.path.join(LIB, "text"), exist_ok=True)
    os.makedirs(os.path.join(LIB, "pdf"), exist_ok=True)
    meta = []
    for key, author, year, title, ia, gut, lang, note in BOOKS:
        txt = os.path.join(LIB, "text", key + ".txt")
        src = GUT % (gut, gut) if gut else IA % (ia, ia + "_djvu.txt")
        print(key, "text:", get(src, txt))
        if not text_only:
            print(key, "pdf:", get(IA % (ia, ia + ".pdf"), os.path.join(LIB, "pdf", key + ".pdf")))
        meta.append({"key": key, "author": author, "year": year, "title": title, "lang": lang, "note": note,
                     "archive_org": "https://archive.org/details/" + ia,
                     "gutenberg": ("https://www.gutenberg.org/ebooks/%d" % gut) if gut else None,
                     "text": "library/text/%s.txt" % key, "text_source": "Project Gutenberg" if gut else "Internet Archive OCR"})
    json.dump(meta, open(os.path.join(LIB, "books.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main()
