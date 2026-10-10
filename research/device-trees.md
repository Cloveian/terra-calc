# Device Upgrade paths

## Framework

| Node                     | Cost | Quantity | Requires     |
| ------------------------ | ---- | -------- | ------------ |
| Framework Stylus         | 500  | 1        | Framework 12 |
| USB Expansion Card       | 100  | 1        | Framework 12 |
| Fancy Expansion Card     | 100  | 4        | Framework 12 |
| Framework 12 DIY Edition | 250  | 1        | Framework 12 |
| +8GB RAM                 | 750  | 3        | DIY Edition  |
| +500GB SSD               | 1000 | 2        | DIY Edition  |
| Core 3 304               | 400  | 1        | DIY Edition  |
| i5-1334U                 | 400  | 1        | Core 3 304   |
| Core 5 320               | 1500 | 1        | i5-1334U     |
| Framework 13             | 500  | 1        | Core 5 320   |
| 2.8K Display             | 900  | 1        | Framework 13 |
| Ryzen AI 7 350           | 2250 | 1        | Framework 13 |

### Incremental costs

*Path cost* = coins to get there from nothing (the node + everything it requires, bought once).

| Node | Cost each | Cost maxed | Path cost (1st) | Path cost (maxed) |
| --- | --- | --- | --- | --- |
| Framework 12 | free | - | 0 | - |
| USB Expansion Card | 100 | 100 | 100 | 100 |
| Fancy Expansion Card | 100 | 400 | 100 | 400 |
| Framework Stylus | 500 | 500 | 500 | 500 |
| Framework 12 DIY Edition | 250 | 250 | 250 | 250 |
| +8GB RAM | 750 | 2250 | 1000 | 2500 |
| +500GB SSD | 1000 | 2000 | 1250 | 2250 |
| Core 3 304 | 400 | 400 | 650 | 650 |
| i5-1334U | 400 | 400 | 1050 | 1050 |
| Core 5 320 | 1500 | 1500 | 2550 | 2550 |
| Framework 13 | 500 | 500 | 3050 | 3050 |
| 2.8K Display | 900 | 900 | 3950 | 3950 |
| Ryzen AI 7 350 | 2250 | 2250 | 5300 | 5300 |

### Milestones

Running total, each row adds to the one above it.

| Milestone | Adds | Running total |
| --- | --- | --- |
| Framework 13 (DIY → Core 3 → i5 → Core 5 → FW13) | 3050 | 3050 |
| + 2.8K Display | 900 | 3950 |
| + Ryzen AI 7 350 | 2250 | 6200 |
| + RAM ×3 | 2250 | 8450 |
| + SSD ×2 | 2000 | 10450 |
| + USB card + Fancy card ×4 (everything maxed, no stylus) | 500 | 10950 |
| + Stylus (everything maxed) | 500 | 11450 |

Everything once (no repeats): 8650.

### Max builds

| Build | What's in it | Coins |
| --- | --- | --- |
| **Max 12** | DIY + Core 3 → i5 → Core 5, RAM ×3, SSD ×2, USB + Fancy ×4, Stylus | 7800 |
| **Max 13** | Framework 13 + 2.8K + Ryzen AI 7 350, RAM ×3, SSD ×2, USB + Fancy ×4 (no stylus) | 10950 |

- Max 12 = everything except Framework 13, 2.8K Display, Ryzen AI 7 350
- Max 13 = everything except the Stylus (doesn't work on the 13")
- Core 3 / i5 / Core 5 are Framework 12 mainboards but Max 13 still has to buy them to unlock the Framework 13
- TODO: check that RAM/SSD/expansion cards carry over to the 13 (they're on the DIY branch)

**Hours/week needed** (same multiplier every week, from Prep 2: 4 coins, 13 plots, 3 apple seeds)

| $m$ | Max 12 | Max 13 |
| --- | --- | --- |
| 0.8 | 44 | not possible |
| 0.9 | 38 | not possible |
| 1.0 | 34 | 45 |
| 1.1 | 31 | 41 |
| 1.2 | 28 | 37 |
| 1.3 | 27 | 34 |
| 1.4 | 25 | 32 |
| 1.5 | 24 | 30 |



## Samsung Tablet
TODO: if i get to it (low priority)

## Ipad
TODO: if i get to it (low priority)

