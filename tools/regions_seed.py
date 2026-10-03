#!/usr/bin/env python3
"""Reference regions shown as pins on the map (and baked with real climate data).

id, name, country (ISO2), lat, lon, group, kind
kind: commercial | heritage | garden | marginal | extreme   (rough role of apples there)
Writes research/region_batches/<group>.json for the region-notes agents, and data/regions_seed.json.
"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

R = [
    # --- British Isles ---
    ("kent", "Kent (East Farleigh and the Weald)", "GB", 51.25, 0.47, "British Isles", "heritage"),
    ("norfolk", "Norfolk (Norwich)", "GB", 52.63, 1.30, "British Isles", "heritage"),
    ("herefordshire", "Herefordshire", "GB", 52.06, -2.72, "British Isles", "heritage"),
    ("somerset", "Somerset (Taunton and the cider country)", "GB", 51.02, -3.10, "British Isles", "heritage"),
    ("devon", "Devon (Totnes)", "GB", 50.43, -3.69, "British Isles", "heritage"),
    ("cornwall", "Cornwall (Truro)", "GB", 50.26, -5.05, "British Isles", "garden"),
    ("evesham", "Vale of Evesham (Worcestershire)", "GB", 52.09, -1.95, "British Isles", "heritage"),
    ("fens", "Cambridgeshire Fens (Wisbech)", "GB", 52.67, 0.16, "British Isles", "garden"),
    ("york", "York (Vale of York)", "GB", 53.96, -1.08, "British Isles", "garden"),
    ("northumberland", "Northumberland (Alnwick)", "GB", 55.41, -1.71, "British Isles", "garden"),
    ("lothians", "East Lothian and Edinburgh", "GB", 55.95, -3.19, "British Isles", "garden"),
    ("carse-of-gowrie", "Carse of Gowrie (Perthshire)", "GB", 56.45, -3.15, "British Isles", "heritage"),
    ("highlands", "Scottish Highlands (Inverness)", "GB", 57.48, -4.22, "British Isles", "marginal"),
    ("south-wales", "South Wales (Usk Valley)", "GB", 51.70, -2.90, "British Isles", "garden"),
    ("armagh", "County Armagh (Northern Ireland)", "GB", 54.35, -6.65, "British Isles", "heritage"),
    ("tipperary", "Tipperary and Cork (Ireland)", "IE", 52.35, -7.70, "British Isles", "heritage"),
    ("jersey", "Jersey (Channel Islands)", "GB", 49.19, -2.11, "British Isles", "heritage"),
    ("shetland", "Shetland (Lerwick)", "GB", 60.15, -1.15, "British Isles", "extreme"),
    # --- France ---
    ("paris", "Paris (Ile-de-France)", "FR", 48.86, 2.35, "France", "garden"),
    ("pays-dauge", "Pays d'Auge (Normandy)", "FR", 49.10, 0.10, "France", "heritage"),
    ("rennes", "Rennes (Brittany)", "FR", 48.11, -1.68, "France", "heritage"),
    ("angers", "Angers (Loire Valley)", "FR", 47.47, -0.55, "France", "commercial"),
    ("limousin", "Limousin (Limoges)", "FR", 45.83, 1.26, "France", "commercial"),
    ("savoie", "Savoie (Chambery)", "FR", 45.57, 5.92, "France", "garden"),
    ("avignon", "Provence (Avignon)", "FR", 43.95, 4.81, "France", "commercial"),
    ("toulouse", "Toulouse (Southwest France)", "FR", 43.60, 1.44, "France", "garden"),
    ("alsace", "Alsace (Strasbourg)", "FR", 48.58, 7.75, "France", "garden"),
    # --- Northern & central Europe ---
    ("altes-land", "Altes Land (Hamburg)", "DE", 53.52, 9.70, "Northern & Central Europe", "commercial"),
    ("bodensee", "Lake Constance (Bodensee)", "DE", 47.65, 9.40, "Northern & Central Europe", "commercial"),
    ("hesse", "Hesse (Frankfurt, Apfelwein country)", "DE", 50.11, 8.68, "Northern & Central Europe", "heritage"),
    ("munich", "Bavaria (Munich)", "DE", 48.14, 11.58, "Northern & Central Europe", "garden"),
    ("betuwe", "Betuwe (Netherlands)", "NL", 51.95, 5.60, "Northern & Central Europe", "commercial"),
    ("haspengouw", "Haspengouw (Belgium)", "BE", 50.82, 5.19, "Northern & Central Europe", "commercial"),
    ("copenhagen", "Copenhagen (Denmark)", "DK", 55.68, 12.57, "Northern & Central Europe", "garden"),
    ("kivik", "Kivik and Scania (Sweden)", "SE", 55.68, 14.23, "Northern & Central Europe", "heritage"),
    ("stockholm", "Stockholm (Sweden)", "SE", 59.33, 18.07, "Northern & Central Europe", "garden"),
    ("hardanger", "Hardanger (Norway)", "NO", 60.34, 6.66, "Northern & Central Europe", "commercial"),
    ("helsinki", "Helsinki (Finland)", "FI", 60.17, 24.94, "Northern & Central Europe", "marginal"),
    ("tartu", "Tartu (Estonia)", "EE", 58.38, 26.72, "Northern & Central Europe", "garden"),
    ("grojec", "Grojec (Poland)", "PL", 51.87, 20.87, "Northern & Central Europe", "commercial"),
    ("prague", "Bohemia (Prague)", "CZ", 50.08, 14.43, "Northern & Central Europe", "garden"),
    ("graz", "Styria (Graz, Austria)", "AT", 47.07, 15.44, "Northern & Central Europe", "commercial"),
    ("thurgau", "Thurgau (Switzerland)", "CH", 47.57, 9.11, "Northern & Central Europe", "heritage"),
    ("szabolcs", "Szabolcs (Hungary)", "HU", 47.95, 21.72, "Northern & Central Europe", "commercial"),
    ("cluj", "Transylvania (Cluj, Romania)", "RO", 46.77, 23.59, "Northern & Central Europe", "heritage"),
    ("vojvodina", "Vojvodina (Serbia)", "RS", 45.26, 19.84, "Northern & Central Europe", "garden"),
    # --- Southern Europe ---
    ("south-tyrol", "South Tyrol (Bolzano, Italy)", "IT", 46.50, 11.35, "Southern Europe", "commercial"),
    ("saluzzo", "Piedmont (Saluzzo, Italy)", "IT", 44.64, 7.49, "Southern Europe", "commercial"),
    ("bologna", "Emilia-Romagna (Bologna)", "IT", 44.49, 11.34, "Southern Europe", "garden"),
    ("etna", "Mount Etna slopes (Sicily)", "IT", 37.72, 15.12, "Southern Europe", "heritage"),
    ("asturias", "Asturias (Spain, cider country)", "ES", 43.36, -5.85, "Southern Europe", "heritage"),
    ("lleida", "Lleida (Catalonia)", "ES", 41.62, 0.62, "Southern Europe", "commercial"),
    ("alcobaca", "Alcobaca (Portugal)", "PT", 39.55, -8.98, "Southern Europe", "heritage"),
    ("pelion", "Pelion (Greece)", "GR", 39.43, 23.10, "Southern Europe", "heritage"),
    # --- Russia, Caucasus, Middle East ---
    ("moscow", "Moscow (Russia)", "RU", 55.76, 37.62, "Russia, Caucasus & Middle East", "garden"),
    ("michurinsk", "Michurinsk (Tambov, Russia)", "RU", 52.90, 40.49, "Russia, Caucasus & Middle East", "heritage"),
    ("st-petersburg", "St Petersburg (Russia)", "RU", 59.93, 30.34, "Russia, Caucasus & Middle East", "marginal"),
    ("novosibirsk", "Novosibirsk (Siberia)", "RU", 55.03, 82.92, "Russia, Caucasus & Middle East", "marginal"),
    ("kyiv", "Kyiv (Ukraine)", "UA", 50.45, 30.52, "Russia, Caucasus & Middle East", "garden"),
    ("almaty", "Almaty (Kazakhstan, home of the wild apple)", "KZ", 43.24, 76.89, "Russia, Caucasus & Middle East", "heritage"),
    ("tbilisi", "Georgia (Tbilisi and Kakheti)", "GE", 41.72, 44.79, "Russia, Caucasus & Middle East", "heritage"),
    ("amasya", "Amasya (Turkey)", "TR", 40.65, 35.83, "Russia, Caucasus & Middle East", "commercial"),
    ("urmia", "Urmia (Iran)", "IR", 37.55, 45.07, "Russia, Caucasus & Middle East", "commercial"),
    ("golan", "Golan Heights (Israel)", "IL", 33.23, 35.76, "Russia, Caucasus & Middle East", "commercial"),
    ("zahle", "Mount Lebanon and the Bekaa", "LB", 33.85, 35.90, "Russia, Caucasus & Middle East", "heritage"),
    # --- Asia ---
    ("srinagar", "Kashmir (Srinagar)", "IN", 34.08, 74.80, "Asia", "commercial"),
    ("shimla", "Himachal Pradesh (Shimla)", "IN", 31.10, 77.17, "Asia", "commercial"),
    ("quetta", "Quetta (Pakistan)", "PK", 30.18, 66.99, "Asia", "commercial"),
    ("yantai", "Shandong (Yantai, China)", "CN", 37.46, 121.45, "Asia", "commercial"),
    ("luochuan", "Luochuan (Shaanxi, China)", "CN", 35.76, 109.43, "Asia", "commercial"),
    ("aksu", "Aksu (Xinjiang, China)", "CN", 41.17, 80.26, "Asia", "commercial"),
    ("aomori", "Aomori (Japan)", "JP", 40.82, 140.74, "Asia", "commercial"),
    ("nagano", "Nagano (Japan)", "JP", 36.65, 138.18, "Asia", "commercial"),
    ("daegu", "Daegu (South Korea)", "KR", 35.87, 128.60, "Asia", "commercial"),
    # --- Africa ---
    ("elgin", "Elgin (Western Cape, South Africa)", "ZA", -34.15, 19.00, "Africa", "commercial"),
    ("ceres", "Ceres (Western Cape, South Africa)", "ZA", -33.37, 19.31, "Africa", "commercial"),
    ("ifrane", "Ifrane (Middle Atlas, Morocco)", "MA", 33.53, -5.11, "Africa", "marginal"),
    ("nairobi", "Nairobi highlands (Kenya)", "KE", -1.29, 36.82, "Africa", "marginal"),
    ("cape-town", "Cape Town (coastal)", "ZA", -33.92, 18.42, "Africa", "marginal"),
    # --- Australia & New Zealand ---
    ("hawkes-bay", "Hawke's Bay (New Zealand)", "NZ", -39.49, 176.92, "Australia & New Zealand", "commercial"),
    ("nelson", "Nelson (New Zealand)", "NZ", -41.27, 173.28, "Australia & New Zealand", "commercial"),
    ("central-otago", "Central Otago (New Zealand)", "NZ", -45.03, 169.19, "Australia & New Zealand", "commercial"),
    ("auckland", "Auckland (New Zealand)", "NZ", -36.85, 174.76, "Australia & New Zealand", "marginal"),
    ("huon", "Huon Valley (Tasmania)", "AU", -43.00, 147.05, "Australia & New Zealand", "commercial"),
    ("goulburn", "Goulburn Valley (Victoria)", "AU", -36.38, 145.40, "Australia & New Zealand", "commercial"),
    ("batlow", "Batlow (New South Wales)", "AU", -35.52, 148.15, "Australia & New Zealand", "commercial"),
    ("orange-nsw", "Orange (New South Wales)", "AU", -33.28, 149.10, "Australia & New Zealand", "commercial"),
    ("manjimup", "Manjimup (Western Australia)", "AU", -34.24, 116.15, "Australia & New Zealand", "commercial"),
    ("granite-belt", "Granite Belt (Queensland)", "AU", -28.66, 151.94, "Australia & New Zealand", "marginal"),
    ("perth", "Perth (Western Australia)", "AU", -31.95, 115.86, "Australia & New Zealand", "marginal"),
    ("sydney", "Sydney (New South Wales)", "AU", -33.87, 151.21, "Australia & New Zealand", "marginal"),
    # --- Latin America ---
    ("maule", "Maule Valley (Chile)", "CL", -35.43, -71.66, "Latin America", "commercial"),
    ("puerto-montt", "Los Lagos (Puerto Montt, Chile)", "CL", -41.47, -72.94, "Latin America", "heritage"),
    ("rio-negro", "Alto Valle del Rio Negro (Argentina)", "AR", -39.03, -67.58, "Latin America", "commercial"),
    ("mendoza", "Mendoza (Argentina)", "AR", -32.89, -68.84, "Latin America", "commercial"),
    ("sao-joaquim", "Sao Joaquim (Brazil)", "BR", -28.29, -49.93, "Latin America", "commercial"),
    ("chihuahua", "Cuauhtemoc (Chihuahua, Mexico)", "MX", 28.41, -106.87, "Latin America", "commercial"),
    ("zacatlan", "Zacatlan (Puebla, Mexico)", "MX", 19.93, -97.96, "Latin America", "heritage"),
    ("bogota", "Bogota highlands (Colombia)", "CO", 4.71, -74.07, "Latin America", "extreme"),
    # --- United States ---
    ("wenatchee", "Wenatchee (Washington)", "US", 47.42, -120.31, "United States", "commercial"),
    ("hood-river", "Hood River (Oregon)", "US", 45.71, -121.52, "United States", "commercial"),
    ("puget-sound", "Puget Sound (Seattle)", "US", 47.61, -122.33, "United States", "garden"),
    ("sebastopol", "Sebastopol (Sonoma, California)", "US", 38.40, -122.82, "United States", "heritage"),
    ("watsonville", "Pajaro Valley (Watsonville, California)", "US", 36.91, -121.76, "United States", "commercial"),
    ("los-angeles", "Los Angeles basin (California)", "US", 34.05, -118.24, "United States", "marginal"),
    ("south-michigan", "Southern Michigan (Berrien and Van Buren)", "US", 42.20, -86.17, "United States", "commercial"),
    ("traverse-city", "Traverse City (northern Michigan)", "US", 44.76, -85.62, "United States", "commercial"),
    ("hudson-valley", "Hudson Valley (New York)", "US", 41.95, -73.95, "United States", "commercial"),
    ("finger-lakes", "Finger Lakes (New York)", "US", 42.87, -76.98, "United States", "commercial"),
    ("champlain", "Champlain Valley (Vermont)", "US", 43.90, -73.30, "United States", "heritage"),
    ("pioneer-valley", "Pioneer Valley (Massachusetts)", "US", 42.35, -72.60, "United States", "heritage"),
    ("maine", "Central Maine", "US", 44.20, -70.00, "United States", "heritage"),
    ("adams-county", "Adams County (Pennsylvania)", "US", 39.90, -77.30, "United States", "commercial"),
    ("shenandoah", "Shenandoah Valley (Winchester, Virginia)", "US", 39.18, -78.16, "United States", "commercial"),
    ("henderson-county", "Henderson County (North Carolina)", "US", 35.30, -82.50, "United States", "commercial"),
    ("ellijay", "Ellijay (Georgia)", "US", 34.70, -84.50, "United States", "heritage"),
    ("wooster", "Wooster (Ohio)", "US", 40.80, -81.94, "United States", "commercial"),
    ("bayfield", "Bayfield (Wisconsin)", "US", 46.81, -90.82, "United States", "commercial"),
    ("minneapolis", "Twin Cities (Minnesota)", "US", 44.98, -93.27, "United States", "commercial"),
    ("paonia", "Paonia (Colorado)", "US", 38.87, -107.59, "United States", "commercial"),
    ("hill-country", "Texas Hill Country (Medina)", "US", 29.80, -99.24, "United States", "marginal"),
    ("gainesville", "Gainesville (Florida)", "US", 29.65, -82.32, "United States", "extreme"),
    ("phoenix", "Phoenix (Arizona)", "US", 33.45, -112.07, "United States", "extreme"),
    ("anchorage", "Anchorage (Alaska)", "US", 61.22, -149.90, "United States", "marginal"),
    # --- Canada ---
    ("okanagan", "Okanagan Valley (British Columbia)", "CA", 49.90, -119.40, "Canada", "commercial"),
    ("georgian-bay", "Georgian Bay and Niagara (Ontario)", "CA", 44.45, -80.50, "Canada", "commercial"),
    ("annapolis", "Annapolis Valley (Nova Scotia)", "CA", 45.10, -64.80, "Canada", "commercial"),
    ("rougemont", "Rougemont (Quebec)", "CA", 45.43, -73.05, "Canada", "commercial"),
    ("edmonton", "Edmonton (Alberta)", "CA", 53.55, -113.49, "Canada", "marginal"),
    ("winnipeg", "Winnipeg (Manitoba)", "CA", 49.90, -97.14, "Canada", "marginal"),
    # --- Stress-test places ---
    ("reykjavik", "Reykjavik (Iceland)", "IS", 64.15, -21.94, "Edge cases", "extreme"),
    ("tromso", "Tromso (Arctic Norway)", "NO", 69.65, 18.96, "Edge cases", "extreme"),
    ("singapore", "Singapore (equatorial lowlands)", "SG", 1.35, 103.82, "Edge cases", "extreme"),
    ("dubai", "Dubai (Arabian desert coast)", "AE", 25.20, 55.27, "Edge cases", "extreme"),
    ("mexico-city", "Mexico City (tropical highlands)", "MX", 19.43, -99.13, "Edge cases", "marginal"),
]


def main():
    seen = set()
    out = []
    for (i, n, c, la, lo, g, k) in R:
        assert i not in seen, i
        seen.add(i)
        out.append({"id": i, "name": n, "country": c, "lat": la, "lon": lo, "group": g, "kind": k})
    json.dump(out, open(os.path.join(ROOT, "data", "regions_seed.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    # batches for note-writing agents: ~24 each, keeping groups together
    bdir = os.path.join(ROOT, "research", "region_batches")
    os.makedirs(bdir, exist_ok=True)
    for f in os.listdir(bdir):
        os.remove(os.path.join(bdir, f))
    packs = [
        ("regions-1-british-france", ["British Isles", "France"]),
        ("regions-2-europe", ["Northern & Central Europe", "Southern Europe"]),
        ("regions-3-eurasia-africa-oceania", ["Russia, Caucasus & Middle East", "Asia", "Africa",
                                                "Australia & New Zealand"]),
        ("regions-4-americas", ["Latin America", "United States", "Canada", "Edge cases"]),
    ]
    for bid, groups in packs:
        items = [x for x in out if x["group"] in groups]
        json.dump({"batch": bid, "count": len(items), "regions": items},
                  open(os.path.join(bdir, bid + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(bid, len(items))
    print("total", len(out))


if __name__ == "__main__":
    main()
