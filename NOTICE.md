# Notices

## Not affiliated with Keepers Nursery
Pomography is an independent project. It is not affiliated with, endorsed by or sourced from Keepers Nursery Ltd.

* Keepers' copyright statement reserves their articles, descriptions, images and database. **None of their text,
  photographs or tables is reproduced here.** Variety *names* shown on their public catalogue pages were used to
  decide which varieties to cover and to flag them with a "Keepers" badge and a link to their page.
* For a handful of seedlings that Keepers raised itself (Hamid's Red Pippin, Sima Joon, Primrose Pippin, Bethan,
  St Helens) and for Sweet Society, which no other public source documents, we read the nursery's catalogue
  entries for *facts only* (parentage, year, picking time, flowering group, size, colour) and wrote the
  descriptions ourselves. See `research/patches/001-keepers-seedlings.json` and `docs/decisions/0003-*`.
  If Keepers Nursery would prefer these entries changed or removed, please open an issue.
* Pomography links to Keepers for purchases; it sells nothing.

## Data sources (facts only; all prose is original)
National Fruit Collection (Brogdale / University of Reading / Defra), Orange Pippin, Wikipedia, Hogg's
*Fruit Manual* (1884), Bunyard's *Handbook of Hardy Fruits* (1920), university extension and breeder pages (Cornell /
Geneva, WSU, Michigan State, University of Minnesota, Penn State, East Malling), regional pomological societies.
Individual agents' notes of conflicts between sources are kept inside each record (`notes`, `history`).

## Flavour evidence (decision 0005)
* **Public-domain books** in `library/` (Hogg, the Herefordshire Pomona, Bunyard, Lindley, Beach, Downing, Warder, Ragan,
  Leroy) are quoted verbatim; texts from Project Gutenberg and the Internet Archive.
* **National Fruit Collection characterisation & evaluation data** (Ordidge & Hale, University of Reading,
  doi:10.17864/1947.001455): contains public sector information licensed under the Open Government Licence v3.0
  (Crown copyright, Department for Environment, Food & Rural Affairs).
* **Laboratory sugar/acid data**: USDA GRIN-Global (Geneva NY; public domain); REFPOP apple reference population
  (Switzerland / Italy; Etalab Open Licence 2.0); Canada's Apple Biodiversity Collection (Watts et al. 2021, Plants,
  People, Planet; per-cultivar averages of published measurements, credited); Geneva cider-apple acidity data (Kumar
  et al. 2021, J. Amer. Soc. Hort. Sci., data via GRIN). Only per-variety averages are stored (`data/chemistry/`).
* Modern web sources (Orange Pippin, Wikipedia, nurseries, universities) are recorded as short keyword lists with
  links, never copied prose. Keepers Nursery's text is not used.
* Aroma-chemistry references are listed in `data/flavour_vocab.json`.

## Weather and maps
* Weather: ERA5 reanalysis, Copernicus Climate Change Service / ECMWF, accessed via the free
  [Open-Meteo](https://open-meteo.com/) historical API (CC BY 4.0). Contains modified Copernicus Climate Change Service information.
* Place names: [BigDataCloud](https://www.bigdatacloud.com/) client-side reverse geocoding.
* Map: [Leaflet](https://leafletjs.com/) (BSD-2). Tiles: &copy; [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors; terrain
  layer &copy; [OpenTopoMap](https://opentopomap.org) (CC-BY-SA), SRTM.

## Code
MIT licence for the code in this repository (see `LICENSE`). The data files are original compilations; reuse them
with attribution.
