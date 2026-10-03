// Variety x place suitability. Pure functions: (variety record, climate features) -> score + reasons.
// Design notes and the rejected alternatives are in docs/decisions/0002-climate-model.md.
import { curveAt, offsetFor, viLabel, PARAMS } from '../climate/features.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const fmt = n => Math.round(n).toLocaleString('en-US');

/** Piecewise-linear interpolation through [[x,y],...] sorted by x; flat outside the ends. */
export function pw(x, pts) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
  }
  return pts[pts.length - 1][1];
}

export const WEIGHTS = { chill: 3, hardiness: 3, season: 3, frost: 2, heat: 2, water: 1.2, disease: 1.5 };
const CRITICAL = ['chill', 'hardiness', 'season', 'heat'];
const HEAT_ALLOW = [3, 8, 15, 25, 40];           // days >= 32 C per year a variety of heat tolerance 1..5 shrugs off
const SUSC_W = [0.03, 0.2, 0.5, 0.8, 1.0];       // susceptibility 1..5 -> weight

export function verdictOf(f) { return f >= 0.85 ? 'good' : f >= 0.6 ? 'ok' : f >= 0.3 ? 'warn' : 'bad'; }
export function labelOf(score) {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Workable';
  if (score >= 35) return 'Marginal';
  if (score >= 15) return 'Poor';
  return 'Not viable';
}

/** Build the context once from the reference (south-east England) features. */
export function makeContext(refFeatures) {
  return { ref: refFeatures };
}

/** Thermal requirement (GDD base 5 C from bloom to harvest) implied by a south-east England harvest date. */
export function thermalNeed(ctx, harvestDoy) {
  const r = ctx.ref;
  return curveAt(r.season.gddCurve, harvestDoy - r.bloom.vi);
}

function fChill(v, F, notes) {
  if (F.flags && F.flags.tropical) return { f: 0, text: 'There is effectively no winter here (' + fmt(F.chill.mean) + ' chill units), so apples cannot break dormancy and will not flower properly.' };
  let need = v.climate.chill_hours, est = false;
  if (need == null) { need = 900; est = true; }
  const avail = 0.5 * F.chill.mean + 0.5 * F.chill.p20;
  const r = avail / need;
  const f = pw(r, [[0.45, 0], [0.7, 0.2], [0.85, 0.6], [1.0, 0.95], [1.15, 1]]);
  const have = '~' + fmt(F.chill.mean) + ' chill units here (' + fmt(F.chill.p20) + ' in a mild winter)';
  const needTxt = '~' + fmt(need) + (est ? ' (estimated)' : '');
  let text;
  if (r >= 1.15) text = 'Plenty of winter chill: ' + have + ' against the ' + needTxt + ' it needs.';
  else if (r >= 1.0) text = 'Enough winter chill: ' + have + ' against ' + needTxt + ', with little to spare in a mild year.';
  else if (r >= 0.85) text = 'Chill is borderline: ' + have + ' against ' + needTxt + '. Expect ragged, late or thin blossom after mild winters.';
  else if (r >= 0.7) text = 'Short on chill: ' + have + ' but it needs ' + needTxt + '. Poor blossom set and delayed leafing are likely.';
  else text = 'Not enough winter chill: ' + have + ' against the ' + needTxt + ' it needs. It will flower erratically or fail.';
  return { f, text };
}

function fHardiness(v, F) {
  let vz = v.climate.hardiness_zone, est = false;
  if (vz == null) { vz = 5; est = true; }
  const lz = F.winter.zone.value;
  const m = lz - vz;
  const f = pw(m, [[-1.5, 0], [-1.0, 0.1], [-0.5, 0.55], [0, 0.95], [0.3, 1]]);
  const site = 'Typical coldest night here is about ' + Math.round(F.winter.extMinMean) + ' °C (zone ' + F.winter.zone.label + ')';
  const lim = 'zone ' + vz + (est ? ' (estimated)' : '');
  let text;
  if (m >= 0.3) text = site + '; ' + v.name + ' is hardy to ' + lim + ', so winter cold is no problem.';
  else if (m >= 0) text = site + ', right at the limit of ' + v.name + ' (' + lim + '), fine in most winters.';
  else if (m >= -0.5) text = site + ', a little colder than ' + v.name + ' (' + lim + ') likes: expect occasional winter dieback in the hardest years.';
  else if (m >= -1.0) text = site + ', clearly colder than ' + lim + ': winter injury or tree loss is likely without protection.';
  else text = site + ' is far beyond what ' + v.name + ' (' + lim + ') can survive.';
  return { f, text };
}

function fFrost(v, F) {
  let g = v.pollination.flower_group, est = false;
  if (g == null) { g = 3; est = true; }
  const p = F.frost.p[clamp(g, 1, 7) - 1], n = F.frost.nights[clamp(g, 1, 7) - 1];
  const f = pw(p, [[0, 1], [0.05, 1], [0.15, 0.85], [0.3, 0.55], [0.5, 0.25], [0.8, 0.05]]);
  const yrs = Math.round(p * (F.nCycles - 1));
  const when = 'around ' + F.bloom.label;
  let text;
  if (p <= 0.05) text = 'Blossom (' + when + ', flowering group ' + g + (est ? ', assumed' : '') + ') almost always escapes frost here.';
  else if (p <= 0.15) text = 'Frost during blossom (' + when + ') is uncommon: it hit in about ' + yrs + ' of the last ' + (F.nCycles - 1) + ' years.';
  else if (p <= 0.3) text = 'Frost caught the blossom (' + when + ') in roughly ' + yrs + ' of the last ' + (F.nCycles - 1) + ' years: plan for some frost protection or a later-flowering choice.';
  else text = 'Blossom frost is a serious risk: damaging frosts fell inside the flowering window (around ' + F.bloom.label + ') in about ' + Math.round(p * 100) + '% of years.';
  return { f, text, p };
}

function fSeason(v, F, ctx) {
  const doy = v.season.harvest_doy;
  if (doy == null) return { f: 0.7, text: 'Harvest time is not recorded for this variety, so ripening could not be checked.', unknown: true };
  const R = thermalNeed(ctx, doy);
  const G = F.season.gendMedian;
  const q = G / R;
  const ok = F.season.gendPer.filter(x => x >= R).length / F.season.gendPer.length;
  const f = Math.min(pw(q, [[0.8, 0], [0.9, 0.2], [1.0, 0.6], [1.1, 0.85], [1.25, 1]]), 0.2 + 0.8 * ok);
  const off = offsetFor(F.season.gddCurve, R);
  let harvest = null, shift = null;
  if (isFinite(off)) {
    const hv = F.bloom.vi + off;
    harvest = viLabel(hv, F.southern);
    shift = Math.round(hv - doy);
  }
  let text;
  if (f >= 0.85) {
    text = 'The season is long and warm enough: it should ripen around ' + harvest + (shift !== null && Math.abs(shift) >= 7 ? ', ' + Math.round(Math.abs(shift) / 7) + ' week' + (Math.abs(Math.round(shift / 7)) === 1 ? '' : 's') + (shift < 0 ? ' earlier' : ' later') + ' than in south-east England' : '') + ', well ahead of the first hard freeze (' + (F.season.firstFreeze || 'none recorded') + ').';
  } else if (f >= 0.6) {
    text = 'Ripening is only just comfortable: expected around ' + (harvest || 'late autumn') + ' with the first hard freeze about ' + (F.season.firstFreeze || 'late') + '. Cool summers will leave it sharp and under-coloured.';
  } else if (f >= 0.3) {
    text = 'The season is too short or cool for reliable ripening: fruit would be ready around ' + (harvest || 'after the growing season ends') + ' but ripened fully in only ' + Math.round(ok * 100) + '% of the last ' + F.season.gendPer.length + ' seasons.';
  } else {
    text = 'There is not enough warmth between blossom and the first hard freeze (' + (F.season.firstFreeze || 'early') + ') to ripen this variety here.';
  }
  return { f, text, harvest, shift, need: R };
}

function fWater(v, F) {
  const ar = F.wet.aridity;
  const f = pw(ar, [[0, 0.3], [0.25, 0.55], [0.5, 0.8], [0.8, 1]]);
  const pct = Math.round(Math.min(1, ar) * 100);
  let text;
  if (ar >= 0.8) text = 'Growing-season rain (' + fmt(F.wet.gsPrecip) + ' mm) meets the water needs of the trees, so irrigation is not required.';
  else if (ar >= 0.5) text = 'Growing-season rain covers about ' + pct + '% of the trees’ water needs: water young trees and dwarfing rootstocks in dry spells.';
  else if (ar >= 0.25) text = 'Dry growing season: rain covers only about ' + pct + '% of the trees’ water needs, so regular irrigation is needed.';
  else text = 'Arid: rain covers about ' + pct + '% of the water apples need. Apples can only be grown here with full irrigation (as in dry orchard districts such as Washington State or Xinjiang).';
  return { f, text };
}

function fHeat(v, F) {
  let h = v.climate.heat_tolerance, est = false;
  if (h == null) { h = 3; est = true; }
  const allow = HEAT_ALLOW[clamp(h, 1, 5) - 1];
  const ratio = F.heat.hot32 / allow;
  let f = pw(ratio, [[0, 1], [1, 0.95], [2, 0.6], [3.5, 0.2], [6, 0]]);
  if (F.heat.hot38 > 2) f *= 0.85;
  const bits = [];
  let colourNote = '';
  if (v.climate.colour_needs_cool_nights && F.heat.fallTmin > 14) {
    const c = pw(F.heat.fallTmin, [[14, 1], [17, 0.9], [20, 0.8]]);
    f *= c;
    colourNote = ' Warm autumn nights (~' + Math.round(F.heat.fallTmin) + ' °C lows) will mute its red colour.';
  }
  let text;
  if (F.heat.hot32 < 1) text = 'Summers rarely top 32 °C (' + (F.heat.hot32 < 0.5 ? 'almost never' : 'about one day a year') + '), so heat stress is not an issue.';
  else if (ratio <= 1) text = 'About ' + Math.round(F.heat.hot32) + ' days a year reach 32 °C or more, which a heat tolerance of ' + h + '/5 copes with.';
  else if (ratio <= 2) text = 'About ' + Math.round(F.heat.hot32) + ' days a year reach 32 °C or more, more than ' + v.name + ' (heat tolerance ' + h + '/5) likes: expect some sunburn, soft fruit and lost acidity.';
  else text = 'Hot summers (' + Math.round(F.heat.hot32) + ' days a year at 32 °C or more) are well beyond its comfort: sunburn, soft fruit and poor flavour are likely.';
  return { f, text: text + colourNote + (est && F.heat.hot32 >= 1 ? ' (Its heat tolerance is not recorded, so an average of 3/5 is assumed.)' : '') };
}

/**
 * Disease pressure 0..1 for a place. Weather decides severity; the regional lookup (F.regional) decides whether a disease
 * exists there at all. Humidity enters through leaf wetness (dew + rain hours) in the scab and rust infection counts and
 * through humid nights in the mildew index.
 */
function pressures(F) {
  const W = F.wet, R = F.regional;
  const tempSuit = pw(W.springT, [[2, 0.3], [6, 1], [20, 1], [26, 0.4]]);
  const scab = clamp((W.scabEvents - 8) / 26, 0, 1) * tempSuit;
  const canker = clamp((W.cankerDays - 25) / 60, 0, 1) * (F.winter.extMinMean > -28 ? 1 : 0.6);
  const mildew = clamp((W.mildewIdx - 0.25) / 0.4, 0, 1);
  const fbStatus = R ? R.fireBlight.status : 'unknown';
  const fireBlight = clamp(W.fireBlightEvents / 4, 0, 1) * (fbStatus === 'absent' ? 0.1 : 1);
  const rust = R && R.rust.present ? clamp((W.scabEvents - 6) / 22, 0, 1) * 0.9 : 0;
  return { scab, canker, mildew, fire_blight: fireBlight, rust };
}
export const sitePressures = pressures;
const strength = { scab: 0.8, canker: 0.7, mildew: 0.4, fire_blight: 0.8, rust: 0.4 };
const DNAME = { scab: 'apple scab', canker: 'European canker', mildew: 'powdery mildew', fire_blight: 'fire blight', rust: 'cedar-apple rust' };
export function pressureWord(p) { return p >= 0.66 ? 'high' : p >= 0.33 ? 'moderate' : p >= 0.12 ? 'low' : 'minimal'; }

function fDisease(v, F) {
  const P = pressures(F);
  let prod = 1;
  const issues = [];
  for (const k of Object.keys(P)) {
    let s = v.health[k];
    const unrated = s == null;
    if (unrated) s = 3;
    const pen = P[k] * SUSC_W[clamp(s, 1, 5) - 1] * strength[k];
    prod *= (1 - pen);
    if (P[k] >= 0.33 && s >= 3) issues.push({ k, pen, s, unrated, p: P[k] });
  }
  issues.sort((a, b) => b.pen - a.pen);
  const W = F.wet, hum = F.humidity;
  let text;
  if (!issues.length) {
    const top = Object.keys(P).sort((a, b) => P[b] - P[a])[0];
    text = P[top] < 0.12 ? 'Disease pressure is light here.' : 'Disease pressure is modest and ' + v.name + ' has no major weak spot against it.';
  } else {
    text = issues.slice(0, 3).map(i => cap(DNAME[i.k]) + ' pressure is ' + pressureWord(i.p) + ' here (' + driver(i.k, F) + ') and ' + v.name + ' is ' + (i.s >= 5 ? 'very susceptible' : i.s >= 4 ? 'susceptible' : 'moderately susceptible') + (i.unrated ? ' (assumed)' : '') + '.').join(' ');
  }
  if (hum && hum.estimated) text += ' (Humidity is estimated from the temperature range here.)';
  return { f: prod, text, pressures: P };
}
/** One short phrase on what drives a disease at this place. */
function driver(k, F) {
  const W = F.wet;
  if (k === 'scab') return '~' + Math.round(W.scabEvents) + ' infection periods in spring; leaves stay wet ~' + Math.round(W.lwdSpring) + ' h a day';
  if (k === 'canker') return Math.round(W.cankerDays) + ' mild wet days from October to March';
  if (k === 'mildew') return 'warm dry days after humid nights';
  if (k === 'fire_blight') return '~' + (W.fireBlightEvents < 1 ? W.fireBlightEvents.toFixed(1) : Math.round(W.fireBlightEvents)) + ' warm wet blossom days a year' + (F.regional && F.regional.fireBlight.status === 'unknown' ? ', regional status unmapped' : '');
  if (k === 'rust') return 'cedar-apple rust occurs here and spring is wet';
  return '';
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/** Score one variety at one place. F = climate features, ctx = makeContext(ref). */
export function scoreVariety(v, F, ctx) {
  if (F.error) return { score: 0, label: 'No data', factors: [], limiting: null, error: F.error };
  if (F.noBloom) return { score: 0, label: 'Not viable', factors: [{ key: 'season', title: 'Season', f: 0, tone: 'bad', text: 'It never warms enough here (10-day mean of 10 °C) for apples to flower.', critical: true }], limiting: 'season' };
  const parts = {
    chill: fChill(v, F), hardiness: fHardiness(v, F), frost: fFrost(v, F), season: fSeason(v, F, ctx),
    heat: fHeat(v, F), water: fWater(v, F), disease: fDisease(v, F),
  };
  const titles = { chill: 'Winter chill', hardiness: 'Winter cold', frost: 'Frost at blossom', season: 'Ripening season', heat: 'Summer heat', water: 'Water', disease: 'Disease pressure' };
  let sw = 0, sf = 0;
  const factors = [];
  for (const k of Object.keys(parts)) {
    const p = parts[k];
    sw += WEIGHTS[k]; sf += WEIGHTS[k] * p.f;
    factors.push({ key: k, title: titles[k], f: p.f, tone: verdictOf(p.f), text: p.text, critical: CRITICAL.includes(k), extra: p });
  }
  const base = sf / sw;
  const minCrit = Math.min(...CRITICAL.map(k => parts[k].f));
  const score = Math.round(100 * base * Math.pow(minCrit, 0.6));
  const worst = [...factors].sort((a, b) => a.f - b.f)[0];
  return { score, label: labelOf(score), factors, limiting: worst.f < 0.7 ? worst.key : null, harvest: parts.season.harvest || null, shift: parts.season.shift ?? null };
}

export function rankVarieties(varieties, F, ctx) {
  return varieties.map(v => ({ v, s: scoreVariety(v, F, ctx) })).sort((a, b) => b.s.score - a.s.score);
}

// ----------------------------------------------------------------- place summary + rootstocks

/** Plain-language profile of the place: array of {title, tone, text}. */
export function siteProfile(F) {
  if (F.error) return [];
  const out = [];
  const z = F.winter.zone;
  if (F.flags && F.flags.tropical) {
    out.push({ title: 'Winter', tone: 'bad', text: 'No real winter: ' + fmt(F.chill.mean) + ' chill units and nights that rarely drop below ' + Math.round(F.winter.extMinMean) + ' °C. Only the lowest-chill apples have a chance.' });
  } else {
    const c = F.chill.mean;
    out.push({ title: 'Winter chill', tone: c >= 1200 ? 'good' : c >= 800 ? 'ok' : c >= 400 ? 'warn' : 'bad',
      text: '~' + fmt(c) + ' Utah chill units from November to March (' + fmt(F.chill.p20) + ' in a mild winter)' + (F.chill.hours72 != null ? ', or about ' + fmt(F.chill.hours72) + ' hours below 7.2 °C (45 °F), the classic "chill hours" count' : '') + '. ' + (c >= 1800 ? 'Satisfies even the highest-chill varieties.' : c >= 1000 ? 'Enough for most traditional varieties.' : c >= 600 ? 'Fine for medium and low-chill varieties; high-chill ones may struggle.' : 'Only low-chill varieties are realistic.') });
    out.push({ title: 'Winter cold', tone: z.value >= 6 ? 'good' : z.value >= 4.5 ? 'ok' : z.value >= 3.5 ? 'warn' : 'bad',
      text: 'Coldest night in a typical winter ≈ ' + Math.round(F.winter.extMinMean) + ' °C (zone ' + z.label + '); the coldest in ' + F.period + ' reached ' + Math.round(F.winter.extMinAbs) + ' °C.' });
  }
  if (!F.noBloom) {
    const p3 = F.frost.p[2];
    out.push({ title: 'Blossom & frost', tone: p3 <= 0.1 ? 'good' : p3 <= 0.3 ? 'ok' : p3 <= 0.5 ? 'warn' : 'bad',
      text: 'Mid-season varieties blossom around ' + F.bloom.label + ' (±' + Math.round(F.bloom.sd) + ' days). ' + (p3 < 0.05 ? 'Frost at blossom is rare here' : 'Frost at blossom is a ' + Math.round(p3 * 100) + '% risk in a given year') + '; the last spring frost is typically ' + (F.frost.lastSpring === 'rarely' ? 'rare' : F.frost.lastSpring) + '.' });
    const days = F.season.days, g = F.season.gendMedian;
    out.push({ title: 'Growing season', tone: g >= 1700 ? 'good' : g >= 1300 ? 'ok' : g >= 900 ? 'warn' : 'bad',
      text: 'About ' + Math.round(days) + ' days from bloom to ' + (F.season.firstFreeze ? 'the first hard freeze (~' + F.season.firstFreeze + ')' : 'the end of the season') + ', accumulating ~' + fmt(g) + ' growing degree-days (base 5 °C). ' + (g >= 1800 ? 'Late-ripening varieties are comfortable.' : g >= 1400 ? 'Early to late-mid varieties ripen reliably.' : g >= 1000 ? 'Choose early and mid-season varieties.' : 'Only the earliest varieties will ripen.') });
    if (F.frostFreeDays != null) {
      const ffd = F.frostFreeDays;
      out.push({ title: 'Frost-free season', tone: ffd >= 200 ? 'good' : ffd >= 150 ? 'ok' : ffd >= 110 ? 'warn' : 'bad',
        text: 'About ' + Math.round(ffd) + ' days between the last spring and first autumn frost (last spring frost ~' + F.frost.lastSpring + ')' + (F.snowDays >= 1 ? '; roughly ' + Math.round(F.snowDays) + ' days a year bring snow.' : '; snow is rare.') });
    }
    const hot = F.heat.hot32;
    out.push({ title: 'Summer heat', tone: hot < 3 ? 'good' : hot < 12 ? 'ok' : hot < 30 ? 'warn' : 'bad',
      text: 'Hottest month averages ' + Math.round(F.heat.tmaxHot) + ' °C highs; ' + (hot < 1 ? 'days of 32 °C+ are rare.' : 'about ' + Math.round(hot) + ' days a year reach 32 °C or more.') });
    const P = pressures(F);
    const bits = [];
    for (const k of ['scab', 'canker', 'fire_blight', 'mildew', 'rust']) if (P[k] >= 0.33) bits.push(DNAME[k] + ' (' + pressureWord(P[k]) + ')');
    const rh = F.humidity;
    if (rh) {
      const g = rh.gs;
      out.push({ title: 'Humidity & leaf wetness', tone: g < 60 ? 'good' : g < 72 ? 'ok' : g < 80 ? 'warn' : 'bad',
        text: 'Relative humidity averages ~' + Math.round(g) + '% through the growing season' + (rh.estimated ? ' (estimated from the temperature range)' : '') + '. In spring, leaves stay wet ~' + Math.round(F.wet.lwdSpring) + ' hours a day from dew and rain, enough for ~' + Math.round(F.wet.scabEvents) + ' scab infection periods between early bloom and early summer.' });
    }
    out.push({ title: 'Disease pressure', tone: bits.length === 0 ? 'good' : bits.length <= 1 ? 'ok' : 'warn',
      text: fmt(F.pann) + ' mm of rain a year. ' + (bits.length ? 'Watch for ' + bits.join(', ') + '.' : 'Disease pressure is generally low.') + (F.regional ? ' ' + F.regional.fireBlight.note + ' ' + F.regional.rust.note : '') });
    const ar = F.wet.aridity;
    out.push({ title: 'Water', tone: ar >= 0.8 ? 'good' : ar >= 0.5 ? 'ok' : ar >= 0.25 ? 'warn' : 'bad',
      text: ar >= 0.8 ? 'Growing-season rain covers the water the trees need; irrigation is unnecessary.' : ar >= 0.5 ? 'Rain covers most of what the trees need; water young trees in dry spells.' : ar >= 0.25 ? 'Dry growing season: irrigation will be needed, especially on dwarfing rootstocks.' : 'Arid: apples need full irrigation (and probably mulching) to survive.' });
  } else {
    out.push({ title: 'Spring', tone: 'bad', text: 'It never warms to a 10-day mean of 10 °C, so apple trees would not flower.' });
  }
  return out;
}

const SIZE_BUCKETS = [
  ['dwarf', 'Dwarf (about 2–3 m)', ['very-dwarf', 'dwarf']],
  ['semi-dwarf', 'Semi-dwarf (3–4 m)', ['semi-dwarf']],
  ['semi-vigorous', 'Semi-vigorous (4–5 m)', ['semi-vigorous']],
  ['vigorous', 'Vigorous / standard (5 m+)', ['vigorous', 'very-vigorous']],
];

export function rootstockFit(r, F) {
  let s = 80;
  const why = [], warn = [];
  const lz = F.winter.zone.value;
  const rz = r.hardiness_zone ?? 5;
  const m = lz - rz;
  if (m < 0) { s -= Math.min(65, -m * 45); warn.push('roots are rated to zone ' + rz + ' but this site is about zone ' + F.winter.zone.label); }
  else if (lz < 5.5 && rz <= 4) { s += 6; why.push('very hardy roots for a cold site'); }
  const P = pressures(F);
  const fb = r.susceptibility && r.susceptibility.fire_blight;
  if (P.fire_blight >= 0.3 && fb != null) {
    if (fb >= 4) { s -= P.fire_blight * (fb - 2) * 12; warn.push('fire blight can kill trees through this rootstock, and warm wet blossom weather makes it a real risk here'); }
    else if (fb <= 2) { s += P.fire_blight * 8; why.push('resistant to fire blight, which is a risk in this climate'); }
  }
  const wetP = clamp((F.pann - 700) / 600, 0, 1) * 0.6 + clamp((F.wet.cankerDays - 60) / 60, 0, 1) * 0.4;
  const cr = r.susceptibility && r.susceptibility.collar_rot, wt = r.tolerance && r.tolerance.wet_soil;
  if (wetP >= 0.25) {
    if (cr != null && cr >= 4) { s -= wetP * (cr - 2) * 10; warn.push('prone to collar rot in wet, heavy soils (this is a wet climate)'); }
    else if (cr != null && cr <= 2) { s += wetP * 6; why.push('resists collar rot in wet soils'); }
    if (wt != null && wt >= 4) { s += wetP * 4; why.push('tolerates wet ground'); }
  }
  const dryP = clamp((0.9 - F.wet.aridity) / 0.6, 0, 1);
  const dt = r.tolerance && r.tolerance.drought;
  if (dryP >= 0.2 && dt != null) {
    if (dt >= 4) { s += dryP * 8; why.push('copes with drought, useful where growing-season rain is short'); }
    else if (dt <= 2) { s -= dryP * 10; warn.push('shallow-rooted and drought-sensitive, so it needs irrigation here'); }
  }
  const aph = r.susceptibility && r.susceptibility.woolly_aphid;
  const aphP = (F.heat.tmaxHot >= 21 && F.winter.extMinMean > -26) ? 0.6 : 0.2;
  if (aph != null) {
    if (aph >= 4) { s -= aphP * (aph - 2) * 5; if (aphP > 0.4) warn.push('susceptible to woolly apple aphid, which thrives in climates like this'); }
    else if (aph <= 2) { s += aphP * 5; if (aphP > 0.4) why.push('woolly-aphid resistant'); }
  }
  return { score: clamp(Math.round(s), 0, 100), why, warn };
}

/** Rank rootstocks for a place, grouped by tree size. */
export function rootstockAdvice(rootstocks, F) {
  if (F.error || F.noBloom) return [];
  return SIZE_BUCKETS.map(([key, title, classes]) => {
    const items = rootstocks.filter(r => classes.includes(r.size_class)).map(r => ({ r, ...rootstockFit(r, F) }))
      .sort((a, b) => b.score - a.score);
    return { key, title, items };
  }).filter(b => b.items.length);
}
