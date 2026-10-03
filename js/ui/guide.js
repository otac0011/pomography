// Guide: how to use, how scores work, caveats, sources, glossary.
import { S, esc } from '../data.js';
import { WEIGHTS } from '../score/score.js';

const GLOSS = [
  ['Flowering (pollination) group', 'British nurseries rank apples 1–7 by when they blossom (Cox is 3). Two varieties pollinate each other when their groups are the same or adjacent. Some nurseries write A–G instead.'],
  ['Triploid', 'A variety with three sets of chromosomes (Bramley, Blenheim Orange, Jonagold, Ribston Pippin). Its pollen is sterile, so it needs two other diploid varieties to pollinate it — and cannot pollinate them.'],
  ['Self-fertile', 'Can set a crop with its own pollen. Even then, a partner nearby usually improves yield.'],
  ['Spur-bearer / tip-bearer', 'Spur-bearers fruit on short stubby spurs along the branches and take hard pruning. Tip-bearers fruit on the ends of last year\'s shoots, so heavy pruning removes the crop.'],
  ['Biennial bearing', 'The habit of cropping heavily one year and lightly the next. Thinning the fruitlets in the heavy year helps.'],
  ['Chill (hours or units)', 'The winter cold a tree needs to break dormancy evenly; too little and blossom is thin and late. Pomona counts Utah-style chill units from 1 November to 31 March: an hour at 2.5–9 °C counts as 1, an hour at 1.4–2.5 or 9–12.5 °C as one half. Published requirements, including the ones on variety pages, are rough and use a mix of methods.'],
  ['Hardiness zone', 'USDA zone: the average coldest night of the year. Zone 5 is −29 to −23 °C; zone 8 is −6.7 to −12 °C. Lower number = colder.'],
  ['Growing degree-days', 'A tally of warmth above 5 °C. Late-ripening apples need many; cool summers leave them sharp and unripe.'],
  ['Precocity', 'How soon a tree starts fruiting. Dwarfing rootstocks such as M.9 crop in year 2–3; vigorous ones may take 6–8 years.'],
  ['Vigour', 'How strong the tree grows. A more vigorous rootstock makes a bigger tree that crops later.'],
  ['Apple scab', 'A fungal disease that blackens leaves and fruit, worst in wet springs. Resistant varieties are a gift to organic growers.'],
  ['European canker', 'A fungus that girdles branches, common in wet, mild climates and on heavy soils. Cox and many russets are susceptible.'],
  ['Fire blight', 'A bacterial disease that blackens blossom and shoots as if scorched. It loves warm, wet weather at flowering, and some rootstocks (M.9, M.26) let it kill the whole tree.'],
  ['Bitter pit', 'Brown pitted spots in the flesh from calcium shortage, mainly in storage; worst in big, vigorous or drought-stressed trees.'],
  ['Bittersweet / bittersharp', 'Cider apple classes: bittersweets are tannic and low in acid; bittersharps are tannic and acidic (Kingston Black). "Sweet" and "sharp" cider apples lack tannin.'],
  ['Collar rot', 'Phytophthora rot at the base of the trunk in wet, badly drained soil. Some rootstocks resist it far better than others.'],
  ['Woolly apple aphid', 'A sap-sucking aphid that colonises roots and bark and causes galls; MM.106 and Geneva rootstocks resist it.'],
];

export function renderGuide(app) {
  const c = S.data.counts;
  app.innerHTML = `
  <h1>Guide</h1>
  <div class="sections">
    <section class="card pad wide">
      <h2>How to use Pomona</h2>
      <ol>
        <li><b>Explore varieties.</b> Filter ${c.varieties} apples by flavour (rose-water, vanilla, pineapple, nutty&hellip;), season, use, origin or disease resistance. Open a variety for its taste profile, growing habits, pollination partners and climate needs.</li>
        <li><b>Heart the ones you like.</b> Your favourites are kept in your browser.</li>
        <li><b>Click the world map.</b> Click one of the dots or anywhere at all: Pomona downloads ten years of real weather for that spot and scores each favourite for winter chill, hardiness, spring frost, ripening, summer heat and disease &mdash; with the reasons in words.</li>
        <li><b>Compare rootstocks.</b> See how vigour, precocity, anchorage and disease resistance differ, or use the chooser.</li>
      </ol>
    </section>
    <section class="card pad">
      <h2>How the scores work</h2>
      <p>Each variety is compared with the place on six factors, each from 0 (hopeless) to 1 (ideal):</p>
      <table class="dt"><tbody>
        <tr><td><b>Winter chill</b> <span class="muted">(critical, weight ${WEIGHTS.chill})</span></td><td>Chill hours at the site vs. what the variety needs.</td></tr>
        <tr><td><b>Winter cold</b> <span class="muted">(critical, ${WEIGHTS.hardiness})</span></td><td>Coldest-night zone of the site vs. the variety's hardiness zone.</td></tr>
        <tr><td><b>Ripening season</b> <span class="muted">(critical, ${WEIGHTS.season})</span></td><td>Growing degree-days between blossom and the first hard freeze vs. the warmth the variety needs, calibrated from its harvest date in south-east England.</td></tr>
        <tr><td><b>Blossom frost</b> <span class="muted">(${WEIGHTS.frost})</span></td><td>How often frost fell inside the flowering window of its flowering group.</td></tr>
        <tr><td><b>Summer heat</b> <span class="muted">(${WEIGHTS.heat})</span></td><td>Days of 32 °C or more vs. its heat tolerance, plus warm autumn nights for red-blushed apples.</td></tr>
        <tr><td><b>Disease</b> <span class="muted">(${WEIGHTS.disease})</span></td><td>Local scab, canker, fire blight, mildew and rust pressure vs. its susceptibility to each.</td></tr>
      </tbody></table>
      <p style="margin-top:10px">The score is the weighted average, then pulled down hard if any <i>critical</i> factor fails: a Cox cannot be saved by a lovely summer if the winters are too warm to chill it. Anything under 35 is marginal; under 15 is not viable.</p>
    </section>
    <section class="card pad">
      <h2>Where the numbers come from</h2>
      <ul>
        <li><b>Weather:</b> ERA5 reanalysis (ECMWF/Copernicus) daily highs, lows and rain for 2015–2024, served free by <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>. Place names from BigDataCloud; map tiles &copy; OpenStreetMap contributors &copy; CARTO.</li>
        <li><b>Chill</b> is counted in Utah-model units from daily highs/lows turned into hourly temperatures with a cosine day (checked against real hourly data, within ~4%). In very cold winters at least half the hours below 9 °C are counted, so freezing climates are not wrongly marked short of chill.</li>
        <li><b>Blossom date</b> is predicted from a heat sum fitted to known bloom dates in Kent, Paris, Michigan and Washington; <b>frost</b> uses a threshold calibrated because 25 km grid cells hide the coldest hollows.</li>
        <li><b>Variety and rootstock facts</b> were researched from public pomological sources (National Fruit Collection, Orange Pippin, university extension and breeder pages, Wikipedia) and written in our own words. Each variety shows a confidence level; <i>not recorded</i> means we found nothing reliable rather than guessing.</li>
      </ul>
    </section>
    <section class="card pad wide">
      <h2>Please read: limits of the model</h2>
      <div class="note warn">
        <p><b>This is a regional guide, not a guarantee.</b></p>
        <ul style="margin:0;padding-left:1.2em">
          <li>ERA5 cells are about 25 km wide. They smooth out valley frost hollows, hills and lake or sea shores. Your garden may be colder on still, clear nights, or warmer on a south-facing slope, than the nearest grid cell.</li>
          <li>Chill requirements are rarely measured; most are estimates from a variety's home climate. Disease ratings are general experience and vary by strain and season.</li>
          <li>Ten years is a short record: a once-in-twenty-years frost may not appear in it.</li>
          <li>Scores ignore soil, aspect, pollination and local rules on planting; check with local growers and your national plant-health authority before ordering trees.</li>
          <li>Climate is changing. The recent decade is already warmer than the old normals most reference books use.</li>
        </ul>
      </div>
    </section>
    <section class="card pad wide">
      <h2>About this atlas and Keepers Nursery</h2>
      <p>Pomona's range is inspired by <a href="https://www.keepers-nursery.co.uk/fruit-trees/apple" target="_blank" rel="noopener">Keepers Nursery</a> in East Farleigh, Kent &mdash; one of the best-known sources of rare and heritage fruit trees in Britain, run by Karim Habibi, who also breeds new apples from seed (Hamid's Red Pippin, Sima Joon, Primrose Pippin). The <span class="badge keepers">Keepers</span> badge marks varieties that appear on Keepers' public apple catalogue pages; follow the link on a variety to see what they have and what they charge.</p>
      <p>This is an independent project. It is not affiliated with, endorsed by or sourced from Keepers Nursery: their descriptions and database are their copyright, so none of that text is used here. Everything else you read was researched and written separately.</p>
      <p class="small muted">Data built ${esc(S.data.built)}. ${c.varieties} varieties, ${c.rootstocks} rootstocks, ${c.regions} reference places.</p>
    </section>
    <section class="card pad wide glossary">
      <h2>Glossary</h2>
      <dl>${GLOSS.map(([t, d]) => `<dt>${esc(t)}</dt><dd>${esc(d)}</dd>`).join('')}</dl>
    </section>
  </div>`;
}
