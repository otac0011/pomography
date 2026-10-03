#!/usr/bin/env python3
"""Fetch ten years of daily weather for every reference region into cache/climate/<id>.json.

Source: Open-Meteo Historical Weather API (ERA5 reanalysis, 0.25 deg), 2015-01-01..2024-12-31.
Free tier is limited (per IP: ~600 units/min, 5000/h, 10000/day; one 10-year x 3-variable request is ~80
units), so this paces itself (default one request per 60 s) and backs off on HTTP 429. It is resumable:
regions already in the cache are skipped. Run it in the background.

    python tools/fetch_climate.py            # all regions, resumable
    python tools/fetch_climate.py kent paris # just these
"""
import json, os, sys, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "cache", "climate")
START, END = "2015-01-01", "2024-12-31"
PAUSE = float(os.environ.get("POMONA_PAUSE", "60"))
FIRST = ["south-michigan", "norfolk", "paris", "kent", "herefordshire", "wenatchee", "hawkes-bay", "somerset",
         "minneapolis", "pays-dauge", "anchorage", "singapore", "elgin", "huon", "almaty", "tipperary"]


def url(lat, lon):
    return ("https://archive-api.open-meteo.com/v1/archive?latitude=%s&longitude=%s&start_date=%s&end_date=%s"
            "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&models=era5&timezone=auto"
            % (lat, lon, START, END))


def fetch(rid, lat, lon):
    req = urllib.request.Request(url(lat, lon), headers={"User-Agent": "pomona-apple-atlas/1.0 (research build)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        d = json.load(r)
    x = d["daily"]
    out = {"id": rid, "lat": d["latitude"], "lon": d["longitude"], "req_lat": lat, "req_lon": lon,
           "elevation": d.get("elevation"), "timezone": d.get("timezone"), "start": x["time"][0],
           "n": len(x["time"]), "tmax": x["temperature_2m_max"], "tmin": x["temperature_2m_min"],
           "prcp": x["precipitation_sum"]}
    os.makedirs(CACHE, exist_ok=True)
    with open(os.path.join(CACHE, rid + ".json"), "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))


def main():
    seed = json.load(open(os.path.join(ROOT, "data", "regions_seed.json"), encoding="utf-8"))
    byid = {r["id"]: r for r in seed}
    ids = sys.argv[1:] or ([i for i in FIRST if i in byid] + [r["id"] for r in seed if r["id"] not in FIRST])
    todo = [i for i in ids if not os.path.exists(os.path.join(CACHE, i + ".json"))]
    print("%d regions to fetch (%d cached)" % (len(todo), len(ids) - len(todo)), flush=True)
    for n, rid in enumerate(todo):
        r = byid[rid]
        while True:
            try:
                fetch(rid, r["lat"], r["lon"])
                print("[%d/%d] %s ok" % (n + 1, len(todo), rid), flush=True)
                break
            except urllib.error.HTTPError as e:
                body = e.read().decode("utf-8", "replace")[:200]
                wait = 900 if e.code == 429 else 120
                print("[%d/%d] %s HTTP %s %s -> sleep %ds" % (n + 1, len(todo), rid, e.code, body, wait), flush=True)
                time.sleep(wait)
            except Exception as e:  # network blip
                print("[%d/%d] %s error %s -> sleep 60" % (n + 1, len(todo), rid, e), flush=True)
                time.sleep(60)
        time.sleep(PAUSE)
    print("done", flush=True)


if __name__ == "__main__":
    main()
