"""Shared validation + normalisation for Pomona variety / rootstock / region records."""
import re

TASTE_TAGS = [
    "floral", "rose", "elderflower", "perfumed", "honey", "vanilla", "caramel", "butterscotch", "nutty",
    "almond", "walnut", "aniseed", "fennel", "spice", "clove", "cinnamon", "pear-drop", "pear", "quince",
    "pineapple", "banana", "melon", "mango", "apricot", "peach", "lemon", "citrus", "strawberry", "berry",
    "cherry", "grape", "wine", "herbal", "tea", "earthy", "musky", "bitter", "astringent", "sharp", "sweet",
    "mild", "savoury",
]
USES = ["dessert", "culinary", "cider", "juice", "crab", "ornamental"]
KIND = ["chance", "bred", "ancient", "sport", "discovered", "unknown"]
SIZE = ["small", "medium", "large"]
SHAPE = ["flat", "round-flat", "round", "round-conical", "conical", "oblong", "ribbed", "irregular"]
GROUND = ["green", "yellow-green", "yellow", "gold", "cream"]
BLUSH = ["none", "pink", "orange", "orange-red", "red", "deep-red", "crimson", "purple", "brown"]
HABIT = ["upright", "upright-spreading", "spreading", "weeping", "columnar", "compact"]
BEARING = ["spur", "tip", "part-tip"]
CROPPING = ["light", "moderate", "heavy"]
BIENNIAL = ["none", "slight", "marked"]
PLOIDY = ["diploid", "triploid", "tetraploid"]
SELFF = ["no", "partial", "yes"]
CIDER = ["sweet", "bittersweet", "sharp", "bittersharp"]
CONF = ["high", "medium", "low"]
MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
MONTH_START_DOY = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
PART_DAY = {"early": 6, "mid": 16, "late": 26}
VARIETY_TAGS = ["keepers-bred"]
HEALTH = ["scab", "canker", "mildew", "fire_blight", "rust", "bitter_pit"]


def parse_harvest(s):
    """'late Sep' -> day-of-year; 'mid Sep-early Oct' -> midpoint. None if unparseable."""
    if not isinstance(s, str):
        return None
    s = s.lower().replace("–", "-").replace("—", "-")
    pts = re.findall(r"(early|mid|late)\s+([a-z]{3})[a-z]*", s)
    if not pts:
        return None
    ds = []
    for part, mon in pts:
        if mon not in MONTHS:
            return None
        ds.append(MONTH_START_DOY[MONTHS.index(mon)] + PART_DAY[part])
    return round(sum(ds) / len(ds))


def parse_harvest_range(s):
    """(from_doy, to_doy) covering every part named in the string, +-5 days around each part; None if unparseable."""
    if not isinstance(s, str):
        return None
    s = s.lower().replace("–", "-").replace("—", "-")
    pts = re.findall(r"(early|mid|late)\s+([a-z]{3})[a-z]*", s)
    ds = [MONTH_START_DOY[MONTHS.index(m)] + PART_DAY[p] for p, m in pts if m in MONTHS]
    if not ds:
        return None
    return (min(ds) - 5, max(ds) + 5)


def _int(v, lo, hi):
    return isinstance(v, int) and not isinstance(v, bool) and lo <= v <= hi


def _enum(v, vals, nullable=False):
    return (v is None and nullable) or v in vals


def validate_variety(v):
    """Return (errors, warnings) lists of strings."""
    E, W = [], []
    vid = v.get("id", "?")

    def e(msg):
        E.append("%s: %s" % (vid, msg))

    def w(msg):
        W.append("%s: %s" % (vid, msg))

    for k in ("id", "name", "uses", "origin", "history", "look", "taste", "tree", "pollination", "season",
              "climate", "health", "grow_notes", "conf"):
        if k not in v:
            e("missing key '%s'" % k)
    if E:
        return E, W
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", v["id"]):
        e("bad id")
    if not isinstance(v["name"], str) or not v["name"]:
        e("bad name")
    if not isinstance(v.get("aka", []), list):
        e("aka must be a list")
    if not v["uses"] or not all(u in USES for u in v["uses"]):
        e("uses must be a non-empty subset of %s" % USES)
    o = v["origin"]
    if not (o.get("country") is None or re.fullmatch(r"[A-Z]{2}", str(o.get("country")))):
        e("origin.country must be ISO alpha-2 or null")
    if not (o.get("year") is None or _int(o.get("year"), 1000, 2030)):
        e("origin.year must be int or null")
    if not _enum(o.get("kind"), KIND, True):
        e("origin.kind invalid")
    if not (isinstance(v["history"], str) and len(v["history"]) >= 20):
        w("history missing/short")
    lk = v["look"]
    if not _enum(lk.get("size"), SIZE, True):
        e("look.size")
    if not _enum(lk.get("shape"), SHAPE, True):
        e("look.shape %r" % lk.get("shape"))
    if not _enum(lk.get("ground"), GROUND, True):
        e("look.ground %r" % lk.get("ground"))
    if not _enum(lk.get("blush"), BLUSH, True):
        e("look.blush %r" % lk.get("blush"))
    if not (lk.get("blush_cover") is None or _int(lk.get("blush_cover"), 0, 100)):
        e("look.blush_cover")
    if not (lk.get("russet") is None or _int(lk.get("russet"), 0, 3)):
        e("look.russet")
    t = v["taste"]
    for k in ("sweet", "acid", "aroma", "crisp", "juicy"):
        if not (t.get(k) is None or _int(t.get(k), 1, 5)):
            e("taste.%s must be 1-5 or null" % k)
    if not (t.get("tannin") is None or _int(t.get("tannin"), 0, 5)):
        e("taste.tannin must be 0-5")
    tags = t.get("tags", [])
    if not isinstance(tags, list) or any(x not in TASTE_TAGS for x in tags):
        e("taste.tags has unknown tag(s): %s" % [x for x in tags if x not in TASTE_TAGS])
    elif len(tags) > 8:
        w("more than 8 taste tags")
    if not _enum(t.get("cider_class"), CIDER, True):
        e("taste.cider_class")
    if not (isinstance(t.get("summary"), str) and len(t["summary"]) >= 20):
        w("taste.summary missing/short")
    tr = v["tree"]
    if not (tr.get("vigor") is None or _int(tr.get("vigor"), 1, 5)):
        e("tree.vigor")
    if not _enum(tr.get("habit"), HABIT, True):
        e("tree.habit %r" % tr.get("habit"))
    if not _enum(tr.get("bearing"), BEARING, True):
        e("tree.bearing")
    if not _enum(tr.get("cropping"), CROPPING, True):
        e("tree.cropping")
    if not _enum(tr.get("biennial"), BIENNIAL, True):
        e("tree.biennial")
    if not (tr.get("precocity") is None or _int(tr.get("precocity"), 1, 5)):
        e("tree.precocity")
    if not _enum(tr.get("ploidy"), PLOIDY, True):
        e("tree.ploidy")
    p = v["pollination"]
    if not (p.get("flower_group") is None or _int(p.get("flower_group"), 1, 7)):
        e("pollination.flower_group must be 1-7")
    if not _enum(p.get("self_fertile"), SELFF, True):
        e("pollination.self_fertile")
    if tr.get("ploidy") == "triploid" and p.get("self_fertile") == "yes":
        w("triploid but self_fertile yes?")
    s = v["season"]
    doy = parse_harvest(s.get("harvest"))
    if s.get("harvest") is not None and doy is None:
        e("season.harvest unparseable %r (use e.g. 'late Sep' or 'mid Sep-early Oct')" % s.get("harvest"))
    if not (s.get("storage_weeks") is None or _int(s.get("storage_weeks"), 0, 60)):
        e("season.storage_weeks")
    c = v["climate"]
    if not (c.get("chill_hours") is None or _int(c.get("chill_hours"), 0, 2500)):
        e("climate.chill_hours")
    if not (c.get("hardiness_zone") is None or _int(c.get("hardiness_zone"), 2, 10)):
        e("climate.hardiness_zone")
    if not (c.get("heat_tolerance") is None or _int(c.get("heat_tolerance"), 1, 5)):
        e("climate.heat_tolerance")
    h = v["health"]
    for k in HEALTH:
        if not (h.get(k) is None or _int(h.get(k), 1, 5)):
            e("health.%s must be 1-5 or null" % k)
    if v["conf"] not in CONF:
        e("conf")
    if not isinstance(v.get("tags", []), list) or any(x not in VARIETY_TAGS for x in v.get("tags", [])):
        e("tags must be a subset of %s" % VARIETY_TAGS)
    nulls = sum(1 for sec, keys in (("climate", ["chill_hours", "hardiness_zone", "heat_tolerance"]),
                                    ("pollination", ["flower_group"]), ("season", ["harvest"]))
                for k in keys if v[sec].get(k) is None)
    if nulls >= 3 and v["conf"] != "low":
        w("many climate/season nulls but conf != low")
    if "cider" in v["uses"] and t.get("cider_class") is None:
        w("cider use but no cider_class")
    return E, W
