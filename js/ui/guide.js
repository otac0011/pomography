// Guide: how to use, how scores work, caveats, sources, glossary.
import { S, esc } from '../data.js';
import { WEIGHTS } from '../score/score.js';

const GLOSS = [
  ['Flowering (pollination) group', 'British nurseries rank apples 1–7 by when they blossom (Cox is 3). Two varieties pollinate each other when their groups are the same or adjacent. Some nurseries write A–G instead.'],
  ['Triploid', 'A variety with three sets of chromosomes (Bramley, Blenheim Orange, Jonagold, Ribston Pippin). Its pollen is sterile, so it needs two other diploid varieties to pollinate it — and cannot pollinate them.'],
  ['Self-fertile', 'Can set a crop with its own pollen. Even then, a partner nearby usually improves yield.'],
  ['Spur-bearer / tip-bearer', 'Spur-bearers fruit on short stubby spurs along the branches and take hard pruning. Tip-bearers fruit on the ends of last year\'s shoots, so heavy pruning removes the crop.'],
  ['Biennial bearing', 'The habit of cropping heavily one year and lightly the next. Thinning the fruitlets in the heavy year helps.'],
  ['Chill (hours or units)', 'The winter cold a tree needs to break dormancy evenly; too little and blossom is thin and late. Pomography counts Utah-style chill units from 1 November to 31 March: an hour at 2.5–9 °C counts as 1, an hour at 1.4–2.5 or 9–12.5 °C as one half. Published requirements, including the ones on variety pages, are rough and use a mix of methods.'],
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
      <h2>How to use Pomography</h2>
      <p><i>Pomology</i> is the study of fruit; <i>pomography</i> is the mapping of it: which apples suit which places, and why.</p>
      <ol>
        <li><b>Explore varieties.</b> Filter ${c.varieties} apples by flavour (rose-water, vanilla, pineapple, nutty&hellip;), season, use, origin or disease resistance. Open a variety for its taste profile, growing habits, pollination partners and climate needs.</li>
        <li><b>Check the flavour evidence.</b> The small number on each flavour tag is how many independent sources back it. Each variety page quotes the old pomology books, lists who says what, and shows measured sugar and acidity and expert tasting scores where they exist. The <a href="#/flavour">Flavour</a> page explains the method and maps every measured apple from sweet to sharp. Tasted one? Use <i>Report your tasting</i>.</li>
        <li><b>Grow it where you are.</b> On any variety page, pick your place on a pop-up map (or search for it, or use your location). You get whether it will grow there and how that climate changes the apple: picking date, sugar, acidity, overall taste, aroma, red colour, sunburn, texture and keeping. The place is remembered, so every variety page then shows it. <a href="#how-changes" data-jump-guide>How the changes are worked out</a>.</li>
        <li><b>Heart the ones you like.</b> Your favourites are kept in your browser.</li>
        <li><b>Click the world map.</b> Click one of the dots or anywhere at all: Pomography downloads ten years of real weather for that spot and scores each favourite for winter chill, hardiness, spring frost, ripening, summer heat and disease &mdash; with the reasons in words.</li>
        <li><b>Compare rootstocks.</b> See how vigour, precocity, anchorage and disease resistance differ, or use the chooser.</li>
      </ol>
    </section>
    <section class="card pad">
      <h2>How the scores work</h2>
      <p>Each variety is compared with the place on seven factors, each from 0 (hopeless) to 1 (ideal):</p>
      <table class="dt"><tbody>
        <tr><td><b>Winter chill</b> <span class="muted">(critical, weight ${WEIGHTS.chill})</span></td><td>Chill units at the site vs. what the variety needs.</td></tr>
        <tr><td><b>Winter cold</b> <span class="muted">(critical, ${WEIGHTS.hardiness})</span></td><td>Coldest-night zone of the site vs. the variety's hardiness zone.</td></tr>
        <tr><td><b>Ripening season</b> <span class="muted">(critical, ${WEIGHTS.season})</span></td><td>Growing degree-days between blossom and the first hard freeze vs. the warmth the variety needs, calibrated from its harvest date in south-east England.</td></tr>
        <tr><td><b>Summer heat</b> <span class="muted">(critical, ${WEIGHTS.heat})</span></td><td>Days of 32 °C or more vs. its heat tolerance, plus warm autumn nights for red-blushed apples. A desert fails here whatever else is true.</td></tr>
        <tr><td><b>Blossom frost</b> <span class="muted">(${WEIGHTS.frost})</span></td><td>How often damaging frost fell inside the flowering window of its flowering group.</td></tr>
        <tr><td><b>Water</b> <span class="muted">(${WEIGHTS.water})</span></td><td>Growing-season rain as a share of what the trees would use. Low scores mean irrigation is essential.</td></tr>
        <tr><td><b>Disease</b> <span class="muted">(${WEIGHTS.disease})</span></td><td>Local scab, canker, fire blight, mildew and rust pressure vs. its susceptibility to each (see below).</td></tr>
      </tbody></table>
      <p style="margin-top:10px">The score is the weighted average, then pulled down hard if any <i>critical</i> factor fails: a Cox cannot be saved by a lovely summer if the winters are too warm to chill it. Anything under 35 is marginal; under 15 is likely not viable (we say "likely" because orchard practice - shade netting, cooling, irrigation, frost protection - can sometimes beat the climate).</p>
    </section>
    <section class="card pad wide">
      <h2>What you get when you click anywhere</h2>
      <p>The dots on the map are just reference places: <b>solid</b> dots were analysed in advance and open instantly, <b>dashed</b> dots are analysed live when you click them. <b>Every spot on land can be clicked.</b> For a new spot, Pomography downloads ten years of daily weather for the surrounding 25 km grid cell (plus a short record of dew point and hours of rain), then works out everything below. Each line in the panel's <i>Climate</i> tab is labelled with where it came from:</p>
      <p><span class="kind kind-measured">Measured</span> counted directly from the weather record (hot days, rainfall, elevation, humidity) &nbsp; <span class="kind kind-modelled">Modelled</span> an apple-specific index calculated from that weather (chill, bloom date, frost risk, leaf wetness, disease pressure) &nbsp; <span class="kind kind-regional">Regional</span> looked up by country or range, because weather cannot tell you whether a disease exists there (fire blight status, cedar-apple rust, a few pests) &nbsp; <span class="kind kind-assumed">Assumed</span> a default, such as a variety's unrecorded chill need &nbsp; <span class="kind kind-extrapolated">Extrapolated</span> blended from the nearest reference places because live weather could not be loaded.</p>
      <p><b>Humidity and disease.</b> Disease pressure uses leaf wetness, not just rainfall: hours of dew (from the day's dew point) and rain together decide how many apple-scab infection periods occur in spring (after Mills' infection table). Fire blight uses a Maryblyt-style model of warm, wet blossom days; powdery mildew uses warm dry days after humid nights; European canker uses mild wet days from October to March. The <i>Regional</i> tab then says whether fire blight or cedar-apple rust exists there at all.</p>
      <p><b>If the live weather service is busy</b> (it is free and rate-limited), the panel falls back to <span class="kind kind-extrapolated">extrapolated</span> values: an inverse-distance blend of up to four reference places in the same hemisphere within 1,500 km. The banner names them and their distances, and offers a retry.</p>
    </section>
    <section class="card pad wide" id="how-changes">
      <h2>How an apple changes in another climate</h2>
      <p>The <i>Grow it where you are</i> panel compares your place with the variety's home: the reference place nearest where it was raised, or Kent (the National Fruit Collection's home, where most of our taste notes are written) when no reference place near its origin has weather data. Most of what decides how an apple tastes is set in the <b>six weeks before picking</b>, so the panel compares the average day and night temperatures of that window in both places.</p>
      <table class="dt"><tbody>
        <tr><td><b>Picking date</b></td><td>The number of days from full bloom to picking stays nearly the same for a variety wherever it grows (Gala about 130&ndash;140, Fuji about 175); warm weather in the first two months after bloom shortens it a little. Pomography takes the variety's days-after-bloom in south-east England and shortens it 2.5% for every °C those two months are warmer (at most by a quarter). Whether there is enough warmth to ripen it at all still comes from the degree-days to the first hard frost.</td></tr>
        <tr><td><b>Sugar</b></td><td>Warmer ripening weather lets fruit build more sugar; fruit that cannot finish ripening keeps starch and tastes less sweet. Shown when the window differs by 1.5 °C or more.</td></tr>
        <tr><td><b>Acidity</b></td><td>Malic acid is used up faster in warm weather, warm nights especially, so warm places give less sharp fruit and cool ones sharper fruit (Japanese records over 30&ndash;40 years of warming show exactly this in Fuji and Tsugaru).</td></tr>
        <tr><td><b>Overall taste</b></td><td>The same shift reads differently for each apple: a sharp apple becomes balanced in warmth, a low-acid one turns bland, a cooking apple loses the acidity it is grown for, a cider apple gains sugar and loses acid.</td></tr>
        <tr><td><b>Aroma</b></td><td>The variety's own sourced note where we have one (Cox loses aroma in hot summers); otherwise strongly aromatic apples are expected to lose some perfume when they ripen in heat, and fruit that does not ripen fully tastes plain.</td></tr>
        <tr><td><b>Red colour</b></td><td>The red pigment forms in cool nights and sunlight before harvest and is suppressed by heat: nights averaging 16 °C or more mean a weak blush; 13 °C is already too warm for varieties known to need cool nights.</td></tr>
        <tr><td><b>Sunburn</b></td><td>On days of 35 °C or more, sun-facing fruit reaches the 46&ndash;49 °C at which the skin browns.</td></tr>
        <tr><td><b>Texture &amp; keeping</b></td><td>Fruit that ripens in warm weather softens faster and keeps less long; cool ripening keeps it firm. Varieties prone to bitter pit get a warning where summers are hot or dry.</td></tr>
        <tr><td><b>Skin</b></td><td>Long leaf-wetness in the weeks after blossom roughens the skin into russet on susceptible apples; dry weather gives smoother skin.</td></tr>
      </tbody></table>
      <p class="small muted" style="margin-top:8px">These are tendencies from fruit research, not measurements of a given apple at your place. Crop load, pruning, irrigation and picking date change taste as much as climate does. Sources: Sugiura et al. 2013 (Scientific Reports 3:2418); Warrington et al. 1999 (J. Amer. Soc. Hort. Sci. 124:468); Lin-Wang et al. 2011 (Plant, Cell &amp; Environment 34:1176); Schrader et al. 2003 (Acta Horticulturae 618:397); Faust &amp; Shear 1972 (HortScience 7:233). Details: decision 0006 in the repository.</p>
    </section>
    <section class="card pad">
      <h2>Where the numbers come from</h2>
      <ul>
        <li><b>Weather:</b> ERA5 reanalysis (ECMWF/Copernicus) daily highs, lows and rain for 2015–2024 and dew point and rain hours for 2022–2024, served free by <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>. Place names from BigDataCloud; map tiles &copy; OpenStreetMap contributors &copy; CARTO.</li>
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
      <p>Pomography's range is inspired by <a href="https://www.keepers-nursery.co.uk/fruit-trees/apple" target="_blank" rel="noopener">Keepers Nursery</a> in East Farleigh, Kent &mdash; one of the best-known sources of rare and heritage fruit trees in Britain, run by Karim Habibi, who also breeds new apples from seed (Hamid's Red Pippin, Sima Joon, Primrose Pippin). The <span class="badge keepers">Keepers</span> badge marks varieties that appear on Keepers' public apple catalogue pages; follow the link on a variety to see what they have and what they charge.</p>
      <p>This is an independent project. It is not affiliated with, endorsed by or sourced from Keepers Nursery: their descriptions and database are their copyright, so none of that text is used here. Everything else you read was researched and written separately.</p>
      <p class="small muted">Data built ${esc(S.data.built)}. ${c.varieties} varieties, ${c.rootstocks} rootstocks, ${c.regions} reference places.</p>
    </section>
    <section class="card pad wide glossary">
      <h2>Glossary</h2>
      <dl>${GLOSS.map(([t, d]) => `<dt>${esc(t)}</dt><dd>${esc(d)}</dd>`).join('')}</dl>
    </section>
  </div>`;
  // the hash router owns '#...', so in-page links scroll instead of navigating
  app.querySelectorAll('[data-jump-guide]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); app.querySelector(a.getAttribute('href')).scrollIntoView({ behavior: 'smooth' }); }));
}
