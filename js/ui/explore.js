// Home / Varieties: hero, filters and the card grid.
import { S, esc, countryName, FLAVOUR_FAMILIES, tagLabel, seasonName, chillClass, sortName } from '../data.js';
import { appleSVG, bar, chips, usesBadges, favBtn, keepersBadge, breederBadge } from './widgets.js';

const F0 = () => ({ q: '', uses: new Set(), season: new Set(), tags: new Set(), country: '', keepers: false, bred: false, selfF: false, noTri: false, scab: false, canker: false, chill: new Set(), hardy: false, sort: 'name' });
let F = F0();
let shown = 60;

const SORTS = {
  name: ['Name A–Z', sortName],
  season: ['Ripening (earliest first)', (a, b) => (a.season.harvest_doy ?? 999) - (b.season.harvest_doy ?? 999)],
  sweet: ['Sweetest first', (a, b) => (b.taste.sweet ?? 0) - (a.taste.sweet ?? 0)],
  acid: ['Sharpest first', (a, b) => (b.taste.acid ?? 0) - (a.taste.acid ?? 0)],
  aroma: ['Most aromatic', (a, b) => (b.taste.aroma ?? 0) - (a.taste.aroma ?? 0)],
  old: ['Oldest first', (a, b) => (a.origin.year ?? 9999) - (b.origin.year ?? 9999)],
  hardy: ['Hardiest first', (a, b) => (a.climate.hardiness_zone ?? 99) - (b.climate.hardiness_zone ?? 99)],
  lowchill: ['Lowest chill need', (a, b) => (a.climate.chill_hours ?? 9999) - (b.climate.chill_hours ?? 9999)],
};

function seasonKey(v) { const d = v.season.harvest_doy; return d == null ? null : d < 245 ? 'early' : d < 280 ? 'mid' : 'late'; }

export function filterVarieties() {
  const q = F.q.trim().toLowerCase();
  let list = S.data.varieties.filter(v => {
    if (q && !v._search.includes(q)) return false;
    if (F.uses.size && !v.uses.some(u => F.uses.has(u))) return false;
    if (F.season.size && !F.season.has(seasonKey(v))) return false;
    if (F.tags.size && ![...F.tags].every(t => (v.taste.tags || []).includes(t))) return false;
    if (F.country && v.origin.country !== F.country) return false;
    if (F.keepers && !v.keepers.listed) return false;
    if (F.bred && !(v.tags || []).includes('keepers-bred')) return false;
    if (F.selfF && v.pollination.self_fertile !== 'yes') return false;
    if (F.noTri && v.tree.ploidy === 'triploid') return false;
    if (F.scab && !(v.health.scab != null && v.health.scab <= 2)) return false;
    if (F.canker && !(v.health.canker != null && v.health.canker <= 2)) return false;
    if (F.chill.size && !F.chill.has(chillClass(v.climate.chill_hours))) return false;
    if (F.hardy && !(v.climate.hardiness_zone != null && v.climate.hardiness_zone <= 4)) return false;
    return true;
  });
  list.sort(SORTS[F.sort][1]);
  return list;
}

function card(v) {
  const t = v.taste;
  const row = (l, val) => `<span>${l}</span>${bar(val, 5, l === 'Sharp' ? 'gold' : l === 'Aroma' ? 'leaf' : '')}`;
  const origin = [v.origin.country ? countryName(v.origin.country) : null, v.origin.year ? (v.origin.year_note ? v.origin.year_note + ' ' : '') + v.origin.year : null].filter(Boolean).join(' · ');
  return `<a class="vcard card" href="#/v/${esc(v.id)}">
    ${favBtn(v.id)}
    <div class="top-row">${appleSVG(v, 56)}<div><h3>${esc(v.name)}</h3><div class="sub">${esc(origin) || '&nbsp;'}</div></div></div>
    <div>${usesBadges(v)}${keepersBadge(v)}${breederBadge(v)}<span class="badge">${esc(seasonName(v))}</span></div>
    <div>${chips((t.tags || []).slice(0, 4))}</div>
    <div class="tastebars">${row('Sweet', t.sweet)}${row('Sharp', t.acid)}${row('Aroma', t.aroma)}</div>
  </a>`;
}

function filtersHTML() {
  const countries = [...new Set(S.data.varieties.map(v => v.origin.country).filter(Boolean))].sort((a, b) => countryName(a).localeCompare(countryName(b)));
  const chk = (grp, key, label) => `<label class="chk"><input type="checkbox" data-f="${grp}" data-k="${key}" ${F[grp].has(key) ? 'checked' : ''}> ${label}</label>`;
  return `
  <div class="fbody">
  <input type="search" id="q" placeholder="Search name, synonym or place" value="${esc(F.q)}" aria-label="Search varieties">
  <h4>Use</h4><div class="fgroup" style="gap:10px">${['dessert', 'culinary', 'cider', 'crab'].map(u => chk('uses', u, u)).join('')}</div>
  <h4>Ripens (south-east England)</h4><div class="fgroup" style="gap:10px">${[['early', 'Early (to Aug)'], ['mid', 'Mid (Sep)'], ['late', 'Late (Oct on)']].map(([k, l]) => chk('season', k, l)).join('')}</div>
  <h4>Flavour <span class="tiny muted" style="text-transform:none;letter-spacing:0">(must have all)</span></h4>
  ${FLAVOUR_FAMILIES.map(([fam, tags]) => `<details ${tags.some(t => F.tags.has(t)) ? 'open' : ''}><summary class="small">${fam}</summary><div class="fgroup" style="margin:6px 0">${tags.map(t => `<span class="chip btnlike ${F.tags.has(t) ? 'on' : ''}" role="button" tabindex="0" data-tag="${t}">${esc(tagLabel(t))}</span>`).join('')}</div></details>`).join('')}
  <h4>Growing</h4>
  <div class="fgroup" style="gap:6px 12px;flex-direction:column">
    <label class="chk"><input type="checkbox" data-b="selfF" ${F.selfF ? 'checked' : ''}> Self-fertile</label>
    <label class="chk"><input type="checkbox" data-b="noTri" ${F.noTri ? 'checked' : ''}> Not a triploid</label>
    <label class="chk"><input type="checkbox" data-b="scab" ${F.scab ? 'checked' : ''}> Scab resistant</label>
    <label class="chk"><input type="checkbox" data-b="canker" ${F.canker ? 'checked' : ''}> Canker tolerant</label>
    <label class="chk"><input type="checkbox" data-b="hardy" ${F.hardy ? 'checked' : ''}> Very hardy (zone 4 or colder)</label>
  </div>
  <h4>Winter chill needed</h4><div class="fgroup" style="gap:10px">${['low', 'medium', 'high', 'very high'].map(c => chk('chill', c, c)).join('')}</div>
  <h4>Origin</h4>
  <select id="country" aria-label="Country of origin"><option value="">Anywhere</option>${countries.map(c => `<option value="${c}" ${F.country === c ? 'selected' : ''}>${esc(countryName(c))}</option>`).join('')}</select>
  <h4>Range</h4>
  <label class="chk"><input type="checkbox" data-b="keepers" ${F.keepers ? 'checked' : ''}> In the Keepers Nursery range</label><br>
  <label class="chk"><input type="checkbox" data-b="bred" ${F.bred ? 'checked' : ''}> Seedlings raised by Karim Habibi</label>
  <div style="margin-top:14px"><button class="btn sm" id="reset">Reset filters</button></div>
  </div>`;
}

function gridHTML() {
  const list = filterVarieties();
  const part = list.slice(0, shown);
  return `<div class="row" style="justify-content:space-between;margin-bottom:10px">
      <p class="count" style="margin:0"><b>${list.length}</b> of ${S.data.varieties.length} varieties</p>
      <label class="small">Sort <select id="sort">${Object.entries(SORTS).map(([k, [l]]) => `<option value="${k}" ${F.sort === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    </div>
    ${part.length ? `<div class="grid">${part.map(card).join('')}</div>` : '<div class="empty">No varieties match those filters. Try removing one.</div>'}
    ${list.length > shown ? `<div style="text-align:center;margin-top:18px"><button class="btn" id="more">Show ${Math.min(60, list.length - shown)} more</button></div>` : ''}`;
}

export function renderExplore(app, params) {
  const c = S.data.counts;
  if (params && params.toString()) {
    F = F0();
    if (params.get('bred')) F.bred = true;
    if (params.get('tag')) params.get('tag').split(',').forEach(t => F.tags.add(t));
    if (params.get('use')) F.uses.add(params.get('use'));
    if (params.get('q')) F.q = params.get('q');
    shown = 60;
  }
  const sample = ['coxs-orange-pippin', 'ashmeads-kernel', 'kingston-black', 'egremont-russet', 'ananas-reinette', 'bramleys-seedling'].map(id => S.byId.get(id)).filter(Boolean);
  app.innerHTML = `
  <section class="hero">
    <div>
      <h1>The heirloom apple atlas</h1>
      <p class="lead">Taste, growing habit and ripening for ${c.varieties} apple varieties — from rose-water Cox to pineapple-scented Ananas Reinette — plus the rootstocks that decide how big and how soon they crop. Then click the world map to see how your favourites would do in Norfolk, Paris or southern Michigan.</p>
      <p class="small" style="margin:0 0 8px"><b>Browse by taste:</b>
        ${[['rose', 'Rose-water'], ['floral', 'Floral'], ['pear-drop', 'Pear drop'], ['pineapple', 'Pineapple'], ['vanilla', 'Vanilla'], ['nutty', 'Nutty'], ['aniseed', 'Aniseed'], ['honey', 'Honeyed'], ['strawberry', 'Strawberry']].map(([t, l]) => `<a class="chip" href="#/?tag=${t}">${l}</a>`).join('')}
        <a class="chip" href="#/?bred=1">Karim's own seedlings</a></p>
      <div class="row"><a class="btn primary" href="#/map">Try the world map</a><a class="btn" href="#/rootstocks">Compare rootstocks</a><a class="btn" href="#/guide">How it works</a></div>
      <div class="stats"><div class="stat"><b>${c.varieties}</b>varieties</div><div class="stat"><b>${c.keepers}</b>in the Keepers range</div><div class="stat"><b>${c.rootstocks}</b>rootstocks</div><div class="stat"><b>${c.regions}</b>reference places</div></div>
    </div>
    <div class="hero-art" aria-hidden="true">${sample.map(v => appleSVG(v, 92)).join('')}</div>
  </section>
  <section class="explore">
    <aside class="filters card pad ${matchMedia('(max-width: 900px)').matches ? 'collapsed' : ''}" id="filters"><button class="btn sm ftoggle" id="ftoggle" aria-expanded="false">Show filters</button>${filtersHTML()}</aside>
    <div id="results">${gridHTML()}</div>
  </section>`;
  wire(app);
}

function refreshResults(app) { app.querySelector('#results').innerHTML = gridHTML(); wireResults(app); }

function wire(app) {
  const filters = app.querySelector('#filters');
  const redraw = () => { shown = 60; refreshResults(app); };
  filters.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'q') { F.q = t.value; redraw(); }
    else if (t.id === 'country') { F.country = t.value; redraw(); }
    else if (t.dataset.f) { const s = F[t.dataset.f]; t.checked ? s.add(t.dataset.k) : s.delete(t.dataset.k); redraw(); }
    else if (t.dataset.b) { F[t.dataset.b] = t.checked; redraw(); }
  });
  const tagToggle = el => { const t = el.dataset.tag; if (!t) return; F.tags.has(t) ? F.tags.delete(t) : F.tags.add(t); el.classList.toggle('on'); redraw(); };
  filters.addEventListener('click', e => {
    const el = e.target.closest('[data-tag]'); if (el) tagToggle(el);
    if (e.target.id === 'ftoggle') { const c = filters.classList.toggle('collapsed'); e.target.textContent = c ? 'Show filters' : 'Hide filters'; e.target.setAttribute('aria-expanded', !c); }
    if (e.target.id === 'reset') { F = F0(); const wasCollapsed = filters.classList.contains('collapsed'); filters.innerHTML = '<button class="btn sm ftoggle" id="ftoggle" aria-expanded="' + !wasCollapsed + '">' + (wasCollapsed ? 'Show filters' : 'Hide filters') + '</button>' + filtersHTML(); redraw(); }
  });
  filters.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset.tag) { e.preventDefault(); tagToggle(e.target); } });
  wireResults(app);
}
function wireResults(app) {
  const s = app.querySelector('#sort'); if (s) s.onchange = () => { F.sort = s.value; shown = 60; refreshResults(app); };
  const m = app.querySelector('#more'); if (m) m.onclick = () => { shown += 60; refreshResults(app); };
}
