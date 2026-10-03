# Brief for region-notes agents (Pomona)

Pomona's world map shows ~135 reference places as pins. For each place the site computes the climate
numbers itself from real weather data (chill hours, winter lows, frost at bloom, season length, rainfall
and disease pressure). **Your job is the human knowledge the numbers cannot give:** what apple growing is
really like there, written in your own words, so a hobby grower reading the panel learns something true.

You get `research/region_batches/<batch>.json` (list of regions with id, name, country, lat, lon, kind).
Write `data/regions/<batch>-a.json`, `-b.json`, ... **at most 12 regions per file**, each a JSON array of:

```jsonc
{
  "id": "south-michigan",           // exactly as given
  "summary": "2-3 sentences: what the climate is like FOR APPLES (chilling, lake/ocean influence, frost behaviour, summer heat, wetness). Qualitative only; do not quote exact temperatures or rainfall figures unless you are sure.",
  "apple_culture": "2-3 sentences: apple-growing history and character - commercial belt, cider tradition, heirloom collections, home-orchard culture, or why apples are rare/impossible here.",
  "local_varieties": ["Names of apples genuinely associated with this place or that local growers favour - real, well attested. 3-8 names, or [] if none."],
  "pests_diseases": "1-3 sentences: the regional issues that matter most (e.g. fire blight in warm wet springs, cedar-apple rust, apple maggot, codling moth, European canker in wet mild areas, bitter pit in dry soils, sunburn, fruit flies, woolly aphid). Only ones you are confident about.",
  "tips": "2-3 sentences of practical advice for a home grower: what to prioritise (low-chill types, late-flowering types, hardy rootstocks, shelter, irrigation, scab-resistant varieties, summer pruning ...).",
  "confidence": "high"            // high | medium | low  - how sure you are of the above
}
```

## Rules

* Own words. No copying from websites. Facts only if you are confident; use `confidence: "low"` and keep it
  short when you are not. For places where apples essentially cannot be grown (`kind: extreme`),
  say so plainly and say what *does* work (e.g. containers, hardy crabs, or "not realistic").
* Use `local_varieties` as free text - the exact names of real varieties. Do not invent names.
* Do not give climate statistics that the site computes (chill hours, GDD, exact frost counts).
* Be location-specific, not generic. Two nearby pins (e.g. Kent vs Norfolk) should read differently.
* Verify with a quick search if you are not sure a variety/pest/tradition is real for that place.
* Do NOT use shell heredocs to write; use the Write tool. Absolute paths under C:\GIT\pomona.

Validate:   python tools/validate_regions.py "data/regions/<batch>-*.json" --batch research/region_batches/<batch>.json

Reply with a short report (<150 words): files, validator result, any low-confidence regions.
