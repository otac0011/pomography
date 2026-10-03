# Brief: flavour verification pass (Pomona)

The site lets people search apples by taste: Cox's Orange Pippin is floral / rose-water / pear-drop / honeyed;
some apples carry vanilla, aniseed, pineapple, banana, strawberry, nutty notes. The first research pass recorded
tags quickly, often from memory. **Your job: verify and enrich the taste data for the varieties in your batch
file `research/flavour_batches/flavour-N.json`** (each entry shows the current tags, summary and 1-5 scores).

## How
1. For each variety fetch its Orange Pippin page with WebFetch:
   `https://www.orangepippin.com/varieties/apples/<id>` (ids are slugs; try without apostrophes, e.g.
   `coxs-orange-pippin`; if the URL redirects to the home page the variety is not there - fall back to
   Wikipedia, the National Fruit Collection (nationalfruitcollection.org.uk) or other pomological sources).
   The pages have a Flavour / tasting section and "Quality" and texture words. Don't spend more than 2 fetches
   per variety. WebSearch is exhausted; use WebFetch only. If a site rate-limits (HTTP 429), carry on with other
   sources or leave that variety unchanged.
2. Decide the tags from what the **sources describe** (e.g. "hints of vanilla" -> `vanilla`, "rose-water" ->
   `rose`, "pineapple" -> `pineapple`, "aniseed" -> `aniseed`). Allowed tags only: floral, rose, elderflower,
   perfumed, honey, vanilla, caramel, butterscotch, nutty, almond, walnut, aniseed, fennel, spice, clove,
   cinnamon, pear-drop, pear, quince, pineapple, banana, melon, mango, apricot, peach, lemon, citrus,
   strawberry, berry, cherry, grape, wine, herbal, tea, earthy, musky, bitter, astringent, sharp, sweet, mild,
   savoury. 3-6 tags, most characteristic first. Keep existing tags that are supported; remove ones the
   sources contradict; add missing distinctive ones. Do not invent notes a source does not support.
3. Check the 1-5 scores (`sweet`, `acid`, `aroma`, `crisp`, `juicy`) against the descriptions (sharp / sweet-sharp /
   sweet; crisp vs soft or mealy; aromatic vs bland) and fix clear mismatches.
4. If you change the tags or find the summary is thin or wrong, rewrite `summary` in your own words
   (1-3 sentences; flavour, texture, how it changes in store). **Never copy sentences** from any site.
5. Record anything noteworthy (a source disagreement, "flavour poor in cool summers", etc.) in the summary.

## Output
Write ONE patch file `research/patches/flavour-N.json` (Write tool, no heredocs) of this form, containing
ONLY varieties you changed (omit unchanged ones):

```json
{ "_note": "flavour verification batch N",
  "coxs-orange-pippin": { "taste": { "tags": ["floral","rose","pear-drop","honey","nutty"], "sweet": 4, "acid": 3, "aroma": 5, "summary": "..." } } }
```
Only include the `taste` keys you change. Then validate by running
`python tools/validate_patch.py research/patches/flavour-N.json` and fix errors.

Final reply (<150 words): how many varieties checked / changed, how many had a flavour page, which got `vanilla`,
and anything surprising. Do not paste the patch.
