# 0008 - Heirloom gaps: the Temperate Orchard Conservancy, Pomiferous and EURISCO

Date: 2026-10-04. Status: accepted (EURISCO part pending).

## Context (user request)
"Is there any online database or list of trees? I am especially interested in heirloom varieties", then "run the heirloom
gap check with Temperate Orchard Conservancy list, EURISCO and Pomiferous". Decision 0007 measured coverage against lists
of *well-known* apples. These three hold thousands of old apples, so they answer a different question: which heirlooms
that people still grow, collect or describe are missing?

## Decisions

### 1. Same method as 0007: names only
`tools/coverage_gaps.py --fetch` now also downloads:
| List | How | Names |
|---|---|---|
| Temperate Orchard Conservancy (Oregon): the Botner collection list, `BotnerAppleCollection.pdf` | PDF text, one name a line | 4,160 |
| Pomiferous (a database built from George's unpublished encyclopaedia, ~8,000 entries) | its twelve "apples by use" lists, 30 per page, one page every 2 s (no A-Z index exists) | 4,348 |
| EURISCO (European genebank catalogue, 39,142 *Malus* accessions) | no plain download URL; the export has to be made in its web app | pending |

Only names (and Pomiferous's page links) are read. EURISCO's terms allow use with credit
("EURISCO Catalogue, http://eurisco.ecpgr.org, date of consultation"), noted in NOTICE.md. The TOC's newer scion lists
(2017-2021 PDFs) are scanned images and were not read; the Botner list covers the same collection.
*Rejected:* fetching all ~8,000 Pomiferous pages one by one (heavy on a small site, and the by-use lists already reach
about 4,350 names); Keepers Nursery's search page (still not for now, 0003).

### 2. A separate report, ranked by evidence
`tools/heirloom_gaps.py` writes `research/heirloom-gaps.md` / `.json`: every name on at least one heirloom list and
not in the atlas, with
* the other lists it is on (Wikipedia, Orange Pippin, NFC, ABC, GRIN, REFPOP), and
* the old books in `library/text` (1831-1920) that have an entry for it: a line opening with the name, or with the name
  in capitals for one-word names ("HARVEY."), the way those books head their entries. A plain phrase search was tried
  first and rejected: common names (Harvey, Holland, Murray) turned up in running text everywhere.
Sports and strains (the 0007 SKIP list, "Spur", "Double Red", "... Delicious") are dropped.
Tiers: **A** = on 3+ lists and in an old book; **B** = on 3+ lists, or on 2 and in an old book; **C** = the rest.

### 3. 0007's selection rule is unchanged
Adding three lists raises every score, so `--batches` now scores the 0007 rule on the original lists only (`score0`).

## Results (2026-10-04, without EURISCO)
* The atlas holds 518 of the TOC names and 609 of the Pomiferous names (allowing for synonyms and spelling).
* 6,453 heirloom-list names are missing: **232 tier A**, 935 tier B, 5,286 tier C. 967 have an old-book entry.
* Tier A is mostly classic English and American heirlooms, e.g. Fameuse (Snow Apple), Court of Wick, Herefordshire
  Pearmain, Northern Greening, Yorkshire Greening, Red Canada, Summer Rose, Early Joe, Hoary Morning, Carolina Red June,
  Coe's Golden Drop, Lord Burghley.
* Tier C is long and noisy: TOC names include unnamed seedlings and misspellings ("Aspirn", "Angolle Gis"), and one-list
  names cannot be checked for synonyms.

## Open questions
* Add tier A (232) through the usual research brief? Tier B only after a synonym check, since many are probably
  spelling variants of apples already in the atlas.
* EURISCO: the export needs rows ticked and a browser download. Once saved as `cache/coverage/eurisco-malus.csv`
  (accession names; wild material is filtered out by biological status), re-running both tools adds it.
* Book matching misses Ragan 1905 (a nomenclature list in a different layout) and mostly Leroy (French names).
