// Single-variety page.
import { S, esc, countryName, pollinators, similar, chillClass, seasonName, tagLabel, isFav, loadFlavour, tasteReportURL } from '../data.js';
import { appleSVG, bar, meter, chips, evChips, usesBadges, favBtn, keepersBadge, breederBadge, radar, seasonTimeline, scoreRing, DISEASES } from './widgets.js';
import { scoreVariety, labelOf } from '../score/score.js';
import { renderGrowHere } from './growhere.js';

const CONF = { high: ['High', 'Verified against several independent sources.'], medium: ['Medium', 'Broadly documented; some fields are inferred from season, parentage or origin.'], low: ['Low', 'Sparsely documented. Core facts only; many fields are unrecorded or estimated.'] };
const VIGOR = ['', 'very weak', 'weak', 'moderate', 'vigorous', 'very vigorous'];
const PREC = ['', 'slow (6+ years)', 'slowish (4-5 years)', 'average (3-4 years)', 'early (2-3 years)', 'very early (2 years)'];
const HEAT = ['', 'poor in hot summers', 'below average', 'average', 'good', 'excellent'];
const na = '<span class="muted">not recorded</span>';
const val = (x, f = (y => esc(y))) => x == null || x === '' ? na : f(x);

function rootstockAdvice(v) {
  const tr = v.tree, bits = [];
  if (tr.vigor != null && tr.vigor <= 2) bits.push('A weak-growing variety: avoid very dwarfing stocks (M.27) and prefer M.26 or a semi-vigorous stock such as MM.106, on good soil, so it does not stall.');
  else if (tr.vigor != null && tr.vigor >= 4) bits.push('A strong grower: M.9 or M.26 will keep it to a manageable size and bring cropping forward; on vigorous stocks (MM.111, M.25) expect a big, slow-to-crop tree.');
  else if (tr.vigor != null) bits.push('Average vigour: it suits any of the common stocks, so choose by the tree size you want.');
  if (tr.bearing === 'tip' || tr.bearing === 'part-tip') bits.push('Tip-bearing habit: a semi-vigorous or vigorous stock gives it room to bear on the ends of the shoots; avoid hard pruning.');
  if (tr.ploidy === 'triploid') bits.push('Triploids are vigorous: a dwarfing stock (M.9, M.26) is usually best.');
  if (v.health && v.health.fire_blight != null && v.health.fire_blight >= 4) bits.push('Susceptible to fire blight: where blight is common choose a resistant stock (G.11, G.41, G.935, G.210) rather than M.9 or M.26.');
  if (!bits.length) return '';
  return `<h4 style="margin-top:12px">Rootstock pairing</h4><p class="small">${bits.map(esc).join(' ')} <a href="#/rootstocks">Compare rootstocks &rarr;</a></p>`;
}

const toneN = n => n >= 70 ? 'good' : n >= 55 ? 'ok' : n >= 35 ? 'warn' : 'bad';
function pairNums(s) {
  return `<b class="tone-${toneN(s.score)}" title="climate score">${s.score}</b>${s.disease ? `<b class="tone-${toneN(s.disease.score)} dnum" title="disease score">${s.disease.score}</b>` : ''}`;
}
function kv(rows) { return `<dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`; }

export function regionScores(v) {
  const out = [];
  if (!S.ctx) return out;
  for (const r of S.data.regions) {
    const F = S.presets[r.id];
    if (!F || F.error) continue;
    const s = scoreVariety(v, F, S.ctx);
    out.push({ r, s });
  }
  return out.sort((a, b) => b.s.both - a.s.both || b.s.score - a.s.score);
}

const NEEDS = { cool: 'Flavour is best in a cool climate', warm: 'Needs a warm season for full flavour', any: 'Climate' };
function tasteExtras(v) {
  const t = v.taste, out = [];
  if (t.measured && (t.measured.ssc != null || t.measured.ta != null)) {
    const m = t.measured, pc = (x, w) => x == null ? '' : ` <span class="muted">(${w} than ${Math.round(x)}% of the apples measured)</span>`;
    out.push(`<div class="measured"><b>Measured</b> ${m.ssc != null ? `<span>sugar <b>${m.ssc}</b> °Brix${pc(m.pct_ssc, 'sweeter')}</span>` : ''}${m.ta != null ? `<span>acidity <b>${m.ta}</b> g/L malic${pc(m.pct_ta, 'sharper')}</span>` : ''}<span class="tiny muted">from ${m.n} lab dataset${m.n === 1 ? '' : 's'} — <a href="#evidence" data-jump>details</a></span></div>`);
  }
  if (t.panel) {
    const p = t.panel, f = (l, x) => x == null ? '' : `<span>${l} <b>${x}</b>/9</span>`;
    out.push(`<div class="measured"><b>Expert tasting</b>${f('sweetness', p.sweet)}${f('acidity', p.acid)}${f('aroma', p.aroma)}${f('juiciness', p.juice)}${f('eating quality', p.quality)}<span class="tiny muted">National Fruit Collection, Brogdale; one assessor${p.tasted ? ', tasted ' + esc(p.tasted) : ''}; 5 = medium</span></div>`);
  }
  if (t.peak) out.push(`<p class="small"><b>Best:</b> ${esc(t.peak)}</p>`);
  if (t.storage_change) out.push(`<p class="small"><b>In store:</b> ${esc(t.storage_change)}</p>`);
  if (t.climate_flavour) out.push(`<p class="small"><b>${esc(NEEDS[t.climate_flavour.needs] || 'Climate')}:</b> ${esc(t.climate_flavour.note || '')}</p>`);
  if (t.visitors) {
    const vs = t.visitors, top = Object.entries(vs.tags || {}).filter(([, n]) => n >= 2).slice(0, 5).map(([k]) => tagLabel(k));
    out.push(`<p class="small"><b>Visitors' tastings (${vs.n}):</b> sweetness ${vs.sweet ?? '–'}/5, sharpness ${vs.acid ?? '–'}/5, aroma ${vs.aroma ?? '–'}/5${top.length ? '; most noticed ' + top.map(esc).join(', ') : ''}.</p>`);
  }
  return out.join('');
}

function evidenceHTML(v, D) {
  if (!D) return `<p class="small muted">No sources recorded yet for ${esc(v.name)}; its flavour notes are unverified.</p>`;
  const parts = [];
  parts.push(`<p class="small muted">Each flavour note is counted once per independent source (an author or an organisation); the small numbers on the tags show the count. <a href="#/flavour">How this works &rarr;</a></p>`);
  if (D.sources.length) {
    parts.push(`<h4>Who says what</h4><div class="srclist">${D.sources.map(s => `<div class="src"><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a> <span class="tiny muted">${({ book: 'book', web: 'web', panel: 'tasting scores' })[s.kind] || ''}</span><div>${s.tags.length ? chips(s.tags) : '<span class="tiny muted">no specific flavour notes</span>'}</div>${s.words && s.words.length ? `<div class="tiny muted">their words: ${s.words.map(esc).join(', ')}</div>` : ''}</div>`).join('')}</div>`);
  }
  const added = D.added || [], unv = D.unverified || [], con = D.contested || [];
  if (added.length || unv.length || con.length) {
    parts.push(`<p class="small">${added.length ? `<b>Added from the sources:</b> ${added.map(x => esc(tagLabel(x))).join(', ')}. ` : ''}${unv.length ? `<b>Dropped (no source supports it):</b> ${unv.map(x => esc(tagLabel(x))).join(', ')}. ` : ''}${con.length ? `<b>Dropped (contradicted):</b> ${con.map(x => esc(tagLabel(x))).join(', ')}.` : ''}</p>`);
  }
  if (D.books.length) {
    parts.push(`<h4>In the old books</h4>` + D.books.map(b => `<div class="book">
      <div><b>${esc(b.author)}</b>, <i>${esc(b.title)}</i> (${b.year})${b.page ? `, p. ${b.page}` : ''} — <a href="${esc(b.link)}" target="_blank" rel="noopener">see the page &#8599;</a>${b.match === 'probable' ? ' <span class="tiny muted">(probably the same apple)</span>' : b.match === 'synonym' && b.heading ? ` <span class="tiny muted">(as ${esc(b.heading)})</span>` : ''}</div>
      ${b.quality ? `<div class="small">Verdict: <q>${esc(b.quality)}</q></div>` : ''}
      ${b.flavour ? `<blockquote>${esc(b.flavour)}${b.flavour_en ? `<div class="small muted">${esc(b.flavour_en)}</div>` : ''}</blockquote>` : ''}
      ${b.storage ? `<div class="small">Keeping: <q>${esc(b.storage)}</q></div>` : ''}
      ${b.climate ? `<div class="small">Situation: <q>${esc(b.climate)}</q></div>` : ''}
      ${b.note ? `<div class="tiny muted">${esc(b.note)}</div>` : ''}
      <details><summary class="small">Full entry (scanned text, may contain errors)</summary><div class="small entry">${esc(b.text).replace(/\n\n/g, '<br><br>')}</div></details>
    </div>`).join(''));
  }
  if (D.chemistry.length) {
    parts.push(`<h4>Lab measurements</h4><div class="tblwrap"><table class="tbl small"><tr><th>Source</th><th>Sugar (°Brix)</th><th>Acidity (g/L)</th><th>Firmness</th><th>Samples</th></tr>${D.chemistry.map(c => `<tr><td><a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.title || c.source)}</a>${c.where ? `<div class="tiny muted">${esc(c.where)}${c.stage ? ', at ' + esc(c.stage) : ''}</div>` : ''}</td><td>${c.ssc ?? '–'}</td><td>${c.ta ?? '–'}</td><td>${c.firmness != null ? c.firmness + ' ' + esc(c.firmness_units || '') : '–'}</td><td>${c.n ?? ''}</td></tr>`).join('')}</table></div>`);
  }
  if (D.notes) parts.push(`<p class="tiny muted">Research notes: ${esc(D.notes)}</p>`);
  return parts.join('');
}

export function renderVariety(app, id) {
  const v = S.byId.get(id);
  if (!v) { app.innerHTML = `<div class="empty"><h2>Variety not found</h2><p><a href="#/">Back to all varieties</a></p></div>`; return; }
  const t = v.taste, tr = v.tree, po = v.pollination, c = v.climate, h = v.health, o = v.origin, L = v.look;
  const partners = pollinators(v);
  const sim = similar(v);
  const rs = regionScores(v);
  const best = rs.slice(0, 8), worst = rs.slice(-4).reverse();
  const conf = CONF[v.conf] || CONF.low;
  const triploid = tr.ploidy === 'triploid';
  const cc = chillClass(c.chill_hours);

  const originLine = [o.place, o.year ? (o.year_note ? o.year_note + ' ' : '') + o.year : null].filter(Boolean).join(', ') || (o.country ? countryName(o.country) : 'Origin unknown');
  const keepersLink = v.keepers && v.keepers.listed ? `<a class="btn sm" href="${esc(v.keepers.url)}" target="_blank" rel="noopener">Buy / details at Keepers Nursery &#8599;</a>` : '';
  const wiki = `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(v.name + ' apple')}`;

  app.innerHTML = `
  <p class="crumb"><a href="#/">&larr; All varieties</a></p>
  <section class="vhead">
    ${appleSVG(v, 132)}
    <div>
      <h1 style="margin-bottom:.15em">${esc(v.name)}</h1>
      ${(v.aka && v.aka.length) ? `<div class="sub">also known as ${v.aka.map(esc).join(', ')}</div>` : ''}
      <div style="margin:8px 0">${usesBadges(v)}${keepersBadge(v)}${breederBadge(v)}<span class="badge">${esc(seasonName(v))}</span>${triploid ? '<span class="badge">triploid</span>' : ''}</div>
      <div class="sub">${esc(originLine)}${o.country ? ' &middot; ' + esc(countryName(o.country)) : ''}</div>
      <div class="row" style="margin-top:10px">
        <button class="btn primary" data-fav-big="${esc(v.id)}">${isFav(v.id) ? '♥ In favourites' : '♡ Add to favourites'}</button>
        <a class="btn" href="#/map?f=${esc(v.id)}">See it on the map</a>${keepersLink}
      </div>
    </div>
  </section>

  ${v.conf === 'low' ? `<div class="note warn"><b>Sparsely documented.</b> We found little reliable information about ${esc(v.name)}; fields shown as "not recorded" are unknown rather than zero, and climate scores for it use assumed values (marked as such).</div>` : ''}
  <div class="sections">
    <section class="card pad wide">
      <h2>Taste</h2>
      <div class="taste-grid">
        <div style="justify-self:center">${radar(t)}</div>
        <div>
          ${t.summary ? `<p class="quote">${esc(t.summary)}</p>` : ''}
          <div data-chips>${evChips(t)}</div>
          ${(t.unverified || []).length ? `<p class="tiny muted" style="margin-top:4px">Not confirmed by any source we found: ${t.unverified.map(x => esc(tagLabel(x))).join(', ')}</p>` : ''}
          <p class="tiny muted" style="margin-top:4px">${t.n_sources ? `Flavour notes checked against ${t.n_sources} independent source${t.n_sources === 1 ? '' : 's'}${t.n_books ? `, including ${t.n_books} old book${t.n_books === 1 ? '' : 's'}` : ''}. <a href="#evidence" data-jump>See them</a>` : 'No independent sources recorded yet; these flavour notes are unverified.'}</p>
          <div style="display:grid;grid-template-columns:90px 1fr;gap:5px 10px;margin-top:10px;font-size:.88rem;align-items:center">
            ${[['Sweetness', t.sweet, ''], ['Acidity', t.acid, 'gold'], ['Aroma', t.aroma, 'leaf'], ['Crispness', t.crisp, ''], ['Juiciness', t.juicy, ''], ['Tannin', t.tannin, 'gold']].map(([l, x, cl]) => (l === 'Tannin' && !(x > 0)) ? '' : `<span class="muted">${l}</span>${bar(x, 5, cl)}`).join('')}
          </div>
          ${t.cider_class ? `<p class="small" style="margin-top:8px"><b>Cider class:</b> ${esc(t.cider_class)}</p>` : ''}
          ${t.best_eaten ? `<p class="small muted" style="margin-top:8px">${esc(t.best_eaten)}</p>` : ''}
          ${tasteExtras(v)}
          <p style="margin-top:10px"><a class="btn sm" href="${esc(tasteReportURL(v))}" target="_blank" rel="noopener">Tasted it? Report your tasting &#8599;</a> <span class="tiny muted">a short form on GitHub (free account needed)</span></p>
        </div>
      </div>
    </section>

    <section class="card pad wide" id="here">
      <h2>Grow it where you are</h2>
      <div data-here></div>
    </section>

    <section class="card pad wide" id="evidence">
      <h2>Flavour: the evidence</h2>
      <div data-evidence><p class="small muted">Loading sources&hellip;</p></div>
    </section>

    <section class="card pad">
      <h2>Growing habit</h2>
      ${kv([
        ['Tree vigour', val(tr.vigor, x => `${meter(x)} <span class="small muted">${VIGOR[x]}</span>`)],
        ['Habit', val(tr.habit)],
        ['Bearing', val(tr.bearing, x => x === 'spur' ? 'Spur-bearer' : x === 'tip' ? 'Tip-bearer (prune lightly)' : 'Part-tip bearer')],
        ['Cropping', val(tr.cropping, x => esc(x))],
        ['Biennial bearing', val(tr.biennial, x => x === 'none' ? 'No tendency' : x === 'slight' ? 'Slight tendency' : 'Marked tendency')],
        ['Precocity', val(tr.precocity, x => `${meter(x)} <span class="small muted">${PREC[x]}</span>`)],
        ['Ploidy', val(tr.ploidy)],
      ])}
      ${tr.notes ? `<p class="small" style="margin-top:10px">${esc(tr.notes)}</p>` : ''}
      ${rootstockAdvice(v)}
    </section>

    <section class="card pad">
      <h2>Pollination</h2>
      ${kv([
        ['Flowering group', val(po.flower_group, x => `<b>${x}</b> <span class="small muted">(1 earliest – 7 latest; Cox is 3)</span>`)],
        ['Self-fertile?', val(po.self_fertile, x => x === 'yes' ? 'Yes' : x === 'partial' ? 'Partly' : 'No – needs a partner')],
      ])}
      ${po.notes ? `<p class="small" style="margin-top:10px">${esc(po.notes)}</p>` : ''}
      ${triploid ? `<div class="note warn"><b>Triploid.</b> Its pollen is sterile, so it cannot pollinate others and needs <b>two</b> different compatible diploid varieties nearby to crop.</div>` : ''}
      ${partners.length ? `<h4 style="margin-top:12px">Likely partners</h4><div>${partners.map(p => `<a class="chip" href="#/v/${esc(p.id)}">${esc(p.name)} <span class="muted">(${p.pollination.flower_group})</span></a>`).join('')}</div><p class="tiny muted">Same or adjacent flowering group, diploid. Always check for known incompatibilities before buying.</p>` : ''}
    </section>

    <section class="card pad">
      <h2>Season &amp; storage</h2>
      ${seasonTimeline(v)}
      ${kv([['Picking (SE England)', val(v.season.harvest)], ['Storage life', val(v.season.storage_weeks, x => `about ${x} week${x === 1 ? '' : 's'} in cool store`)]])}
    </section>

    <section class="card pad">
      <h2>Climate needs</h2>
      ${kv([
        ['Winter chill', val(c.chill_hours, x => `~${x.toLocaleString('en-US')} h <span class="small muted">(${cc} chill)</span>`)],
        ['Hardiness', val(c.hardiness_zone, x => `USDA zone ${x} <span class="small muted">(≈ ${[-45, -40, -34, -29, -23, -18, -12, -7, -1, 4][Math.max(0, Math.min(9, x - 1))]} °C or colder minimum)</span>`)],
        ['Heat tolerance', val(c.heat_tolerance, x => `${meter(x)} <span class="small muted">${HEAT[x]}</span>`)],
        ['Colour', c.colour_needs_cool_nights == null ? na : (c.colour_needs_cool_nights ? 'Needs cool autumn nights to colour well' : 'Colours reliably even in warm nights')],
      ])}
      ${c.best_climates ? `<p class="small" style="margin-top:10px"><b class="tone-good">Thrives:</b> ${esc(c.best_climates)}</p>` : ''}
      ${c.poor_climates ? `<p class="small"><b class="tone-bad">Struggles:</b> ${esc(c.poor_climates)}</p>` : ''}
    </section>

    <section class="card pad">
      <h2>Health</h2>
      <p class="tiny muted" style="margin-top:-6px">Susceptibility: <b>fewer</b> filled segments is better.</p>
      <dl class="kv">${DISEASES.map(([k, l]) => `<dt>${l}</dt><dd>${meter(h[k], true, l)}</dd>`).join('')}</dl>
      ${h.other ? `<p class="small" style="margin-top:10px">${esc(h.other)}</p>` : ''}
    </section>

    <section class="card pad">
      <h2>The fruit</h2>
      ${kv([
        ['Size', val(L.size)], ['Shape', val(L.shape)], ['Skin', val(L.description)],
        ['Origin', esc(originLine)], ['Parentage', val(o.parentage)], ['Raised by', val(o.raised_by)],
      ])}
    </section>

    <section class="card pad">
      <h2>History</h2>
      <p>${val(v.history)}</p>
      <h4>Growing notes</h4>
      <p>${val(v.grow_notes)}</p>
    </section>

    ${rs.length ? `<section class="card pad wide">
      <h2>Where in the world it does well</h2>
      <p class="small muted">Scored against the climate of ${rs.length} reference places (real weather, 2015–2024): the first number is the climate score, the second the disease score, ranked by the lower of the two. Click one to see why; or <a href="#/map?f=${esc(v.id)}">open the full map</a> and click anywhere.</p>
      <h4>Best matches</h4>
      <div class="region-list">${best.map(({ r, s }) => `<a href="#/map/${esc(r.id)}?f=${esc(v.id)}"><span>${esc(r.name)}</span>${pairNums(s)}</a>`).join('')}</div>
      <h4 style="margin-top:14px">Hardest places</h4>
      <div class="region-list">${worst.map(({ r, s }) => `<a href="#/map/${esc(r.id)}?f=${esc(v.id)}"><span>${esc(r.name)}</span>${pairNums(s)}</a>`).join('')}</div>
    </section>` : ''}

    ${sim.length ? `<section class="card pad wide">
      <h2>If you like this, try…</h2>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(210px,1fr))">${sim.map(o => `<a class="vcard card" href="#/v/${esc(o.id)}" style="padding:10px 12px"><div class="top-row">${appleSVG(o, 44)}<div><h3 style="font-size:1rem">${esc(o.name)}</h3><div class="sub">${esc(seasonName(o))}</div></div></div><div>${chips((o.taste.tags || []).slice(0, 3))}</div></a>`).join('')}</div>
    </section>` : ''}

    <section class="card pad wide">
      <div class="row">
        <div><b>Data confidence: ${conf[0]}</b> <span class="small muted">${conf[1]}</span></div>
        <div class="spacer"></div>
        <a class="btn sm" href="${esc(wiki)}" target="_blank" rel="noopener">Search Wikipedia &#8599;</a>
      </div>
    </section>
  </div>`;
  // the hash router owns '#...', so in-page jumps scroll instead of navigating
  app.querySelectorAll('[data-jump]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); app.querySelector('#evidence').scrollIntoView({ behavior: 'smooth' }); }));
  renderGrowHere(app.querySelector('[data-here]'), v);
  loadFlavour().then(F => {
    const el = app.querySelector('[data-evidence]');
    if (!el || !el.isConnected) return;
    el.innerHTML = F ? evidenceHTML(v, F.varieties[v.id]) : '<p class="small muted">Could not load the source data.</p>';
    const c = app.querySelector('[data-chips]');
    if (F && c) c.innerHTML = evChips(t);          // re-render with vocabulary tooltips
  });
}
