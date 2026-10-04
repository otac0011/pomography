// "Grow it where you are" on a variety page: pick a place in a map pop-up, then see whether the apple will grow there
// and how its ripening, sugar, acidity, aroma, colour and keeping change compared with its home climate.
import { S, esc, fmtInt } from '../data.js';
import { scoreVariety } from '../score/score.js';
import { climateChanges } from '../score/change.js';
import { analysePlace, searchPlaces, getPlace, setPlace } from '../climate/place.js';
import { scoreRing } from './widgets.js';

const LIMIT = { chill: 'winter chill', hardiness: 'winter cold', frost: 'blossom frost', season: 'season length', heat: 'summer heat', water: 'water supply', disease: 'disease' };
const ARROW = { up: ['▲', 'more / later'], down: ['▼', 'less / earlier'], same: ['=', 'about the same'] };
let token = 0;

/** The baseline the changes are measured from: where the variety's reputation was made. */
const GENERIC = new Set(['valley', 'county', 'coastal', 'basin', 'central', 'north', 'south', 'east', 'west', 'northern', 'southern', 'upper', 'lower', 'and', 'the', 'region', 'district']);
export function homeFor(v) {
  const P = id => { const F = S.presets[id] || (S.allPresets && S.allPresets[id]); return F && !F.error && !F.noBloom ? F : null; };
  const oc = v.origin && v.origin.country, place = ((v.origin && v.origin.place) || '').toLowerCase();
  const named = r => r.country === oc && (r.name + ' ' + r.id.replace(/-/g, ' ')).toLowerCase().match(/[a-zà-ÿ']{4,}/g)?.some(w => !GENERIC.has(w) && new RegExp('\\b' + w + '\\b').test(place));
  // origin named in the place (Excelsior, Minnesota -> Twin Cities (Minnesota)) > same country > grown there
  const cands = S.data.regions.filter(r => P(r.id)).map(r => ({ r, k: (named(r) ? 4 : 0) + (r.country === oc ? 2 : 0) + ((r.variety_ids || []).includes(v.id) ? 1 : 0) }))
    .filter(c => c.k >= 2);
  if (cands.length && !(oc === 'GB' && !cands.some(c => c.k >= 4))) {
    const top = Math.max(...cands.map(c => c.k));
    const best = cands.filter(c => c.k === top).map(c => ({ r: c.r, s: scoreVariety(v, P(c.r.id), S.ctx).score })).sort((a, b) => b.s - a.s)[0];
    return { F: P(best.r.id), name: best.r.name, why: top >= 4 ? 'the reference place nearest its origin' : top >= 3 ? 'a reference place in its home country where it is grown' : 'the reference place in its home country that suits it best' };
  }
  const k = S.regionById.get('kent');
  return { F: S.ctx.ref, name: k ? k.name : 'Kent', why: oc === 'GB' ? 'the home of the National Fruit Collection, where most British taste notes are written' : 'where the National Fruit Collection grows it and most of our taste notes were written; no reference place near its origin has weather data yet' };
}

export function renderGrowHere(el, v) {
  if (!S.ctx) { el.innerHTML = '<p class="small muted">Climate data is not available, so places cannot be compared.</p>'; return; }
  const p = getPlace();
  if (!p) { prompt(el, v); return; }
  analyse(el, v, p);
}

function prompt(el, v, msg = '') {
  el.innerHTML = `${msg}<p>Pick the place where you would grow ${esc(v.name)} to see whether it will thrive there and how the climate changes it: when it ripens, whether it gets enough winter chill, and whether it will be sweeter, sharper, less aromatic, paler or softer than in its home orchards.</p>
    <p class="row"><button class="btn primary" data-pick>Choose a place on the map</button> <button class="btn" data-geo>Use my location</button></p>`;
  wire(el, v);
}

function wire(el, v) {
  el.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => openPicker(pl => { setPlace(pl); analyse(el, v, pl); }));
  el.querySelectorAll('[data-geo]').forEach(b => b.onclick = () => locate(b, pl => { setPlace(pl); analyse(el, v, pl); }));
  el.querySelectorAll('[data-forget]').forEach(b => b.onclick = () => { setPlace(null); prompt(el, v); });
}

function locate(btn, done) {
  if (!navigator.geolocation) { btn.textContent = 'Location not available'; return; }
  const old = btn.textContent; btn.textContent = 'Locating…'; btn.disabled = true;
  navigator.geolocation.getCurrentPosition(
    pos => { btn.textContent = old; btn.disabled = false; done({ lat: pos.coords.latitude, lon: pos.coords.longitude, name: null }); },
    () => { btn.textContent = 'Location blocked - use the map'; btn.disabled = false; },
    { timeout: 10000, maximumAge: 3600e3 });
}

async function analyse(el, v, p) {
  const my = ++token;
  const step = m => { if (my === token && el.isConnected) el.innerHTML = `<p><span class="spinner"></span>&ensp;${esc(m)}</p>`; };
  let a;
  try { a = await analysePlace(p.lat, p.lon, { name: p.name, onStep: step }); }
  catch (e) { if (e.name === 'AbortError') return; a = { failed: true, err: e }; }
  if (my !== token || !el.isConnected) return;
  if (a.ocean) { prompt(el, v, `<div class="note warn">That spot is in ${esc(a.water)}. Apples need land: choose a spot ashore.</div>`); return; }
  if (a.failed) {
    el.innerHTML = `<div class="note bad"><b>No climate data for this spot.</b> ${esc(a.err ? a.err.message : '')}</div><p class="row"><button class="btn" data-retry>Try again</button> <button class="btn" data-pick>Choose another place</button></p>`;
    el.querySelector('[data-retry]').onclick = () => analyse(el, v, p); wire(el, v); return;
  }
  if (!p.name && a.name && a.name !== 'Selected spot') setPlace({ lat: p.lat, lon: p.lon, name: a.name });
  el.innerHTML = panel(v, a);
  wire(el, v);
}

function banner(a) {
  const F = a.F;
  if (a.source === 'extrapolated') return `<div class="prov prov-extrap"><b>Extrapolated.</b> Live weather could not be loaded${a.err ? ' (' + esc(a.err.message) + ')' : ''}, so the climate is blended from ${F.extrapolated.from.map(f => esc(f.name) + ' ' + f.km + ' km').join('; ')}.</div>`;
  return `<div class="prov prov-measured">Ten years of daily weather (${esc(F.period || '2015–2024')}) ${a.source === 'preset' ? 'for this reference place' : 'for the 25 km grid cell ' + (a.cellKm != null && a.cellKm >= 3 ? 'centred ' + a.cellKm + ' km from this spot' : 'at this spot')}, run through the same models as the world map.</div>`;
}

function panel(v, a) {
  const F = a.F, s = scoreVariety(v, F, S.ctx);
  const home = homeFor(v);
  const ch = climateChanges(v, F, S.ctx, home.F, home.name);
  const at = `${a.lat.toFixed(2)}°, ${a.lon.toFixed(2)}°${F.elev != null ? ' · ' + fmtInt(F.elev) + ' m' : ''}${F.koppen ? ' · ' + esc(F.koppen.name) : ''}`;
  const head = `<div class="gh-head"><div><h3>${esc(a.name)}</h3><div class="small muted">${at}</div></div>
    <div class="row"><button class="btn sm" data-pick>Change place</button><button class="btn sm" data-geo>My location</button></div></div>`;
  if (F.error || F.noBloom) return head + banner(a) + `<div class="note bad">${F.noBloom ? 'It never gets warm enough here for apple trees to flower.' : 'Not enough weather data for this point.'}</div>`;
  const chill = F.chill ? `${fmtInt(F.chill.mean)} chill units${F.chill.hours72 != null ? ' (about ' + fmtInt(F.chill.hours72) + ' hours below 7.2 °C)' : ''}` : '';
  return head + banner(a) + `
    <div class="gh-score">${scoreRing(s.score)}<div><b>${esc(s.label)}</b> for growing ${esc(v.name)} here${s.limiting ? ', limited by <b>' + esc(LIMIT[s.limiting]) + '</b>' : ''}.
      <div class="small muted">Winter here: ${chill}; ${esc(v.name)} needs ~${v.climate.chill_hours != null ? fmtInt(v.climate.chill_hours) : '900 (assumed)'}.</div></div></div>
    <h4>How it would change here</h4>
    <p class="small muted">Compared with ${esc(home.name)} (${esc(home.why)}).</p>
    <div class="changes">${ch.items.map(i => `<div class="chg ${i.tone}"><span class="arr" ${i.dir ? `title="${ARROW[i.dir][1]}"` : ''}>${i.dir ? ARROW[i.dir][0] : '•'}</span><div><b>${esc(i.title)}</b> <span>${esc(i.text)}</span></div></div>`).join('')}</div>
    <h4>Will it grow here?</h4>
    <div class="siteprof">${s.factors.map(f => `<div class="sp ${f.tone}"><i></i><div><b>${esc(f.title)}${f.critical ? ' <span class="tiny muted">(critical)</span>' : ''}</b><span>${esc(f.text)}</span></div></div>`).join('')}</div>
    <p class="tiny muted" style="margin-top:12px">These are tendencies from fruit research applied to this place's climate (see <a href="#/guide">the Guide</a>, "How an apple changes in another climate"), not measurements of this apple here. Crop load, pruning, watering and picking date change the taste as much as the weather does. Your place is remembered in this browser only.</p>
    <p class="small"><a href="#/map/@${a.lat.toFixed(3)},${a.lon.toFixed(3)}?f=${esc(v.id)}">Open this spot on the world map &rarr;</a> &middot; <button class="linklike" data-forget>Forget this place</button></p>`;
}

// ---------------------------------------------------------------- the map pop-up
export function openPicker(onPick) {
  const start = getPlace();
  const dlg = document.createElement('dialog');
  dlg.className = 'pickdlg';
  dlg.setAttribute('aria-label', 'Choose a place');
  dlg.innerHTML = `<div class="pick-head"><h3>Choose a place</h3><button class="btn sm" data-x aria-label="Close">&times;</button></div>
    <div class="pick-tools"><input type="search" placeholder="Search for a town or region…" aria-label="Search for a place" autocomplete="off"><button class="btn sm" data-geo>Use my location</button></div>
    <div class="pick-res" role="listbox" aria-label="Search results"></div>
    <div class="pick-map" aria-label="Map: click anywhere on land to choose that spot"></div>
    <p class="tiny muted">Click anywhere on land, or search above.</p>`;
  document.body.appendChild(dlg);
  let map = null;
  const close = () => { if (map) map.remove(); dlg.close(); dlg.remove(); };
  const pick = p => { close(); onPick(p); };
  dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });
  dlg.addEventListener('click', e => {             // a click on the backdrop (outside the box) closes it; one on its padding does not
    if (e.target !== dlg) return;
    const b = dlg.getBoundingClientRect();
    if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) close();
  });
  dlg.querySelector('[data-x]').onclick = close;
  dlg.querySelector('[data-geo]').onclick = e => locate(e.currentTarget, pick);
  const q = dlg.querySelector('input'), res = dlg.querySelector('.pick-res');
  let ac = null, timer = null;
  q.oninput = () => {
    clearTimeout(timer);
    const s = q.value.trim();
    if (s.length < 2) { res.innerHTML = ''; return; }
    timer = setTimeout(async () => {
      if (ac) ac.abort(); ac = new AbortController();
      try {
        const hits = await searchPlaces(s, ac.signal);
        res.innerHTML = hits.length ? hits.map((h, i) => `<button class="pick-hit" role="option" data-i="${i}">${esc(h.label)}</button>`).join('') : '<p class="small muted">No place found.</p>';
        res.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const h = hits[+b.dataset.i]; pick({ lat: h.lat, lon: h.lon, name: h.label }); });
      } catch (e) { if (e.name !== 'AbortError') res.innerHTML = `<p class="small muted">${esc(e.message)}</p>`; }
    }, 300);
  };
  q.onkeydown = e => { if (e.key === 'Enter') { const b = res.querySelector('[data-i]'); if (b) b.click(); } };
  dlg.showModal();
  if (typeof L === 'undefined') { dlg.querySelector('.pick-map').innerHTML = '<p class="small muted">The map could not load; use the search box.</p>'; return; }
  const div = dlg.querySelector('.pick-map');
  if (matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.dataset.theme !== 'light') div.classList.add('dark-tiles');
  map = L.map(div, { worldCopyJump: true, minZoom: 2 }).setView(start ? [start.lat, start.lon] : [47, 8], start ? 6 : 3);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 12 }).addTo(map);
  if (start) L.circleMarker([start.lat, start.lon], { radius: 9, weight: 3, color: '#a8312b', fillOpacity: .15, interactive: false }).addTo(map);
  map.on('click', e => {
    L.circleMarker(e.latlng, { radius: 11, weight: 3, color: '#a8312b', fillColor: '#a8312b', fillOpacity: .2, interactive: false }).addTo(map);
    setTimeout(() => pick({ lat: e.latlng.lat, lon: ((e.latlng.lng + 540) % 360) - 180, name: null }), 180);
  });
  setTimeout(() => map && map.invalidateSize(), 50);
  q.focus();
}
