# 0010 - "Best here": endless list and kinds of apple

Date: 2026-10-06. Status: accepted.

## Context (user request)
"I want to be able to continue scrolling the 'best here'. I also want, after the 'use' category, other ways to sort,
like heirloom, russeted, red flesh, modern."

## Decisions
1. **Endless list.** The map panel's "Best here" tab showed the top 20 and the 6 worst. It now shows 20 at a time and
   adds the next 20 when the end of the list scrolls into view (IntersectionObserver), with a "Show 20 more" button as
   a fallback; rows are numbered. The separate "Least suited here" box went: the end of the list is the same thing.
   Hearting an apple there now updates the heart in place instead of redrawing the panel, which would have thrown you
   back to the top; the filters are kept while you click other places.
2. **Kinds** (a second menu after "use"):
   | Kind | Rule | Apples |
   |---|---|---|
   | Heirloom | introduced before 1950 (`origin.year`) | 425 |
   | Modern | 1950 or later | 136 |
   | Russeted | `look.russet` 2+ (heavy patches or fully russeted; 1 = a few dots, which most apples have) | 42 |
   | Red flesh | `look.flesh_colour = "red"` | 7 |
   | Red or pink-tinged flesh | any `flesh_colour` | 38 |
   1950 is the usual cut-off for "heirloom" in American use; British sources often say "pre-war" or 50+ years, which
   gives nearly the same set here. The 85 apples with no recorded date are in neither group rather than guessed.
3. **`look.flesh_colour`** is a new optional field ("red" = red or pink right through or streaked through the flesh;
   "tinged" = stained under the skin or near the core), set by `research/patches/005-flesh-colour.json` from each
   record's own taste and look text and checked by `tools/schema.py`. The atlas has few true red-fleshed apples (Hidden
   Rose, Pink Pearl, Surprise, Red Sauce, Harry Baker, Sops in Wine, Bloody Ploughman); the modern red-fleshed
   families (Redlove, Baya Marisa, Weirouge, Niedzwetzkyana and its descendants) are not in it yet.

## Open questions
* Some well-known modern apples have no year recorded (Topaz, Envy, Golden Delicious Russet), so they drop out of
  "Modern"; filling those 85 dates would fix it.
