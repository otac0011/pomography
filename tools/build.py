#!/usr/bin/env python3
"""Merge data/*  ->  assets/data.json  (run after any data edit).

    python tools/build.py            # validate + build
    python tools/build.py --report   # also print the data-quality report

Inputs
  data/varieties/*.json    variety records (research/SCHEMA.md)
  data/rootstocks/*.json   rootstock records (research/ROOTSTOCK_BRIEF.md)
  data/regions/*.json      region notes; coordinates come from data/regions_seed.json
  data/glossary.json       hand-written glossary
  research/all_ids.json    which varieties appear in Keepers Nursery's public catalogue pages (names only)
"""
import glob, json, os, re, sys, unicodedata, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from schema import validate_variety, parse_harvest, parse_harvest_range, TASTE_TAGS  # noqa: E402
from validate_rootstocks import validate_rootstock  # noqa: E402
from validate_regions import validate_region  # noqa: E402
import flavour  # noqa: E402

KEEPERS_ROOTSTOCKS = {"m27", "m9", "m26", "mm106", "mm111", "m25"}   # the apple rootstocks Keepers lists
KEEPERS_BASE = "https://www.keepers-nursery.co.uk/fruit-trees/apple/"


def load_dir(sub):
    out = []
    for f in sorted(glob.glob(os.path.join(ROOT, "data", sub, "*.json"))):
        out += json.load(open(f, encoding="utf-8"))
    return out


def norm(s):
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    s = s.replace("’", "").replace("'", "")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def main():
    report = "--report" in sys.argv
    errors, warnings = [], []

    keepers = {k["id"]: k for k in json.load(open(os.path.join(ROOT, "research", "all_ids.json"), encoding="utf-8"))}

    # ---- varieties
    varieties = load_dir("varieties")
    seen = {}
    for v in varieties:
        E, W = validate_variety(v)
        errors += E
        warnings += W
        if v["id"] in seen:
            errors.append("%s: duplicate id" % v["id"])
        seen[v["id"]] = v
        v["season"]["harvest_doy"] = parse_harvest(v["season"].get("harvest"))
        rng = parse_harvest_range(v["season"].get("harvest"))
        v["season"]["harvest_from"], v["season"]["harvest_to"] = rng if rng else (None, None)
        k = keepers.get(v["id"])
        v["keepers"] = {"listed": bool(k and k.get("keepers")), "slug": k.get("keepers_slug") if k else None,
                        "category": k.get("keepers_cat") if k else None}
        if v["keepers"]["listed"]:
            v["keepers"]["url"] = KEEPERS_BASE + v["keepers"]["category"] + "/" + v["keepers"]["slug"]
    # sort: name
    varieties.sort(key=lambda v: norm(v["name"]))
    missing = [k for k in keepers if k not in seen]
    if missing:
        warnings.append("not yet researched (%d): %s" % (len(missing), ", ".join(missing[:60])))

    # synonym collisions: a name or alias that appears on two different records usually means one apple, two cards
    seen_names = {}
    for v in varieties:
        for nm in [v["name"]] + (v.get("aka") or []):
            k = norm(nm)
            if k in seen_names and seen_names[k] != v["id"]:
                warnings.append("possible duplicate: %r (%s) also names %s" % (nm, v["id"], seen_names[k]))
            seen_names.setdefault(k, v["id"])

    # name index for cross-linking region 'local_varieties
    names = {}
    for v in varieties:
        names[norm(v["name"])] = v["id"]
        for a in v.get("aka") or []:
            names.setdefault(norm(a), v["id"])

    # ---- rootstocks
    rootstocks = load_dir("rootstocks")
    rseen = set()
    for r in rootstocks:
        E, W = validate_rootstock(r)
        errors += E
        warnings += W
        if r["id"] in rseen:
            errors.append("%s: duplicate rootstock id" % r["id"])
        rseen.add(r["id"])
        r["keepers"] = r["id"] in KEEPERS_ROOTSTOCKS
    order = {"very-dwarf": 0, "dwarf": 1, "semi-dwarf": 2, "semi-vigorous": 3, "vigorous": 4, "very-vigorous": 5}
    rootstocks.sort(key=lambda r: (order.get(r["size_class"], 9), r["name"]))

    # ---- regions
    seed = json.load(open(os.path.join(ROOT, "data", "regions_seed.json"), encoding="utf-8"))
    notes = {}
    for r in load_dir("regions"):
        E = validate_region(r)
        errors += E
        notes[r["id"]] = r
    regions = []
    for s in seed:
        n = notes.get(s["id"])
        if not n:
            warnings.append("region %s has no notes yet" % s["id"])
            n = {}
        reg = dict(s)
        reg.update({k: n.get(k) for k in ("summary", "apple_culture", "local_varieties", "pests_diseases", "tips", "confidence")})
        ids = []
        for nm in reg.get("local_varieties") or []:
            vid = names.get(norm(nm))
            if vid and vid not in ids:
                ids.append(vid)
        reg["variety_ids"] = ids
        regions.append(reg)

    os.makedirs(os.path.join(ROOT, "assets"), exist_ok=True)
    fstats = flavour.attach(varieties, warnings)

    glossary = json.load(open(os.path.join(ROOT, "data", "glossary.json"), encoding="utf-8")) if os.path.exists(
        os.path.join(ROOT, "data", "glossary.json")) else []

    out = {
        "built": datetime.date.today().isoformat(),
        "counts": {"varieties": len(varieties), "keepers": sum(1 for v in varieties if v["keepers"]["listed"]),
                   "rootstocks": len(rootstocks), "regions": len(regions)},
        "tasteTags": TASTE_TAGS,
        "varieties": varieties, "rootstocks": rootstocks, "regions": regions, "glossary": glossary,
    }
    os.makedirs(os.path.join(ROOT, "assets"), exist_ok=True)
    with open(os.path.join(ROOT, "assets", "data.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    for m in errors:
        print("ERROR  ", m)
    if report or errors:
        for m in warnings[:200]:
            print("warning", m)
    c = out["counts"]
    print("built assets/data.json: %d varieties (%d in Keepers range), %d rootstocks, %d regions; %d errors, %d warnings"
          % (c["varieties"], c["keepers"], c["rootstocks"], c["regions"], len(errors), len(warnings)))
    if report:
        conf = {}
        for v in varieties:
            conf[v["conf"]] = conf.get(v["conf"], 0) + 1
        print("confidence:", conf)
        nul = {k: sum(1 for v in varieties if v["climate"].get(k) is None) for k in ("chill_hours", "hardiness_zone", "heat_tolerance")}
        nul["flower_group"] = sum(1 for v in varieties if v["pollination"].get("flower_group") is None)
        nul["harvest"] = sum(1 for v in varieties if v["season"].get("harvest") is None)
        print("nulls:", nul)
        print("flavour evidence:", fstats)
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
