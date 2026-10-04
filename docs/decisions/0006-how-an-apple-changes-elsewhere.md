# 0006 - "Grow it where you are": how an apple changes in another climate

Date: 2026-10-04. Status: accepted.

## Context (user request)
"I want each apple variety to have in its page some way for you to pick a location (like maybe a pop-up window where you
click on the map) and I want you to then give some note that is how the apple will change in that climate. Like will sugar
levels be higher? Will it get enough chill hours, will it have a changed flavor, etc."

## Decisions

### 1. A place picker on every variety page, remembered per browser
`js/ui/growhere.js`: a `<dialog>` with a Leaflet map (click anywhere on land), a place search (Open-Meteo geocoding, free,
no key) and "use my location". The chosen place is kept in `localStorage` (`pomona.place.v1`), so after one pick every
variety page shows its panel for that place. The place analysis (reverse geocode -> ten years of ERA5 weather -> features,
falling back to extrapolation) moved out of the map into `js/climate/place.js` and is shared by both, so the panel and the
map give identical numbers. *Rejected:* sending people to the world map (the request was for the variety page itself);
a server-side store of places (no server; a place is a per-visitor convenience).

### 2. Compare with the variety's home, in the six weeks before picking
Changes are only meaningful against a baseline. `homeFor(v)` picks, among reference places with weather data: one in the
variety's origin country whose name appears in its origin (Excelsior, **Minnesota** -> Twin Cities); else one in the
origin country (best-suited if several); else Kent, where the National Fruit Collection grows nearly every variety and
most British taste notes are written. Matching needs the same country and whole words ("England" must not match "Altes
Land", "New South Wales" must not match Wales).
The comparison window is the **42 days before the predicted picking date** at each place, from interpolated monthly mean
highs and lows; that is when sugar accumulates, acid is respired, the red pigment forms and aroma volatiles are made.
*Rejected:* comparing whole-summer averages (an early apple in a hot place ripens before the heat; a late one after it).

### 3. The rules (`js/score/change.js`, pure functions, tested)
Thresholds are on the difference in the window's mean temperature (dT) between the place and home:
| Note | Rule | Basis |
|---|---|---|
| Ripening | date from decision 4; "too short" if degree-days to the first hard frost < need | existing season model (0002) |
| Sugar | up if dT >= 1.5 (marked if >= 3), down if <= -1.5; down if it cannot ripen | SSC rises with temperature/light during maturation; Sugiura et al. 2013 |
| Acidity | on (dT + dNight)/2: down if >= 1.5, up if <= -1.5 | malate respiration rises with temperature; Sugiura et al. 2013 (decades of warming in Japan: lower acid in Fuji and Tsugaru); Etienne et al. 2013 |
| Overall taste | the shift read against the variety: sharp (acid >= 4) -> balanced; low-acid (<= 2) -> bland; cooker -> loses its point; cider -> more sugar/alcohol, less acid | composition of the above |
| Aroma | the variety's sourced `climate_flavour` first (0005); else aroma >= 4 and window highs >= 29 °C -> some loss; unripe -> plain | esters are made in the last ripening stage |
| Colour | red/blushed apples: window nights >= 16 °C weak blush; >= 13 °C for varieties flagged `colour_needs_cool_nights`; 3 °C cooler than home -> redder | Lin-Wang et al. 2011 (heat suppresses the MYB10 anthocyanin complex) |
| Sunburn | >= 2 days a year at 35 °C; worse >= 10, or >= 5 for heat tolerance <= 2 | Schrader et al. 2003 (browning at 46-49 °C fruit surface) |
| Texture & keeping | dT >= 3 softer, shorter storage than the cool-store weeks quoted; dT <= -2 firmer | Sugiura et al. 2013 (firmness fell with warming) |
| Bitter pit | susceptibility >= 3 and (rain covers < 50% of demand or 10+ days >= 32 °C) | Ferguson & Watkins 1989 |
| Skin | russet <= 2 and spring leaf-wetness hours differ by >= 3 h/day | Faust & Shear 1972 |
Notes are directional words, never predicted °Brix or g/L: the datasets in 0005 show harvest-to-harvest and lab-to-lab
spread larger than any climate effect we could compute. *Rejected:* a numeric sugar/acid model (cannot be validated here);
folding flavour into the suitability score (decision 0005 kept flavour unscored; unchanged).
The "Will it grow here?" list under the notes is the map's seven scored factors for this variety, verbatim.

### 4. Picking date: days after bloom, not degree-days
Testing the panel showed the season model putting harvests in hot places far too early: Honeycrisp at Wenatchee on Aug 11
(growers pick it early-mid September), Cox at Almaty on Aug 12. The old model converted the variety's south-east England
harvest into a degree-day total and found when the place reached it; hot summers reach it weeks early, but fruit does not
mature proportionally faster. Days from full bloom to harvest are nearly constant per variety across regions (Gala
~130-140, Fuji ~175, Granny Smith ~190 in Washington, New Zealand and Europe), shortened a little by warm weather in the
first ~60 days after bloom (Warrington et al. 1999).
New `harvestAt()` in `score.js`: DAFB in Kent x (1 - 0.025 x (T60 here - T60 Kent)), clamped to 0.75-1.2, where T60 is
the mean temperature of the 60 days after bloom. Checks against grower dates:
| | old (degree-days) | new (days after bloom) | growers |
|---|---|---|---|
| Honeycrisp, Wenatchee | Aug 11 | Sep 14 | early-mid Sep |
| Cox, Almaty | Aug 12 | Sep 11 | (no grower record found) |
| Gala, Wenatchee | - | Sep 5 | late Aug-early Sep |
| Fuji, Wenatchee | - | Oct 10 | early-mid Oct |
| Cox, Hawke's Bay | - | Feb 11 | Feb |
| Braeburn, Hawke's Bay | - | Mar 17 | late Mar-early Apr |
Whether a variety ripens at all is still the degree-day test (warmth to the first hard frost), unchanged. The map's
"ripens ~" label and the ripening-season factor text now use the new date too, so map and variety page agree.
*Rejected:* capping degree-days at a lower temperature (tried on paper: Wenatchee still reaches Kent's total in early
August, because Kent's total is simply low).

## Results (2026-10-04)
* Tests: 88 PASS (5 new: harvest at the reference, warmer -> shorter DAFB within the clamp, home-vs-itself "same",
  hot place -> sugar up / acid down / softer / paler / sunburn, short season -> unripe).
* Checked in the browser: search ("Wenatchee"), a map click on a live (non-reference) spot near Ellensburg, mobile width,
  no horizontal overflow.

## Open questions
* Honeycrisp scores "not viable" at Wenatchee, Washington's main Honeycrisp district, because summer heat is a critical
  factor and its heat tolerance is 2/5. Commercial orchards there use evaporative cooling and shade netting. Heat probably
  should lower quality (as these notes say) rather than veto viability; changing it would move every map score, so it is
  left for a separate decision.
* Bloom dates in the southern hemisphere look early (Hawke's Bay full bloom ~Sep 7; growers report late Sep-early Oct).
