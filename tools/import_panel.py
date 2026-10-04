#!/usr/bin/env python3
"""Import sensory (taste/texture) scores from the UK National Fruit
Collection characterisation & evaluation data into data/panel/nfc.json.

Source: Ordidge M, Hale P (2025) Characterization and Evaluation data from
the National Fruit Collection 2025_Apple. University of Reading. Dataset.
https://doi.org/10.17864/1947.001455 - Open Government Licence 3.0 (stated
on the landing page and in the README; rights holder Defra).

Raw files (cache/chem/nfc/, gitignored), downloaded from the landing page
https://researchdata.reading.ac.uk/id/eprint/1455 :
    NFC_C_E_data_Apple_22_08_25.csv   one row per accession, 73 columns
    README_Ordidge_Apple_2025.txt
    page.html                         landing page (licence check)

Scale definitions are those of the ECPGR Characterization and Evaluation
Descriptors for Apple Genetic Resources (Lateur et al. 2022), which the
README says the data follow; the CSV carries both the verbal state and the
numeric code, and every verbal state maps to exactly one code.

The sensory columns (firmness, sweetness, acidity, acid/sweet balance,
juiciness, crunchiness, aroma intensity, overall dessert quality) are filled
only for accessions with a recorder "P. Hale" plus a harvest date and a
recording date: one assessor, one sample per accession (no repeats, no
panel). The dataset has no free-text flavour descriptors, so flavour_words
is always empty. Values are copied as published; we only average when
several accessions of one cultivar were scored.

Usage:
    python tools/import_panel.py               # write data/panel/nfc.json + coverage
    python tools/import_panel.py --review      # matches whose source name differs
                                               # from ours, and dropped accessions
    python tools/import_panel.py --candidates  # unmatched scored names that look
                                               # like one of our varieties
"""
from __future__ import annotations

import csv
import difflib
import json
import re
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from import_chemistry import load_varieties, norm, norm_loose  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "cache" / "chem" / "nfc" / "NFC_C_E_data_Apple_22_08_25.csv"
OUT = ROOT / "data" / "panel" / "nfc.json"

SOURCE = {
    "key": "nfc-ce",
    "title": "Characterization and Evaluation data from the National Fruit Collection 2025_Apple",
    "authors": "Ordidge M, Hale P",
    "year": 2025,
    "url": "https://doi.org/10.17864/1947.001455",
    "data_url": "https://researchdata.reading.ac.uk/id/eprint/1455 (NFC_C_E_data_Apple_22_08_25.csv)",
    "licence": "OGL 3.0",
    "attribution": "Contains public sector information licensed under the Open Government Licence v3.0 "
                   "(Crown copyright, Department for Environment, Food & Rural Affairs).",
    "where": "Brogdale, Faversham, Kent, UK",
    "method": (
        "Sensory scores recorded by one assessor (P. Hale, Fruit Advisory Services Team) on fruit of one "
        "tree per accession, harvested and tasted once at eating maturity (dates given per record), "
        "c. 2019-2024, following the ECPGR apple descriptors (Lateur et al. 2022) on 1-9 scales where even "
        "numbers are intermediate states. sweet: 1 = extremely low, 3 = low, 5 = intermediate, 7 = high, "
        "9 = extremely high sweetness. acid: 1 = extremely low, 5 = intermediate, 9 = extremely high acidity. "
        "balance (acidity/sweetness): 1 = extremely more acid than sweet, 5 = good balance, "
        "9 = extremely more sweet than acid. juice: 1 = extremely low, 5 = intermediate, 9 = extremely high "
        "juiciness when chewed. aroma (intensity of aromatic taste, not type): 1 = extremely low, "
        "5 = medium, 9 = extremely high. texture.firm (force to chew): 1 = extremely soft, 5 = intermediate, "
        "9 = extremely firm. texture.crunch (sustained granular resistance while chewing): 1 = extremely low, "
        "5 = intermediate, 9 = extremely high. quality (overall dessert quality, hedonic): 1 = extremely poor, "
        "3 = poor, 5 = good, 7 = very good, 9 = extremely good. Season fields are copied from the collection's "
        "descriptions (partly standardised from Smith 1971, National Apple Register): pick = time of harvest "
        "maturity; keeps_to = latest month of storage. Where several accessions of one cultivar were scored "
        "the scores are averaged (n = accessions averaged, each scored once). Accessions that are sports, "
        "spur/compact types, clones with a distinct name or induced tetraploids are excluded; accessions "
        "whose MUNQ genotype code disagrees with the cultivar's majority are dropped."
    ),
}

# column indices (0-based) in the CSV
C_MUNQ, C_ACC, C_NAME, C_TYPE = 0, 1, 2, 3
C_HARV, C_REC, C_RECORDER = 41, 42, 44
C_PICK, C_STORE = 69, 72
SENSORY = {          # field -> (numeric column, expected header fragment)
    "firm": (46, "Fruit firmness 2 sensory"),
    "sweet": (48, "Flesh sweetness 1 sensory"),
    "acid": (50, "Flesh acidity 1 sensory"),
    "balance": (52, "Ratio between acidity and sweetness"),
    "juice": (54, "Flesh juiciness"),
    "crunch": (56, "Flesh crunchiness"),
    "aroma": (58, "Intensity of fruit aroma"),
    "quality": (60, "Overall fruit quality"),
}

# Hand-checked source names -> our id (spelling variants / short forms).
PROBABLE: dict[str, str] = {}

# Source names that would auto-match one of our names but are something else.
REJECT: dict[str, str] = {
    "Gilliflower": "bare 'Gilliflower' is used for several cultivars",
}

# Parenthesised qualifiers that do not change the cultivar: virus-tested
# clone codes (LA = Long Ashton, EMLA = East Malling-Long Ashton, EM, NFT =
# National Fruit Trials), natural triploid notes, and (a)/(b) duplicates.
BENIGN = re.compile(r"^(?:(?:EM)?LA\s*\d*\w*|EMLA\s*\d*|EM|NFT\s*\d*|[23][nx]|[ab])$", re.I)
# Anything signalling a different selection of the cultivar.
NOT_SAME = re.compile(r"\b(?:sport|spur|mutation|clone|compact|self-fertile|strain|supposed|[4-8][nx])\b|\?",
                      re.I)
TRAILING_CODE = re.compile(r"\s+(?:EM)?LA\s*\d+\w*$", re.I)


def parse_name(name: str):
    """-> (base name, list of qualifiers, list of synonyms given as '(syn X)')."""
    name = " ".join(name.split())
    quals, syns = [], []
    for q in re.findall(r"\(([^()]*)(?:\)|$)", name):
        q = q.strip()
        m = re.match(r"syn\.?\s+(.+)$", q, re.I)
        if m:
            syns.append(m.group(1).strip())
        elif q:
            quals.append(q)
    base = name.split("(")[0].strip()
    m = TRAILING_CODE.search(base)
    if m:
        quals.append(m.group(0).strip())
        base = base[:m.start()].strip()
    return base, quals, syns


def lookup(name: str, index):
    if name in REJECT:
        return None
    if name in PROBABLE:
        return PROBABLE[name], "probable"
    hit = index.get(norm(name))
    if hit:
        return hit
    return index.get("~" + norm_loose(name))


def classify(full: str, index):
    """-> (vid, kind, tier, note, full_hit) or None. tier: 'firm' (cultivar name with at
    most a clone-code qualifier) or 'loose' (donor/place qualifier, or a
    possessive/spelling variant)."""
    base, quals, syns = parse_name(full)
    if NOT_SAME.search(base) or any(NOT_SAME.search(q) for q in quals):
        return None
    hit, cand = None, None
    for cand in [full, base] + syns:
        hit = lookup(cand, index)
        if hit:
            break
    if not hit:
        return None
    vid, kind = hit
    # a parenthesis that is part of a name we list (e.g. "Mother (American)") is not a qualifier
    # a qualifier that is itself one of our names for the same cultivar
    # (e.g. "Tenroy (Royal Gala)") confirms rather than weakens the match
    other = [] if cand == full else [q for q in quals if not BENIGN.match(q)
                                     and (lookup(q, index) or (None,))[0] != vid]
    full_hit = cand == full and "(" in full
    if kind == "probable":
        return vid, kind, "loose", "spelling variant", full_hit
    if other:
        return vid, kind, "loose", "qualifier: " + ", ".join(other), full_hit
    return vid, kind, "firm", "", full_hit


def num(x):
    x = (x or "").strip()
    try:
        return float(x)
    except ValueError:
        return None


def read_rows():
    with SRC.open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f))
    head = rows[0]
    for field, (col, frag) in SENSORY.items():
        assert frag.lower() in head[col].lower(), (field, head[col])
    assert "Accession Name" in head[C_NAME] and "Harvest Date" in head[C_HARV]
    accs = []
    for r in rows[1:]:
        if not r[C_NAME].strip() or r[C_NAME].strip().lower() == "unknown":
            continue
        scores = {k: num(r[c]) for k, (c, _) in SENSORY.items()}
        if all(v is None for v in scores.values()):
            continue
        accs.append({
            "name": " ".join(r[C_NAME].split()),
            "acc": r[C_ACC].strip(),
            "munq": r[C_MUNQ].strip(),
            "type": r[C_TYPE].strip(),
            "harvest": r[C_HARV].strip() or None,
            "tasted": r[C_REC].strip() or None,
            "pick": r[C_PICK].strip() or None,
            "keeps_to": r[C_STORE].strip() or None,
            **scores,
        })
    return accs


def avg(xs):
    xs = [x for x in xs if x is not None]
    if not xs:
        return None
    m = statistics.fmean(xs)
    return int(m) if m == int(m) else round(m, 1)


def mode(xs):
    xs = [x for x in xs if x]
    return Counter(xs).most_common(1)[0][0] if xs else None


def build(accs, index):
    by_vid = defaultdict(list)
    unmatched = []
    for a in accs:
        c = classify(a["name"], index)
        if c is None:
            unmatched.append(a)
            continue
        a["vid"], a["kind"], a["tier"], a["note"], a["full"] = c
        by_vid[a["vid"]].append(a)

    records, dropped = {}, []
    for vid, group in sorted(by_vid.items()):
        firm = [a for a in group if a["tier"] == "firm"]
        if firm:
            munqs = {a["munq"] for a in firm if a["munq"]}
            keep = firm + [a for a in group if a["tier"] == "loose" and a["munq"] and a["munq"] in munqs]
        else:
            keep = list(group)
        # genotype check: keep the majority MUNQ. Ties go to the accession whose
        # full qualified name is one we list (e.g. our "Sunrise (Canada)" beats a
        # plain "Sunrise" of another genotype), then to an exact-name accession.
        mc = Counter(a["munq"] for a in keep if a["munq"])
        if len(mc) > 1:
            def rank(m):
                g = [a for a in keep if a["munq"] == m]
                return (mc[m], any(a["full"] for a in g), any(a["kind"] == "exact" for a in g))
            top = max(mc, key=rank)
            for a in keep:
                if a["munq"] and a["munq"] != top:
                    dropped.append((vid, a, f"MUNQ {a['munq']} != {top}"))
            keep = [a for a in keep if not a["munq"] or a["munq"] == top]
        for a in group:
            if a not in keep and not any(d[1] is a for d in dropped):
                dropped.append((vid, a, "lower-confidence duplicate of a firm match"))

        kinds = {a["kind"] for a in keep}
        tier_firm = any(a["tier"] == "firm" for a in keep)
        if tier_firm and "exact" in kinds:
            match = "exact"
        elif tier_firm:
            match = "synonym"
        else:
            match = "probable"
        rec = {
            "accession": "; ".join(a["name"] for a in keep),
            "sweet": avg(a["sweet"] for a in keep),
            "acid": avg(a["acid"] for a in keep),
            "balance": avg(a["balance"] for a in keep),
            "aroma": avg(a["aroma"] for a in keep),
            "texture": {"firm": avg(a["firm"] for a in keep), "crunch": avg(a["crunch"] for a in keep)},
            "juice": avg(a["juice"] for a in keep),
            "quality": avg(a["quality"] for a in keep),
            "flavour_words": [],
            "pick": mode(a["pick"] for a in keep),
            "keeps_to": mode(a["keeps_to"] for a in keep),
            "assessed": [{"harvest": a["harvest"], "tasted": a["tasted"]} for a in keep],
            "n": len(keep),
            "match": match,
        }
        if len(keep) > 1:
            rec["per_accession"] = [
                {"accession": a["name"], "acc_no": a["acc"], "munq": a["munq"] or None,
                 **{k: a[k] for k in ("sweet", "acid", "balance", "aroma", "firm", "crunch", "juice", "quality")}}
                for a in keep]
        else:
            rec["acc_no"] = keep[0]["acc"]
        records[vid] = rec
    return records, by_vid, dropped, unmatched


def main():
    vs, index, _amb = load_varieties()
    names = {v["id"]: v["name"] for v in vs}
    accs = read_rows()
    records, by_vid, dropped, unmatched = build(accs, index)

    if "--candidates" in sys.argv:
        keys = {}
        for v in vs:
            for n in [v["name"]] + (v.get("aka") or []):
                keys[norm(n)] = v["id"]
        for a in sorted(unmatched, key=lambda a: a["name"]):
            base = parse_name(a["name"])[0]
            best = difflib.get_close_matches(norm(base), list(keys), n=1, cutoff=0.82)
            if best:
                print(f"{a['name']!r:55} ~ {keys[best[0]]}  ({best[0]})")
        return

    if "--review" in sys.argv:
        print("Matches whose source name differs from our name:")
        for vid, rec in records.items():
            if rec["accession"] != names[vid]:
                print(f"  {vid:32} {rec['match']:9} n={rec['n']}  {rec['accession']}")
        print("\nDropped accessions:")
        for vid, a, why in dropped:
            print(f"  {vid:32} {a['name']!r:45} {why}")
        return

    OUT.parent.mkdir(parents=True, exist_ok=True)
    out = {"_source": SOURCE, "records": records}
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    km = Counter(r["match"] for r in records.values())
    print(f"NFC rows with sensory scores (named): {len(accs)}")
    print(f"matched to our varieties: {len(records)} of {len(vs)} "
          f"({100 * len(records) / len(vs):.0f}%)  exact {km['exact']}, synonym {km['synonym']}, "
          f"probable {km['probable']}")
    print(f"accessions averaged: {sum(r['n'] for r in records.values())}; "
          f"records with n>1: {sum(r['n'] > 1 for r in records.values())}; dropped accessions: {len(dropped)}")
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
