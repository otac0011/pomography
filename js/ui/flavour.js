// Flavour page: how taste notes are sourced, the sweet/sharp map from lab data, the flavour vocabulary and the library.
import { S, esc, loadFlavour, FLAVOUR_FAMILIES, tagLabel, getFavs, LEVEL, REPO } from '../data.js';

function scatter(vs) {
  const W = 640, H = 420, P = 44, favs = new Set(getFavs());
  const x = p => P + (W - 2 * P) * p / 100, y = p => H - P - (H - 2 * P) * p / 100;
  const pts = vs.map(v => {
    const m = v.taste.measured, fav = favs.has(v.id);
    return `<a href="#/v/${esc(v.id)}"><circle class="pt" tabindex="0" cx="${x(m.pct_ssc).toFixed(1)}" cy="${y(m.pct_ta).toFixed(1)}" r="${fav ? 6 : 4}" fill="${fav ? 'var(--accent)' : 'color-mix(in srgb, var(--leaf) 75%, transparent)'}"><title>${esc(v.name)}: sugar ${m.ssc ?? '–'} °Brix, acidity ${m.ta ?? '–'} g/L</title></circle>${fav ? `<text x="${(x(m.pct_ssc) + 8).toFixed(1)}" y="${(y(m.pct_ta) + 4).toFixed(1)}" font-size="11" fill="var(--ink)">${esc(v.name)}</text>` : ''}</a>`;
  }).join('');
  const q = [['Sweet & sharp', 75, 92], ['Sharp', 12, 92], ['Sweet & mild', 75, 6], ['Mild', 12, 6]]
    .map(([t, a, b]) => `<text x="${x(a)}" y="${y(b)}" font-size="12" fill="var(--muted)" text-anchor="middle">${t}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Measured sugar and acidity of ${vs.length} apples">
    <rect x="${P}" y="${P}" width="${W - 2 * P}" height="${H - 2 * P}" fill="none" stroke="var(--line)"/>
    <line x1="${x(50)}" y1="${P}" x2="${x(50)}" y2="${H - P}" stroke="var(--line)" stroke-dasharray="4 4"/>
    <line x1="${P}" y1="${y(50)}" x2="${W - P}" y2="${y(50)}" stroke="var(--line)" stroke-dasharray="4 4"/>
    ${q}${pts}
    <text x="${W / 2}" y="${H - 10}" text-anchor="middle" font-size="12" fill="var(--ink)">sweeter &rarr; (sugar, percentile among measured apples)</text>
    <text x="14" y="${H / 2}" text-anchor="middle" font-size="12" fill="var(--ink)" transform="rotate(-90 14 ${H / 2})">sharper &rarr; (acidity percentile)</text>
  </svg>`;
}

export function renderFlavour(app) {
  app.innerHTML = `<h1>Flavour</h1><p class="muted">Loading the sources&hellip;</p>`;
  loadFlavour().then(F => {
    if (!app.isConnected) return;
    F = F || { books: [], vocab: {}, chemistry_sources: [], varieties: {} };
    const vs = S.data.varieties;
    const measured = vs.filter(v => v.taste.measured && v.taste.measured.pct_ssc != null && v.taste.measured.pct_ta != null);
    const lv = { firm: 0, supported: 0, reported: 0, unsourced: 0 };
    let dropped = 0, added = 0;
    for (const v of vs) {
      for (const tg of v.taste.tags || []) lv[LEVEL((v.taste.support || {})[tg] ?? 0)[0]]++;
      dropped += (v.taste.unverified || []).length;
    }
    for (const d of Object.values(F.varieties)) added += (d.added || []).length;
    const bookCount = {};
    for (const d of Object.values(F.varieties)) for (const b of d.books) bookCount[b.book] = (bookCount[b.book] || 0) + 1;
    const voc = (F.vocab && F.vocab.tags) || {}, refs = Object.fromEntries(((F.vocab && F.vocab.references) || []).map(r => [r.id, r]));
    const tagCount = {};
    for (const v of vs) for (const tg of v.taste.tags || []) tagCount[tg] = (tagCount[tg] || 0) + 1;

    app.innerHTML = `
    <h1>Flavour</h1>
    <p class="lead">How does an apple <i>taste</i>? Descriptions on the web are often copied from one another, so Pomography
    checks each flavour note against <b>independent sources</b>: the classic public-domain pomologies (Hogg, Bunyard,
    Beach, Downing, Leroy and others), today's growers and collections, laboratory measurements of sugar and acid, and
    visitors' own tastings.</p>
    <div class="sections">
      <section class="card pad wide">
        <h2>How sure is each note?</h2>
        <p>On every variety page the small number on a flavour tag is how many independent sources (an author or an
        organisation, counted once however many books or pages it wrote) use that word or a clear synonym.</p>
        <p><span class="chip flav ev-firm">nutty<sup>3</sup></span> firm — three or more sources &nbsp;
        <span class="chip flav ev-supported">nutty<sup>2</sup></span> supported &nbsp;
        <span class="chip flav ev-reported">nutty<sup>1</sup></span> reported by one source &nbsp;
        <span class="chip flav ev-unsourced">nutty</span> not yet checked</p>
        <p class="small">A note is <b>dropped</b> when the variety has two or more sources and none supports it, or when more
        sources contradict it than support it. A note we did not have is <b>added</b> when two independent sources agree.
        Right now: ${lv.firm} firm, ${lv.supported} supported, ${lv.reported} reported and ${lv.unsourced} unchecked tags;
        ${dropped} dropped and ${added} added. <a href="https://github.com/${REPO}/blob/main/docs/flavour-audit.md" target="_blank" rel="noopener">Full audit &#8599;</a></p>
      </section>

      <section class="card pad wide fmap">
        <h2>Sweet or sharp? Measured</h2>
        ${measured.length ? `<p class="small muted">${measured.length} varieties with laboratory measurements of soluble solids (sugar, °Brix) and titratable acidity.
        Positions are percentiles within each dataset, because labs measure at different ripeness and in different ways. Your favourites are labelled. Click a dot to open the apple.</p>
        ${scatter(measured)}
        <p class="tiny muted">Sources: ${(F.chemistry_sources || []).map(c => `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.title)}</a> (${esc(c.where || '')}, ${c.year})`).join('; ')}.</p>`
        : '<p class="muted">No laboratory data loaded yet.</p>'}
      </section>

      ${(F.panel_sources || []).length ? `<section class="card pad wide">
        <h2>Expert tasting scores</h2>
        <p class="small">${(F.panel_sources || []).map(p => `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a> (${esc(p.authors || '')}, ${p.year}): sweetness, acidity, aroma, juiciness and eating quality on 1-9 scales (5 = medium), each apple tasted at eating ripeness by one experienced assessor at Brogdale. Shown on ${vs.filter(v => v.taste.panel).length} variety pages. <span class="tiny muted">${esc(p.attribution || '')}</span>`).join('<br>')}</p>
      </section>` : ''}

      <section class="card pad wide">
        <h2>The flavour words</h2>
        <p class="small muted">What each tag means, the words sources use for it, and, where research has identified them, the aroma compounds behind it.</p>
        ${FLAVOUR_FAMILIES.map(([fam, tags]) => `<h3 style="margin-top:14px">${esc(fam)}</h3><div class="vocab">${tags.map(tg => {
          const d = voc[tg] || {};
          return `<div class="card"><h4><a href="#/?tag=${esc(tg)}">${esc(d.label || tagLabel(tg))}</a> <span class="tiny muted">${tagCount[tg] || 0} apples</span></h4>
            ${d.definition ? `<div>${esc(d.definition)}</div>` : ''}
            ${(d.synonyms || []).length ? `<div class="tiny muted" style="margin-top:4px">Also written: ${d.synonyms.map(esc).join(', ')}</div>` : ''}
            ${(d.compounds || []).length ? `<div class="tiny" style="margin-top:4px">Chemistry: ${d.compounds.map(c => `${esc(c.name)}${c.role ? ' (' + esc(c.role) + ')' : ''}${c.ref && refs[c.ref] ? ` <a href="${esc(refs[c.ref].url || '#')}" target="_blank" rel="noopener">[${c.ref}]</a>` : ''}`).join('; ')}</div>` : ''}
            ${d.note ? `<div class="tiny muted" style="margin-top:4px">${esc(d.note)}</div>` : ''}</div>`;
        }).join('')}</div>`).join('')}
        ${Object.keys(refs).length ? `<h4 style="margin-top:16px">References</h4><ol class="small">${Object.values(refs).map(r => `<li value="${r.id}">${esc(r.authors)} (${r.year}). ${esc(r.title)}. <i>${esc(r.journal || '')}</i>. ${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">link</a>` : ''}</li>`).join('')}</ol>` : ''}
      </section>

      <section class="card pad wide">
        <h2>The library</h2>
        <p class="small">These books are out of copyright, so their descriptions are quoted in full on each variety page
        (open "Flavour: the evidence"). The complete texts and scans are kept in the project's
        <a href="https://github.com/${REPO}/tree/main/library" target="_blank" rel="noopener">library</a>.</p>
        <div class="tblwrap"><table class="tbl small"><tr><th>Book</th><th>Our apples described</th><th>Read</th></tr>
        ${(F.books || []).map(b => `<tr><td><b>${esc(b.author)}</b>, <i>${esc(b.title)}</i> (${b.year})${b.note ? `<div class="tiny muted">${esc(b.note)}</div>` : ''}</td><td>${bookCount[b.key] || '–'}</td><td><a href="${esc(b.archive_org)}" target="_blank" rel="noopener">scan</a>${b.gutenberg ? ` · <a href="${esc(b.gutenberg)}" target="_blank" rel="noopener">text</a>` : ''}</td></tr>`).join('')}
        </table></div>
      </section>

      <section class="card pad wide">
        <h2>Your tastings</h2>
        <p class="small">Tasted one of these apples? Every variety page has a <b>Report your tasting</b> button: a short form
        (sweetness, sharpness, aroma, texture, flavours you noticed, where it grew and how long it was stored). Reports
        are public GitHub issues; once three or more exist for a variety, a summary appears on its page. Flavour changes
        with ripeness, storage and climate, so where and when you ate it matters as much as what you tasted.</p>
        <p><a class="btn sm" href="https://github.com/${REPO}/issues?q=label%3Ataste-report" target="_blank" rel="noopener">See all reports &#8599;</a></p>
      </section>
    </div>`;
  });
}
