# Brief: flavour evidence from modern sources (Pomography)

Pomography (repo `C:\GIT\pomography`) shows taste tags for ~425 apples (rose, pear-drop, nutty, aniseed, vanilla ...).
Many were recorded by earlier research agents from a few web pages and are not traceable. We are now recording, **for
each tag, which independent sources support it**, so the site can show "3 sources" vs "1 source" and drop tags nobody
supports. Another team is doing the same from 19th-century books; you cover **modern sources**.

Your batch: `research/evidence_batches/ev-N.json` (id, name, synonyms, country, our current tags, sweet/acid 1-5,
summary, best_eaten).

## Sources (WebFetch only; WebSearch is rationed - use it at most 10 times in total)
For each variety try, in this order, and stop at **3 independent sources** or **4 fetches**:
1. **Orange Pippin**: `https://www.orangepippin.com/varieties/apples/<slug>` (slug from the name: lowercase, no
   apostrophes, hyphens, e.g. `coxs-orange-pippin`, `ashmeads-kernel`; if it redirects to the home page, it is not there).
   Use the variety description *and* the tasting-notes summary, not individual user comments.
2. **Wikipedia** (`https://en.wikipedia.org/wiki/<Name>` or `<Name>_(apple)`); also de/fr Wikipedia for German/French apples.
3. **National Fruit Collection** (Brogdale, UK): `https://www.nationalfruitcollection.org.uk/` variety pages.
4. Other independent growers' or institutions' pages: university / extension pages, Ken Muir, Walcot Organic
   Nursery, Trees of Antiquity, Big Horse Creek Farm, Cummins Nursery, Adams Apples, Blackmoor, Scott Farm, Hidden
   Spring, Apples & Pears Australia, Lubera, German/Swiss pomology sites (e.g. obstsortendatenbank.de, BUND
   Lemgo Obstsorten), Fruitipedia, Applesnz, etc.
* **Do NOT use Keepers Nursery** (keepers-nursery.co.uk) - their copyright forbids it until they give permission.
* Two pages from the same organisation are one source. A page that plainly copies another (identical wording) is not
  independent - count the original only.
* If a site rate-limits (HTTP 429) move on to the next source and come back later in the batch at most once.

## What to record per source
* `words`: the source's own flavour/aroma words as short items (1-4 words each, e.g. "aromatic", "pear-drop",
  "hint of aniseed", "nutty", "sweet-sharp"). These are for traceability; no sentences.
* `tags`: the taste tags those words support (allowed list below). Mapping: aromatic/perfumed/fragrant -> perfumed;
  rose/rose-water -> rose; anise/aniseed/liquorice -> aniseed; fennel -> fennel; vinous/wine -> wine; pineapple ->
  pineapple; nutty/hazelnut/walnut -> nutty (walnut only if said); honey/honeyed -> honey; spicy/spice -> spice;
  sweet/sugary -> sweet; sharp/tart/acidic/brisk -> sharp; bland/mild/low acid -> mild; pear/pear-like -> pear;
  "pear-drop"/"acid-drop" (the boiled sweet) -> pear-drop; banana -> banana; strawberry -> strawberry; citrus/orange ->
  citrus; lemon -> lemon; vanilla -> vanilla; floral/flowery -> floral; elderflower -> elderflower; melon -> melon;
  bitter/bittersweet tannin -> bitter/astringent. Do not tag a word the source does not use.
* `sweet`, `acid` (1-5) if the source clearly indicates (very sweet 5 ... very sharp 5), else null.
* `against`: our tags the source clearly contradicts ("no aroma" vs our `perfumed`).

## Per variety (from all your sources together)
* `storage_change`: in your own words, how the flavour changes after picking / in store, if any source says
  (e.g. "sharp at picking; sweeter and nuttier after Christmas"); null if nothing.
* `climate_flavour`: `{"needs": "cool" | "warm" | "any" | null, "note": "own words"}` - does flavour/colour depend on
  climate? (e.g. Cox loses aroma in hot summers -> "cool"; Granny Smith needs a long hot season -> "warm"; Ribston
  "fine in a warm dry summer"). null if no source says.
* `peak`: own words for when it tastes best, if a source says (e.g. "Nov-Jan after 4-6 weeks in store").
* `notes`: disagreements between sources, homonym doubts, "Orange Pippin page is for a different apple".

## Output
Write `data/evidence/ev-N.json` (Write tool, no shell heredocs):

```json
{
  "_batch": "ev-N",
  "coxs-orange-pippin": {
    "sources": [
      { "src": "orangepippin", "url": "https://www.orangepippin.com/varieties/apples/coxs-orange-pippin",
        "words": ["aromatic", "complex"], "tags": ["perfumed"], "sweet": null, "acid": null, "against": [] },
      { "src": "wikipedia", "url": "https://en.wikipedia.org/wiki/Cox%27s_Orange_Pippin", "words": ["..."], "tags": ["..."] }
    ],
    "storage_change": null, "climate_flavour": { "needs": "cool", "note": "..." }, "peak": null, "notes": ""
  }
}
```
`src` is one of: `orangepippin`, `wikipedia`, `nfc`, `university`, `nursery`, `pomology-site`, `book`, `other`. (The
values above only illustrate the shape.) Include every variety in your batch; one with no sources found gets
`"sources": []`. Validate with `python tools/validate_evidence.py data/evidence/ev-N.json` and fix errors.

Honesty: record only what pages say. Never fill gaps from memory. Words must be the source's words.

Final reply (under 150 words): varieties with 0 / 1 / 2 / 3+ sources, tags most often unsupported, notable
contradictions, rate-limit problems.

Allowed tags: floral, rose, elderflower, perfumed, honey, vanilla, caramel, butterscotch, nutty, almond, walnut,
aniseed, fennel, spice, clove, cinnamon, pear-drop, pear, quince, pineapple, banana, melon, mango, apricot, peach,
lemon, citrus, strawberry, berry, cherry, grape, wine, herbal, tea, earthy, musky, bitter, astringent, sharp, sweet,
mild, savoury.
