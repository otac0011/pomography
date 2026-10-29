# 0011 - Statesville, NC and detailed place profiles

Date: 2026-10-29. Status: accepted.

## Context (user request)
"Can you research Statesville NC and put that on a map and have lots of data for it. You might need to do extra
research." Asked which kind of map, the user chose a Pomography reference place.

## Decisions
1. **Statesville is reference place 136** (`statesville`, 35.78 N, -80.89 W, kind `heritage`). Its weather was fetched
   (ERA5 2015-2024 plus the humidity record) and baked like the others, so it is a solid dot with every tab, and it
   has the usual five notes in `data/regions/statesville.json`.
2. **Detailed place profiles.** "Lots of data" did not fit the five short note fields, so a place can now have
   `data/places/<id>.json`: `facts` (label, value, source), `sections` (title, intro, items with optional apple
   `name` and `url`) and `sources`. `tools/build.py` validates it (`validate_profile`), links item names to atlas
   apples, collects every source URL, and writes `assets/places/<id>.json`, which the Local tab loads only when it is
   opened. That keeps `assets/data.json` small however many places get profiles.
   *Rejected:* adding the fields to `data.json` (every page would download every profile); free HTML (no validation,
   and no per-line sources).
3. **Sources.** Gathered by a research agent (`research/statesville/findings.json`, with uncertain items marked) from
   NOAA 1991-2020 normals (Statesville 2 NNE), USDA soil series descriptions, the Horne Creek Farm Southern Heritage
   Apple Orchard index, NC State Extension and county centres, and local orchard pages. The profile is in our own
   words and every line links its source; items the agent could only see in search snippets say so. Things it could
   not source (deer, Japanese beetle, oriental fruit moth in Piedmont apples, Statesville fruit-tree nurseries,
   Statesville apple shipping) are listed as not sourced rather than guessed.

## What the model and the records say
| | Pomography (ERA5 cell) | NOAA station normals |
|---|---|---|
| Last spring frost | ~Apr 11 | Apr 16 (median) |
| Rain a year | 1,188 mm | 1,185 mm |
| Zone | 8a (coldest night of a typical winter ≈ -11 °C) | 8a on the 2023 USDA map |

## Open questions
* **Bloom and ripening look early here.** The model puts mid-season bloom at Mar 17 and frost at blossom in 80 % of
  years; NC State says Piedmont apples bloom with the dogwoods, usually in early April. Late apples also come out
  early (Arkansas Black ~Sep 13; it is a late October apple in the South). Both come from the bloom rule (220 GDD
  above 5 °C from 1 Feb, calibrated in Europe) and the heat-shortened days after bloom (0006). The same bias was
  noted for the southern hemisphere. Worth recalibrating against southern US bloom records before trusting the
  frost-risk and harvest dates here.
* Most of the local heirlooms (Red Potts, Phifer, Vandevere June, McLean...) are not in the atlas yet.
