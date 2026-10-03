// Small reusable visual pieces: procedural apple portraits, bars, radar, timelines, score rings.
import { esc, eatingMonths, tagLabel, isFav } from '../data.js';

const GROUND = { green: '#86ae4a', 'yellow-green': '#b4c357', yellow: '#e6d15a', gold: '#e2b03d', cream: '#eee2b4' };
const BLUSH = { pink: '#e8909c', orange: '#ec9a4c', 'orange-red': '#d8552f', red: '#c0302c', 'deep-red': '#8e1d24', crimson: '#a2133b', purple: '#6c2f58', brown: '#8d5632' };
const BODY = 'M50 27C32 15 9 30 12 57C15 82 33 95 50 90C67 95 85 82 88 57C91 30 68 15 50 27Z';
const CONE = 'M50 27C32 15 10 28 12 50C14 72 34 96 50 94C66 96 86 72 88 50C90 28 68 15 50 27Z';
const SHAPE = {
  'flat': { p: BODY, t: 'translate(0 14) scale(1 .8)' }, 'round-flat': { p: BODY, t: 'translate(0 7) scale(1 .9)' }, 'round': { p: BODY, t: '' },
  'round-conical': { p: CONE, t: 'translate(0 2) scale(1 .96)' }, 'conical': { p: CONE, t: 'translate(11 0) scale(.78 1)' },
  'oblong': { p: BODY, t: 'translate(6 -6) scale(.88 1.1)' }, 'ribbed': { p: CONE, t: 'translate(0 3) scale(1 .94)' }, 'irregular': { p: BODY, t: 'rotate(-5 50 60)' },
};
let uid = 0;

/** Apple portrait from a variety's `look` block. size in px. */
export function appleSVG(v, size = 64) {
  const L = v.look || {}, id = 'ap' + (++uid);
  const sh = SHAPE[L.shape] || SHAPE.round;
  const ground = GROUND[L.ground] || '#cdbf6a';
  const russet = L.russet || 0;
  const small = L.size === 'small', med = L.size === 'large' ? 1 : L.size === 'small' ? .78 : .92;
  const blush = BLUSH[L.blush];
  const cover = blush ? Math.max(0, Math.min(100, L.blush_cover ?? 40)) : 0;
  let layers = '';
  layers += `<rect width="100" height="100" fill="${ground}"/>`;
  if (blush && cover > 0) {
    const solid = cover >= 85 && !L.stripes;
    if (L.stripes) {
      const c = Math.max(.12, Math.min(.95, cover / 100));
      const xs = Array.from({ length: 17 }, (_, i) => 4 + i * 6.2);
      layers += `<defs><linearGradient id="${id}g" x1="0.92" y1="0.1" x2="0.08" y2="0.9"><stop offset="0" stop-color="#fff"/><stop offset="${Math.min(.97, c + .08)}" stop-color="#000"/></linearGradient><mask id="${id}m"><rect width="100" height="100" fill="url(#${id}g)"/></mask></defs>` +
        `<g mask="url(#${id}m)"><rect width="100" height="100" fill="${blush}" opacity="${(.18 + c * .3).toFixed(2)}"/>` +
        `<g stroke="${blush}" stroke-width="2.4" opacity=".78" fill="none" stroke-linecap="round">` +
        xs.map((x, i) => `<path d="M${x + (i % 3) * .8} ${14 + (i % 4) * 2}C${x - 7} 42 ${x + 6} 66 ${x - 3} 96"/>`).join('') + '</g></g>';
    } else if (solid) {
      layers += `<rect width="100" height="100" fill="${blush}"/>`;
    } else {
      const r = 28 + cover * .62;
      layers += `<defs><radialGradient id="${id}b" cx="68%" cy="42%" r="${r}%"><stop offset="0" stop-color="${blush}" stop-opacity=".95"/><stop offset=".7" stop-color="${blush}" stop-opacity=".8"/><stop offset="1" stop-color="${blush}" stop-opacity="0"/></radialGradient></defs><rect width="100" height="100" fill="url(#${id}b)"/>`;
    }
  }
  if (russet) {
    const op = [0, .28, .55, .9][russet];
    layers += `<defs><pattern id="${id}r" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.5" fill="#7b5a2c"/><circle cx="6.5" cy="6" r="1.2" fill="#8a6934"/><circle cx="5" cy="1" r=".8" fill="#6d4f26"/></pattern></defs>`;
    layers += `<rect width="100" height="100" fill="#9a7440" opacity="${russet === 3 ? .75 : russet === 2 ? .25 : 0}"/><rect width="100" height="100" fill="url(#${id}r)" opacity="${op}"/>`;
  }
  layers += `<ellipse cx="34" cy="40" rx="11" ry="17" fill="#fff" opacity=".2" transform="rotate(25 34 40)"/>`;
  const s = size;
  return `<svg class="apple" viewBox="0 0 100 100" width="${s}" height="${s}" role="img" aria-label="${esc(v.name)} apple" style="flex:none">
  <defs><clipPath id="${id}c"><path d="${sh.p}" transform="${sh.t}"/></clipPath></defs>
  <g transform="translate(50 56) scale(${med}) translate(-50 -56)">
    <g clip-path="url(#${id}c)">${layers}</g>
    <path d="${sh.p}" transform="${sh.t}" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="1.4"/>
    <path d="M50 30C49 22 51 15 56 10" stroke="#6b4a2b" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M54 17C60 9 70 10 73 12C70 20 61 22 54 17Z" fill="#4a7a38" opacity="${small ? .9 : 1}"/>
  </g></svg>`;
}

export function bar(val, max = 5, cls = '') {
  const p = val == null ? 0 : Math.max(0, Math.min(100, val / max * 100));
  return `<div class="bar ${cls}" title="${val == null ? 'not recorded' : val + ' / ' + max}"><i style="width:${p}%"></i></div>`;
}

/** 5-segment meter. risk=true colours by value (1 green .. 5 red). */
export function meter(val, risk = false, label = '') {
  if (val == null) return `<div class="meter na" title="not recorded">${'<i></i>'.repeat(5)}</div>`;
  let h = '';
  for (let i = 1; i <= 5; i++) h += `<i class="${i <= val ? 'f r' + val : ''}"></i>`;
  return `<div class="meter ${risk ? 'risk' : ''}" title="${esc(label)} ${val} / 5">${h}</div>`;
}

export function scoreRing(score, big = false) {
  const tone = score >= 70 ? 'good' : score >= 55 ? 'ok' : score >= 35 ? 'warn' : 'bad';
  return `<div class="ring s-${tone} ${big ? 'lg' : ''}" style="--p:${Math.max(2, score)}" title="${score} / 100"><b>${score}</b></div>`;
}

export const toneOf = f => f >= 0.85 ? 'good' : f >= 0.6 ? 'ok' : f >= 0.3 ? 'warn' : 'bad';

/** Taste radar: sweet, acid, aroma, crisp, juicy (+ tannin as a sixth axis when relevant). */
export function radar(t, size = 170) {
  const axes = [['Sweet', t.sweet], ['Acid', t.acid], ['Aroma', t.aroma], ['Crisp', t.crisp], ['Juicy', t.juicy]];
  if ((t.tannin ?? 0) > 0) axes.push(['Tannin', t.tannin]);
  const n = axes.length, c = size / 2, R = size / 2 - 26;
  const pt = (i, r) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [c + Math.cos(a) * r, c + Math.sin(a) * r]; };
  let g = '';
  for (let k = 1; k <= 5; k++) g += `<polygon points="${axes.map((_, i) => pt(i, R * k / 5).join(',')).join(' ')}" fill="none" stroke="var(--line)" stroke-width="${k === 5 ? 1.2 : .7}"/>`;
  axes.forEach((_, i) => { const [x, y] = pt(i, R); g += `<line x1="${c}" y1="${c}" x2="${x}" y2="${y}" stroke="var(--line)" stroke-width=".7"/>`; });
  const poly = axes.map(([, v], i) => pt(i, R * Math.max(0.06, (v ?? 0) / 5)).join(',')).join(' ');
  g += `<polygon points="${poly}" fill="var(--accent)" fill-opacity=".28" stroke="var(--accent)" stroke-width="2"/>`;
  axes.forEach(([lab, v], i) => { const [x, y] = pt(i, R + 14); g += `<text x="${x}" y="${y + 3}" text-anchor="middle" font-size="10" fill="var(--muted)">${lab}${v == null ? '?' : ''}</text>`; });
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Taste profile radar">${g}</svg>`;
}

/** Year strip Jul..Jun showing harvest window (top) and best-eating months (bottom). */
export function seasonTimeline(v) {
  const order = [6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5];       // Jul..Jun
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const CUM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const x = doy => { let d = doy - 181; if (d < 0) d += 365; return Math.max(0, Math.min(100, d / 365 * 100)); };
  let grid = '';
  order.forEach((m, i) => { grid += `<div class="m" style="left:${i / 12 * 100}%">${names[m]}</div>`; });
  let h = '';
  if (v.season.harvest_from != null) {
    const a = x(v.season.harvest_from), b = x(v.season.harvest_to);
    h += `<div class="harvest" style="left:${a}%;width:${Math.max(2.5, b - a)}%" title="Harvest: ${esc(v.season.harvest)}"></div>`;
  }
  const em = eatingMonths(v.season.eating);
  if (em) {
    const first = em[0], last = em[em.length - 1];
    const start = CUM[first], end = CUM[last] + [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][last];
    const a = x(start), b = x(end);
    if (b >= a) h += `<div class="eat" style="left:${a}%;width:${Math.max(2.5, b - a)}%" title="Best eaten: ${esc(v.season.eating)}"></div>`;
    else { h += `<div class="eat" style="left:${a}%;width:${100 - a}%"></div><div class="eat" style="left:0;width:${b}%"></div>`; }
  }
  return `<div class="tl" role="img" aria-label="Season: harvest ${esc(v.season.harvest || 'unknown')}, eating ${esc(v.season.eating || 'unknown')}">${grid}${h}</div>
  <div class="legend"><span><i style="background:var(--accent)"></i>Picked ${esc(v.season.harvest || '?')}</span><span><i style="background:var(--leaf)"></i>Best eaten ${esc(v.season.eating || '?')}</span></div>`;
}

export function chips(tags, cls = 'flav') { return (tags || []).map(t => `<span class="chip ${cls}">${esc(tagLabel(t))}</span>`).join(''); }
export function usesBadges(v) { return v.uses.map(u => `<span class="badge ${u}">${u}</span>`).join(''); }
export function favBtn(id) {
  const on = isFav(id);
  return `<button class="fav ${on ? 'on' : ''}" data-fav="${esc(id)}" aria-pressed="${on}" aria-label="${on ? 'Remove from' : 'Add to'} favourites" title="${on ? 'Remove from' : 'Add to'} favourites">${on ? '♥' : '♡'}</button>`;
}
export function keepersBadge(v) { return v.keepers && v.keepers.listed ? `<span class="badge keepers" title="Listed in Keepers Nursery's public apple catalogue">Keepers</span>` : ''; }
export function breederBadge(v) { return v.tags && v.tags.includes('keepers-bred') ? `<span class="badge breeder" title="Bred by Karim Habibi at Keepers Nursery">Bred by Karim</span>` : ''; }

export const DISEASES = [['scab', 'Apple scab'], ['canker', 'European canker'], ['mildew', 'Powdery mildew'], ['fire_blight', 'Fire blight'], ['rust', 'Cedar-apple rust'], ['bitter_pit', 'Bitter pit']];
