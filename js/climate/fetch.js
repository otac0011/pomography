// Live climate lookup for an arbitrary map click: Open-Meteo archive (ERA5) -> features. Cached; degrades gracefully.
import { computeFeatures, compactFeatures } from './features.js';
import { S, haversine, nearestPreset } from '../data.js';

const START = '2015-01-01', END = '2024-12-31';
const LS = 'pomona.climate.v2';
const mem = new Map();
let inflight = null;

export class ClimateError extends Error { constructor(kind, msg) { super(msg); this.kind = kind; } }

function key(lat, lon) { return lat.toFixed(1) + ',' + lon.toFixed(1); }
function lsRead() { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { return {}; } }
function lsWrite(o) { try { localStorage.setItem(LS, JSON.stringify(o)); } catch (e) { /* full or private mode */ } }

function remember(k, F) {
  mem.set(k, F);
  const o = lsRead(); o[k] = { t: Date.now(), F };
  const ks = Object.keys(o); if (ks.length > 30) { ks.sort((a, b) => o[a].t - o[b].t); for (const x of ks.slice(0, ks.length - 30)) delete o[x]; }
  lsWrite(o);
}

/** Best-effort place name and ocean check (BigDataCloud client-side reverse geocoding). */
export async function reverseGeocode(lat, lon, signal) {
  try {
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&localityLanguage=en`, { signal });
    if (!r.ok) return null;
    const d = await r.json();
    const parts = [d.locality || d.city, d.principalSubdivision, d.countryName && d.countryName.replace(/ of Great Britain and Northern Ireland| of America/g, '')].filter(Boolean);
    const dedup = parts.filter((p, i) => parts.indexOf(p) === i);
    return { label: dedup.join(', '), ocean: !d.countryCode, country: d.countryCode, water: d.locality };
  } catch (e) { return null; }
}

/** Features for a point. Resolves {F, source, note?}. source: preset | cache | live | nearest */
export async function climateFor(lat, lon, { preferPreset = true } = {}) {
  lon = ((lon + 540) % 360) - 180;
  // 1. a baked reference place within 12 km is the same answer, instantly
  if (preferPreset) {
    const np = nearestPreset(lat, lon);
    if (np && np.d < 12) return { F: S.presets[np.region.id], source: 'preset', region: np.region };
  }
  const k = key(lat, lon);
  if (mem.has(k)) return { F: mem.get(k), source: 'cache' };
  const o = lsRead();
  if (o[k] && Date.now() - o[k].t < 90 * 864e5) { mem.set(k, o[k].F); return { F: o[k].F, source: 'cache' }; }

  if (inflight) inflight.abort();
  const ac = inflight = new AbortController();
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&start_date=${START}&end_date=${END}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&models=era5&timezone=auto`;
  let resp;
  try {
    resp = await fetch(url, { signal: ac.signal });
    if (resp.status === 429) { await new Promise(r => setTimeout(r, 2500)); resp = await fetch(url, { signal: ac.signal }); }
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ClimateError('network', 'Could not reach the weather service.');
  } finally { if (inflight === ac) inflight = null; }
  if (resp.status === 429) throw new ClimateError('rate', 'The free weather service is rate-limiting this browser; wait a minute and click again.');
  if (!resp.ok) throw new ClimateError('http', 'Weather service error ' + resp.status);
  const d = await resp.json();
  if (!d.daily || !d.daily.time) throw new ClimateError('http', 'Unexpected weather response.');
  const x = d.daily;
  const nulls = x.temperature_2m_max.filter(v => v == null).length;
  if (nulls > x.time.length * 0.3) throw new ClimateError('nodata', 'No land weather data at this point (open sea?).');
  const F = computeFeatures({ lat: d.latitude, lon: d.longitude, elevation: d.elevation, start: x.time[0], tmax: x.temperature_2m_max, tmin: x.temperature_2m_min, prcp: x.precipitation_sum });
  F.reqLat = lat; F.reqLon = lon;
  const C = compactFeatures(F);
  remember(k, C);
  return { F: C, source: 'live' };
}

/** Fallback when live data is unavailable: the nearest baked reference place, with its distance. */
export function fallbackFor(lat, lon) {
  const np = nearestPreset(lat, lon);
  return np ? { F: S.presets[np.region.id], source: 'nearest', region: np.region, distanceKm: Math.round(np.d) } : null;
}
