// Climate feature extraction: ten years of daily Tmax / Tmin / precipitation -> the numbers that matter to apples.
// Pure functions (no DOM, no network). See docs/decisions/0002-climate-model.md for the reasoning behind each metric.
//
// Southern-hemisphere series are re-indexed by 181 days ("virtual years" starting 1 July) so that every metric can be
// written once, in northern-hemisphere terms: virtual day 0 = 1 Jan (N) or 1 Jul (S).

const CUM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const MDAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const PARAMS = {
  chillStart: 304, chillEnd: 89,      // chill = positive Utah-model units from 1 Nov (vi 304, previous cycle) to 31 Mar (vi 89)
  bloomBase: 5, bloomStart: 32, bloomGdd: 220, bloomLast: 200, // full bloom = 220 degree-days (base 5 C) from 1 Feb; fitted, see decision 0002
  extMinBias: -2,                     // 25 km grids run ~2 C too warm on the coldest nights (checked against sites of known USDA zone)
  chillGate: 800,                     // ... but forcing is held back until this many chill hours have accumulated (mild-winter sites)
  groupStepDays: 3,                   // flowering groups are ~3 days apart
  frostNight: 1.5,                    // grid-cell Tmin counted as a damaging frost at bloom: a garden frost of about -2 C reads +1..+2 C in a 25 km cell (decision 0002)
  anyFrost: 2.5,                      // grid Tmin that corresponds to an ordinary garden frost (0 C); used for last-frost and frost-free days
  frostWindow: [-2, 14],              // days relative to a group's bloom date
  gddBase: 5, gddCap: 30,
  killFreeze: -2.2,                   // season ends at the first Tmin <= this after bloom + 60 d
  curveStep: 10, curveLen: 27,        // GDD curve sampled every 10 days after bloom, 0..260
  wetDay: 1,                          // mm
};

// ---------------------------------------------------------------- helpers
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN;
const sd = a => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
const pct = (a, p) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); const i = (s.length - 1) * p; const lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** Standard normal CDF (Abramowitz-Stegun 26.2.17, error < 7.5e-8). */
function normCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

// ---------------------------------------------------------------- humidity and leaf wetness (estimated; decision 0004)
/** Saturation vapour pressure (kPa), FAO-56. */
const es = t => 0.6108 * Math.exp(17.27 * t / (t + 237.3));
/**
 * Humidity of one day from its min/max. Dew point is taken as Tmin - k (FAO-56: k = 0 in humid climates, about 2-2.5 C
 * in arid ones); hourly temperature follows a cosine day. Returns mean RH, RH at the coldest hour, and the hours with
 * RH >= 90% (a standard proxy for dew-driven leaf wetness).
 */
export function dayHumidity(tmax, tmin, k) {
  const m = (tmax + tmin) / 2, a = (tmax - tmin) / 2, eTd = es(tmin - k);
  let sum = 0, dew = 0;
  for (let h = 0; h < 24; h++) {
    const t = m + a * Math.cos(2 * Math.PI * (h + 0.5 - 15) / 24);
    const rh = Math.min(100, 100 * eTd / es(t));
    sum += rh; if (rh >= 90) dew++;
  }
  return { rh: sum / 24, rhn: Math.min(100, 100 * eTd / es(tmin)), dew };
}
/** Hours of leaf wetness in a day: dew hours and rain-wet hours (measured rain hours per wet day for the month, plus drying time), partly overlapping. */
export function leafWetHours(dew, prcp, rainHrs = 9) {
  const rain = prcp >= 1 ? Math.min(22, rainHrs + 1.5 + (prcp > 10 ? Math.min(4, (prcp - 10) / 5) : 0)) : prcp >= 0.3 ? 0.5 * rainHrs : 0;
  return Math.min(24, Math.max(dew, rain) + 0.25 * Math.min(dew, rain));
}
/**
 * Humidity climatology from a short daily record that includes dew point and hours of precipitation: the mean gap
 * between Tmin and the dew point per calendar month (replaces the FAO-56 guess) and the mean rain hours on wet days.
 */
export function humidityClimatology(h) {
  const [y0, m0, d0] = h.start.split('-').map(Number), t0 = Date.UTC(y0, m0 - 1, d0);
  const dep = Array.from({ length: 12 }, () => []), rain = Array.from({ length: 12 }, () => []);
  for (let i = 0; i < h.tmin.length; i++) {
    const m = new Date(t0 + i * 86400000).getUTCMonth();
    if (h.tmin[i] != null && h.dew[i] != null) dep[m].push(h.tmin[i] - h.dew[i]);
    if (h.prcp[i] != null && h.prcp[i] >= 1 && h.ph[i] != null) rain[m].push(h.ph[i]);
  }
  return { dewDep: dep.map(a => a.length ? clamp(mean(a), -1, 14) : 2), rainHrs: rain.map(a => a.length ? clamp(mean(a), 3, 20) : 9), n: h.tmin.length };
}

/** Hours of continuous leaf wetness needed for a (light) primary scab infection at mean temperature t (after Mills). */
export function millsHours(t) {
  if (t <= 1) return Infinity;
  if (t < 4) return 40; if (t < 6) return 30; if (t < 8) return 21; if (t < 10) return 17; if (t < 12) return 14;
  if (t < 14) return 12; if (t < 16) return 10; if (t < 24) return 9; if (t < 26) return 11; if (t < 28) return 16;
  return Infinity;
}
/** Degree-hours above 18.3 C for one day (cosine day): the fire-blight "epiphytic infection potential" driver (Maryblyt). */
export function blightDegreeHours(tmax, tmin) {
  const m = (tmax + tmin) / 2, a = (tmax - tmin) / 2;
  let dh = 0;
  for (let h = 0; h < 24; h++) { const t = m + a * Math.cos(2 * Math.PI * (h + 0.5 - 15) / 24); if (t > 18.3) dh += t - 18.3; }
  return dh;
}

export function viToDate(vi, southern) {
  const di = ((Math.round(vi) + (southern ? 181 : 0)) % 365 + 365) % 365;
  let m = 11; while (CUM[m] > di) m--;
  return { month: m, day: di - CUM[m] + 1, doy: di };
}
export function viLabel(vi, southern) { if (vi == null || isNaN(vi)) return '-'; const d = viToDate(vi, southern); return MONTH_NAMES[d.month] + ' ' + d.day; }
/** Northern-calendar day of year (0..364) -> virtual index for a hemisphere. */
export function doyToVi(doy, southern) { return southern ? (doy - 181 + 365) % 365 : doy; }

function fillGaps(a) {
  let last = -1;
  for (let i = 0; i < a.length; i++) {
    if (!isNaN(a[i])) {
      if (last >= 0 && i - last > 1) for (let j = last + 1; j < i; j++) a[j] = a[last] + (a[i] - a[last]) * (j - last) / (i - last);
      else if (last < 0) for (let j = 0; j < i; j++) a[j] = a[i];
      last = i;
    }
  }
  if (last >= 0) for (let j = last + 1; j < a.length; j++) a[j] = a[last];
}

/** raw: {start:'YYYY-MM-DD', tmax:[], tmin:[], prcp:[]} (consecutive days). Returns Map(vy -> {tmax,tmin,prcp,valid}). */
export function buildCycles(raw, southern, dewK, rainHrs) {
  const [y0, m0, d0] = raw.start.split('-').map(Number);
  const t0 = Date.UTC(y0, m0 - 1, d0);
  const cyc = new Map();
  for (let i = 0; i < raw.tmax.length; i++) {
    const dt = new Date(t0 + i * 86400000);
    const y = dt.getUTCFullYear(), m = dt.getUTCMonth(), d = dt.getUTCDate();
    if (m === 1 && d === 29) continue;
    const di = CUM[m] + d - 1;
    let vy, vi;
    if (!southern) { vy = y; vi = di; } else if (di >= 181) { vy = y; vi = di - 181; } else { vy = y - 1; vi = di + 184; }
    let c = cyc.get(vy);
    if (!c) { c = { tmax: new Float64Array(365).fill(NaN), tmin: new Float64Array(365).fill(NaN), prcp: new Float64Array(365).fill(NaN), cmonth: new Uint8Array(365), valid: 0 }; cyc.set(vy, c); }
    const a = raw.tmax[i], b = raw.tmin[i], p = raw.prcp ? raw.prcp[i] : null;
    c.tmax[vi] = a == null ? NaN : a; c.tmin[vi] = b == null ? NaN : b; c.prcp[vi] = p == null ? NaN : p; c.cmonth[vi] = m;
    if (a != null && b != null) c.valid++;
  }
  for (const [vy, c] of cyc) {
    if (c.valid < 345) { cyc.delete(vy); continue; }
    fillGaps(c.tmax); fillGaps(c.tmin);
    for (let i = 0; i < 365; i++) if (isNaN(c.prcp[i])) c.prcp[i] = 0;
    c.tmean = new Float64Array(365); c.rh = new Float32Array(365); c.rhn = new Float32Array(365); c.dew = new Float32Array(365); c.lwd = new Float32Array(365);
    for (let i = 0; i < 365; i++) {
      if (c.tmin[i] > c.tmax[i]) { const t = c.tmin[i]; c.tmin[i] = c.tmax[i]; c.tmax[i] = t; }
      c.tmean[i] = (c.tmax[i] + c.tmin[i]) / 2;
      const h = dayHumidity(c.tmax[i], c.tmin[i], dewK ? dewK[c.cmonth[i]] : 0);
      c.rh[i] = h.rh; c.rhn[i] = h.rhn; c.dew[i] = h.dew; c.lwd[i] = leafWetHours(h.dew, c.prcp[i], rainHrs ? rainHrs[c.cmonth[i]] : 9);
    }
  }
  return cyc;
}

/** Utah-model weight of one hour at temperature t (positive part only: warm hours never cancel chill). */
export function utahWeight(t) {
  if (t < 1.4) return 0;
  if (t < 2.5) return 0.5;
  if (t < 9.2) return 1;
  if (t < 12.5) return 0.5;
  return 0;
}
/** Effective chill for one day from its min/max (cosine day sampled hourly): the larger of the Utah-model units and
 *  half the hours below 9.2 C. The floor matters in very cold winters, where sub-zero hours score nothing in the Utah
 *  model although dormancy release is certainly not prevented (decision 0002). */
export function chillUnitsDay(tmax, tmin) {
  const m = (tmax + tmin) / 2, a = (tmax - tmin) / 2;
  let u = 0, cold = 0;
  for (let k = 0; k < 24; k++) { const t = m + a * Math.cos(2 * Math.PI * (k + 0.5 - 15) / 24); u += utahWeight(t); if (t < 9.2) cold++; }
  return Math.max(u, 0.5 * cold);
}

/** Hours at or below `thr` in a day (cosine day): the classic "chill hours" count uses thr = 7.2 C (45 F). */
export function hoursAtOrBelow(tmax, tmin, thr) {
  const m = (tmax + tmin) / 2, a = (tmax - tmin) / 2;
  let n = 0;
  for (let k = 0; k < 24; k++) if (m + a * Math.cos(2 * Math.PI * (k + 0.5 - 15) / 24) <= thr) n++;
  return n;
}

/** FAO-56 extraterrestrial radiation (mm/day equivalent) for latitude (deg) and day of year (1..365). */
export function ra(latDeg, doy) {
  const phi = latDeg * Math.PI / 180, dr = 1 + 0.033 * Math.cos(2 * Math.PI * doy / 365);
  const dec = 0.409 * Math.sin(2 * Math.PI * doy / 365 - 1.39);
  const x = clamp(-Math.tan(phi) * Math.tan(dec), -1, 1), ws = Math.acos(x);
  return 0.408 * (24 * 60 / Math.PI) * 0.082 * dr * (ws * Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.sin(ws));
}
export function et0Hargreaves(latDeg, doy, tmax, tmin) {
  const tm = (tmax + tmin) / 2;
  return Math.max(0, 0.0023 * ra(latDeg, doy) * (tm + 17.8) * Math.sqrt(Math.max(0, tmax - tmin)));
}

export function usdaZone(minC) {
  const f = minC * 9 / 5 + 32;
  const z = (f + 60) / 10;                    // zone 1 starts at -60 F
  const n = Math.floor(z) + 1, half = (z - Math.floor(z)) >= 0.5 ? 'b' : 'a';
  return { value: Math.max(0, z + 1), label: (n < 1 ? '<1' : n) + half, n };
}

// ---------------------------------------------------------------- Köppen-Geiger
const KOPPEN_NAMES = {
  Af: 'Tropical rainforest', Am: 'Tropical monsoon', Aw: 'Tropical savanna', As: 'Tropical savanna (dry summer)',
  BWh: 'Hot desert', BWk: 'Cold desert', BSh: 'Hot semi-arid', BSk: 'Cold semi-arid',
  Csa: 'Hot-summer Mediterranean', Csb: 'Warm-summer Mediterranean', Csc: 'Cool-summer Mediterranean',
  Cwa: 'Humid subtropical (dry winter)', Cwb: 'Subtropical highland (dry winter)', Cwc: 'Cold subtropical highland',
  Cfa: 'Humid subtropical', Cfb: 'Temperate oceanic', Cfc: 'Subpolar oceanic',
  Dsa: 'Hot dry-summer continental', Dsb: 'Warm dry-summer continental', Dsc: 'Dry-summer subarctic', Dsd: 'Dry-summer subarctic (extreme)',
  Dwa: 'Hot-summer continental (dry winter)', Dwb: 'Warm-summer continental (dry winter)', Dwc: 'Subarctic (dry winter)', Dwd: 'Extreme subarctic (dry winter)',
  Dfa: 'Hot-summer humid continental', Dfb: 'Warm-summer humid continental', Dfc: 'Subarctic', Dfd: 'Extreme subarctic',
  ET: 'Tundra', EF: 'Ice cap',
};
export function koppen(T, P, southern) {
  // T: 12 monthly mean C, P: 12 monthly precip mm (calendar months)
  const tann = mean(T), pann = P.reduce((a, b) => a + b, 0);
  const tmax = Math.max(...T), tmin = Math.min(...T);
  const summer = southern ? [9, 10, 11, 0, 1, 2] : [3, 4, 5, 6, 7, 8];      // Apr-Sep (N) / Oct-Mar (S)
  const winter = southern ? [3, 4, 5, 6, 7, 8] : [9, 10, 11, 0, 1, 2];
  const ps = summer.map(i => P[i]), pw = winter.map(i => P[i]);
  const psum = ps.reduce((a, b) => a + b, 0);
  const pwin = pw.reduce((a, b) => a + b, 0);
  const psmin = Math.min(...ps), psmax = Math.max(...ps), pwmin = Math.min(...pw), pwmax = Math.max(...pw);
  const pmin = Math.min(...P);
  let pth;
  if (pwin >= 0.7 * pann) pth = 2 * tann; else if (psum >= 0.7 * pann) pth = 2 * tann + 28; else pth = 2 * tann + 14;
  let code;
  if (tmax < 10) code = tmax < 0 ? 'EF' : 'ET';
  else if (pann < 10 * pth) { code = (pann < 5 * pth ? 'BW' : 'BS') + (tann >= 18 ? 'h' : 'k'); }
  else if (tmin >= 18) {
    if (pmin >= 60) code = 'Af'; else if (pann >= 25 * (100 - pmin)) code = 'Am';
    else code = (P.indexOf(pmin) % 12 >= (southern ? 9 : 3) && P.indexOf(pmin) % 12 <= (southern ? 11 : 8) ? 'As' : 'Aw');
  } else {
    const grp = tmin > 0 ? 'C' : 'D';
    let s2;
    if (psmin < 40 && psmin < pwmax / 3) s2 = 's'; else if (pwmin < psmax / 10) s2 = 'w'; else s2 = 'f';
    const warm = T.filter(t => t >= 10).length;
    let s3;
    if (tmax >= 22) s3 = 'a'; else if (warm >= 4) s3 = 'b'; else if (tmin > -38) s3 = 'c'; else s3 = 'd';
    code = grp + s2 + s3;
  }
  return { code, name: KOPPEN_NAMES[code] || code };
}

// ---------------------------------------------------------------- main
export function computeFeatures(raw, opts = {}) {
  const lat = raw.lat, southern = lat < 0;
  const P = PARAMS;
  const out = {
    lat, lon: raw.lon, elev: raw.elevation ?? null, southern, nCycles: 0,
    period: opts.period || (raw.start ? raw.start.slice(0, 4) + '-' + (+raw.start.slice(0, 4) + Math.round(raw.tmax.length / 365.25) - 1) : ''),
  };
  // calendar-month normals (true calendar months from the raw series)
  const mT = Array.from({ length: 12 }, () => []), mTx = Array.from({ length: 12 }, () => []), mTn = Array.from({ length: 12 }, () => []), mP = Array.from({ length: 12 }, () => 0);
  {
    const [y0, m0, d0] = raw.start.split('-').map(Number); const t0 = Date.UTC(y0, m0 - 1, d0);
    for (let i = 0; i < raw.tmax.length; i++) {
      const dt = new Date(t0 + i * 86400000); const m = dt.getUTCMonth();
      if (raw.tmax[i] != null && raw.tmin[i] != null) { mTx[m].push(raw.tmax[i]); mTn[m].push(raw.tmin[i]); mT[m].push((raw.tmax[i] + raw.tmin[i]) / 2); }
      if (raw.prcp && raw.prcp[i] != null) mP[m] += raw.prcp[i];
    }
  }
  const yearsN = raw.tmax.length / 365.25;
  const monthly = { tmax: mTx.map(a => mean(a)), tmin: mTn.map(a => mean(a)), tmean: mT.map(a => mean(a)), prcp: mP.map(v => v / yearsN) };
  out.monthly = monthly;
  out.tann = mean(monthly.tmean); out.pann = monthly.prcp.reduce((a, b) => a + b, 0);
  out.koppen = koppen(monthly.tmean, monthly.prcp, southern);
  // dew point = Tmin - k. k is measured per calendar month when a humidity record came with the weather (raw.hum or raw.humClim);
  // otherwise it is the FAO-56 guess from how dry the month is, and the result is flagged `estimated`.
  const hc = raw.humClim || (raw.hum ? humidityClimatology(raw.hum) : null);
  const dewK = hc ? hc.dewDep : monthly.prcp.map(pm => clamp(2.5 * (1 - pm / 50), 0, 2.5));
  const cyc = buildCycles(raw, southern, dewK, hc ? hc.rainHrs : null);
  const vys = [...cyc.keys()].sort((a, b) => a - b);
  out.nCycles = vys.length;
  if (vys.length < 3) { out.error = 'not enough data'; return out; }

  const chill = [], chill72 = [], wmin = [], blooms = [];
  const frostHit = Array.from({ length: 7 }, () => []), frostN = Array.from({ length: 7 }, () => []), frostMin = Array.from({ length: 7 }, () => []);
  const gend = [], endVis = [], seasonDays = [], curves = [];
  const hot32 = [], hot35 = [], hot38 = [], fallTmin = [];
  const swd = [], swt = [], cank = [], fbd = [], mild = [], gsP = [], gsEt = [], lastFrost = [], firstFreezeAll = [];
  const scabEv = [], lwdSp = [], rhGs = [], snowD = [], ffd = [], rhMonth = Array.from({ length: 12 }, () => []), dewMonth = Array.from({ length: 12 }, () => []);
  let noBloom = 0;

  for (const vy of vys) {
    const c = cyc.get(vy), prev = cyc.get(vy - 1);
    if (!prev) continue;                       // every metric needs the previous autumn
    // --- chill + winter minimum (previous autumn + this winter)
    let gateVi = 0;
    {
      let h = 0, mn = Infinity;
      for (let i = P.chillStart; i < 365; i++) { h += chillUnitsDay(prev.tmax[i], prev.tmin[i]); }
      const autumn = h;
      const dayChill = new Float64Array(P.chillEnd + 1);
      for (let i = 0; i <= P.chillEnd; i++) { dayChill[i] = chillUnitsDay(c.tmax[i], c.tmin[i]); h += dayChill[i]; }
      chill.push(h);
      let h72 = 0;
      for (let i = P.chillStart; i < 365; i++) h72 += hoursAtOrBelow(prev.tmax[i], prev.tmin[i], 7.2);
      for (let i = 0; i <= P.chillEnd; i++) h72 += hoursAtOrBelow(c.tmax[i], c.tmin[i], 7.2);
      chill72.push(h72);
      // forcing only counts once ~800 h of chill (or 85% of what this winter offers) have accumulated
      const gate = Math.min(P.chillGate, 0.85 * h);
      if (autumn < gate) { let a2 = autumn; gateVi = P.chillEnd; for (let i = 0; i <= P.chillEnd; i++) { a2 += dayChill[i]; if (a2 >= gate) { gateVi = i; break; } } }
      for (let i = 273; i < 365; i++) mn = Math.min(mn, prev.tmin[i]);
      for (let i = 0; i <= 119; i++) mn = Math.min(mn, c.tmin[i]);
      wmin.push(mn + P.extMinBias);
      // European canker: leaf scars and wounds are infected on wet days at mild temperatures (2-16 C), Oct-Mar
      let cd = 0;
      for (let i = 273; i < 365; i++) if (prev.prcp[i] >= P.wetDay && prev.tmean[i] >= 2 && prev.tmean[i] <= 16) cd++;
      for (let i = 0; i <= 89; i++) if (c.prcp[i] >= P.wetDay && c.tmean[i] >= 2 && c.tmean[i] <= 16) cd++;
      cank.push(cd);
    }
    // --- bloom date: degree-days above 5 C from 1 Feb (or the end of chilling, if later) reach 220
    let b = null, forcing = 0;
    for (let i = Math.max(P.bloomStart, gateVi); i <= P.bloomLast; i++) {
      forcing += Math.max(0, c.tmean[i] - P.bloomBase);
      if (forcing >= P.bloomGdd) { b = i; break; }
    }
    if (b == null) { noBloom++; continue; }
    blooms.push(b);
    // --- spring frost at bloom, per flowering group
    for (let g = 1; g <= 7; g++) {
      const bg = b + P.groupStepDays * (g - 3);
      let n = 0, wmn = Infinity;
      for (let i = Math.max(0, bg + P.frostWindow[0]); i <= Math.min(364, bg + P.frostWindow[1]); i++) { if (c.tmin[i] <= P.frostNight) n++; if (c.tmin[i] < wmn) wmn = c.tmin[i]; }
      frostHit[g - 1].push(n > 0 ? 1 : 0); frostN[g - 1].push(n); frostMin[g - 1].push(wmn);
    }
    // --- GDD curve + season end
    let end = Math.min(364, b + 290), ff = null;
    for (let i = b + 60; i < 365; i++) { if (c.tmin[i] <= P.killFreeze) { end = i; ff = i; break; } }
    if (ff != null) firstFreezeAll.push(ff);
    let acc = 0; const cur = []; let gE = 0;
    for (let k = 0; k <= 260 && b + k < 365; k++) {
      if (k % P.curveStep === 0) cur.push(acc);
      const t = c.tmean[b + k]; acc += clamp(t - P.gddBase, 0, P.gddCap - P.gddBase);
      if (b + k === end) gE = acc;
    }
    if (!gE) gE = acc;
    while (cur.length < P.curveLen) cur.push(cur[cur.length - 1] ?? 0);
    curves.push(cur); gend.push(gE); endVis.push(end); seasonDays.push(end - b);
    // last spring frost (a garden frost, grid Tmin <= anyFrost, before bloom+40)
    let lf = -1; for (let i = 0; i < Math.min(200, b + 40); i++) if (c.tmin[i] <= P.anyFrost) lf = i;
    lastFrost.push(lf);
    // --- heat
    let a32 = 0, a35 = 0, a38 = 0;
    for (let i = b + 30; i <= Math.min(364, b + 210); i++) { if (c.tmax[i] >= 32) a32++; if (c.tmax[i] >= 35) a35++; if (c.tmax[i] >= 38) a38++; }
    hot32.push(a32); hot35.push(a35); hot38.push(a38);
    let ft = 0, fn = 0; for (let i = 227; i <= 273; i++) { ft += c.tmin[i]; fn++; } fallTmin.push(ft / fn);
    // --- wetness / disease pressure (decision 0004)
    let sw = 0, st = 0, sn = 0, lw = 0;
    for (let i = Math.max(0, b - 20); i <= Math.min(364, b + 60); i++) { if (c.prcp[i] >= P.wetDay) sw++; st += c.tmean[i]; sn++; lw += c.lwd[i]; }
    swd.push(sw); swt.push(st / sn); lwdSp.push(lw / sn);
    // apple scab: primary infection periods = runs of wet days whose accumulated leaf-wetness hours reach Mills' requirement
    let ev = 0, acc2 = 0;
    for (let i = Math.max(0, b - 20); i <= Math.min(364, b + 60); i++) {
      if (c.lwd[i] >= 7) {
        acc2 += c.lwd[i];
        if (acc2 >= millsHours(c.tmean[i])) { ev++; acc2 = 0; }
      } else acc2 = 0;
    }
    scabEv.push(ev);
    // fire blight (Maryblyt-style): open blossom, >= 110 degree-hours above 18.3 C since opening, daily mean >= 15.6 C and a wetting event
    let dh = 0, fb = 0;
    for (let i = Math.max(0, b - 7); i <= Math.min(364, b + 14); i++) {
      dh += blightDegreeHours(c.tmax[i], c.tmin[i]);
      if (dh >= 110 && c.tmean[i] >= 15.6 && (c.prcp[i] >= 0.25 || c.dew[i] >= 6)) fb++;
    }
    fbd.push(fb);
    // powdery mildew: warm, rain-free days after moderately humid nights (conidia germinate even in fairly dry air)
    let md = 0, mn2 = 0;
    for (let i = b; i <= Math.min(364, b + 90); i++) { mn2++; if (c.tmean[i] >= 10 && c.tmean[i] <= 25 && c.prcp[i] < 1 && c.rhn[i] >= 60) md++; }
    mild.push(md / mn2);
    let gp = 0, ge = 0;
    for (let i = b; i <= end; i++) {
      gp += c.prcp[i];
      const realDoy = southern ? (i + 181) % 365 + 1 : i + 1;
      ge += 0.9 * et0Hargreaves(lat, realDoy, c.tmax[i], c.tmin[i]);
    }
    gsP.push(gp); gsEt.push(ge);
    let rg = 0, rn = 0; for (let i = b; i <= end; i++) { rg += c.rh[i]; rn++; } rhGs.push(rg / Math.max(1, rn));
    let sn2 = 0; for (let i = 0; i < 365; i++) if (c.prcp[i] >= 1 && c.tmean[i] < 0.5) sn2++; snowD.push(sn2);
    for (let i = 0; i < 365; i++) { rhMonth[c.cmonth[i]].push(c.rh[i]); dewMonth[c.cmonth[i]].push(c.lwd[i]); }
    // frost-free season: from the last spring frost to the first autumn frost (Tmin <= 0)
    let f0 = -1; for (let i = b + 60; i < 365; i++) if (c.tmin[i] <= P.anyFrost) { f0 = i; break; }
    ffd.push((f0 < 0 ? 365 : f0) - Math.max(0, lf));
  }

  out.noBloomYears = noBloom;
  out.nCycles = chill.length;
  if (!blooms.length) {
    out.noBloom = true;
    out.chill = { mean: mean(chill), p20: pct(chill, 0.2), min: Math.min(...chill), per: chill, hours72: mean(chill72) };
    const em = mean(wmin); out.winter = { extMinMean: em, extMinAbs: Math.min(...wmin), zone: usdaZone(em) };
    return out;
  }
  out.chill = { mean: mean(chill), p20: pct(chill, 0.2), min: Math.min(...chill), max: Math.max(...chill), per: chill, hours72: mean(chill72) };
  const em = mean(wmin);
  out.winter = { extMinMean: em, extMinAbs: Math.min(...wmin), zone: usdaZone(em), per: wmin };
  out.bloom = { vi: mean(blooms), sd: sd(blooms), label: viLabel(mean(blooms), southern) };
  // Probability of a frost at bloom: ten years is a small sample, so blend the observed hit rate with a normal fit to the
  // coldest night in each year's window (decision 0002).
  const frostP = frostHit.map((hits, g) => {
    const emp = mean(hits), mu = mean(frostMin[g]), s = Math.max(1.2, sd(frostMin[g]));
    return 0.5 * emp + 0.5 * normCdf((P.frostNight - mu) / s);
  });
  const lfs = lastFrost.filter(v => v >= 0);
  out.frost = { p: frostP, nights: frostN.map(a => mean(a)), minMean: frostMin.map(a => mean(a)), lastSpring: lfs.length >= lastFrost.length / 2 ? viLabel(mean(lfs), southern) : 'rarely', lastSpringVi: lfs.length ? mean(lfs) : null };
  const curve = []; for (let k = 0; k < P.curveLen; k++) curve.push(mean(curves.map(c => c[k])));
  out.season = {
    gddCurve: curve.map(v => Math.round(v)), gendPer: gend.map(Math.round), gendMedian: pct(gend, 0.5), gendP20: pct(gend, 0.2),
    endVi: mean(endVis), endLabel: viLabel(mean(endVis), southern), days: mean(seasonDays),
    freezeYears: firstFreezeAll.length / blooms.length,
    firstFreeze: firstFreezeAll.length ? viLabel(mean(firstFreezeAll), southern) : null,
  };
  out.heat = { hot32: mean(hot32), hot35: mean(hot35), hot38: mean(hot38), tmaxHot: Math.max(...monthly.tmax), fallTmin: mean(fallTmin) };
  out.wet = {
    springWetDays: mean(swd), springT: mean(swt), cankerDays: mean(cank), fireBlightEvents: mean(fbd), mildewIdx: mean(mild),
    scabEvents: mean(scabEv), lwdSpring: mean(lwdSp),
    gsPrecip: mean(gsP), gsEt0: mean(gsEt), aridity: mean(gsP) / Math.max(1, mean(gsEt)),
  };
  out.humidity = { gs: mean(rhGs), monthly: rhMonth.map(a => mean(a)), lwdMonthly: dewMonth.map(a => mean(a)), estimated: !hc, dewDep: dewK.map(v => Math.round(v * 10) / 10) };
  out.snowDays = mean(snowD);
  out.frostFreeDays = mean(ffd);
  out.flags = { tropical: out.winter.extMinMean > 12 || (out.chill.mean < 30) };
  return out;
}

/** Rounded, size-trimmed copy of a features object for baking into assets/climate-presets.json. */
export function compactFeatures(F) {
  const r = (v, d = 2) => typeof v === 'number' ? (isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : null) : v;
  const walk = o => {
    if (Array.isArray(o)) return o.map(walk);
    if (o && typeof o === 'object') { const out = {}; for (const k of Object.keys(o)) { if (k === 'per' && o.per && k in o && (o === F.chill || o === F.winter)) continue; out[k] = walk(o[k]); } return out; }
    return r(o);
  };
  return walk(F);
}

/** Curve value (mean cumulative GDD from bloom) at a fractional day offset. */
export function curveAt(curve, off) {
  const s = PARAMS.curveStep, x = clamp(off / s, 0, curve.length - 1), i = Math.floor(x), f = x - i;
  return i >= curve.length - 1 ? curve[curve.length - 1] : curve[i] + (curve[i + 1] - curve[i]) * f;
}
/** Day offset after bloom at which the mean curve reaches `gdd` (Infinity if it never does in 260 days). */
export function offsetFor(curve, gdd) {
  const s = PARAMS.curveStep;
  for (let i = 1; i < curve.length; i++) {
    if (curve[i] >= gdd) { const a = curve[i - 1], b = curve[i]; return (i - 1 + (b > a ? (gdd - a) / (b - a) : 0)) * s; }
  }
  return Infinity;
}
