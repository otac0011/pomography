# 0009 - Separate climate and disease scores

Date: 2026-10-06. Status: accepted.

## Context (user request)
"If an apple is suited to the climate, but will get wrecked by disease, it still scores high. I want two separate
scores: one for climate/water/etc., and a separate disease score, and show the bar that represents
resistance/susceptibility (you can asterisk if assumed)."

Before this, disease was one of seven weighted factors (weight 1.5 of 15.7) and was not critical, so even the worst
possible disease factor (0) only took about 10 points off. Gala in the Hudson Valley scored 81 overall while its disease
factor was 0.23.

## Decisions
1. **Climate score** = the old score without the disease factor: chill, winter cold, ripening season and summer heat
   (critical), blossom frost and water. Weights and the critical-factor penalty are unchanged (`WEIGHTS` in score.js).
2. **Disease score** = 100 × the existing disease product: for scab, European canker, powdery mildew, fire blight and
   cedar-apple rust, loss = pressure here (0-1) × susceptibility weight (1→0.03 … 5→1.0) × how damaging the disease is
   (0.4-0.8); score = 100 × Π(1 − loss). Words: 85+ low, 65+ some, 40+ high, below 40 severe disease risk. It assumes
   no spraying, so the text says "spray, or choose a more resistant apple" rather than "impossible".
3. **Per-disease table** wherever a score is explained (map panel rows, "Grow it where you are"): a bar for the pressure
   here and a 1-5 susceptibility meter coloured green to red. An unrecorded susceptibility is assumed 3 and marked
   with **\***; most canker, fire blight and rust ratings are unrecorded (523-558 of 646 apples), so the asterisk matters.
4. **Ranking** of "best here" lists and a variety's best/hardest places uses `both` = the lower of the two scores, so
   either can sink an apple. The map panel's "Best here" tab has a sort menu (both / climate only / disease only).
   *Rejected:* a product or weighted blend - that is the single number the user asked to get rid of; the minimum is
   easy to explain and keeps both scores visible.
5. **Map dots** keep showing the climate score (mean over your favourites, or a broad sample). Disease depends on the
   apple far more than climate does, so a disease average over a sample of apples says little about the place.

## Example (Hudson Valley, NY)
| Apple | climate | disease | old single score |
|---|---|---|---|
| Gala (scab 4, fire blight 4) | 87 | 23 | 81 |
| Liberty (scab-resistant) | 79 | 76 | 77 |
| Honeycrisp | 53 | 46 | 51 |
