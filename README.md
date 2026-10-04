# Pomography - the heirloom apple atlas

*Pomology* is the study of fruit; *pomography* is the mapping of it - where each apple tastes the way it should and where it won't.

An independent, static website about apple varieties and rootstocks, built around the range of
[Keepers Nursery](https://www.keepers-nursery.co.uk/fruit-trees/apple) (East Farleigh, Kent; nursery manager
Karim Habibi).

* **Varieties** - taste (flavour tags such as pineapple, fennel, strawberry, pear-drop, nutty, each with the number of independent sources behind it), growing habit,
  pollination partners, season and storage, climate needs, disease susceptibility, history. Filter by flavour,
  season, use, origin, disease resistance and more.
* **Rootstocks** - vigour, precocity, anchorage, disease and soil tolerance for ~50 apple rootstocks (M.27 to
  MM.111, Budagovsky, Polish, Geneva...), a comparison table and a "which rootstock for me?" chooser.
* **World map** - pick favourites, then click **any spot on land** (the dots are only pre-computed reference places).
  Pomography fetches ten years of real weather plus dew point and rain hours for that point and scores each favourite for
  winter chill, winter cold, blossom frost, ripening season, summer heat, water supply and disease pressure, with the
  reasons written out. Disease pressure is driven by leaf wetness and humidity (apple scab infection periods, a
  Maryblyt-style fire blight model, mildew, canker); whether fire blight or cedar-apple rust exists there at all comes
  from regional lookups. Every number is labelled measured / modelled / regional / assumed / extrapolated, and if the
  free weather service is busy the panel falls back to values extrapolated from nearby reference places and says so.
* **Flavour** - every taste note is checked against independent sources: verbatim entries from 19th- and
  early-20th-century pomologies (Hogg, Bunyard, Beach, Downing, Leroy ...; full texts in `library/`), modern growers
  and collections, the National Fruit Collection's expert tasting scores, and laboratory sugar/acid measurements
  (a sweet-vs-sharp chart). A defined flavour vocabulary links notes to aroma chemistry; visitors can report tastings
  through a GitHub issue form; `docs/flavour-audit.md` lists what changed. The map says how a place will change an
  apple's flavour (e.g. Cox milder in hot summers).
* **Favourites** - side-by-side comparison and a pollination check (flowering groups, triploids).

Live site: https://otac0011.github.io/pomography/ (GitHub Pages from `main`, repo root).

## Run it locally

```
python tools/serve.py 8190      # http://localhost:8190/   tests: http://localhost:8190/tests/
```

No Node, no bundler. Leaflet comes from cdnjs; weather from Open-Meteo; place names from BigDataCloud.

## Layout

| Path | What |
|---|---|
| `index.html`, `css/`, `js/` | the site (ES modules, hash router) |
| `js/climate/features.js` | pure climate-metric extraction (chill, zone, bloom, frost, season, heat, humidity, leaf wetness, disease) |
| `js/climate/regional.js`, `extrapolate.js`, `fetch.js` | regional presence lookups, extrapolation from neighbours, live Open-Meteo lookup |
| `js/score/score.js` | variety x place scoring + reasons, rootstock advice |
| `library/` | public-domain pomology books (text committed, scans git-ignored); `tools/fetch_library.py` |
| `data/historic/`, `data/evidence/`, `data/chemistry/`, `data/panel/`, `data/flavour_vocab.json`, `data/tastings.json` | flavour evidence (decision 0005); merged by `tools/flavour.py` during the build into `assets/flavour.json` |
| `tools/flavour_audit.py` | writes `docs/flavour-audit.md` |
| `tools/import_tastings.py`, `.github/` | visitor taste reports (issue form, nightly import) |
| `docs/outreach/` | draft letters to Keepers Nursery and the National Fruit Collection (not sent) |
| `data/varieties/`, `data/rootstocks/`, `data/regions/` | source data (JSON, one array per file) |
| `assets/data.json`, `assets/climate-presets.json` | **built**: re-run the tools below after editing data |
| `research/` | schemas, agent briefs, batch lists, hand-correction patches |
| `tools/` | build, validators, climate fetch/bake, dev server |
| `tests/` | in-browser tests (must all PASS) |
| `docs/decisions/` | the decision journal: why each choice was made, and what was rejected |

## Data workflow

```
python tools/validate.py "data/varieties/*.json"      # schema check
python tools/build.py --report                         # merge + validate -> assets/data.json
python tools/apply_patch.py research/patches/NNN.json  # reviewed hand corrections
python tools/fetch_climate.py                          # raw ERA5 weather for reference places (slow, rate-limited)
# open http://localhost:8190/tools/bake.html?save=1    # compute features with the production JS -> assets/climate-presets.json
```

## Honesty about the data

Every field can be `null` ("not recorded"); each variety carries a confidence level. Chill requirements and
many flowering groups are estimates. Climate scores come from 25 km reanalysis cells and ten years of data and are
a regional guide only. See the in-site Guide and `docs/decisions/0002-climate-model.md`.

## Licence and credits

See `NOTICE.md`. Code: MIT. Data compiled for this project from public pomological sources, paraphrased.
