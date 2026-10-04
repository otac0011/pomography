# Brief: find our apples in the old pomology books (Pomography)

Pomography (static site, repo `C:\GIT\pomography`) describes ~425 apple varieties. We have downloaded public-domain
pomology books as plain text into `library/text/<book>.txt` (catalogue: `library/books.json`). Your job: **for every
one of our varieties that your book describes, record where its entry is and what the book says about its flavour.**
These are 19th/early-20th-century books, out of copyright, so exact quotation is allowed and wanted.

Inputs
* `research/library/varieties.json` - our varieties: id, name, aka (synonyms), country, year, uses, our current taste tags.
* `research/library/candidates-<book>.json` - a script's guesses: for each variety id, lines in the book that START with
  one of its names, best first (`score` >= 3 means a capitalised heading). Many are index lines, catalogue lists or
  passing mentions; some real entries are missing.
* The book text itself (use the Read tool with `offset`/`limit`, and the Grep tool; text is OCR, so names may have
  doubled spaces, broken letters, `�` for dashes; search with `\s+` between words and try synonyms).

## Steps
1. For each candidate, Read about 60 lines from the candidate line. Decide whether it is **the descriptive entry** for
   that apple (a heading followed by the description: fruit, skin, flesh/flavour, season, tree, history). Index lines,
   lists ("Cox's Orange Pippin, Oct. -"), tables of recommended sorts and passing mentions in other entries are NOT
   entries. If the book has several entries for one name, pick the main descriptive one.
2. Check it is **the same apple**: compare synonyms, origin, season, colour with our record. Old names are reused
   ("Golden Pippin", "Nonpareil", "Russet" have many meanings). `match`: `exact` (same name, clearly same),
   `synonym` (listed under another name that the book or our `aka` ties to ours), `probable` (likely but not certain;
   say why in `note`). Skip it if you think it is a different apple.
3. Then **look for our varieties that have no good candidate** (especially pre-1920 English, French, American apples
   that a book of that date and country would cover): Grep the text for the name, its synonyms, or distinctive words.
   Use the book's own index if it has one. Do not spend more than ~2 searches on any one variety.
4. For each entry you confirm, record (see Output): the first line of the heading (`line`) and the last line of the
   entry (`end`, before the next variety's heading; leave out running heads/page numbers at the end), and:
   * `flavour`: the sentence(s) about the flesh, flavour, taste or perfume, **verbatim**, with only obvious OCR errors
     fixed (`Fmit` -> `Fruit`, `tlie` -> `the`, broken hyphenation re-joined). Keep the old spelling (`flavour`,
     `sugary`, `sub-acid`). Up to ~70 words. `null` if the entry says nothing about taste.
   * `quality`: the book's verdict in its words, e.g. "a dessert apple of the first quality", "very good" (short; null if none).
   * `storage`: verbatim words about keeping and how it changes in store ("keeps till March", "improves by keeping",
     "becomes mealy"), else null.
   * `climate`: verbatim words about soil, situation or climate affecting it ("requires a warm soil", "colours poorly
     in the north"), else null.
   * `tags`: the taste tags **this book's words support** (list below). Map old words carefully:
     "aromatic", "perfumed", "fragrant" -> `perfumed`; "rose-water", "rose" -> `rose`; "anise", "aniseed", "fennel" ->
     `aniseed` (or `fennel` if it says fennel); "vinous", "wine-like" -> `wine`; "pine-apple" -> `pineapple`; "nutty",
     "filbert" -> `nutty`; "honey" -> `honey`; "spicy", "spiced" -> `spice`; "musky", "musk" -> `musky`; "sugary",
     "saccharine", "very sweet" -> `sweet`; "brisk", "acid", "sharp", "tart" -> `sharp`; "insipid", "flat",
     "wanting in flavour", "mild" -> `mild`; "astringent", "rough" (cider) -> `astringent`; "bitter" -> `bitter`;
     "pear-like" / "pear flavour" -> `pear`; "quince" -> `quince`; "violet", "flowery" -> `floral`; "sprightly",
     "sub-acid", "rich", "high-flavoured", "excellent" -> no tag on their own (they are quality, not a note).
     Do not tag what the book does not say.
   * `against`: our current tags (from varieties.json) that the book **contradicts** (e.g. our `sharp` vs "sweet, with
     no acidity"; our `perfumed` vs "without aroma"). Only clear contradictions.
   * `sweet`, `acid`: 1-5 if the book clearly indicates (sugary 4-5, sweet 4, sub-acid 3, brisk 3-4, sharp/acid 4-5,
     insipid acid 1-2), else null.
   * `heading`: the heading as printed (OCR-fixed), `note`: anything worth knowing (homonym doubts, "the author
     prefers X", "described under the synonym Y").
5. French (Leroy): quote `flavour` etc. in French as printed, and give an English translation in `flavour_en`.
6. Validate: `python tools/validate_historic.py data/historic/<book>.json`. It rejects quotes whose words are not in
   your line range - fix the range or the quote, never weaken a real quote to pass.

## Output
Write `data/historic/<book-key>.json` with the Write tool (no shell heredocs), one object keyed by OUR variety id:

```json
{
  "_book": "hogg-1884",
  "coxs-orange-pippin": {
    "line": 7054, "end": 7083, "heading": "COX'S ORANGE PIPPIN", "match": "exact",
    "flavour": "Flesh yellow, firm, crisp, tender, and very juicy, with a rich and delicious aroma.",
    "quality": "a dessert apple of the very first quality",
    "storage": "It is in use from October to January.",
    "climate": null,
    "tags": ["perfumed"], "against": [], "sweet": null, "acid": null, "note": ""
  }
}
```
(The values above are only an illustration of the shape; take every word from the book.)

Rules: quotes must be the book's words; everything else is your judgement and must be supported by the entry. Never
include a variety you could not find. If two of our ids are the same apple in the book, record both with the same lines
and say so in `note`.

Final reply (under 150 words): entries found / candidate varieties checked, how many found by your own search, the
notable flavour notes (vanilla, rose, aniseed, pineapple...), any contradictions with our tags, and any homonym doubts.
