// Data loading, favourites, and derived helpers shared by every view.
import { makeContext } from './score/score.js';
import { regionalFor } from './climate/regional.js';

export const S = { data: null, byId: new Map(), rsById: new Map(), regionById: new Map(), presets: {}, ctx: null, ready: null };

const FAV_KEY = 'pomona.favs.v1';
const listeners = new Set();
let favs = [];

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmtInt = n => Math.round(n).toLocaleString('en-US');
export const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

export const COUNTRY = {
  GB: 'United Kingdom', IE: 'Ireland', FR: 'France', DE: 'Germany', NL: 'Netherlands', BE: 'Belgium', DK: 'Denmark', SE: 'Sweden',
  NO: 'Norway', FI: 'Finland', EE: 'Estonia', LV: 'Latvia', LT: 'Lithuania', PL: 'Poland', CZ: 'Czechia', SK: 'Slovakia', HU: 'Hungary',
  RO: 'Romania', RS: 'Serbia', HR: 'Croatia', SI: 'Slovenia', AT: 'Austria', CH: 'Switzerland', IT: 'Italy', ES: 'Spain', PT: 'Portugal',
  GR: 'Greece', TR: 'Turkey', RU: 'Russia', UA: 'Ukraine', BY: 'Belarus', GE: 'Georgia', AM: 'Armenia', AZ: 'Azerbaijan', KZ: 'Kazakhstan',
  IR: 'Iran', IL: 'Israel', LB: 'Lebanon', IN: 'India', PK: 'Pakistan', CN: 'China', JP: 'Japan', KR: 'South Korea', US: 'United States',
  CA: 'Canada', MX: 'Mexico', CO: 'Colombia', BR: 'Brazil', AR: 'Argentina', CL: 'Chile', UY: 'Uruguay', AU: 'Australia', NZ: 'New Zealand',
  ZA: 'South Africa', KE: 'Kenya', MA: 'Morocco', IS: 'Iceland', SG: 'Singapore', AE: 'United Arab Emirates',
};
export const countryName = c => COUNTRY[c] || c || 'Unknown';

export const FLAVOUR_FAMILIES = [
  ['Floral & perfumed', ['floral', 'rose', 'elderflower', 'perfumed', 'musky']],
  ['Honey & sweetness', ['honey', 'vanilla', 'caramel', 'butterscotch', 'sweet']],
  ['Nutty & earthy', ['nutty', 'almond', 'walnut', 'earthy', 'savoury']],
  ['Tropical & stone fruit', ['pineapple', 'banana', 'melon', 'mango', 'apricot', 'peach']],
  ['Orchard & berry', ['pear', 'pear-drop', 'quince', 'strawberry', 'berry', 'cherry', 'grape', 'wine']],
  ['Citrus & bright', ['lemon', 'citrus', 'sharp']],
  ['Spice & herb', ['aniseed', 'fennel', 'spice', 'clove', 'cinnamon', 'herbal', 'tea']],
  ['Tannic', ['bitter', 'astringent']],
  ['Mild', ['mild']],
];
export const TAG_LABEL = { 'pear-drop': 'pear drop', 'rose': 'rose-water' };
export const tagLabel = t => TAG_LABEL[t] || t;

// ---------------------------------------------------------------- loading
export function load() {
  if (S.ready) return S.ready;
  S.ready = (async () => {
    const [data, presets] = await Promise.all([
      fetch('assets/data.json').then(r => r.json()),
      fetch('assets/climate-presets.json').then(r => r.ok ? r.json() : {}).catch(() => ({})),
    ]);
    S.data = data;
    for (const v of data.varieties) { S.byId.set(v.id, v); v._search = (v.name + ' ' + (v.aka || []).join(' ') + ' ' + (v.origin.place || '')).toLowerCase(); }
    for (const r of data.rootstocks) S.rsById.set(r.id, r);
    for (const r of data.regions) S.regionById.set(r.id, r);
    S.presets = presets;
    for (const r of data.regions) if (presets[r.id]) presets[r.id].regional = regionalFor(r.lat, r.lon, r.country);
    S.ctx = presets.kent ? makeContext(presets.kent) : null;
    try { favs = JSON.parse(localStorage.getItem(FAV_KEY) || '[]').filter(id => S.byId.has(id)); } catch (e) { favs = []; }
    return S;
  })();
  return S.ready;
}

// ---------------------------------------------------------------- favourites
export const getFavs = () => favs.slice();
export const isFav = id => favs.includes(id);
export function setFavs(ids) {
  favs = [...new Set(ids)].filter(id => S.byId.has(id)).slice(0, 24);
  try { localStorage.setItem(FAV_KEY, JSON.stringify(favs)); } catch (e) { /* private mode */ }
  listeners.forEach(f => f(favs));
}
export function toggleFav(id) {
  if (isFav(id)) setFavs(favs.filter(x => x !== id));
  else {
    if (favs.length >= 24) { toast('Favourites are limited to 24 varieties'); return; }
    setFavs([...favs, id]);
  }
}
export const onFavs = f => { listeners.add(f); return () => listeners.delete(f); };

export function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; t.setAttribute('role', 'status');
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}

// ---------------------------------------------------------------- derived helpers
const TASTE_KEYS = ['sweet', 'acid', 'aroma', 'tannin', 'crisp', 'juicy'];
function tasteVec(v) { return TASTE_KEYS.map(k => v.taste[k] ?? 2.5); }

export function similar(v, n = 6) {
  const a = tasteVec(v), ta = new Set(v.taste.tags || []);
  const out = [];
  for (const o of S.data.varieties) {
    if (o.id === v.id) continue;
    const b = tasteVec(o);
    let d = 0; for (let i = 0; i < a.length; i++) d += (a[i] - b[i]) ** 2;
    const tb = new Set(o.taste.tags || []);
    const inter = [...ta].filter(x => tb.has(x)).length, uni = new Set([...ta, ...tb]).size || 1;
    let s = 1 / (1 + Math.sqrt(d)) * 0.6 + (inter / uni) * 0.7;
    if (v.uses.some(u => o.uses.includes(u))) s += 0.1; else s -= 0.4;
    out.push([s, o]);
  }
  return out.sort((x, y) => y[0] - x[0]).slice(0, n).map(x => x[1]);
}

export function pollinators(v, n = 8) {
  const g = v.pollination.flower_group;
  if (g == null) return [];
  const out = [];
  for (const o of S.data.varieties) {
    if (o.id === v.id || o.tree.ploidy === 'triploid' || o.pollination.flower_group == null) continue;
    if (o.uses.length === 1 && o.uses[0] === 'ornamental') continue;
    const d = Math.abs(o.pollination.flower_group - g);
    if (d > 1) continue;
    out.push([d * 2 + (o.keepers.listed ? 0 : 1) + (o.conf === 'low' ? 1.5 : 0) + (o.uses.includes('crab') ? 0.5 : 0), o]);
  }
  return out.sort((a, b) => a[0] - b[0]).slice(0, n).map(x => x[1]);
}

const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** Month indices (0-11) covered by an 'eating' string such as 'Oct-Dec' or 'Nov-Feb'. */
export function eatingMonths(s) {
  if (!s) return null;
  const m = (s.toLowerCase().match(/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/g) || []).map(x => MON.indexOf(x));
  if (!m.length) return null;
  const a = m[0], b = m[Math.min(m.length - 1, 1)];
  const out = []; let i = a; for (let k = 0; k < 12; k++) { out.push(i); if (i === b) break; i = (i + 1) % 12; }
  return out;
}

export function seasonBand(v) {
  const d = v.season.harvest_doy;
  if (d == null) return null;
  return d < 232 ? 'early' : d < 262 ? 'early-mid' : d < 282 ? 'mid' : 'late';
}
export function seasonName(v) {
  const d = v.season.harvest_doy;
  if (d == null) return 'unknown';
  return d < 245 ? 'Early season' : d < 280 ? 'Mid season' : 'Late season';
}
export function chillClass(h) {
  if (h == null) return null;
  return h < 500 ? 'low' : h < 900 ? 'medium' : h < 1200 ? 'high' : 'very high';
}
export function sortName(a, b) { return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }); }

export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
export function nearestPreset(lat, lon) {
  let best = null;
  for (const r of S.data.regions) {
    if (!S.presets[r.id]) continue;
    const d = haversine(lat, lon, r.lat, r.lon);
    if (!best || d < best.d) best = { region: r, d };
  }
  return best;
}
