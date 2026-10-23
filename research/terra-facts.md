# Terra game research

## Schedule (US Eastern)
| Week | Dates |
| --- | --- |
| Prep 1 | 9/28 - 10/4 |
| Prep 2 | 10/5 - 10/11 |
| Prep 3 | 10/12 - 10/18 |
| 1 | 10/19 - 10/25 |
| 2 | 10/26 - 11/1 |
| 3 | 11/2 - 11/8 |
| 4 | 11/9 - 11/15 |
| 5 | 11/16 - 11/22 |
| 6 | 11/23 - 11/29 |
| 7 | 11/30 - 12/6 |
| 8 | 12/7 - 12/13 |
| 9 | 12/14 - 12/20 |
| 10 | 12/21 - 12/27 |
| 11 | 12/28 - 1/3 |
| 12 | 1/4 - 1/10 |

1 wiggle day after each week to spend leftover water / harvest (no extra coding time).

## Core rules
- 1 hour coded (devlogged) = 1 water; 1 water + 1 seed (+ 1 plot) = 1 crop
- AI coding counts at 1/3 (3h AI = 1h)
- 10 free base seeds per week from Ratticus
- Main weeks: first 10 crops are rent, but the week's rent still pays 20 coins × multiplier in total, all 10 together (dev, 10 Oct: "20 * multiplier" when asked if it's 20 total or 20×10; the FAQ is wrong, and so was my first reading of 20 each). Over 10 crops of rent debt = out
- Main weeks: crops grow once 10 h are approved for the week (ship early, reship to add more)
- Prep weeks: every crop earns coins (no rent)
- Water resets every week
- Extra crops are sold to Heidi for coins
- One project per week; ship needs to be experienceable (firmware: demo video)
- Continuing last week's code is fine, just make a new Terra project for it (FAQ)
- Up to 30% of time can be art/assets (track with 
- Water can be bought to skip hours; price rises with each purchase in the same week
- All seeds expire at the end of the week, so only buy apple seeds you'll plant that week
- A crop gets the multiplier of the week it's planted
- More seed types are coming: "we're hoping to release a few more before next week :3" (dev, 10 Oct). Nothing known about them yet. The notes are carrots + apples only
- They showed up 22 Oct: Bok Choy and Eggplant, today-only bonus seeds in Heidi's shop (22 Oct HAR, `shop.stock`, numbers in [new-seeds.md](../docs/new-seeds.md)). And from Week 1 the free base seeds are strawberries, not carrots (a Week 1 inventory capture, `test/fixtures/inventory-sync.json`). Nobody's checked what a strawberry sells for. Doesn't matter while all 10 are rent, the site and userscript never sell one
- Prices of things already in the game are "not that likely to change", but "there might be some small adjustments before the required weeks start" (dev, 10 Oct). Re-check everything on 19 Oct
- Code 15 hours during prep weeks = free Terra t-shirt (from the game's text)
- Buying, planting and watering are instant and can wait until the last day, but crops only grow once the ship is approved, so ship early enough to fix a reviewer cut

## Heidi's shop
| Item       | Price                         |
| ---------- | ----------------------------- |
| Apple Seed | 5 (not limited stock, expires end of week) |
| Dirt Plot  | min(1 + n, 10) (n = plots bought so far), so 11th = 1 … 19th = 9, then 10 each |
| Water      | 50, +5 per water bought that week, max 75 |
| Bok Choy Seed | 10 (today only, some days, 22 Oct HAR) |
| Eggplant Seed | 15 (today only, some days, takes 2 water, 22 Oct HAR) |

### Sell price
| Item | Base Value |
| --- | --- |
| Carrot | 25 |
| Apple | 30 |
| Bok Choy | 37 |
| Eggplant | 75 |
| Strawberry | ? (never sold, they're rent) |

Every week you get a multiplyer from 0.8-1.5 based on a few things:
- vote score
- overall project quality
- "shipped"ness - i.e. how easy was it for the reviewer to figure out how to use your project
*(source: [Olive on Slack](https://hackclub.slack.com/archives/C0C6H1C6SJY/p1791561254699359?thread_ts=1791561065.694439&cid=C0C6H1C6SJY) (word for word))*


## Device upgrade tree 
[Moved](device-trees.md)

## Real USD prices
[Moved](real-prices.md)

## To find out
- Multiplier rounding
- How long grace water (wiggle day) lasts
- New seeds: weeks to grow, stock per week, which weeks they're in the shop, which tab
- Can a crop other than carrots pay rent, and what does it pay
- Re-check all prices (device upgrades + shop) when Week 1 starts (19 Oct)

Answered by the dev (10 Oct): water curve, stock limits, seed expiry, plot price, rent pay, more seeds coming (yes), price stability (unlikely to change, small adjustments possible before Week 1). Details in [how-terra-works.md](how-terra-works.md).

Found: max dirt plots = 45 (7×7 minus corners), RAM/SSD price steps (see [device-trees.md](device-trees.md)). Full list in [how-terra-works.md](how-terra-works.md#11-still-unknown).
