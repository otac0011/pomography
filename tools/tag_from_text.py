#!/usr/bin/env python3
"""Suggest missing taste tags by scanning each variety's written tasting summary for strong flavour words.

    python tools/tag_from_text.py            # dry run: print what would be added
    python tools/tag_from_text.py --write research/patches/003-flavour-tags.json

Only distinctive nouns are matched (vanilla, rose-water, pineapple, aniseed, ...), a match inside a negation
("no vanilla", "not floral", "lacking") is ignored, and no record is pushed past 8 tags.
"""
import glob, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEYS = {
    "vanilla": r"vanilla", "rose": r"rose[- ]?water|rosewater|rose petal|rose[- ]like|roses\b|rosy perfume", "elderflower": r"elderflower",
    "floral": r"\bfloral|flowery|blossom[- ]?(?:y|scent|like)|violet", "perfumed": r"perfum", "honey": r"\bhoney", "caramel": r"caramel|toffee",
    "butterscotch": r"butterscotch", "nutty": r"\bnutt?y|hazelnut|nuts?\b", "almond": r"almond|marzipan", "walnut": r"walnut",
    "aniseed": r"anise|aniseed|liquorice|licorice", "fennel": r"fennel", "spice": r"\bspic(?:e|y|ed)", "clove": r"\bclove", "cinnamon": r"cinnamon|nutmeg",
    "pear-drop": r"pear[- ]drop|pear drop", "pear": r"\bpear(?:s|y)?\b(?![- ]drop)(?!main)", "quince": r"quince", "pineapple": r"pineapple", "banana": r"banana",
    "melon": r"\bmelon", "mango": r"\bmango", "apricot": r"apricot", "peach": r"\bpeach", "lemon": r"\blemon", "citrus": r"citrus|grapefruit|orange[- ]peel",
    "strawberry": r"strawberr", "berry": r"raspberr|blackcurrant|\bberry|berries|blackberr", "cherry": r"\bcherr", "grape": r"\bgrape", "wine": r"\bwine|winey|vinous",
    "herbal": r"\bherb", "tea": r"\btea\b", "earthy": r"\bearthy", "musky": r"\bmusk",
}
NEG = re.compile(r"(?:\bno\b|\bnot\b|\bwithout\b|\black(?:s|ing)?\b|\blittle\b|\bnor\b|\bunlike\b|\bless\b|[Nn]othing)[^.;]{0,25}$")


def scan(text):
    out = []
    t = text or ""
    for tag, rx in KEYS.items():
        for m in re.finditer(rx, t, re.I):
            before = t[max(0, m.start() - 40):m.start()]
            if NEG.search(before):
                continue
            out.append(tag)
            break
    return out


def main():
    patch, added = {}, 0
    for f in sorted(glob.glob(os.path.join(ROOT, "data", "varieties", "*.json"))):
        for r in json.load(open(f, encoding="utf-8")):
            tags = list(r["taste"].get("tags") or [])
            text = (r["taste"].get("summary") or "")
            new = [t for t in scan(text) if t not in tags]
            if not new or not text:
                continue
            room = 8 - len(tags)
            new = new[:max(0, room)]
            if new:
                patch[r["id"]] = {"taste": {"tags": tags + new}}
                added += len(new)
                print(r["id"].ljust(28), "+", ", ".join(new), "   (", ", ".join(tags), ")")
    print(len(patch), "records, ", added, "tags to add")
    if "--write" in sys.argv:
        out = sys.argv[sys.argv.index("--write") + 1]
        patch = {"_note": "Flavour tags added by scanning the written tasting summaries (tools/tag_from_text.py), 2026-10-03."} | patch
        json.dump(patch, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
