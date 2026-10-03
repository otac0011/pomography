# 0004 - Click-anywhere analysis: humidity, regional factors, provenance and extrapolation

Date: 2026-10-03. Status: accepted.

## Context (user feedback)
"The map needs to not just be a couple of points where existing apple orchards are. People need to be able to click
anywhere ... have all known factors or extrapolated factors based on the areas around it, like chill hours where they
clicked, disease pressures there ... and note that it is assumed/extrapolated if there isn't anything for that exact spot.
Weather, humidity etc. can impact disease pressures, and local things like cedar-apple rust are regional."

Findings when this was investigated:
* Click-anywhere already worked in production (1-2 s live fetch; tested at Bilma in the Sahara, Siberia, Nepal, Mongolia),
  but the 135 reference dots were the only obvious affordance.
* The background weather download for those 135 places ran from the same IP as the user's browser and used ~90% of the
  free API allowance (5,000 units/h per IP). Live clicks from that machine were being rate-limited (HTTP 429) and fell
  back to the *nearest single dot*, however far away. That fits the report exactly.
* The model had real gaps: the Sahara scored Cox "Good" (heat and aridity were not critical); disease used rainfall days
  only (no humidity or leaf wetness); rust and fire blight were not separated from weather.

## Decisions

### 1. Provenance on every number
Five classes, shown as badges next to each value in the Climate tab ("Where each number comes from") and in the panel
banner: **measured** (counted from the weather record), **modelled** (apple index from measured weather), **regional**
(lookup by country/range), **assumed** (default), **extrapolated** (blended from neighbours). The banner states which class
the whole panel is in. *Rejected:* a single "approximate" disclaimer (does not tell the grower which numbers to trust).

### 2. Humidity and leaf wetness from measured dew points, not estimates
Disease pressure now runs on leaf wetness. Per day: hourly temperature from a cosine day; hourly RH from the day's dew
point; **dew hours = hours with RH >= 90%**; rain-wet hours from the measured *precipitation_hours* per wet day of the
month (+1.5 h drying); leaf wetness = max(dew, rain) + 25% of the smaller, capped at 24 h.
Dew point = Tmin - k with **k measured per calendar month** from a short ERA5 record (dew_point_2m_mean, 2022-2024; about 30
free-tier units per place). First attempt used the FAO-56 guess (k = 0 in humid, 2.5 C in arid climates); checked against
measured ERA5 at six sites it was badly off in dry-summer and continental places (Tmin minus dew point in July:
Wenatchee 6.3 C measured vs 1.9 estimated; Avignon 8.6 vs 2.2; Michigan 2.3 vs 0.0), which would have drowned Wenatchee in
leaf wetness. If the supplementary request fails, the FAO-56 estimate is used and flagged `humidity.estimated` (badge: assumed).

| Disease | Model | Calibration seen on baked sites |
|---|---|---|
| Apple scab | primary infection periods: runs of days with >= 7 h wetness whose accumulated hours reach **Mills' requirement** at the mean temperature (40 h at 2-4 C ... 9 h at 16-24 C, none above 28 or below 1 C), bloom-20 to bloom+60 d. Pressure = (events - 8) / 26 x temperature suitability | Wenatchee 11.6, S Michigan 20.6, Norfolk 24.3, Kent 25.9, Herefordshire 30.3, Somerset 30.9 events: the right order |
| Fire blight | **Maryblyt-style**: from 7 d before to 14 d after full bloom, count days with >= 110 degree-hours above 18.3 C accumulated since opening, daily mean >= 15.6 C and a wetting event (rain >= 0.25 mm or >= 6 dew hours). Pressure = events / 4; x0.1 where the country is fire-blight free | Minneapolis 4.9, S Michigan 3.0, Kent 0.7, Norfolk 0.0 events a year |
| Powdery mildew | fraction of bloom..+90 d with mean 10-25 C, no rain and night RH >= 60%. First version required RH >= 80% and scored Wenatchee 0, but mildew conidia germinate in fairly dry air and the disease is common in dry orchard districts | |
| European canker | wet days (>= 1 mm) with mean 2-16 C between 1 Oct and 31 Mar; pressure = (days - 25) / 60 | Kent 68, Herefordshire 73, Minneapolis 18 |
| Cedar-apple rust | present only inside the eastern-North-America polygon; pressure = scab-like wetness x 0.9 | |

### 3. Regional factors are lookups, kept separate from weather
`js/climate/regional.js`: fire blight by country (present / absent for Australia, Japan, Chile / unmapped -> treated as
present and said so), cedar-apple rust polygon (range of *Juniperus virginiana*), apple maggot and plum curculio regions,
codling moth everywhere, light brown apple moth in Australia and New Zealand. Country comes from the reverse geocoder
(BigDataCloud) or the reference-place table, with bounding boxes for Australia and Japan as an offline guess.
*Rejected:* inferring pest presence from climate (would invent facts); a huge pest database (unverifiable here).

### 4. Heat and water are no longer ignorable
The Sahara scored Cox 78 because summer heat was a non-critical factor (weight 2) in a weighted average. Heat is now
critical (a failed critical factor multiplies the score by f^0.6) and a seventh factor, **Water**, scores growing-season
rain / (0.9 x Hargreaves ET0) (0 -> 0.30, 0.25 -> 0.55, 0.5 -> 0.80, 0.8 -> 1): arid sites can still grow apples with full
irrigation (Washington, Xinjiang, Iran), so water is a heavy but non-fatal penalty. After the change Wenatchee: Cox 13,
Granny Smith 76; Minneapolis: Honeycrisp 88, Granny Smith 14, Anna 0; every Singapore score 0.

### 5. Extrapolation instead of "nearest dot"
`js/climate/extrapolate.js`: when live weather cannot be loaded, blend up to **4** reference places in the **same hemisphere**
within **1,500 km** by weights 1/(d + 100 km)^2. Numbers and numeric arrays are averaged (sorted-quantile resampling for
the per-year totals); labels, zone, bloom date and frost label are recomputed from the blended numbers; Koppen comes from the
nearest. The banner lists the sources and distances and offers a retry; beyond 1,500 km it refuses rather than guesses.
*Rejected:* a global precomputed grid (about 700 land cells at 5 degrees would take half a day at the free rate limit and
still miss mountains and coasts; live data is better where it is available).

### 6. UX: dots de-emphasised, click affordance explicit
Dots are smaller and in a layer the user can switch off; a "Click anywhere" hint sits on the map until the first click; the
cursor is a crosshair; the Regional tab and the nearest reference place's local notes (labelled with their distance) give
context for any spot.

### 7. Be a good API citizen
The bulk download is paced at ~3,300 units/hour (was 4,500) so a visitor on the same IP keeps ~1,700 units/hour of headroom
(about 12 live clicks). A live click costs ~110 units (10-year weather + 3-year humidity), so a busy visitor will meet the
extrapolation fallback; that is the designed behaviour.

## Reference points that were wrong
Etna was on the 3,128 m summit (apples are grown at 700-1,100 m); Hardanger on a 987 m plateau instead of the fjord shore;
Thurgau on a 660 m hillside; Golan at Katzrin (400 m) instead of the 900+ m orchards. All four moved and re-fetched.

## Verification
74 in-browser tests (humidity primitives, Mills table, blight degree-hours, regional lookups, rust/blight changing scores,
desert scores near zero, extrapolation between Kent and Paris, hemisphere separation, nothing within range of the mid-Pacific).
Manual: forced a weather-service outage and clicked 50.2 N, 1.6 E: extrapolated banner named Kent (141 km), Paris (159 km),
Pays d'Auge (163 km), Haspengouw (263 km).

## Open questions
* ERA5 cells hide fjord and valley-floor orchards (Hardanger still reads cold even at the shore); a terrain correction would help.
* Fire blight country list is conservative; Argentina, South Africa, India, China are "unmapped".
* The Mills table assumes ascospores are mature and discharging; early-spring days before green tip are over-counted.
