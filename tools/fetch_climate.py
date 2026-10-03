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
RATE = float(os.environ.get("POMONA_RATE", "1.1"))
FIRST = ["south-michigan", "norfolk", "paris", "kent", "herefordshire", "wenatchee", "hawkes-bay", "somerset",
         "minneapolis", "pays-dauge", "anchorage", "singapore", "elgin", "huon", "almaty", "tipperary"]


def url(lat, lon):
    return ("https://archive-api.open-meteo.com/v1/archive?latitude=%s&longitude=%s&start_date=%s&end_date=%s"
            "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&models=era5&timezone=auto"
            % (lat, lon, START, END))


HUM_START, HUM_END = "2022-01-01", "2024-12-31"


def url_hum(lat, lon):
    # humidity climatology: daily dew point and hours of rain, 3 years (about 30 free-tier units)
    return ("https://archive-api.open-meteo.com/v1/archive?latitude=%s&longitude=%s&start_date=%s&end_date=%s"
            "&daily=temperature_2m_min,precipitation_sum,dew_point_2m_mean,precipitation_hours&models=era5&timezone=auto"
            % (lat, lon, HUM_START, HUM_END))


def _get(u):
    req = urllib.request.Request(u, headers={"User-Agent": "pomona-apple-atlas/1.0 (research build)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def load(rid):
    f = os.path.join(CACHE, rid + ".json")
    return json.load(open(f, encoding="utf-8")) if os.path.exists(f) else None


def save(rid, d):
    os.makedirs(CACHE, exist_ok=True)
    with open(os.path.join(CACHE, rid + ".json"), "w", encoding="utf-8") as f:
        json.dump(d, f, separators=(",", ":"))


def fetch(rid, lat, lon):
    d = _get(url(lat, lon))
    x = d["daily"]
    out = load(rid) or {}
    out.update({"id": rid, "lat": d["latitude"], "lon": d["longitude"], "req_lat": lat, "req_lon": lon,
                "elevation": d.get("elevation"), "timezone": d.get("timezone"), "start": x["time"][0],
                "n": len(x["time"]), "tmax": x["temperature_2m_max"], "tmin": x["temperature_2m_min"],
                "prcp": x["precipitation_sum"]})
    save(rid, out)


def fetch_hum(rid, lat, lon):
    d = _get(url_hum(lat, lon))
    x = d["daily"]
    out = load(rid)
    out["hum"] = {"start": x["time"][0], "tmin": x["temperature_2m_min"], "prcp": x["precipitation_sum"],
                  "dew": x["dew_point_2m_mean"], "ph": x["precipitation_hours"]}
    save(rid, out)


def main():
    seed = json.load(open(os.path.join(ROOT, "data", "regions_seed.json"), encoding="utf-8"))
    byid = {r["id"]: r for r in seed}
    ids = sys.argv[1:] or ([i for i in FIRST if i in byid] + [r["id"] for r in seed if r["id"] not in FIRST])
    # work list: (kind, id). Humidity-only top-ups for places already downloaded come first (cheap), then full places.
    work = []
    for i in ids:
        d = load(i)
        if d and "tmax" in d and "hum" not in d:
            work.append(("hum", i))
    for i in ids:
        d = load(i)
        if not d or "tmax" not in d:
            work.append(("main", i))
            work.append(("hum", i))
    print("%d requests to make" % len(work), flush=True)
    for n, (kind, rid) in enumerate(work):
        r = byid[rid]
        if kind == "hum" and not (load(rid) or {}).get("tmax"):
            print("skip hum %s (no weather file)" % rid, flush=True)
            continue
        units = 80 if kind == "main" else 32
        while True:
            try:
                (fetch if kind == "main" else fetch_hum)(rid, r["lat"], r["lon"])
                print("[%d/%d] %s %s ok" % (n + 1, len(work), kind, rid), flush=True)
                break
            except urllib.error.HTTPError as e:
                body = e.read().decode("utf-8", "replace")[:200]
                wait = 900 if e.code == 429 else 120
                print("[%d/%d] %s %s HTTP %s %s -> sleep %ds" % (n + 1, len(work), kind, rid, e.code, body, wait), flush=True)
                time.sleep(wait)
            except Exception as e:  # network blip
                print("[%d/%d] %s %s error %s -> sleep 60" % (n + 1, len(work), kind, rid, e), flush=True)
                time.sleep(60)
        time.sleep(units * RATE)     # default 1.1 s per unit = ~3,300 units/hour, leaving headroom for live clicks from this IP
    print("done", flush=True)


if __name__ == "__main__":
    main()
