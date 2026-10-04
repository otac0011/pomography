# 0002 - Climate model and suitability scoring

Date: 2026-10-03. Status: accepted (calibration notes below are measured, not assumed).

## Context
The map must answer "how well would variety X grow at this clicked point, and why?" for any point on Earth,
for ~400 varieties, in a browser, with a static host and no API key. The answer must come with reasons.

## Weather source
**Open-Meteo Historical API, `models=era5`, daily Tmax/Tmin/precipitation, 2015-01-01..2024-12-31.**
* CORS-enabled, free, no key; one 10-year x 3-variable request is ~80 "units" against a free allowance of
  ~600/min, 5,000/h, 10,000/day **per IP**. So a visitor can click ~6 times/min; results are cached
  (memory + localStorage, 90 days, rounded to 0.1 deg), 429s are retried once, and on failure the UI falls
  back to the nearest baked reference place with an explicit note and distance.
* 135 reference places are baked (`assets/climate-presets.json`) so the map works instantly and offline.
  Baking is done by the **production JavaScript** (`tools/bake.html`, run in a browser against the raw data
  fetched by `tools/fetch_climate.py`), so there is exactly one implementation of the metrics.
* `best_match` rejected: it silently switches from ERA5 to ECMWF IFS 9 km in 2017, which produced a step change
  in Kent (mean Tmin -0.4 C, coldest night -8.5 vs -5.6 C). A consistent series matters more than resolution.
* `era5_land` (9 km, land only) rejected: it has no precipitation through this API, and a second request
  would double the load for little gain (its winter Tmin at Hawke's Bay and Elgin was within ~1 C of ERA5).
* NASA POWER / WorldClim rejected: coarser, or monthly-only (no frost or chill statistics).
* BigDataCloud client-side reverse geocoding gives the place label and detects open water.
* Tiles: CARTO basemaps now return "API KEY REQUIRED" watermarks, so OpenStreetMap + OpenTopoMap are used.
  Dark mode inverts the OSM tile pane with a CSS filter.

## Virtual years
Southern-hemisphere series are shifted by 181 days so every metric is written once in northern terms
(`buildCycles`): virtual day 0 = 1 Jan (N) or 1 Jul (S). Each cycle needs the previous autumn, so a 10-year
series gives 9 NH cycles / 8 SH cycles.

## Metrics (all in `js/climate/features.js`)
| Metric | Method | Why / how checked |
|---|---|---|
| Chill | Hourly temperature from a daily cosine (min 03:00, max 15:00); per day `max(Utah units, 0.5 x hours < 9.2 C)`, summed 1 Nov-31 Mar | Utah *positive* weights (<1.4: 0, 1.4-2.4: .5, 2.5-9.1: 1, 9.2-12.4: .5, else 0). First attempt (hours 0-7.2 C) gave Elgin 32 and Hawke's Bay 467 (mild maritime winters); Utah gives 942 / 1,474. Utah alone starved Minneapolis (781) because sub-zero hours score 0, so a floor of half the hours below 9.2 C was added (Minneapolis 1,916). Cosine-day vs real hourly ERA5 for Kent winter 2022-23: 1,498 vs 1,444 h (+4%). |
| Winter minimum / zone | Mean over winters of the lowest Tmin (1 Oct-30 Apr) **minus 2 C**, mapped to USDA zones | ERA5 25 km cells are ~2 C too warm on the coldest nights (Kent -4.5 vs ~-7 real, Norfolk -2.3 vs -8, Paris -5.4 vs ~-7.5; continental sites were within 1 C). After the correction: Kent 8b/9a, Paris 8b, S Michigan 6b, Wenatchee 7a, Minneapolis 4b - all match the USDA map. |
| Bloom date | Growing degree-days (base 5 C, daily mean) from 1 Feb (or from when chill reaches 800 / 85% of the winter total, whichever is later) reaching **220** | First idea, "first 10-day mean >= 10 C", gave bloom 2-4 weeks early (Paris 19 Mar). The GDD threshold 220 was fitted by scanning thresholds against sites with known bloom: Kent Apr 20, Herefordshire Apr 22, Paris Apr 7-10, S Michigan May 8, Wenatchee Apr 16-19. |
| Frost at bloom | per flowering group g=1..7: window bloom+3(g-3)-2 .. +14 d; hit if grid Tmin <= **+1.5 C**; probability = 0.5 x observed hit rate + 0.5 x Normal CDF fitted to the yearly window minimum | Ten years is too few for a plain frequency (0/9 everywhere). The threshold is a calibration, not physics: a damaging garden frost (about -2 C) reads +1..+2 C in a 25 km cell. Tested thresholds on the baked sites (P(frost) for mid-season varieties, -0.5 / +1 / +2 / +3 C): Kent 0/1/10/31%, Norfolk 0/0/8/21%, Herefordshire 1/18/34/58%, Paris 21/47/69/88%, S Michigan 0/1/2/10%, Wenatchee 1/10/20/32%. -0.5 gave Kent and Norfolk 0% against grower reports of damaging blossom frosts in 2016, 2017 and 2021, so +1.5 was chosen (Kent ~5%, Norfolk ~4%, Herefordshire ~26%, Paris ~58%). Still low for lake/sea-moderated cells (S Michigan). |
| Ripening | GDD base 5 C (cap 30 C) from bloom to the first Tmin <= -2.2 C after bloom+60 d. A variety's requirement is the Kent GDD at its recorded south-east England harvest date; score from median season GDD / requirement and the share of years it was reached | Self-calibrating: no per-variety thermal constants had to be invented, only the harvest date every pomology records. |
| Heat | Days >= 32 C in bloom+30..bloom+210 vs allowance by heat tolerance 1-5 (3, 8, 15, 25, 40 d); x0.85 if > 2 days >= 38 C; red varieties lose up to 20% if Aug 15-Sep 30 mean Tmin > 14 C | |
| Disease pressure | scab: wet days (>= 1 mm) in bloom-20..bloom+60 x temperature suitability; canker: wet days Oct-Mar; fire blight: warm (>= 15 C) days within a day of rain in the 25 days from bloom; mildew: warm dry fraction of bloom..+90; rust: scab x 0.9 in eastern North America only | Pressures 0-1; variety penalty = pressure x susceptibility weight (.03,.2,.5,.8,1) x strength; combined multiplicatively. Missing susceptibility assumed 3 and said so. |
| Water | growing-season rain / (0.9 x Hargreaves ET0) | Hargreaves needs only Tmax/Tmin and latitude. |
| Koppen | classic Koppen-Geiger rules on calendar-month normals | unit-tested on London, Af, Dfb, BWh. |

## Score
Six factors in [0,1]: chill (w3), hardiness (3), season (3), frost (2), heat (2), disease (1.5).
`score = 100 x weighted_mean x (min of {chill, hardiness, season})^0.6`.
The exponent makes a failed critical factor drag the score hard (0.3 -> x0.48; 0 -> 0) while a marginal one
costs little (0.9 -> x0.94); a plain weighted mean let good summers "average away" a dead tree.
*Rejected:* a strict minimum (too brittle, ignores the non-critical factors); a learned model (no ground truth).
Labels: >=85 Excellent, 70 Good, 55 Workable, 35 Marginal, 15 Poor, else Likely not viable (renamed from "Not viable" 2026-10-04 at the owner's request: orchard practice can beat a climate verdict).
Every factor returns a sentence; the UI shows them verbatim, so a surprising score can always be traced.

## Rootstock advice
Site-fit score from root hardiness (zone gap), fire blight risk x susceptibility, wetness x collar-rot
susceptibility / wet-soil tolerance, dryness x drought tolerance, woolly-aphid climate x susceptibility,
grouped by desired tree size. The Rootstocks page also has a soil/site chooser using the same fields.

## Known limitations (also stated in the Guide page)
25 km grid cells: frost hollows, hills, lake and sea shores are smoothed; chill requirements are mostly
estimated; ten years is short; soil, aspect and pollination are outside the score; climate is changing.

## Open questions
* A 2050s toggle using Open-Meteo's CMIP6 climate API (daily 1950-2050) would show how chill declines.
* Upgrading frost/chill with a downscaled lapse-rate/aspect correction.
* Calibrating variety chill needs from actual dormancy studies (few exist for heritage cultivars).
