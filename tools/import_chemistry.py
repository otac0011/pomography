#!/usr/bin/env python3
"""Import measured apple fruit chemistry (SSC, titratable acidity, firmness)
from open datasets into data/chemistry/<source-key>.json.

Raw files live in cache/chem/ (gitignored); the comment above each parser
says where each file was downloaded from. Values are copied from the
sources: we only average (over years/trees and over several accessions of
one cultivar). No unit conversion was needed (all TA is g/L malic acid as
published); obviously invalid entries are dropped as stated in "method".

Not used: UK National Fruit Collection C&E data (doi:10.17864/1947.001455,
OGL 3.0) - sweetness/acidity there are sensory 1-9 scores, not measurements.

Usage (needs xlrd for the REFPOP name table):
    python tools/import_chemistry.py               # write data/chemistry/*.json + coverage
    python tools/import_chemistry.py --review      # every match whose name differs from ours
    python tools/import_chemistry.py --candidates  # unmatched source names that look
                                                   # like one of our varieties (for curation)
"""
from __future__ import annotations

import csv
import difflib
import html
import json
import re
import statistics
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "cache" / "chem"
OUT = ROOT / "data" / "chemistry"
VARIETIES = ROOT / "research" / "library" / "varieties.json"


# --------------------------------------------------------------------------
# Name matching
# --------------------------------------------------------------------------

def norm(s: str) -> str:
    """Case/accent/punctuation-insensitive key. Apostrophes are dropped, so
    "Cox's" == "Coxs" and "D'Arcy" == "Darcy"; "St." == "St"."""
    s = html.unescape(s)
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower()
    s = re.sub(r"['’‘`]", "", s)
    s = re.sub(r"\b(st|saint)\.?\s", "st ", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return " ".join(s.split())


def norm_loose(s: str) -> str:
    """norm() after also dropping possessive endings, so "Peck Pleasant" ==
    "Peck's Pleasant" and "Bulmer Norman" == "Bulmer's Norman". A hit only on
    this key is reported as a 'probable' match."""
    s = html.unescape(s)
    s = re.sub(r"(\w)['\u2019]s\b", r"\1", s)
    s = re.sub(r"(\w)s['\u2019](?=\s|$)", r"\1s", s)
    return norm(s)


def load_varieties():
    vs = json.loads(VARIETIES.read_text(encoding="utf-8"))
    index: dict[str, tuple[str, str]] = {}
    ambiguous: set[str] = set()

    def add(key, vid, kind):
        if not key:
            return
        if key in index and index[key][0] != vid:
            # an exact name always wins over someone else's synonym
            if index[key][1] == "exact" and kind == "synonym":
                return
            if kind == "exact" and index[key][1] == "synonym":
                index[key] = (vid, kind)
                return
            ambiguous.add(key)
            return
        if key not in index or (kind == "exact"):
            index[key] = (vid, kind)

    for v in vs:
        add(norm(v["name"]), v["id"], "exact")
    for v in vs:
        for a in v.get("aka", []) or []:
            add(norm(a), v["id"], "synonym")
    for k in ambiguous:
        index.pop(k, None)
    # loose (possessive-insensitive) keys, used only when the strict key misses
    loose: dict[str, set] = defaultdict(set)
    for v in vs:
        for n in [v["name"]] + list(v.get("aka", []) or []):
            loose[norm_loose(n)].add(v["id"])
    for k, ids in loose.items():
        if len(ids) == 1:
            index.setdefault("~" + k, (next(iter(ids)), "probable"))
    return vs, index, ambiguous


# Curated "probable" matches: source name (as written in the source) -> our id.
# Each was checked by hand: spelling variants, abbreviations or the source's
# short form of the same cultivar. Sports, clones, strains and seedlings are
# NOT listed here on purpose.
PROBABLE: dict[str, dict[str, str]] = {
    "abc-2021": {
        "Bella di Pontoise": "belle-de-pontoise",        # Italian form of the name
        "Canada Grise": "reinette-grise-du-canada",      # = Canada Gris
        "Coxs Orange": "coxs-orange-pippin",             # short form; ABC also has "Cox's Orange Pippin"
        "Crown Prince Rudolf": "kronprinz-rudolf",       # English translation
        "Saltcote Pipin": "saltcote-pippin",             # misspelling
        "Trembletts Bitter": "tremletts-bitter",         # misspelling
        "Ribston": "ribston-pippin",                     # short form
    },
    "grin-geneva": {
        "Bella di Pontoise": "belle-de-pontoise",
        "Cornish Aromatic (Wakeley)": "cornish-aromatic",  # parenthesis = donor
        "Cox's Orange": "coxs-orange-pippin",
        "Duchess Favorite": "duchesss-favourite",
        "Saltcote Pipin": "saltcote-pippin",
        "Tydeman Red (Cooper)": "tydemans-early-worcester",  # Tydeman's Red; parenthesis = donor
        "Wyken Pippen": "wyken-pippin",
        "Ribston": "ribston-pippin",
    },
    "kumar-2021-cider": {
        "Bella di Pontoise": "belle-de-pontoise",
        "Ribston": "ribston-pippin",
    },
    "refpop-2022": {
        "Pepin Shafrannyj": "pepin-shafranny",           # transliteration
        "Grahams Jubileum": "royal-jubilee",             # Graham's Jubilaeumsapfel = Graham's Royal Jubilee
        "Priscilla-NL": "priscilla",                     # suffix = Dutch source of the accession
    },
}

# Source names that auto-match one of our names/synonyms but are known to be
# something else (e.g. the source's name is a different cultivar that shares
# a synonym). Source name -> reason.
_GILLI = "bare 'Gilliflower' is used for several cultivars (Black Gilliflower, Cornish Gilliflower)"
REJECT: dict[str, dict[str, str]] = {
    "abc-2021": {"Gilliflower": _GILLI},
    "grin-geneva": {
        "Gilliflower": _GILLI,
        "Virginia Crab": "GRIN's 'Virginia Crab' is Foster's Virginia Crab, conflated with Hewes (Hughes') "
                         "Virginia Crab (J. Am. Pomol. Soc., 'Mistaken Identity')",
    },
    "kumar-2021-cider": {"Gilliflower": _GILLI},
    "refpop-2022": {},
}


def match(source_key: str, name: str, index):
    name = html.unescape(name)
    if name in REJECT.get(source_key, {}):
        return None
    if name in PROBABLE.get(source_key, {}):
        return PROBABLE[source_key][name], "probable"
    hit = index.get(norm(name))
    if hit:
        return hit
    return index.get("~" + norm_loose(name))


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

def fnum(x):
    if x is None:
        return None
    x = str(x).strip()
    if x in ("", "NA", "NaN", "nan", "."):
        return None
    try:
        return float(x)
    except ValueError:
        return None


def mean(xs):
    xs = [x for x in xs if x is not None]
    return statistics.fmean(xs) if xs else None


def rnd(x, nd=2):
    return None if x is None else round(x, nd)


def year_span(years):
    ys = sorted({int(y) for y in years if y})
    if not ys:
        return None
    return str(ys[0]) if ys[0] == ys[-1] else f"{ys[0]}-{ys[-1]}"


# Each parser returns a list of "accession" dicts:
#   {"acc": unique accession id, "name": source name, "ssc": [..], "ta": [..],
#    "firm": [..], "years": [..], optional "storage": {"ssc": [..], ...}}
# Lists hold the per-year (or per-tree-year) raw values for that accession.


# --------------------------------------------------------------------------
# Source 1: Canada's Apple Biodiversity Collection (Watts et al. 2021)
# cache/chem/abc/pheno_meta_data.csv  <-
#   https://raw.githubusercontent.com/MylesLab/abc-phenomics/main/outputs/pheno_meta_data.csv
# --------------------------------------------------------------------------

def parse_abc():
    f = CACHE / "abc" / "pheno_meta_data.csv"
    rows = list(csv.DictReader(f.open(encoding="utf-8")))
    accs = []
    for r in rows:
        h_ssc = {"2016": fnum(r["brix_avg_16_harv"]), "2017": fnum(r["brix_17_harv"])}
        h_ta = {"2016": fnum(r["acidity_16_harv"]), "2017": fnum(r["acidity_17_harv"])}
        h_fi = {"2016": fnum(r["firmness_avg_16_harv"]), "2017": fnum(r["firmness_avg_17_harv"])}
        s_ssc = [fnum(r["brix_16_stor"]), fnum(r["brix_17_stor"])]
        s_ta = [fnum(r["acidity_16_stor"]), fnum(r["acidity_17_stor"])]
        s_fi = [fnum(r["firmness_avg_16_stor"]), fnum(r["firmness_avg_17_stor"])]
        years = [y for i, y in enumerate(("2016", "2017"))
                 if any(d[y] is not None for d in (h_ssc, h_ta, h_fi))
                 or any(lst[i] is not None for lst in (s_ssc, s_ta, s_fi))]
        accs.append({
            "acc": r["apple_id"], "name": r["PLANTID"].strip(),
            "ssc": list(h_ssc.values()), "ta": list(h_ta.values()), "firm": list(h_fi.values()),
            "years": years,
            "storage": {"ssc": s_ssc, "ta": s_ta, "firm": s_fi},
        })
    return accs


ABC_SOURCE = {
    "key": "abc-2021",
    "title": "Quantifying apple diversity: A phenomic characterization of Canada's Apple Biodiversity Collection",
    "authors": "Watts S, Migicovsky Z, McClure KA, Yu CHJ, Amyotte B, Baker T, Bowlby D, Burgher-MacLellan K, "
               "Butler L, Donald R, Fan L, Fillmore S, Flewelling L, Gong Z, McElroy B, Money D, O'Hara M, Ong Q, "
               "Campbell Palmer L, Sawler J, Vinqvist-Tymchuk M, Rupasinghe HPV, DeLong JM, Forney CF, Song J, Myles S",
    "year": 2021,
    "url": "https://doi.org/10.1002/ppp3.10211",
    "data_url": "https://github.com/MylesLab/abc-phenomics (outputs/pheno_meta_data.csv = Supplementary Table S1)",
    "licence": "Article CC BY-NC-ND 4.0; the data repository named in its data-availability statement "
               "carries no licence file. Factual measurements, reused with attribution.",
    "where": "Apple Biodiversity Collection, AAFC Kentville Research and Development Centre, Nova Scotia, Canada",
    "method": "Two trees per accession on M.9, 2016 and 2017 seasons. Fruit picked at judged harvest maturity "
              "(starch-iodine, background colour, drop, taste). SSC: Atago PAL-1 refractometer on composite juice "
              "per tree; TA: titration of 1 ml composite juice with 0.1 M NaOH (Metrohm 865 Dosimat), reported as "
              "g/L malic acid; firmness: Guss GS-14 fruit texture analyser on peeled flesh, 5-10 fruit per tree, "
              "kg/cm2. Harvest values are the published per-accession means, which the authors adjusted for "
              "orchard position (REML, lme4); 'storage' values are unadjusted, after 3 months of cold storage. "
              "Here: mean of the 2016 and 2017 values per accession, then mean over accessions of the same "
              "cultivar (n = accessions).",
    "ta_units": "g/L malic acid",
}


# --------------------------------------------------------------------------
# Source 2: USDA GRIN-Global, Geneva NY apple collection, SOLSOLIDS and
# FRUIT.FIRMNESS.PSI descriptors.
# cache/chem/grin/grin_115156.dat (SOLSOLIDS), grin_375605.dat (firmness) <-
#   "Download list of accessions evaluated for this trait" on
#   https://npgsweb.ars-grin.gov/gringlobal/descriptordetail?id=115156 / 375605
# --------------------------------------------------------------------------

GRIN_SSC_RANGE = (4.0, 32.0)  # outside = transcription errors in GRIN (e.g. 1, 1.1, 730)


def read_grin(fname):
    lines = (CACHE / "grin" / fname).read_text(encoding="utf-8-sig", errors="replace").splitlines()
    # line 0 title, line 1 ",", line 2 header
    return list(csv.DictReader(lines[2:]))


def grin_year(method):
    m = re.search(r"\.(\d{2,4})$", method or "")
    if not m:
        return None
    y = m.group(1)
    if len(y) == 4:
        return y
    return ("19" if int(y) >= 50 else "20") + y


def grin_acc_id(r):
    return " ".join(x for x in (r["accession_prefix"], r["accession_number"], r["accession_suffix"]) if x)


GRIN_EXCLUDED: list[str] = []


def parse_grin():
    accs: dict[str, dict] = {}

    def get(r):
        a = grin_acc_id(r)
        if a not in accs:
            accs[a] = {"acc": a, "name": html.unescape(r["plant_name"]).strip(), "ssc": [], "ta": [], "firm": [],
                       "years": [], "taxon": r["taxon"]}
        return accs[a]

    for r in read_grin("grin_115156.dat"):
        v = fnum(r["observation_value"])
        if v is None:
            continue
        a = get(r)
        if not (GRIN_SSC_RANGE[0] <= v <= GRIN_SSC_RANGE[1]):
            GRIN_EXCLUDED.append(f"{a['name']} ({a['acc']}): SSC {v}")
            continue
        a["ssc"].append(v)
        a["years"].append(grin_year(r["method_name"]))
    for r in read_grin("grin_375605.dat"):
        v = fnum(r["observation_value"])
        if v is None:
            continue
        a = get(r)
        a["firm"].append(v)
        a["years"].append(grin_year(r["method_name"]))
    return [a for a in accs.values() if a["ssc"] or a["firm"]]


GRIN_SOURCE = {
    "key": "grin-geneva",
    "title": "GRIN-Global apple (Malus) evaluation data: SOLSOLIDS and FRUIT.FIRMNESS.PSI descriptors",
    "authors": "USDA-ARS Plant Genetic Resources Unit, Geneva NY (National Plant Germplasm System)",
    "year": 2025,
    "url": "https://npgsweb.ars-grin.gov/gringlobal/descriptordetail?id=115156",
    "data_url": "https://npgsweb.ars-grin.gov/gringlobal/descriptordetail?id=115156 ; "
                "https://npgsweb.ars-grin.gov/gringlobal/descriptordetail?id=375605",
    "licence": "US Government work (USDA-ARS), public domain",
    "where": "USDA Malus collection, Plant Genetic Resources Unit, Geneva, New York, USA",
    "method": "Descriptor SOLSOLIDS: percent soluble solids, average refractometer reading from 3 fruits at full "
              "maturity (APPLE.MORPHOLOGIC evaluations, 1995-2017, usually one season per accession). "
              "FRUIT.FIRMNESS.PSI: penetrometer firmness in pounds-force (recorded as 'psi'), 2008-2018, mostly "
              "wild/collected accessions. No acidity in these evaluations. GRIN SSC values outside "
              f"{GRIN_SSC_RANGE[0]}-{GRIN_SSC_RANGE[1]} Brix (e.g. 1, 1.1, 730) were treated as data-entry errors "
              "and dropped. Here: mean of observations per accession, then mean over accessions of the same "
              "cultivar (n = accessions).",
    "ta_units": "g/L malic acid (no TA in this source)",
}


# --------------------------------------------------------------------------
# Source 3: Kumar et al. 2021 cider-apple titratable acidity, as deposited in
# GRIN-Global (descriptor TITRATABLE.ACIDITY, study Cider.Apple.Classification.Peck.2021).
# cache/chem/grin/grin_375603.dat <-
#   https://npgsweb.ars-grin.gov/gringlobal/descriptordetail?id=375603
# --------------------------------------------------------------------------

def parse_kumar():
    out = []
    for r in read_grin("grin_375603.dat"):
        v = fnum(r["observation_value"])
        if v is None:
            continue
        out.append({"acc": grin_acc_id(r), "name": html.unescape(r["plant_name"]).strip(), "ssc": [], "ta": [v],
                    "firm": [], "years": ["2017"]})
    return out


KUMAR_SOURCE = {
    "key": "kumar-2021-cider",
    "title": "Classifying Cider Apple Germplasm Using Genetic Markers for Fruit Acidity",
    "authors": "Kumar SK, Wojtyna N, Dougherty L, Xu K, Peck G",
    "year": 2021,
    "url": "https://doi.org/10.21273/JASHS05056-21",
    "data_url": "https://npgsweb.ars-grin.gov/gringlobal/descriptordetail?id=375603",
    "licence": "Data as deposited in USDA GRIN-Global (US Government database, public domain); "
               "article CC BY-NC-ND 4.0",
    "where": "USDA Malus collection, Plant Genetic Resources Unit, Geneva, New York, USA",
    "method": "Juice titratable acidity of 217 cider-relevant accessions sampled from the Geneva collection in "
              "2017 (three 15-fruit subsamples per accession, per the 2018 ASHS conference abstract), reported in "
              "g/L and classified against the Long Ashton 0.45 % malic acid threshold, i.e. malic acid basis. "
              "Fruit sampled at harvest maturity; storage time not stated in GRIN. One value per accession; no "
              "SSC or firmness deposited.",
    "ta_units": "g/L malic acid",
}


# --------------------------------------------------------------------------
# Source 4: apple REFPOP raw phenotypes (Jung et al. 2022), Recherche Data Gouv
# cache/chem/refpop/refpop_pheno.txt <-
#   https://entrepot.recherche.data.gouv.fr/api/access/datafile/125021  (doi:10.15454/VARJYJ)
# cache/chem/refpop/supp2020/41438_2020_408_MOESM2_ESM.xls (genotype code -> name) <-
#   Supplementary Table 1 of Jung et al. 2020, Hortic Res 7:189 (PMC7603508)
# --------------------------------------------------------------------------

def parse_refpop():
    import xlrd  # only needed for this source
    book = xlrd.open_workbook(str(CACHE / "refpop" / "supp2020" / "41438_2020_408_MOESM2_ESM.xls"))
    sh = book.sheet_by_index(0)
    names = {}
    for i in range(1, sh.nrows):
        code, munq, orig, pref, origin = sh.row_values(i)[:5]
        code = str(code).strip()
        if code.endswith(".0"):
            code = code[:-2]
        names[code] = str(pref).strip()
    rows = csv.DictReader((CACHE / "refpop" / "refpop_pheno.txt").open(encoding="utf-8"), delimiter="\t")
    accs: dict[str, dict] = {}
    for r in rows:
        g = r["Genotype"].strip()
        if g not in names:  # progeny of breeding crosses: no cultivar name
            continue
        if r.get("Management", "M1") != "M1":
            continue
        ssc, ta, fi = fnum(r["Sugar"]), fnum(r["Acidity"]), fnum(r["Firmness"])
        if ssc is None and ta is None and fi is None:
            continue
        a = accs.setdefault(g, {"acc": f"REFPOP {g}", "name": names[g], "ssc": [], "ta": [], "firm": [],
                                "years": [], "sites": set()})
        a["ssc"].append(ssc)
        a["ta"].append(ta)
        # metadata says g/cm2, but values (median ~8.5, range 2.4-17) are kg/cm2;
        # a 0 means not measured
        a["firm"].append(fi if fi else None)
        a["years"].append(r["Year"])
        a["sites"].add(r["Country"])
    return list(accs.values())


REFPOP_SOURCE = {
    "key": "refpop-2022",
    "title": "Phenology, productivity, fruit size, outer fruit, inner fruit, and vigor traits in an apple "
             "reference population (apple REFPOP); used in Jung et al. 2022, Genetic architecture and genomic "
             "predictive ability of apple quantitative traits across environments, Hortic Res 9:uhac028",
    "authors": "Jung M, Keller B, Roth M, Aranzana MJ, Auwerkerken A, Guerra W, Al-Rifai M, Lewandowski M, "
               "Sanin N, Rymenants M, Didelot F, Dujak C, Font i Forcada C, Knauf A, Laurens F, Studer B, "
               "Muranty H, Patocchi A",
    "year": 2022,
    "url": "https://doi.org/10.15454/VARJYJ",
    "data_url": "https://doi.org/10.15454/VARJYJ (raw per-tree data); names from Supplementary Table 1 of "
                "https://doi.org/10.1038/s41438-020-00408-8",
    "licence": "Etalab Open Licence 2.0 (dataset); articles CC BY 4.0",
    "where": "Agroscope, Waedenswil, Switzerland (2018-2020) and Laimburg, South Tyrol, Italy (2019-2020)",
    "method": "Raw per-tree values, integrated pest management (M1) trees, 2-4 trees per accession per site. "
              "Pimprenelle (Setop) automated analyser on fruit at harvest: SSC in Brix, mean of 10 fruits; TA in g "
              "of titratable acid per litre of juice pooled from 10 fruits, used as reported (the dataset does "
              "not name the reference acid; Pimprenelle apple results are conventionally given as malic acid, so "
              "no conversion was applied); firmness by Pimprenelle penetrometer. The metadata labels firmness "
              "g/cm2 but the values (median about 8.5, range 2-17) are kg/cm2 magnitudes, so they are given as "
              "kg/cm2 unchanged; zero firmness values were treated as missing. Here: mean over all tree x year "
              "x site values per accession; 'obs' = number of tree-year-site SSC records averaged.",
    "ta_units": "g/L malic acid",
}


# --------------------------------------------------------------------------
# Aggregation and output
# --------------------------------------------------------------------------

SOURCES = [
    (ABC_SOURCE, parse_abc, "harvest", "kg/cm2"),
    (GRIN_SOURCE, parse_grin, "harvest", "lbf (penetrometer, recorded as psi)"),
    (KUMAR_SOURCE, parse_kumar, "harvest", None),
    (REFPOP_SOURCE, parse_refpop, "harvest", "kg/cm2"),
]

KIND_RANK = {"exact": 0, "synonym": 1, "probable": 2}


def acc_means(a):
    return mean(a["ssc"]), mean(a["ta"]), mean(a["firm"])


def build(source, parser, stage, firm_units, index):
    key = source["key"]
    accs = parser()
    groups: dict[str, list] = defaultdict(list)
    unmatched = []
    for a in accs:
        m = match(key, a["name"], index)
        if not m:
            unmatched.append(a["name"])
            continue
        vid, kind = m
        groups[vid].append((a, kind))
    records = {}
    for vid in sorted(groups):
        items = groups[vid]
        per = [acc_means(a) for a, _ in items]
        rec_stage = stage
        has_storage = "storage" in items[0][0]
        if all(x is None for p in per for x in p) and has_storage:
            # no harvest values at all: fall back to the after-storage values
            per = [(mean(a["storage"]["ssc"]), mean(a["storage"]["ta"]), mean(a["storage"]["firm"]))
                   for a, _ in items]
            rec_stage = "storage"
            has_storage = False
        used = [(it, p) for it, p in zip(items, per) if any(x is not None for x in p)]
        if not used:
            continue
        ssc = mean([p[0] for _, p in used])
        ta = mean([p[1] for _, p in used])
        fi = mean([p[2] for _, p in used])
        kinds = sorted({k for (_, k), _ in used}, key=KIND_RANK.get)
        rec = {
            "accession": "; ".join(sorted({a["name"] for (a, _), _ in used})),
            "ssc": rnd(ssc, 1),
            "ta": rnd(ta, 2),
            "firmness": rnd(fi, 2),
            "firmness_units": firm_units if fi is not None else None,
            "n": len(used),
            "years": year_span([y for (a, _), _ in used for y in a["years"]]),
            "match": kinds[-1],  # weakest link
            "stage": rec_stage,
        }
        items = [it for it, _ in used]
        per = [p for _, p in used]
        if key == "refpop-2022":
            rec["obs"] = sum(sum(1 for x in a["ssc"] if x is not None) for a, _ in items)
            rec["sites"] = ", ".join(sorted({s for a, _ in items for s in a["sites"]}))
        if key in ("grin-geneva", "kumar-2021-cider"):
            rec["accession_ids"] = sorted(a["acc"] for a, _ in items)
        if has_storage:
            st = [(mean(a["storage"]["ssc"]), mean(a["storage"]["ta"]), mean(a["storage"]["firm"]))
                  for a, _ in items]
            s_ssc, s_ta, s_fi = (mean([p[i] for p in st]) for i in range(3))
            if any(x is not None for x in (s_ssc, s_ta, s_fi)):
                rec["storage"] = {"ssc": rnd(s_ssc, 1), "ta": rnd(s_ta, 2), "firmness": rnd(s_fi, 2),
                                  "note": "after 3 months of cold storage, unadjusted"}
        if len(items) > 1:  # show what was averaged
            rec["per_accession"] = [
                {"accession": a["name"], "id": a["acc"], "ssc": rnd(p[0], 1), "ta": rnd(p[1], 2),
                 "firmness": rnd(p[2], 2)}
                for (a, _), p in zip(items, per)]
        records[vid] = rec
    return records, unmatched, accs


def candidates(vs, index):
    """Print source names that are close to one of our names but did not match."""
    ours = {}
    for v in vs:
        for n in [v["name"]] + list(v.get("aka", []) or []):
            ours[norm(n)] = v["id"]
    keys = list(ours)
    for source, parser, _, _ in SOURCES:
        _, unmatched, _ = build(source, parser, "", "", index)
        print(f"\n=== {source['key']} ({len(unmatched)} unmatched names)")
        for name in sorted(set(unmatched)):
            n = norm(name)
            close = difflib.get_close_matches(n, keys, n=3, cutoff=0.8)
            toks = set(n.split())
            contain = [k for k in keys if k and (set(k.split()) <= toks or (toks <= set(k.split()) and len(toks) > 1))]
            hits = list(dict.fromkeys(close + contain))
            if hits:
                print(f"  {name!r:45} -> " + ", ".join(f"{h} [{ours[h]}]" for h in hits))


def main():
    vs, index, ambiguous = load_varieties()
    if "--candidates" in sys.argv:
        candidates(vs, index)
        return
    if "--review" in sys.argv:  # every match whose source name differs from our main name
        names = {v["id"]: v["name"] for v in vs}
        for source, parser, _, _ in SOURCES:
            print(f"\n=== {source['key']}")
            for a in parser():
                m = match(source["key"], a["name"], index)
                if m and html.unescape(a["name"]) != names[m[0]]:
                    print(f"  {m[1]:8} {html.unescape(a['name'])!r:40} -> {names[m[0]]}")
        return
    OUT.mkdir(parents=True, exist_ok=True)
    total: dict[str, set] = defaultdict(set)
    print(f"{len(vs)} varieties; {len(ambiguous)} ambiguous name keys ignored")
    for source, parser, stage, firm_units in SOURCES:
        records, unmatched, accs = build(source, parser, stage, firm_units, index)
        doc = {"_source": source, "records": records}
        path = OUT / f"{source['key']}.json"
        path.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        n_ssc = sum(1 for r in records.values() if r["ssc"] is not None)
        n_ta = sum(1 for r in records.values() if r["ta"] is not None)
        n_fi = sum(1 for r in records.values() if r["firmness"] is not None)
        kinds = defaultdict(int)
        for r in records.values():
            kinds[r["match"]] += 1
        print(f"{source['key']:18} {len(accs):5} accessions in source -> {len(records):3} of our varieties "
              f"(SSC {n_ssc}, TA {n_ta}, firmness {n_fi}; " +
              ", ".join(f"{k} {v}" for k, v in sorted(kinds.items(), key=lambda kv: KIND_RANK[kv[0]])) + ")")
        for vid, r in records.items():
            total["any"].add(vid)
            if r["ssc"] is not None:
                total["ssc_ids"].add(vid)
            if r["ta"] is not None:
                total["ta_ids"].add(vid)
            if r["firmness"] is not None:
                total["firm_ids"].add(vid)
            if r["ssc"] is not None and r["ta"] is not None:
                total["both_same_source"].add(vid)
    both = total["ssc_ids"] & total["ta_ids"]
    print(f"TOTAL: {len(total['any'])} of {len(vs)} varieties have some data; SSC {len(total['ssc_ids'])}, "
          f"TA {len(total['ta_ids'])}, firmness {len(total['firm_ids'])}; SSC+TA (any sources) {len(both)}, "
          f"SSC+TA from one source {len(total['both_same_source'])}")
    if GRIN_EXCLUDED:
        print(f"GRIN SSC values dropped as out of range: {len(GRIN_EXCLUDED)}")


if __name__ == "__main__":
    main()
