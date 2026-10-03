# 0001 - Architecture and data policy

Date: 2026-10-03. Status: accepted.

## Context

The request: a GitHub Pages site holding every heirloom apple variety, focused on the range of Keepers Nursery
(East Farleigh, Kent; Karim Habibi), with taste (e.g. Cox's rose-water and pear-drop notes, vanilla in some),
growing habit, rootstock information (precocity, vigour, disease resistance...), and a clickable world map
that scores the user's favourite varieties against the climate of any clicked place (southern Michigan,
Norfolk UK, Paris...) with reasons.

## Decisions

### 1. Static site, no build step for the front end, a Python build for data
Plain ES modules + hash router, Leaflet from cdnjs. Same shape as the sibling projects (Sigil, Redox): GitHub
Pages serves the repo root. Node is not installed on this machine, so there is no bundler; Python 3
(stdlib only) merges and validates data (`tools/build.py` -> `assets/data.json`).
*Rejected:* a framework/bundler (nothing needs it, would add a toolchain to a machine without Node);
a server API (Pages is static).

### 2. Keepers' website is used only to choose coverage, never as a content source
`keepers-nursery.co.uk/helpdesk/customer-services/copyright` says their articles, descriptions and
"fruit tree database" are copyright and may not be copied or adapted (short attributed quotations allowed).
So: variety **names** from their public category pages (216 across early/mid/late/cooking/cider/crab) are the
seed list and drive the "Keepers" badge and a link out; **every description, number and note was researched
from other sources and written in our own words** (agents were told not to read the Keepers site at all).
Their search page advertises ~800 apple varieties in their graft-to-order list; we deliberately did **not**
harvest it (database right; and the research budget is better spent on accuracy). The other ~200 varieties are
hand-picked heritage / world / commercial apples so the atlas is useful beyond one nursery. Two records
(monidel, st-helens) were written by an agent that read the Keepers page only to identify the variety;
they are flagged for review (see 0003).
*Open question:* ask Keepers whether they would license their data (the page offers to discuss); that would let
us cover the whole 600-variety collection properly.

### 3. Honest data model: nulls and a confidence level instead of plausible guesses
Every field may be `null` ("not recorded" in the UI). Each variety carries `conf: high|medium|low`. Agents were
told that an obscure variety with many nulls beats a fabricated one. Flowering group uses the UK 1-7 system
(Cox = 3). Numbers that drive the climate engine (chill, hardiness zone, heat tolerance, harvest date) are
estimates for most varieties and are labelled as such.
*Rejected:* imputing missing fields from region or parentage (looks authoritative, is not).

### 4. Research by parallel agents, one batch per ~20 varieties, validated by schema
`tools/make_batches.py` -> `research/batches/*.json`; each agent follows `research/BRIEF.md` + `SCHEMA.md`,
writes <= 8 records per file, and must pass `tools/validate.py`. Rootstocks: `research/ROOTSTOCK_BRIEF.md`;
region notes: `research/REGION_BRIEF.md`. A pilot of two batches checked the pipeline before fan-out.
The session's WebSearch quota (200) was exhausted by the pilots/early agents, so later agents relied on
direct page fetches (National Fruit Collection, Orange Pippin, Wikipedia, Hogg 1884, Bunyard 1920).

### 5. Apple portraits are drawn, not photographed
Keepers' photographs are copyrighted and licensing is paid, so each variety gets a procedural SVG apple driven by
its recorded skin data (ground colour, blush colour/cover, stripes, russet, shape, size). Honest (it is
labelled as an illustration of the recorded colours), small, and works offline.

### 6. Favourites live in localStorage; share links carry ids in the URL
`#/map?f=id,id` adds those varieties to the visitor's favourites. No accounts, no server.

## Verification
`tests/index.html` (open via `python tools/serve.py`) runs unit tests for the climate engine, scoring and data
integrity; all must say PASS before committing.
