# Library: public-domain pomology books

Complete texts of classic apple books, all out of copyright, kept here so every quotation on the site can be checked
against the original and new questions can be answered later without going back to the web.

| key | book | text |
|---|---|---|
| `hogg-1851` | Robert Hogg, *British Pomology: The Apple* (1851) | Project Gutenberg #47367 (proof-read) |
| `hogg-1884` | Robert Hogg, *The Fruit Manual*, 5th ed. (1884) | Internet Archive OCR |
| `herefordshire-pomona-1`, `-2` | Hogg & Bull (eds.), *The Herefordshire Pomona* (1876-1885) | Internet Archive OCR |
| `bunyard-1920` | Edward A. Bunyard, *A Handbook of Hardy Fruits: Apples and Pears* (1920) | Internet Archive OCR |
| `lindley-1831` | George Lindley, *A Guide to the Orchard and Fruit Garden* (1831) | Internet Archive OCR |
| `beach-1905-1`, `-2` | S. A. Beach, *The Apples of New York* (1905) | Internet Archive OCR |
| `downing-1900` | A. J. & C. Downing, *The Fruits and Fruit-Trees of America* (rev. 1900) | Internet Archive OCR |
| `warder-1867` | J. A. Warder, *American Pomology: Apples* (1867) | Project Gutenberg #37596 |
| `ragan-1905` | W. H. Ragan, *Nomenclature of the Apple* (USDA Bulletin 56, 1905) | Internet Archive OCR |
| `leroy-3`, `-4` | André Leroy, *Dictionnaire de pomologie*, vols. 3-4: Pommes (1873, French) | Internet Archive OCR |

* `books.json` - the catalogue (author, year, archive.org and Gutenberg links), read by the build.
* `text/` - plain text, committed. OCR text has errors: always check a quotation against the scan.
* `pdf/` - the page scans (~520 MB), **not committed** (git-ignored). Recreate with `python tools/fetch_library.py`
  (add `--text` for text only). Everything is resumable.

How the books are used: `tools/locate_library.py` proposes where each of our varieties is described;
research agents confirm the entries per `research/LIBRARY_BRIEF.md` and record them in `data/historic/<key>.json`
(line range + verbatim flavour, quality, keeping and situation quotes, checked by `tools/validate_historic.py`).
`tools/build.py` turns those into the "In the old books" section of each variety page (assets/flavour.json).

Wanted but not found as a free full text: Bunyard's *The Anatomy of Dessert* (1929; public domain in the US since
2025 and in the UK since 2010) - only a lending copy of a 2006 reprint is on archive.org.
