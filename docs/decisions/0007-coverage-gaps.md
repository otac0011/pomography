# 0007 - Coverage: finding the well-known apples the atlas was missing

Date: 2026-10-04. Status: accepted.

## Context (user request)
"I didn't see Karmijn de Sonnaville in the list. Can you make sure we're not missing too many varieties like that? Or did
I just miss it somehow?" It was genuinely missing. The atlas was seeded from Keepers Nursery's public category pages plus a
hand-picked list (0001), so its coverage of continental, North American, Scandinavian and modern breeding-programme apples
depended on what came to mind.

## Decisions

### 1. Measure coverage against independent lists, by name only
`tools/coverage_gaps.py` downloads (into `cache/coverage/`, git-ignored) and compares, accent-, case- and possessive-insensitively:
| List | Points | Names |
|---|---|---|
| has its own English Wikipedia article (category "Apple cultivars", two levels down) | 2 | 280 |
| Wikipedia "List of apple cultivars" tables (A-K, L-Z) | 1 | ~1,380 |
| Orange Pippin A-Z index | 1 | ~840 |
| UK National Fruit Collection accessions (Brogdale, from the OGL dataset already used in 0005) | 1 | ~2,070 |
| Apple Biodiversity Collection, USDA Geneva (GRIN), REFPOP (the lab datasets of 0005) | 1 each | 830 / 1,260 / 270 |
A name's score is a rough notability signal: on most lists = a well-known apple. Only names are read from these lists.
Merging rules: synonyms from Wikipedia's tables, names differing only by spaces ("Paula Red" = "Paulared"), parenthetical
suffixes ("(3n)", donor names), and a one-word name that starts exactly one longer name ("Karmijn" = Karmijn de Sonnaville).
*Rejected:* harvesting Keepers' ~800-name search page (their copyright terms, decision 0003: the owner decides before more
of their site is used); counting the old books as a list (they hold thousands of extinct apples).

### 2. What to add
Every missing name scoring 4+, plus score-3 names with their own Wikipedia article, minus sports and strains of apples
already present (Starking, Goldspur and Empress Spur Golden Delicious, Red Dougherty, Jonared, Antonovka Kamenichka) -
**200 apples** in `research/batches/coverage-1..10.json`; then the remaining apples with their own Wikipedia article
(`coverage-11`, 22). Researched by the usual brief (`research/BRIEF.md`) plus modern-source flavour evidence in the same
pass (`data/evidence/ev-c*.json`, `research/EVIDENCE_BRIEF.md`), then looked up in the library books (0005 method; new
entries are validated and merged with `tools/merge_historic.py`, so earlier reviewed entries are never overwritten).
The lab and NFC tasting imports are name-matched, so re-running them picked up the new apples
(`tools/library_varieties.py` now regenerates the shared name list they read).

### 3. Corrections found on the way
* "Monstrueuse du Canada" is the white Reinette du Canada's synonym (NFC), not the grey one's; "Aromatic Russet" is a
  separate English apple, not Fenouillet Gris (`research/patches/coverage-1.json`).
* Homonyms kept apart and noted in the records: Holland Pippin (Lincolnshire, NFC) vs the American Pie Apple; Eden
  (Quebec) vs Eden (English, NFC); Jubilee (Summerland, Canada) vs Delbard Jubilée vs Royal Jubilee; Champion (Czech
  Šampion) vs NFC "Champion" = Collins; Golden Sweet vs Northern Sweet; Surprise (red-fleshed) vs Surprise (Veitch).
* Foxwhelp is kept next to Foxwhelp (Broxwood), its sport, as for other sport/parent pairs.

* Detroit Black (Downing: a separate apple), September Beauty (Bunyard: a separate Laxton apple) and Kirton Pippin
  (Hogg: not Holland Pippin) were removed as synonyms; "Mulga" turned out to be an insect gall on an acacia, not an apple.

## Results (2026-10-04)
* **221 apples added** (425 -> 646). Of these, 216 have at least one independent flavour source (100 have 3+), 77 have
  entries in the old books (+190 quoted entries across 12 book files), 159 have lab sugar/acid data and 86 have NFC
  tasting scores; 94 are `conf: low` (mostly modern breeding-programme apples with little published).
* Atlas-wide: 622 of 646 varieties have a flavour source, 272 an old-book entry, 411 lab measurements.
* Coverage after the pass:
| List | before | after |
|---|---|---|
| own Wikipedia article (280) | 166 | 259 |
| Wikipedia list tables (~1,380) | 258 | 428 |
| Orange Pippin index (~840) | 328 | 449 |
| National Fruit Collection (~2,070) | 278 | 434 |
The 21 Wikipedia "apple cultivar" articles still unmatched are sports deliberately skipped, ornamental crabs, and
non-cultivar pages (a festival, an airport, a breeding programme, a company). Nothing scoring 6+ is missing; the five
5-point names left are the skipped sports.

## Open questions
* 217 names still score 3 (on three lists, no Wikipedia article): mostly North American breeding-programme selections
  and NFC accessions. Worth a second pass if the atlas should aim at "every apple a British or American nursery sells".
* Keepers Nursery's own search page lists ~800 apples; comparing names against it needs the owner's go-ahead (0003).
