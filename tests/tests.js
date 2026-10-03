// In-browser unit tests: open /tests/ (served by tools/serve.py). All lines must say PASS before committing.
import { computeFeatures, chillUnitsDay, utahWeight, koppen, usdaZone, viLabel, viToDate, doyToVi, curveAt, offsetFor, ra, et0Hargreaves, buildCycles, compactFeatures } from '../js/climate/features.js';
import { pw, scoreVariety, rankVarieties, makeContext, thermalNeed, rootstockAdvice, siteProfile, labelOf } from '../js/score/score.js';

const out = document.getElementById('out');
let pass = 0, fail = 0;
function t(name, fn) {
  try { const r = fn(); if (r === false) throw new Error('returned false'); pass++; out.insertAdjacentHTML('beforeend', `<div class="pass">PASS ${name}</div>`); }
  catch (e) { fail++; out.insertAdjacentHTML('beforeend', `<div class="fail">FAIL ${name}: ${e.message}</div>`); }
}
const eq = (a, b, m = '') => { if (a !== b) throw new Error(`${m} expected ${b}, got ${a}`); };
const near = (a, b, tol, m = '') => { if (!(Math.abs(a - b) <= tol)) throw new Error(`${m} expected ${b} +-${tol}, got ${a}`); };

// ---------------------------------------------------------------- synthetic climates
/** Ten years of sinusoidal daily weather: mean annual temp tm, seasonal half-amplitude ta, diurnal half-range dr, rain every 3rd day. */
function synth(lat, tm, ta, dr, { start = '2015-01-01', years = 10, rain = 3, noise = 0 } = {}) {
  const tmax = [], tmin = [], prcp = [];
  const d0 = Date.UTC(+start.slice(0, 4), 0, 1);
  const n = Math.round(years * 365.25);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - .5; };
  for (let i = 0; i < n; i++) {
    const dt = new Date(d0 + i * 86400000); const doy = (dt - Date.UTC(dt.getUTCFullYear(), 0, 0)) / 86400000;
    const phase = lat >= 0 ? 2 * Math.PI * (doy - 200) / 365.25 : 2 * Math.PI * (doy - 17) / 365.25;
    const m = tm + ta * Math.cos(phase) + noise * rnd() * 2;
    tmax.push(m + dr); tmin.push(m - dr); prcp.push(i % rain === 0 ? 4 : 0);
  }
  return { lat, lon: 0, elevation: 50, start, tmax, tmin, prcp };
}

// ---------------------------------------------------------------- primitives
t('pw interpolates and clamps', () => { eq(pw(5, [[0, 0], [10, 1]]), .5); eq(pw(-3, [[0, 0], [10, 1]]), 0); eq(pw(30, [[0, 0], [10, 1]]), 1); });
t('utahWeight bins', () => { eq(utahWeight(0), 0); eq(utahWeight(2), .5); eq(utahWeight(5), 1); eq(utahWeight(10), .5); eq(utahWeight(14), 0); });
t('chillUnitsDay: constant 5 C day = 24 units', () => eq(chillUnitsDay(5, 5), 24));
t('chillUnitsDay: hot day = 0', () => eq(chillUnitsDay(30, 20), 0));
t('chillUnitsDay: cold-floor keeps freezing days positive', () => { const u = chillUnitsDay(-5, -15); if (!(u >= 12)) throw new Error('u=' + u); });
t('usdaZone boundaries', () => { eq(usdaZone(-28).label, '5a'); eq(usdaZone(-23.5).label, '6a'.replace('6a', '5b')); near(usdaZone(-17.7).value, 7.0, .05); });
t('viLabel NH / SH', () => { eq(viLabel(0, false), 'Jan 1'); eq(viLabel(110, false), 'Apr 21'); eq(viLabel(0, true), 'Jul 1'); });
t('doyToVi inverse of viToDate', () => { for (const s of [false, true]) for (const d of [10, 100, 250, 340]) { const vi = doyToVi(d, s); eq(viToDate(vi, s).doy, d, 'south=' + s); } });
t('ra symmetry: June high at 50N, Dec high at 50S', () => { if (!(ra(50, 172) > ra(50, 355))) throw new Error('N'); if (!(ra(-50, 355) > ra(-50, 172))) throw new Error('S'); });
t('Hargreaves ET0 rises with diurnal range', () => { if (!(et0Hargreaves(40, 180, 32, 14) > et0Hargreaves(40, 180, 26, 20))) throw new Error('order'); });
t('curveAt / offsetFor round trip', () => { const c = Array.from({ length: 27 }, (_, i) => i * 100); near(offsetFor(c, curveAt(c, 55)), 55, .01); eq(offsetFor(c, 1e9), Infinity); });
t('koppen: Cfb for London-like', () => eq(koppen([5, 5, 7, 9, 13, 16, 18, 18, 15, 11, 8, 5.5], [55, 40, 41, 44, 49, 45, 45, 50, 49, 69, 59, 55], false).code, 'Cfb'));
t('koppen: Af for equatorial', () => eq(koppen(Array(12).fill(27), Array(12).fill(200), false).code, 'Af'));
t('koppen: Dfb for continental', () => eq(koppen([-8, -6, 0, 7, 14, 18, 20, 19, 13, 7, 0, -6], [30, 25, 35, 60, 80, 90, 90, 85, 80, 60, 50, 35], false).code, 'Dfb'));
t('koppen: BWh desert', () => eq(koppen([14, 17, 21, 26, 32, 35, 36, 36, 33, 28, 21, 16], [5, 5, 5, 3, 1, 0, 0, 0, 0, 1, 3, 5], false).code, 'BWh'));

// ---------------------------------------------------------------- feature extraction
const temperate = computeFeatures(synth(51.2, 10.5, 7.5, 3.5));
t('temperate synthetic: has bloom in April-May', () => { const b = temperate.bloom.vi; if (!(b > 95 && b < 140)) throw new Error('bloom vi=' + b + ' ' + temperate.bloom.label); });
t('temperate synthetic: chill is plentiful', () => { if (!(temperate.chill.mean > 1200)) throw new Error('' + temperate.chill.mean); });
t('temperate synthetic: no hot days', () => near(temperate.heat.hot32, 0, 0.001));
t('temperate synthetic: Koppen oceanic/continental C or D', () => { if (!/^[CD]/.test(temperate.koppen.code)) throw new Error(temperate.koppen.code); });
t('cycles: 9 usable cycles from 10 years NH', () => eq(temperate.nCycles, 9));

const tropical = computeFeatures(synth(1.3, 27, 0.7, 4));
t('tropical synthetic: flagged tropical, chill ~0', () => { if (!tropical.flags.tropical) throw new Error('flag'); if (!(tropical.chill.mean < 5)) throw new Error('' + tropical.chill.mean); });

const arctic = computeFeatures(synth(70, -2, 11, 3));
t('arctic synthetic: no bloom', () => { if (!arctic.noBloom) throw new Error('bloom=' + (arctic.bloom && arctic.bloom.label)); });

const hot = computeFeatures(synth(33.4, 23, 11, 8.5));
t('hot synthetic: many days >= 32 C', () => { if (!(hot.heat.hot32 > 20)) throw new Error('' + hot.heat.hot32); });

const south = computeFeatures(synth(-41, 11, 6, 3.5));
t('southern hemisphere: bloom in Sep-Oct (virtual index shifted)', () => { const d = viToDate(south.bloom.vi, true); if (!(d.month === 8 || d.month === 9 || d.month === 10)) throw new Error(south.bloom.label); });
t('southern hemisphere: chill window is austral winter, similar to mirrored NH', () => { const nh = computeFeatures(synth(41, 11, 6, 3.5)); near(south.chill.mean, nh.chill.mean, nh.chill.mean * 0.08, 'chill'); });

t('compactFeatures drops per-year arrays, keeps numbers', () => { const c = compactFeatures(temperate); if (c.chill.per) throw new Error('per kept'); if (typeof c.chill.mean !== 'number') throw new Error('mean'); });

// ---------------------------------------------------------------- scoring
const ctx = makeContext(temperate);
const V = (o = {}) => ({
  id: 'x', name: 'Testa', uses: ['dessert'], taste: {}, tree: {},
  pollination: { flower_group: 3, self_fertile: 'no' },
  season: { harvest_doy: 268 }, climate: { chill_hours: 1000, hardiness_zone: 5, heat_tolerance: 3, colour_needs_cool_nights: false },
  health: { scab: 3, canker: 3, mildew: 3, fire_blight: 3, rust: 3, bitter_pit: 3 }, ...o,
});
t('home climate scores home variety well', () => { const s = scoreVariety(V(), temperate, ctx); if (!(s.score >= 70)) throw new Error('score ' + s.score); });
t('tropical site: every apple scores 0-5', () => { const s = scoreVariety(V(), tropical, ctx); if (!(s.score <= 5)) throw new Error('score ' + s.score); });
t('arctic site: not viable', () => { const s = scoreVariety(V(), arctic, ctx); if (s.score !== 0) throw new Error('score ' + s.score); });
t('low-chill variety does fine in warm winter; high-chill fails there', () => {
  const warm = computeFeatures(synth(33, 19.5, 5.5, 5)); // mild winters (~14 C mean)
  const lo = scoreVariety(V({ climate: { chill_hours: 300, hardiness_zone: 8, heat_tolerance: 4 } }), warm, ctx);
  const hi = scoreVariety(V({ climate: { chill_hours: 1400, hardiness_zone: 5, heat_tolerance: 3 } }), warm, ctx);
  if (!(lo.score > hi.score + 15)) throw new Error(`lo ${lo.score} hi ${hi.score}`);
});
t('hardiness: zone-3 variety beats zone-8 variety in a cold place', () => {
  const cold = computeFeatures(synth(45, 6.5, 17, 5));   // continental: ~ -17 C coldest nights, warm summer
  const hardy = scoreVariety(V({ season: { harvest_doy: 240 }, climate: { chill_hours: 800, hardiness_zone: 3, heat_tolerance: 3 } }), cold, ctx);
  const tender = scoreVariety(V({ season: { harvest_doy: 240 }, climate: { chill_hours: 800, hardiness_zone: 8, heat_tolerance: 3 } }), cold, ctx);
  if (!(hardy.score > tender.score + 30)) throw new Error(`hardy ${hardy.score} tender ${tender.score}`);
});
t('late variety scores worse than early one where summers are cool', () => {
  const cool = computeFeatures(synth(45, 5.5, 15, 4.5));   // short, cool growing season
  const early = scoreVariety(V({ season: { harvest_doy: 215 } }), cool, ctx);
  const late = scoreVariety(V({ season: { harvest_doy: 300 } }), cool, ctx);
  if (!(early.score > late.score)) throw new Error(`early ${early.score} late ${late.score}`);
});
t('susceptible variety is penalised more than resistant one under high scab pressure', () => {
  const wet = computeFeatures(synth(52, 10, 7, 3, { rain: 1 }));
  const a = scoreVariety(V({ health: { scab: 1, canker: 1, mildew: 1, fire_blight: 1, rust: 1 } }), wet, ctx);
  const b = scoreVariety(V({ health: { scab: 5, canker: 5, mildew: 5, fire_blight: 5, rust: 5 } }), wet, ctx);
  if (!(a.score > b.score)) throw new Error(`${a.score} vs ${b.score}`);
});
t('score has factors with text and tones', () => { const s = scoreVariety(V(), temperate, ctx); eq(s.factors.length, 6); if (!s.factors.every(f => f.text && f.tone)) throw new Error('missing'); });
t('null variety data does not crash', () => { const s = scoreVariety(V({ climate: {}, pollination: {}, season: {}, health: {} }), temperate, ctx); if (!isFinite(s.score)) throw new Error('NaN'); });
t('rankVarieties sorts descending', () => { const r = rankVarieties([V({ id: 'a', climate: { chill_hours: 3000, hardiness_zone: 5 } }), V({ id: 'b' })], temperate, ctx); if (r[0].s.score < r[1].s.score) throw new Error('order'); });
t('labelOf thresholds', () => { eq(labelOf(90), 'Excellent'); eq(labelOf(10), 'Not viable'); });
t('thermalNeed grows with later harvest', () => { if (!(thermalNeed(ctx, 300) > thermalNeed(ctx, 230))) throw new Error('monotone'); });
t('siteProfile returns entries for a normal site', () => { if (siteProfile(temperate).length < 5) throw new Error('short'); });
t('rootstockAdvice groups by size', () => {
  const rs = [{ id: 'm9', name: 'M.9', size_class: 'dwarf', hardiness_zone: 5, susceptibility: { fire_blight: 5 }, tolerance: {} }, { id: 'g41', name: 'G.41', size_class: 'dwarf', hardiness_zone: 4, susceptibility: { fire_blight: 1 }, tolerance: {} }, { id: 'm25', name: 'M.25', size_class: 'vigorous', hardiness_zone: 4, susceptibility: {}, tolerance: {} }];
  const warmWet = computeFeatures(synth(40, 14, 10, 6, { rain: 2 }));
  const g = rootstockAdvice(rs, warmWet);
  eq(g.length, 2);
  eq(g[0].items[0].r.id, 'g41', 'fire-blight resistant dwarf should win when blight pressure is high');
});

// ---------------------------------------------------------------- data integrity (needs assets/data.json)
try {
  const d = await (await fetch('../assets/data.json')).json();
  const ids = new Set();
  t('data: no duplicate variety ids', () => { for (const v of d.varieties) { if (ids.has(v.id)) throw new Error(v.id); ids.add(v.id); } });
  t('data: every variety has numeric harvest_doy or is flagged', () => { const bad = d.varieties.filter(v => v.season.harvest && v.season.harvest_doy == null); if (bad.length) throw new Error(bad.map(v => v.id).join()); });
  t('data: taste tags valid', () => { const ok = new Set(d.tasteTags); for (const v of d.varieties) for (const x of v.taste.tags || []) if (!ok.has(x)) throw new Error(v.id + ':' + x); });
  t('data: Cox is group 3 diploid dessert', () => { const c = d.varieties.find(v => v.id === 'coxs-orange-pippin'); eq(c.pollination.flower_group, 3); eq(c.tree.ploidy, 'diploid'); });
  t('data: Bramley is a triploid', () => eq(d.varieties.find(v => v.id === 'bramleys-seedling').tree.ploidy, 'triploid'));
  t('data: rootstock ids unique', () => { const s = new Set(); for (const r of d.rootstocks) { if (s.has(r.id)) throw new Error(r.id); s.add(r.id); } });
  t('data: M.9 more dwarfing than MM.111', () => { const m9 = d.rootstocks.find(r => r.id === 'm9'), mm = d.rootstocks.find(r => r.id === 'mm111'); if (!(m9.vigor < mm.vigor)) throw new Error('vigor'); });
  t('data: every region has coordinates and notes', () => { for (const r of d.regions) { if (typeof r.lat !== 'number' || !r.summary) throw new Error(r.id); } });
  const pres = await (await fetch('../assets/climate-presets.json')).json();
  t('presets: Kent exists (reference climate)', () => { if (!pres.kent) throw new Error('missing kent'); });
  t('presets: every baked place has chill, zone, bloom, curve', () => { for (const [k, F] of Object.entries(pres)) { if (F.error) continue; if (!F.noBloom && (!F.bloom || !F.season.gddCurve || F.season.gddCurve.length !== 27)) throw new Error(k); } });
  if (pres.kent) {
    const c2 = makeContext(pres.kent);
    const cox = d.varieties.find(v => v.id === 'coxs-orange-pippin');
    t('Cox scores >= 80 in Kent', () => { const s = scoreVariety(cox, pres.kent, c2); if (!(s.score >= 80)) throw new Error('' + s.score); });
    if (pres.singapore) t('Cox scores < 10 in Singapore', () => { const s = scoreVariety(cox, pres.singapore, c2); if (!(s.score < 10)) throw new Error('' + s.score); });
    if (pres.anchorage) t('Cox scores < 40 in Anchorage', () => { const s = scoreVariety(cox, pres.anchorage, c2); if (!(s.score < 40)) throw new Error('' + s.score); });
    const dg = d.varieties.find(v => v.id === 'dorsett-golden');
    if (dg && pres.singapore) t('Dorsett Golden (low chill) outscores Cox in a warm-winter place', () => { const warm = pres['los-angeles'] || pres.elgin || pres['hawkes-bay']; if (!warm) return true; const a = scoreVariety(dg, warm, c2).score, b = scoreVariety(cox, warm, c2).score; if (!(a >= b)) throw new Error(`dg ${a} cox ${b}`); });
  }
} catch (e) { fail++; out.insertAdjacentHTML('beforeend', `<div class="fail">FAIL data load: ${e.message}</div>`); }

document.getElementById('sum').innerHTML = fail ? `<span class="fail">${fail} FAILED</span>, ${pass} passed` : `<span class="pass">ALL ${pass} PASS</span>`;
window.__testResult = { pass, fail };
