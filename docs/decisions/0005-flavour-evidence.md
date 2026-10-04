# 0005 - Flavour evidence: books, sources, measurements, vocabulary, tastings

Date: 2026-10-04. Status: accepted.

## Context (user request)
"What other things can we do to get good and accurate descriptions of flavors of apples?" Seven ideas were proposed and
the user asked for all of them, and for the public-domain books to be downloaded whole "so we can reference them later".
Until now the taste tags (rose, pear-drop, nutty ...) came from research agents reading a few web pages, with one
verification pass; nothing on the site said where a note came from, and web descriptions copy each other.

## Decisions

### 1. A local library of public-domain pomologies
`library/` holds the complete texts (committed, ~17 MB) and scans (git-ignored, ~520 MB) of Hogg 1851 and 1884, the
Herefordshire Pomona, Bunyard 1920, Lindley 1831, Beach 1905, Downing 1900, Warder 1867, Ragan 1905 and Leroy 1873
(apples). Gutenberg's proof-read text is used where it exists, otherwise Internet Archive OCR. `tools/fetch_library.py`
re-downloads everything. *Not found:* Bunyard's *Anatomy of Dessert* (1929) as a free full text.

Finding entries: `tools/locate_library.py` proposes candidate headings (lines that start with a name or synonym,
scored up for capitals), then one research agent per book confirms the real entry, its extent and identity (homonyms:
"Golden Pippin", "Nonpareil", "Hagloe" are different apples in different books) and records verbatim quotes. Because the
books are out of copyright the site quotes them directly and shows the full entry.
`tools/validate_historic.py` rejects any quote whose words are not in the entry's line range - the guard against
invented quotations. *Rejected:* automatic extraction alone (OCR headings are too irregular; homonyms need judgement);
page numbers (OCR running heads are too patchy - links use archive.org's in-book search instead).

### 2. Evidence counts per tag
Each tag's support is the set of **independent** sources using the word or a defined synonym. One author is one voice
(Hogg's three works count once; Beach's two volumes once; a website once per organisation). Levels shown on every tag:
3+ firm, 2 supported, 1 reported, 0 unchecked. Rules (`tools/flavour.py`):
* keep a tag supported by at least one source;
* drop it ("not confirmed") when the variety has 2+ sources **including a modern one** and none supports it - the old
  books do not use words such as "pear-drop", so their silence alone is not evidence;
* drop it as contested when more sources contradict it than support it (two contradictions, or one once a modern
  source was checked) - a lone Victorian "subacid" against our "sharp" is not enough;
* add a tag we lacked when 2+ independent sources agree.
Our record files are not rewritten: the build applies the rules, so new evidence re-evaluates every tag.
*Rejected:* deleting unsourced tags outright (absence of a mention is weak evidence); weighting sources by reputation
(unmeasurable here).

### 3. Modern sources
Orange Pippin, Wikipedia, the National Fruit Collection and independent nurseries / universities, read by agents per
`research/EVIDENCE_BRIEF.md`; only the source's own short words and the mapped tags are stored (no copied sentences).
**Keepers Nursery is excluded** until they give permission (their copyright statement; see step 6).

### 4. Measured sugar and acidity
Open datasets of soluble solids (°Brix) and titratable acidity (g/L malic) per cultivar, matched to our ids
(`tools/import_chemistry.py` -> `data/chemistry/<source>.json`). Labs measure at different ripeness and by different
methods, so values are shown raw and as **percentiles within each dataset**; the Flavour page plots sweet vs sharp
percentiles. Measurements at harvest under-state the sweetness of late keepers, which is stated on the page.

### 5. A defined vocabulary
`data/flavour_vocab.json`: for every tag, a plain definition, the synonyms that map to it (used by every research brief),
and the aroma compounds the literature links to it, with references. Shown on the Flavour page and as tooltips.

### 6. Context: storage, peak, climate
New per-variety fields from the sources: `storage_change`, `peak`, `climate_flavour {needs: cool|warm|any, note}`. The
world map adds an unscored "Flavour here" line: a cool-climate apple (Cox) in a place whose hottest month averages
>= 28 °C highs or has 10+ days at 32 °C is said to taste milder; a warm-season apple (Granny Smith) where the hottest month
averages < 22 °C highs may stay sharp. *Rejected:* scoring flavour into the suitability number (too uncertain).

### 7. People: tastings and outreach
* Visitors report tastings through a GitHub issue form (`.github/ISSUE_TEMPLATE/taste-report.yml`, label
  `taste-report`), linked from every variety. `tools/import_tastings.py` (nightly GitHub Action
  `.github/workflows/tastings.yml`) aggregates them into `data/tastings.json`; a summary appears after **3** reports.
  Moderation: close with `invalid` / `spam`. *Rejected:* a hosted database (needs a server or accounts we do not have).
* Draft letters to Keepers Nursery (permission to cite their tasting notes as tags + one short quote) and to the National
  Fruit Collection (reuse of tasting / quality records) are in `docs/outreach/`. They are for the owner to send.

### 8. Audit
`tools/flavour_audit.py` writes `docs/flavour-audit.md`: tags dropped / contested / added, varieties with no source,
single-source tags, and 1-5 sweet/acid scores that disagree with lab percentiles or the old books.

### 9. Expert tasting scores (found during the work)
The National Fruit Collection publishes its characterisation & evaluation data under the Open Government Licence
(doi:10.17864/1947.001455): sweetness, acidity, aroma, juiciness, eating quality on ECPGR 1-9 scales, each apple tasted
once at eating ripeness by one experienced assessor. Imported to `data/panel/nfc.json` (175 of our varieties) and
shown on variety pages. It counts as the same voice as the NFC's web pages, supports only the structural tags (sweet
>= 7, sharp >= 7, mild <= 3, perfumed if aroma >= 7), and does not count towards dropping a note - a 1-9 score cannot
say whether an apple tastes of pear-drop.

## Results (2026-10-04)
* Library: 12 book files, **776 entries** for **195** of our varieties (Hogg 1884: 114, Bunyard: 129, Downing: 120,
  Hogg 1851: 88, Herefordshire Pomona: 97, Lindley: 53, Beach: 75, Warder: 43, Leroy: 59), every quote machine-checked.
* Modern sources: all 425 varieties researched; **406** now have at least one independent source, 263 three or more.
* Tags: 297 firm, 311 supported, 300 reported, 39 unchecked; **192 added, 152 dropped (no support), 4 contested**.
* Lab data for **252** varieties (4 datasets), expert tasting scores for **175**.
* The user's own example: Cox's Orange Pippin's *rose-water, floral, pear-drop, honey* are not supported by any source
  we may use (Hogg: "a fine perfume and rich flavour"; Wikipedia: hints of cherry and anise). They are listed as "not
  confirmed" on the page. Keepers' notes may well support them; that is what the permission letter is for.
* Well-supported classics: Ananas Reinette pineapple (3), Pitmaston Pine Apple pineapple (3), Ross Nonpareil fennel (3),
  Worcester Pearmain strawberry (3), Ellison's Orange aniseed (3, estragole), Egremont Russet nutty (3).
* Validator lessons: OCR splits and run-together words made true quotes fail; `validate_historic.py` now accepts
  line-break hyphens, run-ons and 1-2 letter OCR corrections, and still rejects an invented quote (tested).
* Homonyms the agents caught (recorded in notes, not merged): English vs American Golden Russet, Hogg's King of the
  Pippins, Beach's Hagloe, Duck's Bill vs Winter Pearmain, Westfield vs English Seek-no-further, Royal Somerset vs London
  Pippin. Several of our `aka` lists merge distinct apples; worth a separate clean-up pass.

## Open questions
* Proposed new tags from the vocabulary research: green/grassy (strong case), fermented/solvent, cooked-apple.
* 63 sweet/acid 1-5 scores disagree with lab or panel data (`docs/flavour-audit.md`); review by hand rather than auto-correct.
* Origin conflicts surfaced: Hogg and Beach say Bismarck came from New Zealand (we say Australia); our 1937 date for
  Duck's Bill looks wrong.
