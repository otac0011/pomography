// How one apple changes when it is grown somewhere else: ripening date, sugar, acidity, overall taste, aroma, colour,
// sunburn, texture and keeping, skin finish. Pure functions of (variety, place features, home features).
// The physiology behind each rule, with references and the rejected alternatives, is in docs/decisions/0006.
import { thermalNeed, flavourHere, harvestAt } from './score.js';
import { spanClim, viLabel } from '../climate/features.js';

const WINDOW = 42;          // the six weeks before picking: when sugar, acid, colour and aroma are set (decision 0006)
const r0 = x => Math.round(x);

/** Mean max/min over the `days` before virtual day `endVi`. */
export const windowClim = (F, endVi, days = WINDOW) => spanClim(F, endVi - days, endVi);

/** When the variety ripens at a place, and whether the season holds enough warmth to ripen it at all. */
export function ripening(v, F, ctx) {
  const h = harvestAt(v, F, ctx);
  if (!h || !F.season) return null;
  const need = thermalNeed(ctx, v.season.harvest_doy), have = F.season.gendMedian;
  const ripens = have >= need;
  const vi = ripens ? Math.min(h.vi, F.season.endVi) : F.season.endVi;
  const okYears = F.season.gendPer ? F.season.gendPer.filter(x => x >= need).length / F.season.gendPer.length : (ripens ? 1 : 0);
  return { vi, label: viLabel(vi, F.southern), ripens, margin: have / need, okYears, dafb: h.dafb };
}

const weeks = (d, where) => { const w = Math.round(Math.abs(d) / 7); return w === 0 ? 'about the same time as in ' + where : w + ' week' + (w === 1 ? '' : 's') + (d < 0 ? ' earlier' : ' later') + ' than in ' + where; };
const RED = new Set(['red', 'deep-red', 'crimson', 'purple', 'orange-red']);

/**
 * @param v variety record, F features of the chosen place, H features of the variety's home (baseline), homeName its label
 * @returns { here, home, items: [{key, title, dir, tone, text}] }  dir: 'up' | 'down' | 'same' | null
 */
export function climateChanges(v, F, ctx, H, homeName) {
  const items = [];
  const add = (key, title, tone, text, dir = null) => items.push({ key, title, tone, text, dir });
  if (!F || F.error || F.noBloom || !F.season) return { items };
  const rp = ripening(v, F, ctx), rh = H ? ripening(v, H, ctx) : null;
  const name = v.name, t = v.taste || {}, look = v.look || {};
  // without a harvest date, judge the ripening weather in the month most apples are picked (Sep N / Mar S)
  const endHere = rp ? rp.vi : 255, endHome = rh ? rh.vi : 255;
  const W = windowClim(F, endHere), WH = H ? windowClim(H, endHome) : null;
  const dT = WH ? W.tmean - WH.tmean : 0, dN = WH ? W.tmin - WH.tmin : 0;
  const cmp = WH ? ` (the six weeks before picking average ${r0(W.tmax)} °C days and ${r0(W.tmin)} °C nights here, against ${r0(WH.tmax)} °C and ${r0(WH.tmin)} °C in ${homeName})` : '';
  const unripe = rp && !rp.ripens;

  // 1. ripening date
  if (!rp) add('ripen', 'Ripening', 'ok', 'Its picking date is not recorded, so the ripening comparison uses the weather of a typical apple harvest month.');
  else if (unripe) add('ripen', 'Ripening', 'bad', `The season here is too short or cool for it: in a typical year the first hard frost (${F.season.firstFreeze || F.season.endLabel}) comes before it has had the warmth it needs, and it ripened fully in only ${r0(rp.okYears * 100)}% of the last ${F.season.gendPer ? F.season.gendPer.length : 10} seasons. Fruit picked early will be starchy, sharp and poorly coloured.`, 'down');
  else {
    const shift = rh ? Math.round(rp.vi - rh.vi) : null;
    const tight = rp.margin < 1.1;
    add('ripen', 'Ripening', tight ? 'warn' : 'good', `Should be ready to pick around ${rp.label}` + (shift != null ? `, ${weeks(shift, homeName)} (${rh.label})` : '') + '.' +
      (tight ? ` That is close to the end of the season here, so in cool years it will be picked before it is fully ripe.` : rp.margin > 1.6 && v.season.harvest_doy < 240 ? ' The long season means it ripens in the heat of summer, when early apples go soft and mealy within days of picking.' : ''), shift == null ? null : shift < -6 ? 'down' : shift > 6 ? 'up' : 'same');
  }

  // 2. sugar - rises with warmth and light during maturation; falls if the fruit cannot finish ripening
  if (unripe) add('sugar', 'Sugar', 'bad', 'Lower: fruit that does not finish ripening keeps much of its starch unconverted, so it tastes less sweet than its reputation.', 'down');
  else if (WH) {
    if (dT >= 3) add('sugar', 'Sugar', 'ok', `Higher: warm ripening weather lets the fruit build more sugar${cmp}. Expect a sweeter apple, provided the tree is not over-cropped and gets enough water.`, 'up');
    else if (dT >= 1.5) add('sugar', 'Sugar', 'ok', `Slightly higher: ripening weather is a little warmer than in ${homeName}${cmp}.`, 'up');
    else if (dT <= -3) add('sugar', 'Sugar', 'warn', `Lower: cool ripening weather slows sugar build-up${cmp}. It will taste less sweet, especially in dull years.`, 'down');
    else if (dT <= -1.5) add('sugar', 'Sugar', 'ok', `Slightly lower: ripening weather is a little cooler than in ${homeName}${cmp}.`, 'down');
    else add('sugar', 'Sugar', 'good', `About the same as in ${homeName}: the weather while it ripens is similar${cmp}.`, 'same');
  }

  // 3. acidity - malic acid is respired faster in warm weather, warm nights especially
  if (WH) {
    const d = (dT + dN) / 2;              // nights weigh double
    if (unripe || d <= -3) add('acid', 'Acidity', 'warn', `Higher: in cool weather fruit keeps more of its malic acid, so it will be sharper than in ${homeName}.`, 'up');
    else if (d <= -1.5) add('acid', 'Acidity', 'ok', `Slightly higher: cooler ripening weather leaves a little more acid in the fruit.`, 'up');
    else if (d >= 3) add('acid', 'Acidity', 'warn', `Lower: warm days and nights burn off malic acid while it ripens (nights ${r0(W.tmin)} °C here against ${r0(WH.tmin)} °C in ${homeName}), so it will be less sharp.`, 'down');
    else if (d >= 1.5) add('acid', 'Acidity', 'ok', `Slightly lower: warmer ripening weather burns off a little more of its acid.`, 'down');
    else add('acid', 'Acidity', 'good', `About the same as in ${homeName}.`, 'same');
  }

  // 4. overall taste: the same change reads differently for a sharp apple, a sweet one and a cooker
  if (WH) {
    const a = t.acid, cooker = (v.uses || []).includes('culinary') && !(v.uses || []).includes('dessert');
    const cider = (v.uses || []).includes('cider') && !(v.uses || []).includes('dessert');
    const warmer = !unripe && dT >= 1.5, cooler = unripe || dT <= -1.5;
    let text = null, tone = 'ok';
    if (cider && warmer) text = 'Cider makers would see more sugar (more alcohol) and less acid in the juice; bittersweets keep their tannin, but sharps and bittersharps lose some bite.';
    else if (cider && cooler) text = 'Juice will be lower in sugar (less alcohol) and higher in acid than in its home orchards.';
    else if (cooker && warmer) { text = 'A cooking apple relies on its acidity; here it will be milder, may keep less of its shape or sharpness when cooked, and could be eaten fresh sooner.'; tone = 'warn'; }
    else if (cooker && cooler) { text = 'It will stay sharp and cook well; it will rarely sweeten enough to eat fresh.'; tone = 'good'; }
    else if (warmer && a >= 4) { text = `A sharp apple at home, it should taste more balanced here: sweeter and less tart.`; tone = 'good'; }
    else if (warmer && a != null && a <= 2) { text = `Already low in acid, it may taste flat or bland here: sweet with little to lift it.`; tone = 'warn'; }
    else if (warmer) text = 'Expect it to taste sweeter and softer, with less of the bright acidity it has at home.';
    else if (cooler && a >= 4) { text = 'Already sharp, it will be sharper still; best stored a few weeks to mellow, or used for cooking.'; tone = 'warn'; }
    else if (cooler && a != null && a <= 2) { text = 'The extra acidity should give this mild apple more liveliness than it has in warmer places.'; tone = 'good'; }
    else if (cooler) text = 'Expect a brisker, less sweet taste than its reputation.';
    if (text) add('taste', 'Overall taste', tone, text);
  }

  // 5. aroma: the variety's own sourced note first (Cox loses aroma in heat), else a general rule for perfumed apples
  const fh = flavourHere(v, F);
  if (fh) add('aroma', 'Aroma', fh.tone, fh.text, fh.tone === 'good' ? 'same' : 'down');
  else if (unripe && t.aroma >= 3) add('aroma', 'Aroma', 'warn', 'Aroma develops in the last stage of ripening, so fruit that does not ripen fully will taste plain.', 'down');
  else if (W.tmax >= 29 && t.aroma >= 4) add('aroma', 'Aroma', 'warn', `Strongly aromatic apples usually lose some perfume when they ripen in heat (${r0(W.tmax)} °C days here).`, 'down');

  // 6. red colour - anthocyanin forms in cool nights and sunlight in the weeks before harvest; heat suppresses it
  const red = (look.blush_cover >= 25 && (RED.has(look.blush) || look.blush === 'pink')) || v.climate.colour_needs_cool_nights;
  if (red && !unripe) {
    const sensitive = v.climate.colour_needs_cool_nights;
    if (W.tmin >= 16) add('colour', 'Colour', sensitive ? 'bad' : 'warn', `Paler: nights stay around ${r0(W.tmin)} °C before picking, too warm for the red skin pigment to form well, so the blush will be weak or patchy${sensitive ? ' (this variety is known to need cool nights to colour)' : ''}.`, 'down');
    else if (W.tmin >= 13 && sensitive) add('colour', 'Colour', 'warn', `Less red: nights around ${r0(W.tmin)} °C before picking are on the warm side for a variety that needs cool nights to colour.`, 'down');
    else if (WH && W.tmin <= WH.tmin - 3) add('colour', 'Colour', 'good', `Redder: cooler nights before picking (${r0(W.tmin)} °C against ${r0(WH.tmin)} °C) bring out more blush.`, 'up');
    else if (W.tmin < 11) add('colour', 'Colour', 'good', `Good colour: cool nights (${r0(W.tmin)} °C) before picking suit the red blush.`, 'same');
  } else if (red && unripe) add('colour', 'Colour', 'warn', 'Poorly coloured: fruit picked before it ripens rarely develops its full blush.', 'down');

  // 7. sunburn
  const hot35 = F.heat.hot35 || 0, ht = v.climate.heat_tolerance ?? 3;
  if (hot35 >= 2) {
    const bad = hot35 >= 10 || (hot35 >= 5 && ht <= 2);
    add('sunburn', 'Sunburn', bad ? 'bad' : 'warn', `About ${r0(hot35)} day${r0(hot35) === 1 ? '' : 's'} a year reach 35 °C here; on such days sun-facing fruit heats to the 46-49 °C at which skin browns. Expect sunburn on exposed fruit${ht <= 2 ? ', and this variety is not heat tolerant' : ''}; shade netting, a leafier canopy or kaolin clay sprays help.`);
  }

  // 8. texture and keeping
  const sw = v.season.storage_weeks;
  if (unripe) add('keep', 'Texture & keeping', 'warn', 'Picked before it is ripe, it tends to shrivel in store and never develops its proper texture.');
  else if (WH && dT >= 3) add('keep', 'Texture & keeping', 'warn', `Softer, and it will not keep as long${sw ? ' as the ~' + sw + ' weeks it manages in a cool climate' : ''}: fruit that ripens in warm weather loses firmness faster after picking. Pick promptly and refrigerate.`, 'down');
  else if (WH && dT <= -2) add('keep', 'Texture & keeping', 'good', 'Firmer, and likely to keep at least as well as at home: cool ripening weather slows softening.', 'up');
  if ((v.health.bitter_pit || 0) >= 3 && (F.wet.aridity < 0.5 || F.heat.hot32 >= 10)) add('pit', 'Bitter pit', 'warn', 'This variety is prone to bitter pit (small brown, bitter spots from calcium shortage in the fruit), which hot or dry summers make worse. Water evenly, avoid heavy feeding and light crops of very large fruit.');

  // 9. skin finish: wet, humid weeks after blossom roughen the skin (russet) on susceptible apples
  if (WH && look.russet != null && look.russet <= 2 && F.wet && H.wet) {
    const d = F.wet.lwdSpring - H.wet.lwdSpring;
    if (d >= 3) add('russet', 'Skin', 'ok', `Probably more russet than in ${homeName}: leaves and fruitlets stay wet ~${r0(F.wet.lwdSpring)} hours a day after blossom here (${r0(H.wet.lwdSpring)} there), and wet, humid weather at that stage roughens the skin.`, 'up');
    else if (d <= -3) add('russet', 'Skin', 'good', `Probably smoother and less russeted than in ${homeName}: the weeks after blossom are drier here.`, 'down');
  }
  return { here: { harvest: rp, win: W }, home: WH ? { harvest: rh, win: WH, name: homeName } : null, items };
}
