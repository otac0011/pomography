# Brief for rootstock-research agents (Pomona)

Write detailed, accurate records for **apple** rootstocks. The site lets users compare precocity, vigour,
disease resistance, soil and climate tolerance, and recommends rootstocks for a clicked place on a map.
Accuracy beats completeness: use `null` for anything you cannot ground, and lower `conf`.

Write `data/rootstocks/<batch>-a.json`, `-b.json`, ... (**at most 8 records per file**, JSON arrays) with the
Write tool (no shell heredocs). Validate with:

    python tools/validate_rootstocks.py "data/rootstocks/<batch>-*.json"

## Record

```jsonc
{
  "id": "m9",                          // slug: lowercase, digits, hyphens (M.9 -> m9, MM.106 -> mm106, G.41 -> g41, B.9 -> b9, Pajam 2 -> pajam-2)
  "name": "M.9",
  "aka": ["Malling 9", "EMLA 9"],
  "clones": ["T337 (Netherlands)", "Pajam 2 (France)", "Nic29 (Belgium)"],   // virus-free clones / selections in common use, or []
  "series": "Malling",                 // Malling | Malling-Merton | Budagovsky | Polish | Geneva | Swedish | Canadian | German | Japanese | Seedling | Other
  "origin": {"country": "GB", "place": "East Malling Research Station, Kent", "year": 1917,
             "parentage": "selected from a French 'Jaune de Metz' paradise stock", "note": "..." },   // parentage/note may be null
  "size_class": "dwarf",               // very-dwarf | dwarf | semi-dwarf | semi-vigorous | vigorous | very-vigorous
  "size_pct_standard": [25, 35],       // typical % of seedling-standard tree size [low, high] on average soil
  "height_m": [2.0, 3.0],              // typical mature height in metres, garden/orchard trees
  "spacing_m": [1.0, 1.5],             // typical in-row spacing in metres for trained trees (null if unknown)
  "vigor": 2,                          // 1 very dwarfing ... 5 very vigorous
  "precocity": 5,                      // 1 slow (6+ yr to first fruit) ... 5 very early (crop in year 2)
  "first_crop_years": [2, 3],          // typical years from planting a maiden to first useful crop
  "yield_efficiency": 5,               // 1 ... 5, crop per unit tree size once established
  "fruit_size_effect": 4,              // 1 ... 5 (5 = promotes large fruit)
  "anchorage": 1,                      // 1 very poor (permanent stake/trellis) ... 5 excellent (free-standing)
  "support": "Permanent stake or trellis for life",
  "suckering": 2,                      // 1 none ... 5 heavy
  "burr_knots": 4,                     // 1 none ... 5 severe (aerial root initials; harbour borers & canker)
  "susceptibility": {                  // 1 = resistant / immune, 5 = very susceptible; null unknown
    "fire_blight": 5,                  // rootstock blight (can kill tree from rootstock infection)
    "collar_rot": 4,                   // Phytophthora collar/crown rot in wet soil
    "woolly_aphid": 4,                 // root-colony woolly apple aphid
    "crown_gall": 3,
    "powdery_mildew": 3
  },
  "tolerance": {                       // 1 poor ... 5 excellent; null unknown
    "cold": 2,                         // root/winter hardiness
    "drought": 2,
    "wet_soil": 2,                     // waterlogging
    "poor_soil": 1,                    // low fertility, stony, grass competition
    "heavy_soil": 3,
    "replant": 2                       // tolerance of apple replant disease
  },
  "hardiness_zone": 5,                 // USDA zone the rootstock is considered safe in (3 very hardy ... 8)
  "uk_availability": "common",         // common | specialist | rare | not-available   (UK nurseries)
  "soil_notes": "needs fertile, well-drained, weed-free soil; stake permanently; irrigate in dry spells",
  "best_for": "small gardens, cordons, espaliers, stepovers, containers on good soil",
  "avoid_when": "poor/dry/grassed ground, cold-winter zones 4-, fire-blight regions",
  "variety_fit": "Pairs well with vigorous or biennial tip-bearers; weak varieties (e.g. Ashmead's Kernel) can be under-vigorous.",
  "notes": "2-3 sentences of the key facts a grower needs; own words.",
  "conf": "high"                       // high | medium | low
}
```

## Rules

* Own words; do not copy. Keepers Nursery's text is copyrighted: do not read or copy it. Good sources:
  Cornell / Geneva Rootstock pages (Cornell University "Geneva rootstocks"), WSU Tree Fruit, Michigan State,
  Penn State, UMN, Univ. of Maine, Agriculture Canada, East Malling Trust / NIAB EMR, Brogdale / RHS.
* Some measures vary by region/soil; give the typical consensus and mention major variability in `notes`.
* A hardiness number must reflect documented winter injury experience (M.9 and M.26 are known for being
  tender in severe winters; Budagovsky and Ottawa stocks are hardy; G.41 and G.935 are hardy-ish).
* Fire blight: M.9 and M.26 are very susceptible; G.11, G.41, G.935, G.210 are resistant/immune to most strains.
* Include only genuine rootstocks. Note clones (T337, Pajam, Nic29) in the parent record rather than adding
  new records, except where a separate commonly sold stock exists (e.g. Pajam 1 vs Pajam 2).
* Your batch file `research/rootstock_batches/<batch>.txt` lists the ids and names to write.

Reply with a short report (<150 words): files, validator result, low-confidence ids, anything dropped.
