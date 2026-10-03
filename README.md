# Pomona - the heirloom apple atlas

An independent, static website about apple varieties and rootstocks, built around the range of
[Keepers Nursery](https://www.keepers-nursery.co.uk/fruit-trees/apple) (East Farleigh, Kent; nursery manager
Karim Habibi).

* **Varieties** - taste (flavour tags such as rose-water, pear-drop, vanilla, pineapple, nutty), growing habit,
  pollination partners, season and storage, climate needs, disease susceptibility, history. Filter by flavour,
  season, use, origin, disease resistance and more.
* **Rootstocks** - vigour, precocity, anchorage, disease and soil tolerance for ~50 apple rootstocks (M.27 to
  MM.111, Budagovsky, Polish, Geneva...), a comparison table and a "which rootstock for me?" chooser.
* **World map** - pick favourites, then click any dot or any spot on Earth. Pomona fetches ten years of real
  weather for that point and scores each favourite for winter chill, winter cold, blossom frost, ripening
  season, summer heat and disease pressure, with the reasons written out; it also lists the best varieties and
  rootstocks for the spot and local notes for ~135 reference places.
* **Favourites** - side-by-side comparison and a pollination check (flowering groups, triploids).

Live site: https://otac0011.github.io/pomona/ (GitHub Pages from `main`, repo root).

## Run it locally

```
python tools/serve.py 8190      # http://localhost:8190/   tests: http://localhost:8190/tests/
```

No Node, no bundler. Leaflet comes from cdnjs; weather from Open-Meteo; place names from BigDataCloud.

## Layout

| Path | What |
|---|---|
| `index.html`, `css/`, `js/` | the site (ES modules, hash router) |
| `js/climate/features.js` | pure climate-metric extraction (chill, zone, bloom, frost, season, heat, disease) |
| `js/score/score.js` | variety x place scoring + reasons, rootstock advice |
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
