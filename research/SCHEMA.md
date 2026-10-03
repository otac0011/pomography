# Pomona variety record schema

One JSON object per variety. A data file is a JSON **array** of these objects
(`data/varieties/<batch>-<letter>.json`). `tools/validate.py` checks every file
against these rules; run it before you finish:

    python tools/validate.py data/varieties/<your files>

Unknown is allowed and **honest**. Use `null` for any scalar you cannot support, and `[]`
for lists. Never guess to fill a gap. Set `conf` to say how well-documented the variety is.

## Fields

```jsonc
{
  "id": "coxs-orange-pippin",        // given to you in the batch file; do not change
  "name": "Cox's Orange Pippin",     // display name, given to you
  "aka": ["Cox's Orange", "Cox"],    // synonyms / common short names (real ones only)
  "uses": ["dessert"],               // any of: dessert, culinary, cider, juice, crab, ornamental
  "origin": {
    "country": "GB",                 // ISO-3166 alpha-2 (GB, IE, FR, DE, US, CA, NZ ...). Use the country where it was raised.
    "place": "Colnbrook, Buckinghamshire, England",   // as specific as you can verify, else broader/null
    "year": 1825,                    // integer; approximate is fine, put "c." in year_note. null if unknown
    "year_note": "c.",               // "" , "c." (circa), "before" or "first recorded"
    "kind": "chance",                // chance | bred | ancient | sport | discovered | unknown
    "parentage": "Chance seedling, possibly of Ribston Pippin",  // or null. State uncertainty plainly.
    "raised_by": "Richard Cox"       // person/institution or null
  },
  "history": "1-3 sentences, your own words: who, where, notable facts.",
  "look": {
    "size": "medium",                // small | medium | large
    "shape": "round-flat",           // flat | round-flat | round | round-conical | conical | oblong | ribbed | irregular
    "ground": "yellow",              // green | yellow-green | yellow | gold | cream
    "blush": "orange-red",           // none | pink | orange | orange-red | red | deep-red | crimson | purple | brown
    "blush_cover": 70,               // integer 0-100, % of skin covered by blush colour
    "stripes": true,                 // blush is streaked/striped rather than solid
    "russet": 1,                     // 0 none | 1 dots/patches | 2 heavy patches | 3 fully russeted
    "description": "short phrase on the fruit's appearance, own words"
  },
  "taste": {
    "summary": "1-3 sentences describing flavour and texture, own words. Be specific (aromas, balance, how it changes in store).",
    "sweet": 4,                      // 1-5  (1 = tart ... 5 = very sweet)
    "acid": 3,                       // 1-5  (1 = bland ... 5 = very sharp)
    "aroma": 5,                      // 1-5  aromatic intensity/complexity (1 = plain, 5 = highly perfumed/complex)
    "tannin": 0,                     // 0-5  astringency/bitterness (cider bittersweets 3-5; most eating apples 0)
    "crisp": 3,                      // 1-5  1 = soft/melting/mealy, 5 = very hard-crisp
    "juicy": 4,                      // 1-5
    "tags": ["pear-drop", "floral"], // from the TASTE TAGS list below ONLY (0-8 tags; most characteristic first)
    "cider_class": null,             // sweet | bittersweet | sharp | bittersharp  (only for cider apples, else null)
    "best_eaten": "Oct-Dec; flavour peaks 2-4 weeks after picking"
  },
  "tree": {
    "vigor": 3,                      // 1 weak ... 5 very vigorous (as a tree on a typical semi-vigorous rootstock)
    "habit": "upright-spreading",    // upright | upright-spreading | spreading | weeping | columnar | compact
    "bearing": "spur",               // spur | tip | part-tip
    "cropping": "moderate",          // light | moderate | heavy
    "biennial": "slight",            // none | slight | marked   (tendency to crop alternate years)
    "precocity": 3,                  // 1 = slow (6+ yr to first crop) ... 5 = very early (crops in year 2-3)
    "ploidy": "diploid",             // diploid | triploid | tetraploid
    "notes": "growth habit quirks, pruning advice, anything a grower should know"
  },
  "pollination": {
    "flower_group": 3,               // UK flowering/pollination group 1-7 (1 earliest, 7 latest); null if unknown. Cox = 3.
    "self_fertile": "no",            // no | partial | yes
    "notes": "triploid varieties are poor pollen donors, etc."
  },
  "season": {
    "harvest": "late Sep",           // when picked in south-east England. Format: (early|mid|late) (Jul|Aug|Sep|Oct|Nov), a range "mid Sep-early Oct" is fine
    "eating": "Oct-Dec",             // when best to eat: month names (Aug, Sep ...), range "Oct-Jan"
    "storage_weeks": 10              // realistic cool-store keeping life, 1-40; null unknown
  },
  "climate": {
    "chill_hours": 1000,             // approx. winter chilling need in hours at or below 7.2 C (45 F); integer; null if you cannot estimate. Typical: low-chill 200-500, medium 600-900, high 1000-1300, very high 1300+
    "hardiness_zone": 5,             // coldest USDA zone it is reliably grown in (3 = very hardy ... 9 = tender); integer 2-10, null unknown
    "heat_tolerance": 2,             // 1 poor in hot summers (soft fruit, poor colour, sunburn) ... 5 excellent
    "colour_needs_cool_nights": true,// red blush fails to develop in warm nights?
    "best_climates": "where it excels (own words)",
    "poor_climates": "where it struggles and why (own words)"
  },
  "health": {                        // susceptibility: 1 = resistant/very tolerant, 3 = moderate, 5 = very susceptible; null unknown
    "scab": 3,
    "canker": 5,                     // European canker (Neonectria ditissima)
    "mildew": 3,                     // powdery mildew
    "fire_blight": 4,
    "rust": 3,                       // cedar-apple rust (N. America) -- null if unknown
    "bitter_pit": 2,                 // storage/calcium disorder
    "other": "notable weaknesses: aphids, russeting, cracking, sunburn, codling moth, bitter pit ..."
  },
  "grow_notes": "2-3 sentences of practical site/soil/pruning/pollinator advice in your own words",
  "conf": "high"                     // high | medium | low  (see below)
}
```

## Taste tags (use ONLY these, lowercase)

floral, rose, elderflower, perfumed, honey, vanilla, caramel, butterscotch, nutty, almond, walnut,
aniseed, fennel, spice, clove, cinnamon, pear-drop, pear, quince, pineapple, banana, melon, mango,
apricot, peach, lemon, citrus, strawberry, berry, cherry, grape, wine, herbal, tea, earthy, musky,
bitter, astringent, sharp, sweet, mild, savoury

Rules: use a tag only when the variety is reliably described that way by growers, tasting panels or
pomological sources. Cox's Orange Pippin is described as floral/rose, pear-drop/ester, honeyed;
Ananas Reinette pineapple; Ashmead's Kernel pear-drop, nutty and sharp; Egremont Russet nutty. "mild" =
low-acid, low-aroma blandness. 3-5 tags is the sweet spot.

## Confidence (`conf`)

* `high`  - well documented; you verified the key facts (origin, season, pollination group, taste) from
  at least two independent sources or very strong knowledge. 
* `medium` - broadly documented but some fields are inferred from season/parentage.
* `low` - obscure; core facts (origin, uses, season) known but many fields null or inferred. Prefer fewer fields over invented ones.

## Honesty rules (the user cares about these)

1. Do NOT invent. If a number cannot be grounded, use `null` (the site displays "not recorded").
2. Do NOT copy sentences from any website (Keepers Nursery, Orange Pippin, Brogdale / National Fruit
   Collection, Wikipedia). Facts are free; their wording is not. Paraphrase everything.
3. Check for homonyms / synonyms (e.g. "Yellow Transparent" = "White Transparent" = "Skorospelka").
   If two requested names are the same variety, make one full record and set the other `aka`, tell the lead.
4. If a requested name is not a real variety or you cannot find it, return a stub with `conf: "low"` and
   mostly nulls, and report it in your final message.
5. Flowering group: UK system 1-7 (Cox 3, Bramley 3, Discovery 3, Golden Delicious 4, Granny Smith 5-6,
   Egremont Russet 3, Worcester Pearmain 3, Newton Wonder 4/5, Blenheim Orange 3 triploid). It is
   sometimes written A-H by nurseries; A = early ... ; convert to numbers (A=1 .. G=7, H=7).
6. Chill hours: published values are patchy and vary by model. Give your best estimate of hours <= 7.2 C
   and set `conf` accordingly. English cultivars (Cox, Bramley, Worcester) are roughly 900-1200. Anna / Dorsett
   Golden are ~250-400. Mark `conf: "low"` if the number is inferred from lineage or region of origin.
7. Hardiness zone: USDA zone number of the coldest area it is reliably grown. Most apples zone 4-5.
   Hardy Russian/prairie types 2-3. Tender or low-chill types 7-9.
