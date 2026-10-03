// Favourites: side-by-side comparison, pollination check, share link.
import { S, esc, getFavs, toggleFav, setFavs, pollinators, seasonName, chillClass, tagLabel, toast } from '../data.js';
import { appleSVG, bar, meter, chips, usesBadges } from './widgets.js';

const BAND = { 1: 'Group 1 (earliest)', 2: 'Group 2', 3: 'Group 3', 4: 'Group 4', 5: 'Group 5', 6: 'Group 6', 7: 'Group 7 (latest)' };

function pollinationReport(vs) {
  const lines = [];
  const diploids = vs.filter(v => v.tree.ploidy !== 'triploid');
  for (const v of vs) {
    const g = v.pollination.flower_group;
    const tri = v.tree.ploidy === 'triploid';
    const needs = v.pollination.self_fertile !== 'yes';
    if (g == null) { lines.push({ tone: 'warn', v, text: `${v.name}: flowering group not recorded, so partners can't be checked.` }); continue; }
    const partners = diploids.filter(o => o.id !== v.id && o.pollination.flower_group != null && Math.abs(o.pollination.flower_group - g) <= 1);
    if (tri) {
      const n = partners.length;
      lines.push(n >= 2 ? { tone: 'good', v, text: `${v.name} is a triploid and has ${n} pollinators among your picks (${partners.map(p => p.name).join(', ')}). Those two must also pollinate each other, so check they share a flowering week.` }
        : { tone: 'bad', v, text: `${v.name} is a triploid: it needs TWO other diploid varieties flowering at the same time (groups ${Math.max(1, g - 1)}–${Math.min(7, g + 1)}), and you have ${n} so far.` });
    } else if (needs) {
      lines.push(partners.length ? { tone: 'good', v, text: `${v.name} (group ${g}) can be pollinated by ${partners.map(p => p.name).join(', ')}.` }
        : { tone: 'warn', v, text: `${v.name} (group ${g}) is not self-fertile and none of your other picks flower alongside it. Add a partner from group ${Math.max(1, g - 1)}–${Math.min(7, g + 1)}, or rely on a neighbour's tree or a crab apple.` });
    } else {
      lines.push({ tone: 'good', v, text: `${v.name} is self-fertile, so it crops on its own (a partner still improves the crop).` });
    }
  }
  return lines;
}

export function renderFavourites(app) {
  const ids = getFavs(), vs = ids.map(id => S.byId.get(id));
  if (!vs.length) {
    app.innerHTML = `<h1>Favourites</h1><div class="card pad empty"><p>Tap the heart on any variety to collect it here. You can then compare them side by side, check that they pollinate each other and see how they'd fare around the world.</p><p><a class="btn primary" href="#/">Browse varieties</a> <a class="btn" href="#/map">Open the map</a></p></div>`;
    return;
  }
  const na = '<span class="muted">–</span>';
  const R = (label, fn) => `<tr><th scope="row">${label}</th>${vs.map(v => `<td>${fn(v) ?? na}</td>`).join('')}</tr>`;
  const link = location.origin + location.pathname + '#/map?f=' + ids.join(',');
  const rep = pollinationReport(vs);
  const byGroup = {}; vs.forEach(v => { const g = v.pollination.flower_group; (byGroup[g ?? '?'] ||= []).push(v); });
  const sugg = (() => {
    const need = rep.filter(r => r.tone !== 'good'); if (!need.length) return [];
    const seen = new Set(ids), out = [];
    for (const r of need) for (const p of pollinators(r.v, 4)) if (!seen.has(p.id)) { seen.add(p.id); out.push(p); }
    return out.slice(0, 6);
  })();
  app.innerHTML = `
  <div class="row"><h1 style="margin:0">Favourites</h1><div class="spacer"></div><a class="btn primary" href="#/map">See them on the map</a><button class="btn" id="share">Copy share link</button><button class="btn" id="clear">Clear</button></div>
  <p class="muted">${vs.length} variet${vs.length > 1 ? 'ies' : 'y'}. Saved in this browser only.</p>
  <section class="card pad" style="margin:14px 0"><h2>Will they pollinate each other?</h2>
    <div class="timeline-groups" aria-label="Flowering groups">${[1, 2, 3, 4, 5, 6, 7].map(g => `<div><b>${BAND[g]}</b>${(byGroup[g] || []).map(v => `<span class="fv ${v.tree.ploidy === 'triploid' ? 'tri' : ''}" title="${esc(v.name)}${v.tree.ploidy === 'triploid' ? ' (triploid)' : ''}">${esc(v.name)}</span>`).join('')}</div>`).join('')}</div>
    ${byGroup['?'] ? `<p class="tiny muted">Group unknown: ${byGroup['?'].map(v => esc(v.name)).join(', ')}</p>` : ''}
    <p class="tiny muted">Gold = triploid (sterile pollen, needs two partners). Varieties in the same or adjacent group overlap in flower.</p>
    <div style="margin-top:8px">${rep.map(r => `<div class="note ${r.tone === 'good' ? '' : r.tone}" style="margin:6px 0">${esc(r.text)}</div>`).join('')}</div>
    ${sugg.length ? `<h4>Add one of these to fill the gaps</h4><div>${sugg.map(p => `<a class="chip" href="#/v/${esc(p.id)}">${esc(p.name)} <span class="muted">(group ${p.pollination.flower_group})</span></a>`).join('')}</div>` : ''}
  </section>
  <section><h2>Side by side</h2>
  <div class="tablewrap"><table class="dt" style="min-width:${180 + vs.length * 190}px"><thead><tr><th></th>${vs.map(v => `<th style="cursor:default;text-align:center;white-space:normal"><a href="#/v/${esc(v.id)}" style="text-decoration:none;color:inherit">${appleSVG(v, 56)}<br>${esc(v.name)}</a><br><button class="btn sm" data-rm="${esc(v.id)}">Remove</button></th>`).join('')}</tr></thead><tbody>
  ${R('Use', v => usesBadges(v))}
  ${R('Ripens', v => esc(seasonName(v)) + (v.season.harvest ? `<br><span class="muted small">${esc(v.season.harvest)}</span>` : ''))}
  ${R('Best eaten', v => v.season.eating ? esc(v.season.eating) : null)}
  ${R('Storage', v => v.season.storage_weeks != null ? v.season.storage_weeks + ' weeks' : null)}
  ${R('Flavour', v => chips((v.taste.tags || []).slice(0, 5)))}
  ${R('Sweetness', v => bar(v.taste.sweet))}${R('Acidity', v => bar(v.taste.acid, 5, 'gold'))}${R('Aroma', v => bar(v.taste.aroma, 5, 'leaf'))}${R('Crispness', v => bar(v.taste.crisp))}
  ${R('Flowering group', v => v.pollination.flower_group != null ? v.pollination.flower_group : null)}
  ${R('Self-fertile', v => v.pollination.self_fertile ? esc(v.pollination.self_fertile) : null)}
  ${R('Ploidy', v => v.tree.ploidy ? esc(v.tree.ploidy) : null)}
  ${R('Tree vigour', v => meter(v.tree.vigor))}${R('Early cropping', v => meter(v.tree.precocity))}
  ${R('Bearing', v => v.tree.bearing ? esc(v.tree.bearing) : null)}${R('Cropping', v => v.tree.cropping ? esc(v.tree.cropping) : null)}
  ${R('Winter chill', v => v.climate.chill_hours != null ? '~' + v.climate.chill_hours.toLocaleString('en-US') + ' h' : null)}
  ${R('Hardiness zone', v => v.climate.hardiness_zone != null ? 'zone ' + v.climate.hardiness_zone : null)}
  ${R('Heat tolerance', v => meter(v.climate.heat_tolerance))}
  ${R('Scab', v => meter(v.health.scab, true))}${R('Canker', v => meter(v.health.canker, true))}${R('Mildew', v => meter(v.health.mildew, true))}${R('Fire blight', v => meter(v.health.fire_blight, true))}
  </tbody></table></div><p class="tiny muted">Disease meters: more filled = more susceptible.</p></section>`;
  app.querySelector('#clear').onclick = () => { setFavs([]); renderFavourites(app); };
  app.querySelector('#share').onclick = async () => { try { await navigator.clipboard.writeText(link); toast('Link copied'); } catch (e) { prompt('Copy this link', link); } };
  app.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { toggleFav(b.dataset.rm); renderFavourites(app); });
}
