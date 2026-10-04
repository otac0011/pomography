// One place, analysed: name lookup + ten years of weather (or a fallback) + regional disease lookups.
// Shared by the world map and the "grow it where you are" panel on each variety page.
import { climateFor, fallbackFor, reverseGeocode } from './fetch.js';
import { regionalFor } from './regional.js';
import { S, haversine, nearestRegion } from '../data.js';

/** Attach the regional (presence/absence) factors, which depend on the country rather than on weather. */
export function withRegional(F, lat, lon, cc) {
  return F.regional && F.regional.country === (cc || F.regional.country) ? F : Object.assign({}, F, { regional: regionalFor(lat, lon, cc) });
}

/**
 * Resolves to one of:
 *   { ocean: true, water }                     - the point is at sea
 *   { failed: true, err }                      - no weather and nothing near enough to extrapolate from
 *   { lat, lon, name, F, source, err, country, region, nearest, cellKm }
 * `onStep(message)` reports progress; `place` (a reference place) keeps its own name. Throws AbortError if superseded.
 */
export async function analysePlace(lat, lon, { place = null, name = null, onStep = () => {} } = {}) {
  lon = ((lon + 540) % 360) - 180;
  onStep('Looking up this place…');
  const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 3500);
  const geo = await reverseGeocode(lat, lon, ac.signal); clearTimeout(to);
  if (geo && geo.ocean && !place) return { ocean: true, water: geo.water || 'Open water' };
  onStep('Fetching ten years of weather for this spot…');
  let res, err = null;
  try { res = await climateFor(lat, lon); }
  catch (e) {
    if (e.name === 'AbortError') throw e;
    err = e; res = fallbackFor(lat, lon);
  }
  if (!res) return { failed: true, err };
  const cc = geo && geo.country;
  const F = res.source === 'preset' ? res.F : withRegional(res.F, lat, lon, cc);
  const np = nearestRegion(lat, lon);
  return {
    lat, lon,
    name: place ? place.name : res.region && res.source === 'preset' ? res.region.name : name || (geo && geo.label) || 'Selected spot',
    region: place || res.region || null, F, source: res.source, err,
    country: cc || (place && place.country) || (res.region && res.region.country) || (F.regional && F.regional.country),
    nearest: np && np.d <= 800 ? np : null,
    cellKm: res.source === 'live' || res.source === 'cache' ? Math.round(haversine(lat, lon, F.lat, F.lon)) : null,
  };
}

/** Place-name search (Open-Meteo geocoding, free, no key). Resolves to [{name, label, lat, lon, country}]. */
export async function searchPlaces(q, signal) {
  const r = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=8&language=en&format=json&name=' + encodeURIComponent(q), { signal });
  if (!r.ok) throw new Error('Place search failed (' + r.status + ')');
  const d = await r.json();
  return (d.results || []).map(x => ({
    name: x.name, lat: x.latitude, lon: x.longitude, country: x.country_code,
    label: [x.name, x.admin1 && x.admin1 !== x.name ? x.admin1 : null, x.country].filter(Boolean).join(', '),
  }));
}

/** The visitor's chosen place, remembered in this browser so every variety page can use it. */
const PLACE_KEY = 'pomona.place.v1';
export function getPlace() {
  try { const p = JSON.parse(localStorage.getItem(PLACE_KEY) || 'null'); return p && isFinite(p.lat) && isFinite(p.lon) ? p : null; } catch (e) { return null; }
}
export function setPlace(p) {
  try { if (p) localStorage.setItem(PLACE_KEY, JSON.stringify({ lat: +p.lat.toFixed(4), lon: +p.lon.toFixed(4), name: p.name || null })); else localStorage.removeItem(PLACE_KEY); } catch (e) { /* private mode */ }
}
