#!/usr/bin/env python3
"""Collect visitors' taste reports (GitHub issues labelled `taste-report`) into data/tastings.json.

    python tools/import_tastings.py            # needs GITHUB_TOKEN, or a logged-in `gh` CLI

Run nightly by .github/workflows/tastings.yml. Issues labelled `invalid`, `spam` or `duplicate` are ignored. The site
shows a variety's summary only once it has MIN_TASTINGS (3) reports (tools/flavour.py).
"""
import json, os, re, subprocess, sys, unicodedata, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.environ.get("GITHUB_REPOSITORY", "otac0011/pomography")
SKIP = {"invalid", "spam", "duplicate"}
TICK = {"rose-water": "rose"}          # form wording -> taste tag
SCALES = ("sweet", "acid", "aroma", "crisp", "juicy")
HEADINGS = {"Variety": "variety", "Sweetness": "sweet", "Sharpness (acidity)": "acid", "Aroma / complexity": "aroma",
            "Texture": "crisp", "Juiciness": "juicy", "Flavours you noticed (tick any)": "notes",
            "Other flavour words": "other_notes", "Where the apple came from": "from",
            "Where it was grown (as precise as you like)": "where", "When you ate it, and how long after picking": "when"}


def norm(s):
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower().replace("'", "").replace("’", "")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def token():
    if os.environ.get("GITHUB_TOKEN"):
        return os.environ["GITHUB_TOKEN"]
    try:
        return subprocess.run(["gh", "auth", "token"], capture_output=True, text=True, check=True).stdout.strip()
    except Exception:  # noqa: BLE001
        return None


def issues():
    tok, page, out = token(), 1, []
    while True:
        url = "https://api.github.com/repos/%s/issues?labels=taste-report&state=all&per_page=100&page=%d" % (REPO, page)
        req = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": "pomography"})
        if tok:
            req.add_header("Authorization", "Bearer " + tok)
        batch = json.load(urllib.request.urlopen(req, timeout=60))
        out += [i for i in batch if "pull_request" not in i]
        if len(batch) < 100:
            return out
        page += 1


def parse(body):
    """Issue-form markdown -> {field: value}."""
    f, cur = {}, None
    for line in (body or "").splitlines():
        m = re.match(r"^###\s+(.*)$", line)
        if m:
            cur = HEADINGS.get(m.group(1).strip()); f.setdefault(cur, []) if cur else None; continue
        if cur:
            f[cur].append(line)
    out = {}
    for k, v in f.items():
        text = "\n".join(v).strip()
        if k == "notes":
            out[k] = [TICK.get(x, x) for x in re.findall(r"- \[[xX]\]\s*(.+)", text)]
        elif k in SCALES:
            m = re.match(r"([1-5])", text)
            out[k] = int(m.group(1)) if m else None
        else:
            out[k] = None if text in ("", "_No response_") else text
    return out


def main():
    data = json.load(open(os.path.join(ROOT, "assets", "data.json"), encoding="utf-8"))
    names = {}
    for v in data["varieties"]:
        for nm in [v["name"]] + (v.get("aka") or []):
            names.setdefault(norm(nm), v["id"])
    agg, unknown = {}, []
    for i in issues():
        if {l["name"] for l in i.get("labels", [])} & SKIP:
            continue
        r = parse(i.get("body"))
        vid = names.get(norm(r.get("variety") or "")) or names.get(norm(re.sub(r"^taste:\s*", "", i["title"], flags=re.I)))
        if not vid:
            unknown.append(i["number"]); continue
        a = agg.setdefault(vid, {"n": 0, "issues": [], "tags": {}, "sums": {k: [0, 0] for k in SCALES}, "where": []})
        a["n"] += 1
        a["issues"].append(i["number"])
        for k in SCALES:
            if r.get(k):
                a["sums"][k][0] += r[k]; a["sums"][k][1] += 1
        for tg in r.get("notes") or []:
            a["tags"][tg] = a["tags"].get(tg, 0) + 1
        if r.get("where"):
            a["where"].append(r["where"][:60])
    out = {}
    for vid, a in sorted(agg.items()):
        out[vid] = {"n": a["n"], "issues": a["issues"], "tags": dict(sorted(a["tags"].items(), key=lambda x: -x[1])),
                    "where": a["where"][:10]}
        for k, (s, n) in a["sums"].items():
            out[vid][k] = round(s / n, 1) if n else None
    json.dump(out, open(os.path.join(ROOT, "data", "tastings.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print("tastings: %d reports for %d varieties%s" % (sum(a["n"] for a in out.values()), len(out),
                                                       ("; unmatched issues %s" % unknown) if unknown else ""))


if __name__ == "__main__":
    sys.exit(main())
