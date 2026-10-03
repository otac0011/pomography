# Brief for variety-research agents (Pomona)

Pomona is a static website about heirloom and modern apple varieties, focused on the range grown by
Keepers Nursery (Kent, UK; nursery manager Karim Habibi). Users browse varieties, learn about taste and
growing habit, then click a world map to see how well their favourite apples would do in that climate.
The data you write is the foundation, so **accuracy beats completeness**.

## Your job

You receive a batch file `research/batches/<batch>.json` listing ~20 varieties (`id`, `name`).
For each, produce one record following `research/SCHEMA.md` exactly.

Write results to `data/varieties/<batch>-a.json`, `-b.json`, ... **in files of at most 8 records each**
(each file is a JSON array). Use the Write tool; do NOT use shell heredocs (they truncate).
Keep ids/names exactly as given. Then run:

    python tools/validate.py "data/varieties/<batch>-*.json" --batch research/batches/<batch>.json

and fix every ERROR. Warnings are advisory.

## Sources and honesty

* Start from what you know, then **verify** with WebSearch / WebFetch where you are unsure. Good sources:
  National Fruit Collection (nationalfruitcollection.org.uk), Orange Pippin (orangepippin.com), Wikipedia,
  Cornell / WSU / Univ. of Minnesota / Michigan State / Agriculture Canada / East Malling / RHS pages,
  Slow Food / Welsh / Irish / Scottish heritage-fruit societies, national pomologies.
* Budget roughly one verification lookup per variety on average; spend more on the obscure ones, almost
  none on famous ones (Cox, Bramley, Gala). Do not spend your whole effort on research - the structured
  record is the product.
* **Paraphrase. Never copy sentences** from any website. All prose (history, taste.summary, notes,
  look.description, best/poor climates) must be your own wording.
* **Keepers Nursery's website text and database are copyrighted** - do not copy from keepers-nursery.co.uk
  at all. Use other sources.
* If you cannot ground a value, use `null` and lower `conf`. Do not fill gaps with plausible-sounding guesses.
  For obscure varieties a record with a few nulls is much better than a fabrication.
* If the requested name is a synonym or a sport/clone of another variety in the same batch, still output a
  record for it (id as given) but say so in `aka`/`history` and keep only differences in the other fields.
* Taste: describe real flavour. Prefer what multiple tasters report (e.g. Cox's Orange Pippin: rich, aromatic,
  floral/rose-water and pear-drop notes, honey; Ashmead's Kernel: sharp, nutty, pear-drop; Egremont Russet:
  nutty, dry; Ananas Reinette: pineapple; Kingston Black: sharp-tannic cider). Use tags only from the list.
* Cider apples: fill `taste.tannin` (bittersweet 3-5), set `taste.cider_class`, and use `uses: ["cider"]`
  (add "culinary"/"dessert" only if genuinely used so).
* Climate fields drive a scoring engine, so think about them: `chill_hours`, `hardiness_zone`,
  `heat_tolerance`, `colour_needs_cool_nights`, `season.harvest` (south-east England). Base them on the
  variety's region of origin and documented performance (e.g. a Russian winter-hardy variety = zone 3 and
  low heat tolerance; an Israeli/Australian low-chill variety = chill 250-500 and good heat tolerance).
* Health ratings are general-experience susceptibility, 1 = resistant ... 5 = very susceptible. Be explicit
  in `health.other` about a known major weakness (e.g. Cox: canker, mildew, scab; Bramley: tip-bearer,
  triploid; Braeburn: bitter pit, canker).

## Final message

Reply with a SHORT report (under 200 words): files written, validator result, ids you flagged `conf: low`,
any requested names that appear to be duplicates/synonyms/non-existent, and anything surprising. Do not
paste the data into the reply.
