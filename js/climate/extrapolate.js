// Extrapolated climate features for a point from the nearest baked reference places (used when live weather cannot be fetched).
// Inverse-distance weighting of the numeric features of up to k places in the same hemisphere within maxKm. It cannot know about
// local terrain, so the UI labels the result as extrapolated and lists the places it came from.
import { S, haversine } from '../data.js';
import { regionalFor } from './regional.js';
import { usdaZone, viLabel } from './features.js';

function resample(arr, n) {
  if (arr.length === n) return arr;
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 0 : i * (arr.length - 1) / (n - 1), lo = Math.floor(x), hi = Math.ceil(x);
    out.push(arr[lo] + (arr[hi] - arr[lo]) * (x - lo));
  }
  return out;
}

/** Weighted blend of same-shaped feature objects. Numbers and numeric arrays are averaged; anything else comes from the nearest. */
function blend(objs, ws, key = '') {
  const first = objs[0];
  if (typeof first === 'number') {
    const vals = objs.map(o => o).filter(v => typeof v === 'number' && isFinite(v));
    if (!vals.length) return first;
    let sw = 0, s = 0; objs.forEach((v, i) => { if (typeof v === 'number' && isFinite(v)) { s += v * ws[i]; sw += ws[i]; } });
    return s / sw;
  }
  if (Array.isArray(first)) {
    if (!first.every(v => typeof v === 'number')) return first;
    const n = Math.max(...objs.map(a => a.length));
    const rows = objs.map(a => resample(key === 'gendPer' ? [...a].sort((x, y) => x - y) : a, n));
    return Array.from({ length: n }, (_, i) => rows.reduce((s, r, j) => s + r[i] * ws[j], 0));
  }
  if (first && typeof first === 'object') {
    const out = {};
    for (const k of Object.keys(first)) {
      if (k === 'regional') continue;
      const parts = objs.map(o => o && o[k]);
      out[k] = parts.some(p => p === undefined) ? first[k] : blend(parts, ws, k);
    }
    return out;
  }
  return first;
}

/**
 * @returns null if no usable reference place is near enough, else a features object with `extrapolated` metadata.
 */
export function extrapolate(lat, lon, { maxKm = 1500, k = 4 } = {}) {
  const south = lat < 0;
  const cands = [];
  for (const r of S.data.regions) {
    const F = S.presets[r.id];
    if (!F || F.error || F.noBloom || (r.lat < 0) !== south) continue;
    const d = haversine(lat, lon, r.lat, r.lon);
    if (d <= maxKm) cands.push({ r, F, d });
  }
  cands.sort((a, b) => a.d - b.d);
  const use = cands.slice(0, k);
  if (!use.length) return null;
  const raw = use.map(c => 1 / Math.pow(c.d + 100, 2));
  const tot = raw.reduce((a, b) => a + b, 0);
  const ws = raw.map(w => w / tot);
  const out = blend(use.map(c => c.F), ws);
  // derived / label fields must follow the blended numbers
  out.lat = lat; out.lon = lon; out.elev = null; out.southern = south;
  out.winter.zone = usdaZone(out.winter.extMinMean);
  out.bloom.label = viLabel(out.bloom.vi, south);
  out.season.endLabel = viLabel(out.season.endVi, south);
  out.season.firstFreeze = out.season.freezeYears >= 0.5 ? viLabel(out.season.endVi, south) : null;
  if (out.frost.lastSpringVi != null) out.frost.lastSpring = viLabel(out.frost.lastSpringVi, south);
  out.koppen = use[0].F.koppen;
  out.flags = { tropical: out.winter.extMinMean > 12 || out.chill.mean < 30 };
  out.period = use[0].F.period;
  out.nCycles = use[0].F.nCycles;
  out.humidity = Object.assign({}, out.humidity, { estimated: use.some(c => c.F.humidity && c.F.humidity.estimated) });
  out.extrapolated = { maxKm, from: use.map((c, i) => ({ id: c.r.id, name: c.r.name, km: Math.round(c.d), w: Math.round(ws[i] * 100) })) };
  return out;
}
