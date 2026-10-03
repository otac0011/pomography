# 0003 - Data audit, duplicates, and the Keepers-facts exception

Date: 2026-10-03. Status: accepted; the exception needs the nursery's blessing (open question).

## What the first research pass produced
~410 variety records from 25 agents in parallel (about 20 each), 50 rootstocks from 3, region notes for 135 places
from 4. Pilot batches (a cider batch and the Cox/Egremont mid-season batch) were checked by hand first; the
pilots showed the agents honoured the "null rather than guess" rule, flagged conflicting sources, and avoided copying.

Agents reported, consistently, that the 200-search WebSearch quota was already spent by the time later batches
ran, so most verification was by direct fetch (National Fruit Collection, Orange Pippin, Wikipedia, Hogg 1884,
Bunyard 1920). Orange Pippin rate-limited (HTTP 429) several of them. Consequences, all visible in the data:
* flowering groups are `null` for ~24% of varieties, and for others they are *estimated from NFC bloom dates*
  (the record's notes say so) - groups differ between sources by +-1 for a quarter of the varieties checked;
* chill requirements are inferred from home climate for most varieties (about 260 sit at "1000"), and hardiness
  zone 5 is the default for most British and European apples. The engine treats these as estimates (wide ramps),
  and the UI labels them;
* 108 records are `conf: low` (names that exist only in nursery catalogues, e.g. Jumbo, Pancake Apple,
  Flanders Cox, Kentish Quarrenden, Autumn Glow, Xanthous, Bethan) and are shown with a warning banner.

## Duplicates merged (research/patches/002-merge-duplicates.json)
Detected by the build (`possible duplicate:` warnings = a name or alias that appears on two records):
Goldparmaene = King of the Pippins = Reine des Reinettes; Mutsu = Crispin; Norfolk Biffin = Norfolk Beefing;
Gravensteiner = Gravenstein; the English "Seek-No-Further" (probably lost, low confidence) dropped in favour of
the American Westfield Seek-No-Further. Cross-claimed aliases removed (Black Blenheim, Aromatic Pippin, Red
Gilliflower, King, Duck's Bill) because two *different* apples claimed them. Sports/clones that nurseries sell
as separate trees (Gala / Royal Gala, Bramley / Bramley 20 / Crimson Bramley, Cox / Self-Fertile Cox / Queen Cox)
stay as separate records, each saying what differs.

## The Keepers-facts exception (research/patches/001-keepers-seedlings.json)
0001 said Keepers' site is never a content source. Exception made: six varieties - Hamid's Red Pippin, Sima Joon,
Primrose Pippin, Bethan, St Helens (all seedlings raised by Karim Habibi, the person the user asked about) and
Sweet Society - are documented nowhere else online, and without them the site would show empty stubs for exactly
the apples that make the nursery distinctive. For these only, the **facts** (parentage, year, picking time,
flowering group, size, colour, who named it) were read from the nursery's catalogue entries; every sentence is
ours, opinions (e.g. "RHS fruit specialist Joan Morgan called it pretty and moreish") are attributed and
paraphrased. NOTICE.md says so and invites the nursery to ask for changes.
*Rejected:* leaving them as stubs (misrepresents the range); quoting their descriptions (barred by their terms).
*Open question:* ask Keepers whether they would license descriptions and their whole variety table.
Monidel and St Helens had also been identified through the nursery page by an agent; both were rewritten.

## Flavour verification pass
A first scan of the tasting summaries found no variety tagged `vanilla` at all (the user specifically mentioned
vanilla notes), so eight agents re-read Orange Pippin / Wikipedia / NFC tasting descriptions for every dessert
and dual-purpose variety and patch the tags and 1-5 scores (`research/patches/flavour-*.json`, validated by
`tools/validate_patch.py`). Tags may only be added when a source describes the note.

## Sanity checks done by hand
Cox: group 3, diploid, Oct-Jan, rose/pear-drop/honey/nutty tags, canker 5; Bramley triploid; Granny Smith chill ~500;
Haralson/Honeycrisp/Wealthy zone 3; Anna/Dorsett Golden chill 150-250, group 1; Dabinett group 6 (cider bittersweet).
Group 2 for Egremont Russet disagrees with the 3 many nurseries print (the record's note explains why).
