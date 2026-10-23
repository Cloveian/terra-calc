# New seeds

*Bok Choy and Eggplant showed up in Heidi's shop on 22 Oct (drafted with Claude the same day). How the site, then the userscript, plan with them. The general maths is in [how-terra-works.md, part 10](../research/how-terra-works.md#more-than-one-seed-type), this is the "what we actually do" version.*

## What's real

From the 22 Oct Chrome HAR, `shop.stock` (`dateKey: "2026-10-22"`):

| Seed | itemId | Buy | Sells | Water | Profit at m 1 | Per hour | Per plot |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Apple | `apple_seed` | 5 | 30 | 1 | 25 | 25 | 25 |
| Bok Choy | `bokchoy_seed` | 10 | 37 | 1 | 27 | 27 | 27 |
| Eggplant | `eggplant_seed` | 15 | 75 | 2 | 60 | 30 | 60 |

- the shop entries have `waterNeeded` and `cropValue` on them now, so nothing has to be hardcoded in the userscript
- bonus seeds are **today only** ("new crops will be in tomorrow"), the stock has a `dateKey` now. Apples are always there
- seeds bought this week die after Monday 11:59 PM EDT if they're not planted and watered, same as apples
- water's buyable too, 50 then 55, prices reset Monday. Not planned with (yet)

Eggplant wins per hour *and* per plot, by a lot per plot. Bok choy only beats apples by 2 a crop and costs 5 more, so it loses when coins are tight.

## The model

| Decision | What it does |
| --- | --- |
| Weeks after this one | **Decision:** apples only, or guess some bonus seeds? Default: apples only. Tomorrow's crops aren't known, so the route stays the one seed that's always there and the h/week it asks for is an upper bound |
| This week | The best mix of what you have plus what's in the shop *today* (the site asks which, the userscript reads `shop.stock`) |
| Hours vs crops | The hours are water. The first 10 are the free base crops like before, the rest get split over seeds by their water, a 2-water eggplant takes 2 of them. Plots and plot cost go by crops, not hours |
| Picking the mix | Tries every combination (eggplants \* bok choys, apples fill the rest), keeps the one that ends the week with the most coins. 3 seeds and up to 35 extra hours is a few hundred tries (342 at 35 h), exact, and it doesn't care about water or budget being weird. Seeds you already have cost nothing |
| What "best" means | This week's coins only. Plots you buy are yours for later too, so this undervalues the mixes that use fewer plots a bit. Same short-sightedness the apples-only model already had |
| The cap | Still 45 h a week and 45 plots. Eggplants could let you code past 45 h on 45 plots. **Decision:** allow that? Default: no, the hours box stays 10-45 |
| Rent | Still the 10 free crops, nothing says a bonus crop can pay rent |

## Site

- `data.js`: Bok Choy and Eggplant rows in `CROPS` with `water`, marked as bonus (today only)
- inventory: seeds on hand for each seed, not just apples
- an "in Heidi's shop today" tick per bonus seed, off by default
- a note above the week table says the first week's mix ("Week 1 plants 14 apple + 8 eggplant", biggest first)

## Userscript (after the site)

- `inventoryFrom` counts every seed in the bag, not just apples
- `seedsFrom(shop.stock)`: today's bonus seeds with `waterNeeded`, `cropValue`, `priceCoins`
- the steps buy and plant the mix ("buy 8 eggplant seeds"), code is the water total

## Order to build it

1. ~~`CROPS` rows, the mix maths in `farm.js`, the route's first week using it, tests~~ done 22 Oct. seeds in your bag get planted even when the shop's moved on
2. ~~site inputs (seeds on hand, shop ticks), the hash, the mix in the table~~ done 22 Oct, the mix is a note above the table
3. ~~userscript: seeds in the bag, `seedsFrom`, buy/plant per seed~~ done 22 Oct. the shop's seeds only count on the day the shop said, and there's a "check Heidi's shop" step till you've looked that day
