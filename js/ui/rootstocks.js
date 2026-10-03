// Rootstock comparison table, chooser and detail pages.
import { S, esc, countryName } from '../data.js';
import { meter, bar } from './widgets.js';

const SIZE_LABEL = { 'very-dwarf': 'Very dwarf', dwarf: 'Dwarf', 'semi-dwarf': 'Semi-dwarf', 'semi-vigorous': 'Semi-vigorous', vigorous: 'Vigorous', 'very-vigorous': 'Very vigorous' };
const SIZE_ORDER = ['very-dwarf', 'dwarf', 'semi-dwarf', 'semi-vigorous', 'vigorous', 'very-vigorous'];
const COLS = [
  ['name', 'Rootstock', r => r.name, 'text'],
  ['size', 'Size', r => SIZE_ORDER.indexOf(r.size_class), 'size'],
  ['height', 'Height (m)', r => r.height_m ? (r.height_m[0] + r.height_m[1]) / 2 : null, 'height'],
  ['vigor', 'Vigour', r => r.vigor, 'meter'],
  ['prec', 'Precocity', r => r.precocity, 'meter'],
  ['yield', 'Yield eff.', r => r.yield_efficiency, 'meter'],
  ['anch', 'Anchorage', r => r.anchorage, 'meter'],
  ['fb', 'Fire blight', r => r.susceptibility.fire_blight, 'risk'],
  ['cr', 'Collar rot', r => r.susceptibility.collar_rot, 'risk'],
  ['wa', 'Woolly aphid', r => r.susceptibility.woolly_aphid, 'risk'],
  ['cold', 'Hardiness', r => r.hardiness_zone, 'zone'],
  ['dr', 'Drought', r => r.tolerance.drought, 'meter'],
  ['wet', 'Wet soil', r => r.tolerance.wet_soil, 'meter'],
];
let sortKey = 'size', sortDir = 1, sizeFilter = '', keepersOnly = false;

function cell(r, [k, , get, type]) {
  const v = get(r);
  if (type === 'text') return `<td><a href="#/r/${esc(r.id)}"><b>${esc(r.name)}</b></a>${r.keepers ? ' <span class="badge keepers" title="One of the apple rootstocks Keepers Nursery lists">Keepers</span>' : ''}${r.conf === 'low' ? ' <span class="badge" title="Sparse data">low data</span>' : ''}</td>`;
  if (type === 'size') return `<td>${esc(SIZE_LABEL[r.size_class])}${r.size_pct_standard ? ` <span class="muted tiny">${r.size_pct_standard[0]}–${r.size_pct_standard[1]}%</span>` : ''}</td>`;
  if (type === 'height') return `<td class="num">${r.height_m ? r.height_m[0] + '–' + r.height_m[1] : '–'}</td>`;
  if (type === 'zone') return `<td class="num">${v == null ? '–' : 'z' + v}</td>`;
  if (type === 'risk') return `<td>${meter(v, true)}</td>`;
  return `<td>${meter(v)}</td>`;
}

function tableHTML() {
  const col = COLS.find(c => c[0] === sortKey) || COLS[1];
  let list = S.data.rootstocks.filter(r => (!sizeFilter || r.size_class === sizeFilter) && (!keepersOnly || r.keepers));
  list = [...list].sort((a, b) => {
    const x = col[2](a), y = col[2](b);
    if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
    const c = typeof x === 'string' ? x.localeCompare(y, 'en', { numeric: true }) : x - y;
    return (c || a.name.localeCompare(b.name, 'en', { numeric: true })) * sortDir;
  });
  return `<div class="tablewrap"><table class="dt"><thead><tr>${COLS.map(c => `<th data-sort="${c[0]}" class="${c[0] === sortKey ? 'sorted' : ''}">${c[1]}${c[0] === sortKey ? (sortDir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead>
  <tbody>${list.map(r => `<tr data-go="${esc(r.id)}">${COLS.map(c => cell(r, c)).join('')}</tr>`).join('')}</tbody></table></div>
  <p class="tiny muted" style="margin-top:6px">${list.length} rootstocks. Meters: vigour/precocity/yield/anchorage/tolerance &mdash; more filled is more; disease columns &mdash; <b>more filled is more susceptible</b>. Click a row for the full profile.</p>`;
}

// ---- chooser
const Q = { size: 'semi-dwarf', soil: 'normal', blight: false, cold: false, wind: false, early: false, grass: false };
export function chooserScore(r, q) {
  let s = 70; const why = [], warn = [];
  const want = SIZE_ORDER.indexOf(q.size === 'dwarf' ? 'dwarf' : q.size), have = SIZE_ORDER.indexOf(r.size_class);
  const d = Math.abs(have - (q.size === 'any' ? have : want));
  s -= d * 22;
  if (d === 0 && q.size !== 'any') why.push('right size');
  const t = r.tolerance || {}, su = r.susceptibility || {};
  if (q.soil === 'wet') { if (su.collar_rot >= 4) { s -= 18; warn.push('collar-rot prone in wet soil'); } else if (su.collar_rot != null && su.collar_rot <= 2) { s += 8; why.push('resists collar rot'); } if (t.wet_soil >= 4) { s += 8; why.push('tolerates wet ground'); } else if (t.wet_soil != null && t.wet_soil <= 2) { s -= 8; warn.push('dislikes wet soil'); } }
  if (q.soil === 'dry') { if (t.drought >= 4) { s += 12; why.push('drought tolerant'); } else if (t.drought != null && t.drought <= 2) { s -= 14; warn.push('drought sensitive'); } }
  if (q.soil === 'poor' || q.grass) { if (t.poor_soil >= 4) { s += 12; why.push('copes with poor/grassed ground'); } else if (t.poor_soil != null && t.poor_soil <= 2) { s -= 14; warn.push('needs fertile, weed-free ground'); } }
  if (q.blight) { if (su.fire_blight >= 4) { s -= 22; warn.push('fire blight susceptible'); } else if (su.fire_blight != null && su.fire_blight <= 2) { s += 14; why.push('fire blight resistant'); } }
  if (q.cold) { const z = r.hardiness_zone; if (z != null && z <= 4) { s += 12; why.push('very hardy'); } else if (z != null && z >= 6) { s -= 22; warn.push('tender roots'); } else if (z === 5) s -= 6; }
  if (q.wind) { if (r.anchorage >= 4) { s += 10; why.push('well anchored'); } else if (r.anchorage != null && r.anchorage <= 2) { s -= 12; warn.push('needs permanent staking'); } }
  if (q.early) { if (r.precocity >= 4) { s += 10; why.push('crops early'); } else if (r.precocity != null && r.precocity <= 2) { s -= 10; warn.push('slow to crop'); } }
  // gentle tie-breakers: proven croppers, stocks you can actually buy, and well-documented ones rank first
  if (r.yield_efficiency != null) s += (r.yield_efficiency - 3) * 2;
  if (r.uk_availability === 'common') { s += 4; if (!why.length) why.push('widely available in the UK'); } else if (r.uk_availability === 'specialist') s += 1; else if (r.uk_availability === 'rare' || r.uk_availability === 'not-available') s -= 3;
  if (r.conf === 'high') s += 3; else if (r.conf === 'low') s -= 6;
  return { score: Math.max(0, Math.min(100, Math.round(s))), why, warn };
}

function chooserHTML() {
  const opt = (v, l, cur) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${l}</option>`;
  const ranked = S.data.rootstocks.map(r => ({ r, ...chooserScore(r, Q) })).sort((a, b) => b.score - a.score).slice(0, 5);
  return `<div class="row" style="align-items:flex-start;gap:18px">
    <div style="min-width:240px;display:grid;gap:8px">
      <label class="small">Tree size you want <select id="q-size">${opt('dwarf', 'Dwarf (2–3 m)', Q.size)}${opt('semi-dwarf', 'Semi-dwarf (3–4 m)', Q.size)}${opt('semi-vigorous', 'Semi-vigorous (4–5 m)', Q.size)}${opt('vigorous', 'Vigorous / standard', Q.size)}${opt('any', 'No preference', Q.size)}</select></label>
      <label class="small">Your soil <select id="q-soil">${opt('normal', 'Good, well-drained', Q.soil)}${opt('wet', 'Heavy or wet', Q.soil)}${opt('dry', 'Light, dry or droughty', Q.soil)}${opt('poor', 'Poor or stony', Q.soil)}</select></label>
      ${[['blight', 'Fire blight is in my area'], ['cold', 'Very cold winters (below −25 °C)'], ['wind', 'Exposed, windy site'], ['early', 'I want fruit as soon as possible'], ['grass', 'Trees will stand in grass']].map(([k, l]) => `<label class="chk"><input type="checkbox" data-q="${k}" ${Q[k] ? 'checked' : ''}> ${l}</label>`).join('')}
    </div>
    <div style="flex:1;min-width:280px">${ranked.map(({ r, score, why, warn }, i) => `<div class="rs-item"><a href="#/r/${esc(r.id)}"><b>${i + 1}. ${esc(r.name)}</b></a> <span class="muted">— ${esc(SIZE_LABEL[r.size_class])}, fit ${score}/100</span>${r.keepers ? ' <span class="badge keepers">Keepers</span>' : ''}<div class="why">${why.length ? '+ ' + why.join(', ') : ''}${warn.length ? `<br><span class="tone-warn">− ${warn.join(', ')}</span>` : ''}</div></div>`).join('')}</div>
  </div>`;
}

export function renderRootstocks(app) {
  app.innerHTML = `
  <h1>Rootstocks</h1>
  <p class="lead muted" style="max-width:46em">The rootstock decides how big the tree grows, how soon it crops, how well it anchors and which soil and disease problems it can shrug off. The same variety on M.27 and on MM.111 is practically a different tree.</p>
  <section class="card pad" style="margin:16px 0"><h2>Which rootstock for me?</h2><div id="chooser">${chooserHTML()}</div></section>
  <div class="row" style="margin:14px 0 8px">
    <h2 style="margin:0">Compare them all</h2><div class="spacer"></div>
    <label class="small">Size <select id="sizef"><option value="">All sizes</option>${SIZE_ORDER.map(s => `<option value="${s}" ${sizeFilter === s ? 'selected' : ''}>${SIZE_LABEL[s]}</option>`).join('')}</select></label>
    <label class="chk small"><input type="checkbox" id="kp" ${keepersOnly ? 'checked' : ''}> Keepers' apple rootstocks only</label>
  </div>
  <div id="rtable">${tableHTML()}</div>`;
  const redraw = () => { app.querySelector('#rtable').innerHTML = tableHTML(); };
  app.querySelector('#rtable').addEventListener('click', e => {
    const th = e.target.closest('th[data-sort]');
    if (th) { const k = th.dataset.sort; if (k === sortKey) sortDir *= -1; else { sortKey = k; sortDir = 1; } redraw(); return; }
    const tr = e.target.closest('tr[data-go]'); if (tr && !e.target.closest('a')) location.hash = '#/r/' + tr.dataset.go;
  });
  app.querySelector('#sizef').onchange = e => { sizeFilter = e.target.value; redraw(); };
  app.querySelector('#kp').onchange = e => { keepersOnly = e.target.checked; redraw(); };
  const ch = app.querySelector('#chooser');
  ch.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'q-size') Q.size = t.value; else if (t.id === 'q-soil') Q.soil = t.value; else if (t.dataset.q) Q[t.dataset.q] = t.checked;
    ch.innerHTML = chooserHTML();
  });
}

export function renderRootstock(app, id) {
  const r = S.rsById.get(id);
  if (!r) { app.innerHTML = '<div class="empty"><h2>Rootstock not found</h2><a href="#/rootstocks">Back</a></div>'; return; }
  const na = '<span class="muted">not recorded</span>';
  const rng = (a, u = '') => a ? `${a[0]}–${a[1]}${u}` : na;
  const sus = r.susceptibility, tol = r.tolerance, o = r.origin || {};
  const row = (l, v, risk) => `<dt>${l}</dt><dd>${meter(v, risk)}</dd>`;
  app.innerHTML = `
  <p class="crumb"><a href="#/rootstocks">&larr; All rootstocks</a></p>
  <h1>${esc(r.name)} ${r.keepers ? '<span class="badge keepers" style="font-size:.7rem;vertical-align:middle">Keepers</span>' : ''}</h1>
  <p class="muted">${esc(SIZE_LABEL[r.size_class])} &middot; ${esc(r.series)} series${o.place ? ' &middot; ' + esc(o.place) : ''}${o.year ? ', ' + esc(o.year) : ''}${r.aka && r.aka.length ? ' &middot; also ' + r.aka.map(esc).join(', ') : ''}</p>
  ${r.notes ? `<p class="quote">${esc(r.notes)}</p>` : ''}
  ${r.clones && r.clones.length ? `<p class="small"><b>Clones / selections:</b> ${r.clones.map(esc).join('; ')}</p>` : ''}
  <div class="sections">
    <section class="card pad"><h2>Size &amp; cropping</h2>
      <dl class="kv"><dt>Tree size</dt><dd>${r.size_pct_standard ? rng(r.size_pct_standard, '% of standard') : na}</dd>
      <dt>Mature height</dt><dd>${rng(r.height_m, ' m')}</dd><dt>Spacing</dt><dd>${rng(r.spacing_m, ' m')}</dd>
      <dt>First crop</dt><dd>${rng(r.first_crop_years, ' years')}</dd>
      ${row('Vigour', r.vigor)}${row('Precocity', r.precocity)}${row('Yield efficiency', r.yield_efficiency)}${row('Fruit size effect', r.fruit_size_effect)}</dl></section>
    <section class="card pad"><h2>Anchorage &amp; habit</h2>
      <dl class="kv">${row('Anchorage', r.anchorage)}<dt>Support</dt><dd>${r.support ? esc(r.support) : na}</dd>${row('Suckering', r.suckering, true)}${row('Burr knots', r.burr_knots, true)}<dt>UK availability</dt><dd>${esc(r.uk_availability || '–')}</dd></dl></section>
    <section class="card pad"><h2>Disease &amp; pests</h2><p class="tiny muted" style="margin-top:-6px">More filled = more susceptible.</p>
      <dl class="kv">${row('Fire blight', sus.fire_blight, true)}${row('Collar rot', sus.collar_rot, true)}${row('Woolly aphid', sus.woolly_aphid, true)}${row('Crown gall', sus.crown_gall, true)}${row('Powdery mildew', sus.powdery_mildew, true)}</dl></section>
    <section class="card pad"><h2>Soil &amp; climate</h2>
      <dl class="kv">${row('Cold hardiness', tol.cold)}<dt>Hardiness zone</dt><dd>${r.hardiness_zone ? 'USDA zone ' + r.hardiness_zone : na}</dd>${row('Drought tolerance', tol.drought)}${row('Wet soil', tol.wet_soil)}${row('Poor soil', tol.poor_soil)}${row('Heavy clay', tol.heavy_soil)}${row('Replant disease', tol.replant)}</dl>
      ${r.soil_notes ? `<p class="small">${esc(r.soil_notes)}</p>` : ''}</section>
    <section class="card pad wide"><h2>Using it</h2>
      <dl class="kv"><dt>Best for</dt><dd>${r.best_for ? esc(r.best_for) : na}</dd><dt>Avoid when</dt><dd>${r.avoid_when ? esc(r.avoid_when) : na}</dd><dt>Variety fit</dt><dd>${r.variety_fit ? esc(r.variety_fit) : na}</dd></dl>
      ${o.parentage ? `<p class="small muted" style="margin-top:10px">Parentage: ${esc(o.parentage)}${o.note ? '. ' + esc(o.note) : ''}</p>` : ''}
      <p class="small muted">Data confidence: <b>${esc(r.conf)}</b>. Ratings are consensus values from extension and breeder trials; they vary with soil, climate and scion.</p></section>
  </div>`;
}
