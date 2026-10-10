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
- Main weeks: first 10 crops are rent, earn no coins; miss rent once out
- Prep weeks: every crop earns coins (no rent)
- Water resets every week
- Extra crops are sold to Heidi for coins
- One project per week; ship needs to be experienceable (firmware: demo video)
- Up to 30% of time can be art/assets (track with 
- Water can be bought to skip hours; price rises with each purchase in the same week
- Code 15 hours during prep weeks = free Terra t-shirt (from the game's text)
- Buying, planting and watering are instant and can wait until the last day, but crops only grow once the ship is approved, so ship early enough to fix a reviewer cut

## Heidi's shop
| Item       | Price                         |
| ---------- | ----------------------------- |
| Apple Seed | 5                             |
| Dirt Plot  | n-9 (n=num plots you have)    |
| Water      | 50 (escalates, curve unknown) |

### Sell price
| Item | Base Value |
| --- | --- |
| Carrot | 25 |
| Apple | 30 |

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
- Water price curve (every water bought in the same week costs more)
- Shop stock limits (can you buy 35 apple seeds a week?)
- Multiplier range + rounding
- Whether bought seeds expire
- How long grace water (wiggle day) lasts

Found: max dirt plots = 45 (7×7 minus corners), RAM/SSD price steps (see [device-trees.md](device-trees.md)). Full list in [how-terra-works.md](how-terra-works.md#11-still-unknown).
