#!/usr/bin/env python3
"""Build research/batches/*.json - the work lists handed to variety-research agents.

Sources of names:
  * research/keepers_index.json  - names visible on Keepers Nursery's public category pages
    (name + category only; none of their descriptions or data are used - see NOTICE.md).
  * EXTRAS below - heritage / world varieties chosen by hand to round out the atlas.

Each batch entry carries the id that the finished record must use.
"""
import json, math, os, re, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MAX_PER_BATCH = 22


def clean(name):
    name = name.replace("®", "").replace("™", "")
    return re.sub(r"\s+", " ", name).strip()


def slug(name):
    n = unicodedata.normalize("NFKD", clean(name))
    n = "".join(c for c in n if not unicodedata.combining(c)).lower()
    n = re.sub(r"[’'`]", "", n)
    n = re.sub(r"[^a-z0-9]+", "-", n).strip("-")
    return n


EXTRAS = {
    "british-heritage": [
        "Ashmead's Kernel", "Allington Pippin", "Barnack Beauty", "Court Pendu Plat", "Cox's Pomona",
        "D'Arcy Spice", "Devonshire Quarrenden", "Dumelow's Seedling", "Early Victoria", "Edward VII",
        "Fortune", "Gascoyne's Scarlet", "George Cave", "George Neal", "Golden Noble", "Gladstone",
        "Herring's Pippin", "Hawthornden", "Lady Henniker", "Lord Lambourne", "Lord Derby", "Lord Hindlip",
        "Lord Grosvenor", "Mère de Ménage", "Michaelmas Red", "Norfolk Royal Russet", "Norfolk Biffin",
        "Reverend W. Wilks", "Royal Jubilee", "Winston", "Wyken Pippin", "Arbroath Pippin",
        "Seek-No-Further", "Kerry Pippin", "Ballyfatten", "Duke of Devonshire", "Sops in Wine", "Bess Pool",
        "Cockle Pippin", "Queen Cox", "Lord Suffield", "Bismarck", "Crawley Beauty", "Norfolk Beauty",
        "Mank's Codlin", "Kentish Fillbasket",
    ],
    "cider-perry-apples": [
        "Brown Snout", "Michelin", "Bulmer's Norman", "Sweet Coppin", "Somerset Redstreak",
        "Médaille d'Or", "Porter's Perfection", "Major", "Sweet Alford", "Court Royal", "Royal Wilding",
        "Frequin Rouge", "Binet Rouge", "Muscadet de Dieppe", "Kermerrien", "Raxao", "Xuanina", "Bohnapfel",
        "Börtlinger Weinapfel", "Ashton Bitter", "Browns Apple", "Gennet Moyle", "Hereford Redstreak",
        "White Jersey", "Ben's Red", "Dymock Red", "Hagloe Crab", "Tom Putt", "Sheep's Nose", "Nehou",
    ],
    "modern-commercial": [
        "Gala", "Royal Gala", "Jazz", "Cripps Pink", "Cripps Red", "Kanzi", "Rubens", "Envy", "Ambrosia",
        "Cameo", "Pinova", "SweeTango", "Ariane", "Pilot", "Santana", "Delbarestivale", "Opal",
        "Cosmic Crisp", "Rave", "Mutsu", "Akane", "Sansa", "Liberty", "Spartan", "Gloster", "Pristine",
        "Enterprise", "Freedom", "Redfree", "Priscilla", "Sir Prize", "Melrose", "Ligol", "Lobo",
    ],
    "north-american-heritage": [
        "Rome Beauty", "Stayman Winesap", "Winesap", "York Imperial", "Arkansas Black", "Ben Davis",
        "Baldwin", "Roxbury Russet", "Newtown Pippin", "Yellow Bellflower", "Tolman Sweet", "Grimes Golden",
        "Black Twig", "Gravenstein", "Red Astrachan", "Lodi", "Golden Russet", "Hubbardston Nonesuch",
        "Tompkins King", "Summer Rambo", "Westfield Seek-No-Further", "Virginia Beauty", "Hewes Crab",
        "Smokehouse", "Sheepnose", "Magnum Bonum", "Yates", "Limbertwig", "Fall Pippin", "Early Harvest",
        "American Mother", "Pink Pearl",
    ],
    "cold-hardy-and-low-chill": [
        "Wealthy", "Duchess of Oldenburg", "Haralson", "Honeygold", "Norland", "Battleford", "Goodland",
        "Prairie Spy", "Snowsweet", "Frostbite", "Zestar", "Anna", "Dorsett Golden", "Ein Shemer",
        "Tropical Beauty", "Beverly Hills", "Gordon", "Lady Williams", "Democrat", "Dunn's Favourite",
        "Winter Banana",
    ],
    "continental-and-asian": [
        "Belle de Boskoop", "Goldparmäne", "Gravensteiner", "Danziger Kantapfel",
        "Freiherr von Berlepsch", "Kaiser Wilhelm", "Schöner aus Nordhausen", "Ingrid Marie",
        "Gyllenkroks Astrakan", "Signe Tillisch", "Filippa", "Calville Rouge d'Hiver",
        "Reinette Grise du Canada", "Pomme Gris", "Belle de Pontoise", "Transparente de Croncels",
        "Calville d'Août", "Reinette Clochard", "Annurca", "Rosa Mantovana", "Berner Rosen", "Maigold",
        "Antonovka", "Anis", "Borovinka", "Papirovka", "Pepin Shafranny", "Kronprinz Rudolf",
        "Zuccalmaglio's Renette", "Malus sieversii", "Aport", "Ralls Janet", "Tsugaru", "Shinano Sweet",
        "Sekai Ichi", "Hokuto",
    ],
    "crab-apples-and-pollinators": [
        "Golden Hornet", "John Downie", "Evereste", "Red Sentinel", "Butterball", "Jelly King",
        "Transcendent", "Siberian Crab", "Profusion", "Red Jade", "Harry Baker", "Lady Northcliffe",
        "Rescue", "Hyslop", "Chestnut Crab", "Centennial", "Parkland", "Sweet Sixteen",
    ],
}

KEEPERS_THEMES = {
    "early-season-eating-apple": "keepers-early",
    "mid-season-eating-apple": "keepers-mid",
    "late-season-eating-apple": "keepers-late",
    "cooking": "keepers-cooking",
    "cider": "cider-perry-apples",
    "crab-apple": "crab-apples-and-pollinators",
    "self-fertile-apple": "keepers-mid",
}


def main():
    idx = json.load(open(os.path.join(ROOT, "research", "keepers_index.json"), encoding="utf-8"))
    entries = {}   # id -> dict
    order = []
    for kslug, v in idx.items():
        nm = clean(v["name"])
        theme = KEEPERS_THEMES[v["cats"][0]]
        eid = slug(nm)
        if eid in entries:
            continue
        entries[eid] = {"id": eid, "name": nm, "theme": theme, "keepers": True, "keepers_slug": kslug,
                        "keepers_cat": v["cats"][0]}
        order.append(eid)
    for theme, names in EXTRAS.items():
        for nm in names:
            nm = clean(nm)
            eid = slug(nm)
            if eid in entries:
                entries[eid].setdefault("also_in", []).append(theme)
                continue
            entries[eid] = {"id": eid, "name": nm, "theme": theme, "keepers": False}
            order.append(eid)

    bytheme = {}
    for eid in order:
        bytheme.setdefault(entries[eid]["theme"], []).append(entries[eid])

    outdir = os.path.join(ROOT, "research", "batches")
    os.makedirs(outdir, exist_ok=True)
    for f in os.listdir(outdir):
        if f.endswith(".json"):
            os.remove(os.path.join(outdir, f))
    batches = []
    for theme, items in sorted(bytheme.items()):
        n = max(1, math.ceil(len(items) / MAX_PER_BATCH))
        size = math.ceil(len(items) / n)
        for i in range(n):
            chunk = items[i * size:(i + 1) * size]
            if not chunk:
                continue
            bid = "%s-%d" % (theme, i + 1)
            batches.append(bid)
            json.dump({"batch": bid, "theme": theme, "count": len(chunk), "varieties": chunk},
                      open(os.path.join(outdir, bid + ".json"), "w", encoding="utf-8"),
                      ensure_ascii=False, indent=1)
    json.dump([entries[e] for e in order], open(os.path.join(ROOT, "research", "all_ids.json"), "w",
              encoding="utf-8"), ensure_ascii=False, indent=0)
    print(len(order), "varieties in", len(batches), "batches")
    for b in batches:
        d = json.load(open(os.path.join(outdir, b + ".json"), encoding="utf-8"))
        print(" ", b, d["count"])


if __name__ == "__main__":
    main()
