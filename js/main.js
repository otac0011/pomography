// Router + shell.
import { load, S, getFavs, onFavs, toggleFav, isFav, esc } from './data.js';
import { renderExplore } from './ui/explore.js';
import { renderVariety } from './ui/variety.js';
import { renderRootstocks, renderRootstock } from './ui/rootstocks.js';
import { renderMap, cleanup as cleanupMap } from './ui/map.js';
import { renderFavourites } from './ui/favourites.js';
import { renderGuide } from './ui/guide.js';

const app = document.getElementById('app');

function syncFavUI() {
  const n = getFavs().length, pill = document.getElementById('favcount');
  pill.textContent = n; pill.hidden = n === 0;
  document.querySelectorAll('[data-fav]').forEach(b => {
    const on = isFav(b.dataset.fav);
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.textContent = on ? '♥' : '♡';
  });
  document.querySelectorAll('[data-fav-big]').forEach(b => { b.textContent = isFav(b.dataset.favBig) ? '♥ In favourites' : '♡ Add to favourites'; });
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-fav],[data-fav-big]');
  if (!b) return;
  e.preventDefault(); e.stopPropagation();
  toggleFav(b.dataset.fav || b.dataset.favBig);
}, true);

let current = '';
function parse() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  return { parts: path.split('/').filter(Boolean).map(decodeURIComponent), params: new URLSearchParams(qs || '') };
}

async function route() {
  await load();
  const { parts, params } = parse();
  const key = parts.join('/');
  if (current.startsWith('map') && !key.startsWith('map')) cleanupMap();
  // switching map -> map (same page, different place) should not rebuild when the URL was just set by the map itself
  current = key;
  const [a, b] = parts;
  let nav = 'explore', title = 'Pomona — the heirloom apple atlas';
  window.scrollTo(0, 0);
  try {
    if (!a) renderExplore(app);
    else if (a === 'v') { renderVariety(app, b); nav = 'explore'; const v = S.byId.get(b); if (v) title = v.name + ' — Pomona'; }
    else if (a === 'rootstocks') { renderRootstocks(app); nav = 'rootstocks'; title = 'Rootstocks — Pomona'; }
    else if (a === 'r') { renderRootstock(app, b); nav = 'rootstocks'; const r = S.rsById.get(b); if (r) title = r.name + ' rootstock — Pomona'; }
    else if (a === 'map') { renderMap(app, b, params); nav = 'map'; title = 'World map — Pomona'; }
    else if (a === 'favourites') { renderFavourites(app); nav = 'favourites'; title = 'Favourites — Pomona'; }
    else if (a === 'guide') { renderGuide(app); nav = 'guide'; title = 'Guide — Pomona'; }
    else app.innerHTML = '<div class="empty"><h2>Page not found</h2><p><a href="#/">Home</a></p></div>';
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="empty"><h2>Something went wrong</h2><p class="muted">${esc(err.message)}</p><p><a href="#/">Back to the start</a></p></div>`;
  }
  document.title = title;
  document.querySelectorAll('#nav a').forEach(a2 => a2.classList.toggle('on', a2.dataset.nav === nav));
  syncFavUI();
}

onFavs(syncFavUI);
window.addEventListener('hashchange', route);
load().then(() => { syncFavUI(); route(); }).catch(err => {
  app.innerHTML = `<div class="empty"><h2>Could not load the data</h2><p class="muted">${esc(err.message)}</p></div>`;
});
window.__pomona = { S };
