#!/usr/bin/env python3
"""Validate rootstock JSON:  python tools/validate_rootstocks.py "data/rootstocks/*.json" """
import glob, json, re, sys

SERIES = ["Malling", "Malling-Merton", "Budagovsky", "Polish", "Geneva", "Swedish", "Canadian", "German",
          "Japanese", "Seedling", "Other"]
SIZE = ["very-dwarf", "dwarf", "semi-dwarf", "semi-vigorous", "vigorous", "very-vigorous"]
AVAIL = ["common", "specialist", "rare", "not-available"]
CONF = ["high", "medium", "low"]
SUSC = ["fire_blight", "collar_rot", "woolly_aphid", "crown_gall", "powdery_mildew"]
TOL = ["cold", "drought", "wet_soil", "poor_soil", "heavy_soil", "replant"]


def ok(v, lo, hi, nullable=True):
    return (v is None and nullable) or (isinstance(v, int) and not isinstance(v, bool) and lo <= v <= hi)


def pair(v, lo, hi):
    return v is None or (isinstance(v, list) and len(v) == 2 and all(isinstance(x, (int, float)) for x in v)
                         and lo <= v[0] <= v[1] <= hi)


def validate_rootstock(r):
    E, W = [], []
    rid = r.get("id", "?")
    e = lambda m: E.append("%s: %s" % (rid, m))
    w = lambda m: W.append("%s: %s" % (rid, m))
    for k in ("id", "name", "series", "size_class", "vigor", "precocity", "susceptibility", "tolerance", "conf",
              "notes", "origin"):
        if k not in r:
            e("missing key %s" % k)
    if E:
        return E, W
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", r["id"]):
        e("bad id")
    if r["series"] not in SERIES:
        e("series %r" % r["series"])
    if r["size_class"] not in SIZE:
        e("size_class %r" % r["size_class"])
    for k in ("vigor", "precocity", "yield_efficiency", "fruit_size_effect", "anchorage", "suckering", "burr_knots"):
        if not ok(r.get(k), 1, 5):
            e("%s must be 1-5 or null" % k)
    if not pair(r.get("size_pct_standard"), 1, 150):
        e("size_pct_standard must be [lo, hi] within 1-150")
    if not pair(r.get("height_m"), 0.3, 15):
        e("height_m must be [lo, hi]")
    if not pair(r.get("spacing_m"), 0.3, 15):
        e("spacing_m must be [lo, hi]")
    if not pair(r.get("first_crop_years"), 1, 15):
        e("first_crop_years must be [lo, hi]")
    for k in SUSC:
        if not ok(r["susceptibility"].get(k), 1, 5):
            e("susceptibility.%s must be 1-5 or null" % k)
    for k in TOL:
        if not ok(r["tolerance"].get(k), 1, 5):
            e("tolerance.%s must be 1-5 or null" % k)
    if not ok(r.get("hardiness_zone"), 2, 10):
        e("hardiness_zone")
    if r.get("uk_availability") not in AVAIL + [None]:
        e("uk_availability")
    if r["conf"] not in CONF:
        e("conf")
    if r.get("vigor") is not None and r.get("size_pct_standard"):
        mid = sum(r["size_pct_standard"]) / 2
        if r["vigor"] <= 2 and mid > 60 or r["vigor"] >= 4 and mid < 55:
            w("vigor %s inconsistent with size_pct_standard %s" % (r["vigor"], r["size_pct_standard"]))
    return E, W


def main():
    files = []
    for a in sys.argv[1:]:
        if a.startswith("--"):
            continue
        files += glob.glob(a) or [a]
    errs, warns, seen = [], [], {}
    for f in files:
        try:
            data = json.load(open(f, encoding="utf-8"))
        except Exception as ex:
            errs.append("%s: cannot parse (%s)" % (f, ex))
            continue
        for r in data:
            E, W = validate_rootstock(r)
            errs += E
            warns += W
            if r.get("id") in seen:
                errs.append("%s: duplicate id" % r.get("id"))
            seen[r.get("id")] = f
    for m in errs:
        print("ERROR  ", m)
    for m in warns:
        print("warning", m)
    print("%d records, %d errors, %d warnings" % (len(seen), len(errs), len(warns)))
    sys.exit(1 if errs else 0)


if __name__ == "__main__":
    main()
