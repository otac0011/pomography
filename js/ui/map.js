// World map: pins for the reference places, click anywhere for live climate, scores for the user's favourites.
import { S, esc, countryName, getFavs, isFav, toggleFav, setFavs, onFavs, toast, seasonName, fmtInt } from '../data.js';
import { appleSVG, scoreRing, scorePair, diseaseTable, bar, toneOf, chips } from './widgets.js';
import { scoreVariety, rankVarieties, siteProfile, rootstockAdvice, labelOf, pressureWord, sitePressures } from '../score/score.js';
import { MONTH_NAMES } from '../climate/features.js';
import { analysePlace } from '../climate/place.js';

let map = null, pinLayer = null, selMarker = null, pins = new Map(), token = 0, sel = null, tab = 'apples', offFavs = null, friendly = null;
const SETS = [
  ['English classics', ['coxs-orange-pippin', 'bramleys-seedling', 'egremont-russet', 'blenheim-orange', 'ashmeads-kernel']],
  ['Cider orchard', ['kingston-black', 'dabinett', 'yarlington-mill', 'tremletts-bitter']],
  ['Crisp & modern', ['honeycrisp', 'gala', 'fuji', 'braeburn']],
  ['Warm-climate', ['anna', 'dorsett-golden', 'ein-shemer', 'granny-smith']],
  ['Cold-hardy', ['haralson', 'wealthy', 'duchess-of-oldenburg', 'zestar']],
];

const colour = s => s == null ? '#9a9486' : s >= 70 ? '#3e8a3a' : s >= 55 ? '#9db02e' : s >= 35 ? '#e0961c' : '#c0392b';

function sampleVarieties() {
  const all = [...S.data.varieties].sort((a, b) => a.id < b.id ? -1 : 1);
  return all.filter((_, i) => i % 6 === 0);
}
function friendliness(id) {
  if (!friendly) {
    friendly = {};
    const sample = sampleVarieties();
    for (const r of S.data.regions) {
      const F = S.presets[r.id]; if (!F || F.error) continue;
      friendly[r.id] = Math.round(sample.reduce((a, v) => a + scoreVariety(v, F, S.ctx).score, 0) / sample.length);
    }
  }
  return friendly[id];
}
function pinScore(r) {
  const F = S.presets[r.id]; if (!F || F.error || !S.ctx) return null;
  const f = getFavs();
  if (!f.length) return friendliness(r.id);
  const sc = f.map(id => scoreVariety(S.byId.get(id), F, S.ctx).score);
  return Math.round(sc.reduce((a, b) => a + b, 0) / sc.length);
}

export function renderMap(app, regionId, params) {
  if (!S.ctx) { app.innerHTML = '<div class="empty"><h2>Climate data not built yet</h2><p>assets/climate-presets.json is missing, so the map cannot score places.</p></div>'; return; }
  cleanup();
  // ?f=a,b,c adds varieties to the favourites (used by the "See it on the map" buttons)
  const f = params.get('f');
  if (f) {
    const ids = f.split(',').filter(id => S.byId.has(id) && !isFav(id));
    if (ids.length) { setFavs([...getFavs(), ...ids]); toast('Added ' + ids.map(i => S.byId.get(i).name).join(', ') + ' to your favourites'); }
  }
  app.innerHTML = `
  <div class="mapwrap">
    <aside class="side card pad" id="mapside"></aside>
    <div class="stage" id="stage"><div id="map" role="application" aria-label="World map. Click anywhere to see how well your favourite apples would grow there."></div><div id="placepanel" hidden></div></div>
  </div>`;
  drawSide();
  map = L.map('map', { worldCopyJump: true, minZoom: 2, zoomControl: true }).setView([47, 8], 3);
  const dark = matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.dataset.theme !== 'light';
  if (dark) document.getElementById('map').classList.add('dark-tiles');
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 12 });
  const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { attribution: 'Map data &copy; OpenStreetMap contributors, SRTM | Style &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)', subdomains: 'abc', maxZoom: 12 });
  osm.addTo(map);
  pinLayer = L.layerGroup().addTo(map);
  L.control.layers({ 'Street map': osm, 'Terrain': topo }, { 'Reference places (pre-computed dots)': pinLayer }, { position: 'topright', collapsed: true }).addTo(map);
  drawPins();
  const hint = L.control({ position: 'topleft' });
  hint.onAdd = () => { const d = L.DomUtil.create('div', 'map-hint'); d.id = 'maphint'; d.innerHTML = '<b>Click anywhere</b> on the map &mdash; any spot on land gets its own climate analysis. The small dots are just pre-computed reference places.'; return d; };
  hint.addTo(map);
  const legend = L.control({ position: 'bottomleft' });
  legend.onAdd = () => { const d = L.DomUtil.create('div', 'legend-box'); d.id = 'legend'; return d; };
  legend.addTo(map);
  updateLegend();
  map.on('click', e => { const h = document.getElementById('maphint'); if (h) h.classList.add('quiet'); selectPoint(e.latlng.lat, e.latlng.lng); });
  offFavs = onFavs(() => {
    drawSide(); recolour(); updateLegend();
    if (!sel) return;
    // on "Best here" only the hearts change: redrawing would lose the scroll position in a long list
    if (tab === 'best') document.querySelectorAll('[data-pfav]').forEach(b => { const on = isFav(b.dataset.pfav); b.classList.toggle('on', on); b.textContent = on ? '♥' : '♡'; b.title = (on ? 'Remove from' : 'Add to') + ' favourites'; });
    else renderPanel();
  });
  setTimeout(() => map && map.invalidateSize(), 60);
  if (regionId) {
    if (regionId.startsWith('@')) { const [la, lo] = regionId.slice(1).split(',').map(Number); if (isFinite(la) && isFinite(lo)) { map.setView([la, lo], 6); selectPoint(la, lo); } }
    else { const r = S.regionById.get(regionId); if (r) { map.setView([r.lat, r.lon], 5); selectRegion(r.id); } }
  }
}

export function cleanup() {
  token++; sel = null; if (offFavs) offFavs(); offFavs = null;
  if (map) { map.remove(); map = null; }
  pins.clear(); selMarker = null; tab = 'apples';
}

function drawPins() {
  pins.clear(); pinLayer.clearLayers();
  for (const r of S.data.regions) {
    const baked = !!S.presets[r.id];
    const m = L.circleMarker([r.lat, r.lon], baked ? { radius: 5, weight: 1.5, color: '#fff', fillColor: colour(pinScore(r)), fillOpacity: .9 }
      : { radius: 4, weight: 1.5, color: '#9a9486', fillColor: '#9a9486', fillOpacity: 0, dashArray: '2 2' });
    m.on('click', e => { L.DomEvent.stopPropagation(e); selectRegion(r.id); });
    pinLayer.addLayer(m); pins.set(r.id, m);
  }
  recolour();
}
function recolour() {
  const favs = getFavs();
  for (const r of S.data.regions) {
    const m = pins.get(r.id); if (!m) continue;
    if (!S.presets[r.id]) { m.bindTooltip(`<b>${esc(r.name)}</b><br>Reference place — click for a live analysis`, { direction: 'top', offset: [0, -6] }); continue; }
    const s = pinScore(r);
    m.setStyle({ fillColor: colour(s) });
    m.bindTooltip(`<b>${esc(r.name)}</b><br>${favs.length ? 'Your favourites: ' : 'Apple-friendliness: '}${s ?? '?'}/100`, { direction: 'top', offset: [0, -6] });
  }
}
function updateLegend() {
  const d = document.getElementById('legend'); if (!d) return;
  d.innerHTML = `<b>${getFavs().length ? 'Mean climate score for your favourites' : 'How apple-friendly the climate is (broad sample)'}</b><br>` +
    [['#3e8a3a', '70+ good'], ['#9db02e', '55–69 workable'], ['#e0961c', '35–54 marginal'], ['#c0392b', 'under 35']].map(([c, l]) => `<span class="sw" style="background:${c}"></span>${l}`).join('&ensp;') +
    `<br><span class="muted">Solid dots: pre-computed places. Dashed dots: reference places analysed live when clicked. Click anywhere else too.</span>`;
}

// ---------------------------------------------------------------- sidebar
function drawSide() {
  const el = document.getElementById('mapside'); if (!el) return;
  const favs = getFavs();
  el.innerHTML = `
    <h2 style="font-size:1.25rem">Your apples</h2>
    ${favs.length ? favs.map(id => { const v = S.byId.get(id); return `<div class="favrow">${appleSVG(v, 28)}<a href="#/v/${esc(id)}">${esc(v.name)}</a><button data-rm="${esc(id)}" aria-label="Remove ${esc(v.name)}" title="Remove">&times;</button></div>`; }).join('') :
      `<p class="small muted">Pick a few varieties and every place you click will be scored for them. Start with a set, or search below.</p>`}
    <div style="margin:10px 0 6px"><input type="search" id="addq" placeholder="Add a variety&hellip;" autocomplete="off" aria-label="Add a variety"></div>
    <div id="addres"></div>
    <h4 style="margin:14px 0 6px;font:600 .78rem var(--sans);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)">Quick sets</h4>
    <div>${SETS.map(([n, ids], i) => ids.filter(x => S.byId.has(x)).length >= 2 ? `<button class="chip btnlike" data-set="${i}">${esc(n)}</button>` : '').join('')}</div>
    ${favs.length ? `<p style="margin-top:12px"><button class="btn sm" id="clearfav">Clear all</button> <a class="btn sm" href="#/favourites">Compare</a></p>` : ''}
    <hr style="border:0;border-top:1px solid var(--line);margin:14px 0">
    <p class="small muted"><b>How to use:</b> click any dot or any spot on the map. Each favourite gets two scores out of 100, with the reasons: <b>climate</b> (winter chill, winter cold, spring frost at blossom, whether the season is long enough to ripen it, summer heat, water) and <b>disease</b> (local scab, canker, mildew, fire blight and rust pressure against how susceptible the apple is). The dots show climate.</p>
    <p class="small muted">Try Norfolk, Paris, southern Michigan, Tasmania&hellip; or somewhere surprising.</p>`;
  el.onclick = e => {
    const rm = e.target.closest('[data-rm]'); if (rm) { toggleFav(rm.dataset.rm); return; }
    const st = e.target.closest('[data-set]'); if (st) { const ids = SETS[+st.dataset.set][1].filter(x => S.byId.has(x)); setFavs(ids); return; }
    if (e.target.id === 'clearfav') { setFavs([]); return; }
    const add = e.target.closest('[data-add]'); if (add) { toggleFav(add.dataset.add); document.getElementById('addq').value = ''; document.getElementById('addres').innerHTML = ''; }
  };
  const q = document.getElementById('addq');
  q.oninput = () => {
    const s = q.value.trim().toLowerCase(); const res = document.getElementById('addres');
    if (s.length < 2) { res.innerHTML = ''; return; }
    const m = S.data.varieties.filter(v => v._search.includes(s) && !isFav(v.id)).slice(0, 7);
    res.innerHTML = m.map(v => `<div class="favrow"><button class="btn sm" data-add="${esc(v.id)}">+ Add</button><span>${esc(v.name)}</span></div>`).join('') || '<p class="small muted">No match.</p>';
  };
}

// ---------------------------------------------------------------- selection
function setHash(id) { try { history.replaceState(null, '', '#/map/' + id); } catch (e) { /* ignore */ } }

function showSel(lat, lon) {
  if (selMarker) map.removeLayer(selMarker);
  selMarker = L.circleMarker([lat, lon], { radius: 13, weight: 3, color: '#a8312b', fillColor: '#a8312b', fillOpacity: .15, interactive: false }).addTo(map);
  document.getElementById('stage').classList.add('with-panel');
  const p = document.getElementById('placepanel'); p.hidden = false;
  setTimeout(() => map && map.invalidateSize(), 80);
}
function panelLoading(msg) {
  const p = document.getElementById('placepanel'); p.hidden = false;
  p.innerHTML = `<div class="ppad"><p><span class="spinner"></span>&ensp;${esc(msg)}</p></div>`;
}

export async function selectRegion(id) {
  const r = S.regionById.get(id); if (!r) return;
  if (!S.presets[id]) return selectPoint(r.lat, r.lon, r);   // not pre-computed yet: analyse live, but keep the place's notes
  ++token;
  showSel(r.lat, r.lon); setHash(id);
  sel = { lat: r.lat, lon: r.lon, name: r.name, region: r, F: S.presets[id], source: 'preset', country: r.country };
  renderPanel();
}

export async function selectPoint(lat, lon, place) {
  const my = ++token;
  lon = ((lon + 540) % 360) - 180;
  showSel(lat, lon); setHash('@' + lat.toFixed(3) + ',' + lon.toFixed(3));
  let a;
  try { a = await analysePlace(lat, lon, { place, onStep: m => { if (my === token) panelLoading(m); } }); }
  catch (e) { if (e.name === 'AbortError') return; throw e; }
  if (my !== token) return;
  if (a.ocean) {
    document.getElementById('placepanel').innerHTML = `<div class="ppad"><button class="btn sm" data-close>&times; Close</button><h3 style="margin-top:12px">${esc(a.water)}</h3><p class="muted">That looks like open water. Apples need land &mdash; click somewhere ashore.</p></div>`;
    wireClose(); return;
  }
  if (a.failed) {
    document.getElementById('placepanel').innerHTML = `<div class="ppad"><button class="btn sm" data-close>&times; Close</button><div class="note bad"><b>No climate data for this spot.</b> ${esc(a.err ? a.err.message : '')} It is also more than 1,500 km from every pre-computed reference place, so nothing could be extrapolated. <button class="btn sm" data-retry>Try again</button></div></div>`;
    wireClose(); const rb = document.querySelector('#placepanel [data-retry]'); if (rb) rb.onclick = () => selectPoint(lat, lon); return;
  }
  sel = a;
  if (tab === 'local' && !sel.region && !sel.nearest) tab = 'apples';
  renderPanel();
}

function wireClose() {
  const p = document.getElementById('placepanel');
  p.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { token++; sel = null; p.hidden = true; document.getElementById('stage').classList.remove('with-panel'); if (selMarker) { map.removeLayer(selMarker); selMarker = null; } setTimeout(() => map && map.invalidateSize(), 80); try { history.replaceState(null, '', '#/map'); } catch (e) { /* */ } });
}

// ---------------------------------------------------------------- panel
const TABS = [['apples', 'Your apples'], ['best', 'Best here'], ['climate', 'Climate'], ['regional', 'Regional'], ['rootstocks', 'Rootstocks'], ['local', 'Local notes']];

function sourceBanner() {
  const F = sel.F;
  if (sel.source === 'preset') return `<div class="prov prov-measured"><b>Measured &amp; modelled.</b> Reference place with ten years of real weather (${esc(F.period || '2015–2024')}).</div>`;
  if (sel.source === 'live' || sel.source === 'cache') {
    const cell = sel.cellKm != null ? ` The weather comes from the 25 km grid cell centred ${sel.cellKm < 3 ? 'on this spot' : sel.cellKm + ' km from your click'}.` : '';
    return `<div class="prov prov-measured"><b>Measured &amp; modelled for this exact spot.</b> Ten years of daily weather (${esc(F.period || '2015–2024')}${sel.source === 'cache' ? ', cached' : ''}) fed through the apple models.${cell}</div>`;
  }
  const x = F.extrapolated;
  return `<div class="prov prov-extrap"><b>Extrapolated, not measured here.</b> Live weather could not be loaded${sel.err ? ' (' + esc(sel.err.message) + ')' : ''}, so these numbers are blended from the nearest reference places: ${x.from.map(f => esc(f.name) + ' ' + f.km + ' km').join('; ')}. Terrain, elevation and local frost pockets are not captured. <button class="btn sm" data-retry>Try live data again</button></div>`;
}

function renderPanel() {
  if (!sel) return;
  const p = document.getElementById('placepanel'); if (!p) return;
  const F = sel.F;
  const place = sel.region && sel.source === 'nearest' ? 'Near ' + sel.region.name : sel.name;
  const tabs = TABS.filter(([k]) => k !== 'local' || sel.region || sel.nearest);
  p.innerHTML = `
    <div class="ppad" style="padding-bottom:6px">
      <div class="row" style="align-items:flex-start"><div style="flex:1"><h3 style="margin:0">${esc(place)}</h3>
      <div class="small muted">${sel.lat.toFixed(2)}&deg;, ${sel.lon.toFixed(2)}&deg;${F.elev != null ? ' &middot; ' + fmtInt(F.elev) + ' m' : ''}${F.koppen ? ' &middot; ' + esc(F.koppen.name) + ' (' + esc(F.koppen.code) + ')' : ''}</div></div><button class="btn sm" data-close aria-label="Close panel">&times;</button></div>
      ${sourceBanner()}
    </div>
    <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
    <div class="ppad" id="tabbody"></div>`;
  wireClose();
  const rb = p.querySelector('[data-retry]'); if (rb) rb.onclick = () => selectPoint(sel.lat, sel.lon);
  p.querySelector('.tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; renderPanel(); } };
  const body = p.querySelector('#tabbody');
  if (F.error) { body.innerHTML = '<div class="note bad">Not enough weather data for this point.</div>'; return; }
  if (!tabs.some(([k]) => k === tab)) tab = 'apples';
  ({ apples: tApples, best: tBest, climate: tClimate, regional: tRegional, rootstocks: tRoot, local: tLocal })[tab](body);
}

function factorHTML(f) {
  return `<div class="factor"><div class="ft"><span class="dot ${f.tone}"></span>${esc(f.title)}${f.critical ? ' <span class="tiny muted">(critical)</span>' : ''}<div class="bar ${f.tone === 'good' ? 'leaf' : ''}"><i style="width:${Math.round(f.f * 100)}%;background:var(--${f.tone})"></i></div></div><div class="fx">${esc(f.text)}</div></div>`;
}
function scoreRow(v, s, extra = '') {
  const first = s.factors && s.factors.length;
  const LIM = { chill: 'winter chill', hardiness: 'winter cold', frost: 'blossom frost', season: 'season length', heat: 'summer heat', water: 'water supply' };
  return `<div class="scorerow" data-open="${esc(v.id)}" tabindex="0" role="button" aria-expanded="false">${scorePair(s)}<div style="flex:1;min-width:0"><h4>${esc(v.name)}</h4><div class="small muted">Climate: ${esc(s.label)}${s.limiting ? ', limited by <b>' + esc(LIM[s.limiting]) + '</b>' : ''}${s.disease ? ' &middot; ' + esc(s.disease.label) : ''}${s.harvest ? ' &middot; ripens ~' + esc(s.harvest) : ''}</div></div>${extra}</div>
  ${first ? `<div class="factors"><h5>Climate</h5>${s.factors.map(factorHTML).join('')}${s.flavour ? `<div class="factor"><div class="ft"><span class="dot ${s.flavour.tone}"></span>Flavour here <span class="tiny muted">(not scored)</span></div><div class="fx">${esc(s.flavour.text)}</div></div>` : ''}${s.disease ? `<h5>Disease</h5>${diseaseTable(s.disease)}` : ''}<p class="small"><a href="#/v/${esc(v.id)}">Full profile of ${esc(v.name)} &rarr;</a></p></div>` : ''}`;
}
function wireRows(body) {
  body.querySelectorAll('.scorerow').forEach(r => {
    const toggle = () => { const o = r.classList.toggle('open'); r.setAttribute('aria-expanded', o); };
    r.onclick = e => { if (!e.target.closest('button,a')) toggle(); };
    r.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } };
  });
  body.querySelectorAll('[data-pfav]').forEach(b => b.onclick = e => { e.stopPropagation(); toggleFav(b.dataset.pfav); });
}

function tApples(body) {
  const favs = getFavs().map(id => S.byId.get(id));
  if (!favs.length) { body.innerHTML = `<p>You haven't picked any favourites yet. Choose a quick set on the left, or see what grows best here:</p><p><button class="btn primary" data-goto="best">Show the best varieties for this spot</button></p>`; body.querySelector('[data-goto]').onclick = () => { tab = 'best'; renderPanel(); }; return; }
  const rows = favs.map(v => ({ v, s: scoreVariety(v, sel.F, S.ctx) })).sort((a, b) => b.s.both - a.s.both || b.s.score - a.s.score);
  const avg = f => Math.round(rows.reduce((a, r) => a + f(r.s), 0) / rows.length);
  const mean = avg(s => s.score), dmean = avg(s => s.disease ? s.disease.score : 0);
  const bad = rows.filter(r => r.s.score < 35), sick = rows.filter(r => r.s.score >= 35 && r.s.disease && r.s.disease.score < 40);
  body.innerHTML = `<p class="small muted" style="margin-bottom:4px">Average for your ${rows.length} favourite${rows.length > 1 ? 's' : ''}: climate <b class="tone-${toneOf(mean / 100)}">${mean}/100</b>, disease <b class="tone-${toneOf(dmean / 100)}">${dmean}/100</b>. Tap a row for the reasons.</p>
    ${bad.length ? `<div class="note bad">${bad.map(r => esc(r.v.name)).join(', ')} ${bad.length > 1 ? 'are' : 'is'} unlikely to do well in this climate.</div>` : ''}
    ${sick.length ? `<div class="note warn">${sick.map(r => esc(r.v.name)).join(', ')} would grow, but ${sick.length > 1 ? 'are' : 'is'} likely to be badly hit by disease here without a spray programme.</div>` : ''}
    ${rows.map(r => scoreRow(r.v, r.s)).join('')}
    ${pollNote(favs)}`;
  wireRows(body);
}
function pollNote(favs) {
  const need = favs.filter(v => v.pollination.self_fertile === 'no' || v.tree.ploidy === 'triploid');
  if (!need.length || favs.length > 12) return '';
  return `<p class="tiny muted" style="margin-top:12px">Pollination is separate from climate &mdash; check <a href="#/favourites">your favourites page</a> to see whether your picks flower together.</p>`;
}

// "Best here" kinds: by date of introduction (heirloom = before 1950, the usual cut-off; apples with no recorded date are
// in neither), by skin (russet 2+ = heavy patches or fully russeted) and by flesh colour (look.flesh_colour, decision 0010)
const KINDS = [
  ['', 'All kinds', () => true],
  ['heirloom', 'Heirloom (before 1950)', v => v.origin.year != null && v.origin.year < 1950],
  ['modern', 'Modern (1950 on)', v => v.origin.year != null && v.origin.year >= 1950],
  ['russet', 'Russeted', v => (v.look.russet || 0) >= 2],
  ['redflesh', 'Red flesh', v => v.look.flesh_colour === 'red'],
  ['tinged', 'Red or pink-tinged flesh', v => !!v.look.flesh_colour],
];
const PAGE = 20;
const bestState = { keepers: false, use: '', kind: '', by: 'both' };      // kept while you click around the map
function tBest(body) {
  const st = bestState;
  let io = null;
  const favBtn = v => `<button class="fav ${isFav(v.id) ? 'on' : ''}" style="position:static" data-pfav="${esc(v.id)}" aria-label="Toggle favourite" title="${isFav(v.id) ? 'Remove from' : 'Add to'} favourites">${isFav(v.id) ? '♥' : '♡'}</button>`;
  const draw = () => {
    if (io) io.disconnect();
    const kind = KINDS.find(k => k[0] === st.kind)[2];
    const list = S.data.varieties.filter(v => (!st.keepers || v.keepers.listed) && (!st.use || v.uses.includes(st.use)) && kind(v));
    const ranked = rankVarieties(list, sel.F, S.ctx, st.by);
    let shown = 0;
    body.innerHTML = `<div class="row" style="margin-bottom:8px"><select id="useSel" aria-label="Use"><option value="">All uses</option>${['dessert', 'culinary', 'cider', 'crab'].map(u => `<option value="${u}" ${st.use === u ? 'selected' : ''}>${u}</option>`).join('')}</select>
      <select id="kindSel" aria-label="Kind of apple">${KINDS.map(([k, l]) => `<option value="${k}" ${st.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <select id="bySel" aria-label="Sort by">${[['both', 'Sort: climate and disease'], ['climate', 'Sort: climate only'], ['disease', 'Sort: disease only']].map(([k, l]) => `<option value="${k}" ${st.by === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <label class="chk small"><input type="checkbox" id="kOnly" ${st.keepers ? 'checked' : ''}> Keepers range only</label></div>
      <p class="small muted">${ranked.length} varieties${st.kind ? ' of this kind' : ''}, ${st.by === 'both' ? 'ranked by the lower of their two scores' : st.by === 'climate' ? 'ranked by climate alone' : 'ranked by disease alone'}. Tap a row for reasons; keep scrolling for more.</p>
      ${ranked.length ? '' : '<div class="note">No apples in the atlas match these choices.</div>'}
      <div id="bestRows"></div>
      <div id="bestMore" class="more-row"></div>`;
    const rowsEl = body.querySelector('#bestRows'), more = body.querySelector('#bestMore');
    const addPage = () => {
      const next = ranked.slice(shown, shown + PAGE);
      if (!next.length) return;
      const tmp = document.createElement('div');
      tmp.innerHTML = next.map(({ v, s }, i) => scoreRow(v, s, `<span class="rank tiny muted">${shown + i + 1}</span>` + favBtn(v))).join('');
      wireRows(tmp);
      rowsEl.append(...tmp.childNodes);
      shown += next.length;
      more.innerHTML = shown < ranked.length ? `<button class="btn sm" data-more>Show ${Math.min(PAGE, ranked.length - shown)} more (${shown} of ${ranked.length})</button>` : (ranked.length > PAGE ? `<span class="tiny muted">All ${ranked.length} shown.</span>` : '');
      const mb = more.querySelector('[data-more]'); if (mb) mb.onclick = addPage;
    };
    addPage();
    // keep loading as the end of the list scrolls into view (the button stays as a fallback)
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting) && shown < ranked.length) addPage(); }, { rootMargin: '200px' });
      io.observe(more);
    }
    body.querySelector('#useSel').onchange = e => { st.use = e.target.value; draw(); };
    body.querySelector('#kindSel').onchange = e => { st.kind = e.target.value; draw(); };
    body.querySelector('#kOnly').onchange = e => { st.keepers = e.target.checked; draw(); };
    body.querySelector('#bySel').onchange = e => { st.by = e.target.value; draw(); };
  };
  draw();
}

function chart(F) {
  const m = F.monthly, W = 420, H = 190, L = 30, R = 32, T = 12, B = 22;
  const xs = i => L + (i + .5) * (W - L - R) / 12;
  const tmin = Math.min(...m.tmin), tmax = Math.max(...m.tmax), lo = Math.floor(Math.min(0, tmin) / 5) * 5, hi = Math.ceil(tmax / 5) * 5;
  const ty = t => T + (hi - t) / (hi - lo) * (H - T - B - 36);
  const pmax = Math.max(...m.prcp, 50), py = p => H - B - p / pmax * 34;
  let g = '';
  for (let t = lo; t <= hi; t += 5) g += `<line x1="${L}" x2="${W - R}" y1="${ty(t)}" y2="${ty(t)}" stroke="var(--line)" stroke-width="${t === 0 ? 1.4 : .5}"/><text x="${L - 4}" y="${ty(t) + 3}" text-anchor="end">${t}</text>`;
  m.prcp.forEach((p, i) => { g += `<rect x="${xs(i) - 9}" y="${py(p)}" width="18" height="${H - B - py(p)}" fill="#5b9bd5" opacity=".55"><title>${MONTH_NAMES[i]}: ${Math.round(p)} mm</title></rect><text x="${xs(i)}" y="${H - 8}" text-anchor="middle">${MONTH_NAMES[i][0]}</text>`; });
  const line = (arr, c) => `<polyline fill="none" stroke="${c}" stroke-width="2.2" points="${arr.map((t, i) => xs(i) + ',' + ty(t)).join(' ')}"/>`;
  g += line(m.tmax, '#d9552f') + line(m.tmin, '#3b6ea5');
  g += `<text x="${W - R + 4}" y="${ty(m.tmax[11]) + 3}" fill="#d9552f" style="fill:#d9552f">high</text><text x="${W - R + 4}" y="${ty(m.tmin[11]) + 3}" style="fill:#3b6ea5">low</text>`;
  g += `<text x="${L}" y="9">&deg;C</text><text x="${W - R}" y="${H - 30}" text-anchor="end" style="fill:#5b9bd5">rain: up to ${Math.round(pmax)} mm/month</text>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Monthly climate chart: temperatures and rainfall">${g}</svg>`;
}

const KIND = {
  measured: ['Measured', 'Counted directly from weather records for this spot'],
  modelled: ['Modelled', 'An apple-specific index calculated from the measured weather'],
  regional: ['Regional', 'Looked up from a country or range map; not measured at this spot'],
  assumed: ['Assumed', 'A default or estimate used because no record was available'],
  extrapolated: ['Extrapolated', 'Blended from nearby places; not measured at this spot'],
};
const kindBadge = k => `<span class="kind kind-${k}" title="${esc(KIND[k][1])}">${KIND[k][0]}</span>`;

function provenanceTable(F) {
  const ex = sel.source === 'extrapolated';
  const m = ex ? 'extrapolated' : 'measured', d = ex ? 'extrapolated' : 'modelled';
  const R = F.regional, W = F.wet, P = F.noBloom ? null : sitePressures(F);
  const row = (name, val, kind) => `<tr><td>${name}</td><td>${val}</td><td>${kindBadge(kind)}</td></tr>`;
  const rows = [
    row('Daily temperature and rain', ex ? 'blended from ' + F.extrapolated.from.length + ' places' : esc(F.period) + ', 25 km ERA5 grid cell', m),
    row('Elevation', F.elev != null ? fmtInt(F.elev) + ' m (terrain model)' : 'not known', F.elev != null ? m : 'assumed'),
    row('Humidity and dew point', F.humidity ? (F.humidity.estimated ? 'estimated from the temperature range' : 'RH ~' + Math.round(F.humidity.gs) + '% in the growing season') : '–', F.humidity && F.humidity.estimated ? 'assumed' : m),
  ];
  if (!F.noBloom) {
    rows.push(
      row('Winter chill', fmtInt(F.chill.mean) + ' Utah units (' + fmtInt(F.chill.p20) + ' in a mild winter)' + (F.chill.hours72 != null ? '; ' + fmtInt(F.chill.hours72) + ' h below 7.2 °C' : ''), d),
      row('Coldest nights / hardiness zone', F.winter.extMinMean.toFixed(0) + ' °C / zone ' + esc(F.winter.zone.label), d),
      row('Full bloom, mid-season varieties', esc(F.bloom.label) + ' ±' + Math.round(F.bloom.sd) + ' days', d),
      row('Blossom frost chance (groups 1–7)', F.frost.p.map(x => Math.round(x * 100) + '%').join(' '), d),
      row('Growing degree-days, bloom to freeze', fmtInt(F.season.gendMedian) + ' (base 5 °C); first hard freeze ' + esc(F.season.firstFreeze || 'none'), d),
      row('Frost-free season / snow days', (F.frostFreeDays != null ? Math.round(F.frostFreeDays) + ' days / ' + Math.round(F.snowDays || 0) + ' days' : '–'), m),
      row('Days at or above 32 °C a year', F.heat.hot32.toFixed(1), m),
      row('Rain: year / growing season', fmtInt(F.pann) + ' / ' + fmtInt(W.gsPrecip) + ' mm', m),
      row('Water balance (rain / crop demand)', Math.round(Math.min(9.99, W.aridity) * 100) + '%', d),
      row('Leaf wetness in spring', '~' + Math.round(W.lwdSpring) + ' h a day; ~' + Math.round(W.scabEvents) + ' scab infection periods', d),
      row('Apple scab, canker, mildew pressure', ['scab', 'canker', 'mildew'].map(k => pressureWord(P[k])).join(' / '), d),
      row('Fire blight: weather risk', '~' + (W.fireBlightEvents < 1 ? W.fireBlightEvents.toFixed(1) : Math.round(W.fireBlightEvents)) + ' warm wet blossom days a year (' + pressureWord(P.fire_blight) + ')', d),
    );
  }
  rows.push(
    row('Fire blight: is it present?', R ? esc(R.fireBlight.status === 'present' ? 'present in ' + (R.country || 'this country') : R.fireBlight.status === 'absent' ? 'not known in ' + (R.country || 'this country') : 'not mapped; assumed present') : '–', R && R.fireBlight.status === 'unknown' ? 'assumed' : 'regional'),
    row('Cedar-apple rust: is it present?', R ? (R.rust.present ? 'yes (eastern North America)' : 'no') : '–', 'regional'),
    row('Variety traits used in the scores', 'where a variety\'s chill need, hardiness, flowering group or harvest date is unrecorded, a default is used and the reason says "assumed"', 'assumed'),
  );
  return `<table class="dt prov-table"><thead><tr><th>Factor</th><th>Value here</th><th>Basis</th></tr></thead><tbody>${rows.join('')}</tbody></table>
    <p class="tiny muted" style="margin-top:6px">${Object.keys(KIND).map(k => kindBadge(k) + ' ' + esc(KIND[k][1].toLowerCase())).join('<br>')}</p>`;
}

function tClimate(body) {
  const F = sel.F, prof = siteProfile(F);
  body.innerHTML = `${chart(F)}
    <div class="siteprof" style="margin-top:10px">${prof.map(p => `<div class="sp ${p.tone}"><i></i><div><b>${esc(p.title)}</b><span>${esc(p.text)}</span></div></div>`).join('')}</div>
    <h4 style="margin-top:16px">Where each number comes from</h4>
    ${provenanceTable(F)}
    <p class="tiny muted" style="margin-top:12px">ERA5 grid cells are ~25 km wide: they smooth out frost hollows, hills and lake shores, so local frost is usually worse than shown on low, sheltered ground and chill can differ on hills. Treat scores as a regional guide, not a guarantee.</p>`;
}

function tRegional(body) {
  const F = sel.F, R = F.regional;
  if (!R) { body.innerHTML = '<p class="muted">Regional data unavailable.</p>'; return; }
  const P = F.noBloom ? null : sitePressures(F);
  const fbTone = R.fireBlight.status === 'absent' ? 'good' : R.fireBlight.status === 'present' ? 'warn' : 'ok';
  body.innerHTML = `<p class="small muted">Some risks depend on <i>where you are</i> rather than on the weather: whether a disease exists in the region at all. These come from coarse country and range maps. Weather then decides how bad they get.</p>
    <div class="siteprof">
      <div class="sp ${fbTone}"><i></i><div><b>Fire blight ${kindBadge('regional')}</b><span>${esc(R.fireBlight.note)}${P ? ' Weather-driven pressure here: <b>' + pressureWord(P.fire_blight) + '</b>.' : ''}</span></div></div>
      <div class="sp ${R.rust.present ? 'warn' : 'good'}"><i></i><div><b>Cedar-apple rust ${kindBadge('regional')}</b><span>${esc(R.rust.note)}${P && R.rust.present ? ' Pressure this wet-spring pattern allows: <b>' + pressureWord(P.rust) + '</b>.' : ''}</span></div></div>
      ${R.pests.map(x => `<div class="sp ok"><i></i><div><b>${esc(x.name)} ${kindBadge('regional')}</b><span>${esc(x.note)}</span></div></div>`).join('')}
      ${P ? `<div class="sp ok"><i></i><div><b>Weather-driven diseases here ${kindBadge(sel.source === 'extrapolated' ? 'extrapolated' : 'modelled')}</b><span>Apple scab: <b>${pressureWord(P.scab)}</b> &middot; European canker: <b>${pressureWord(P.canker)}</b> &middot; powdery mildew: <b>${pressureWord(P.mildew)}</b>. These follow from leaf wetness, humidity and temperature in the climate record.</span></div></div>` : ''}
    </div>
    <p class="tiny muted" style="margin-top:12px">Country detected: ${esc(R.country ? countryName(R.country) : 'unknown')}. Plant-health rules (restrictions on moving trees or fruit) also vary by region; check with your national plant-health authority before ordering.</p>`;
}

function tRoot(body) {
  const groups = rootstockAdvice(S.data.rootstocks, sel.F);
  body.innerHTML = `<p class="small muted">Best-fitting rootstocks for this climate, by the tree size you want. Fit weighs root hardiness, fire blight, collar rot in wet soils, drought and woolly aphid.</p>` +
    groups.map(g => `<div class="rs-group"><h4>${esc(g.title)}</h4>${g.items.slice(0, 3).map(({ r, score, why, warn }) => `<div class="rs-item"><a href="#/r/${esc(r.id)}"><b>${esc(r.name)}</b></a> <span class="muted">fit ${score}/100</span>${r.keepers ? ' <span class="badge keepers">Keepers</span>' : ''}<div class="why">${why.length ? '+ ' + esc(why.join('; ')) : ''}</div>${warn.length ? `<div class="why tone-warn">&minus; ${esc(warn.join('; '))}</div>` : ''}</div>`).join('')}</div>`).join('') +
    `<p class="small"><a href="#/rootstocks">Compare all rootstocks &rarr;</a></p>`;
}

function tLocal(body) {
  let r = sel.region, nearNote = '';
  if ((!r || !r.summary) && sel.nearest) {
    r = sel.nearest.region;
    nearNote = `<div class="note warn"><b>Context from a nearby place.</b> These notes were written for ${esc(r.name)}, ${sel.nearest.d < 5 ? 'right here' : Math.round(sel.nearest.d) + ' km away'}; your spot may differ. <a href="#/map/${esc(r.id)}">Open that reference place</a>.</div>`;
  }
  if (!r || !r.summary) { body.innerHTML = '<p class="muted">No local notes within 800 km of this spot.</p>'; return; }
  const vs = (r.variety_ids || []).map(id => S.byId.get(id)).filter(Boolean);
  const free = (r.local_varieties || []).filter(n => !vs.some(v => v.name.toLowerCase() === n.toLowerCase()));
  body.innerHTML = `${nearNote}<h4>Climate for apples</h4><p>${esc(r.summary)}</p><h4>Apple culture</h4><p>${esc(r.apple_culture)}</p>
    ${(vs.length || free.length) ? `<h4>Varieties linked with this place</h4><div>${vs.map(v => `<a class="chip" href="#/v/${esc(v.id)}">${esc(v.name)}</a>`).join('')}${free.map(n => `<span class="chip">${esc(n)}</span>`).join('')}</div>` : ''}
    <h4>Pests &amp; diseases</h4><p>${esc(r.pests_diseases)}</p><h4>Tips for growers</h4><p>${esc(r.tips)}</p>
    <p class="tiny muted">Notes written for this atlas; confidence: ${esc(r.confidence || '?')}.</p>`;
}
