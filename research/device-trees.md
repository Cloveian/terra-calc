# Device Upgrade paths

Source: the game's `/device-upgrades` data (captured 9 Oct 2026, Prep 2). Prices can change, and may depend on your country (the Cidery asks for your address "to make sure we're showing the right price"). How the tree rules work is in [how-terra-works.md](how-terra-works.md#8-the-cidery-upgrade-trees).

**Rules**
- Pick one device. Switching refunds everything bought for the old one (unless already fulfilled).
- A node needs **all** of its "Requires" nodes first.
- Some nodes get pricier each time you buy one (RAM, SSD).
- Upgrades are refundable until they ship.

## Framework

| Node                     | Cost                 | Limit               | Requires     |
| ------------------------ | -------------------- | ------------------- | ------------ |
| Framework Stylus         | 500                  | 1                   | Framework 12 |
| USB Expansion Card       | 100                  | no limit            | Framework 12 |
| Fancy Expansion Card     | 100                  | 4 + USB cards owned | Framework 12 |
| Framework 12 DIY Edition | 250                  | 1                   | Framework 12 |
| RAM                      | 750 → 1300 → 2100    | 3                   | DIY Edition  |
| SSD                      | 1000 → 2000          | 2                   | DIY Edition  |
| Core 3 304               | 400                  | 1                   | DIY Edition  |
| i5-1334U                 | 400                  | 1                   | Core 3 304   |
| Core 5 320               | 1500                 | 1                   | i5-1334U     |
| Framework 13             | 500                  | 1                   | Core 5 320   |
| 2.8K Display             | 900                  | 1                   | Framework 13 |
| Ryzen AI 7 350           | 2250                 | 1                   | Framework 13 |

**Notes from the game**

| Node | Note |
| --- | --- |
| Framework 12 | "The most basic of fw12's" |
| USB Expansion Card | "An additional usb A or C expansion card. (the default laptop comes with 4 of these)" |
| Fancy Expansion Card | "Upgrade one of your expansion cards to a fancy one. If you want this to be in addition to the other ones, buy a regular card as well. This includes: audio, displayport, ethernet, hdmi, microsd, and sd." |
| Framework Stylus | "you can draw with this?! (but not on the fw 13 pro btw :p)" |
| Framework 12 DIY Edition | "build it yourself — and pick your own parts while you're at it" |
| +8GB RAM (1st) | "get your ram game up!!!! (16GB total)" |
| +16GB RAM (2nd) | "more ram, more tabs (32GB total)" |
| +16GB RAM (3rd) | "at this point it's just showing off (48GB total)" |
| +500GB SSD (1st) | "you can download your whole steam library on this one! (1TB total)" |
| +1TB SSD (2nd) | "now you can just about download unreal engine (2TB total)" |
| Core 3 304 | "a proper step up from the base chip" |
| i5-1334U | "get that i5-1334U you've always wanted" |
| Core 5 320 | "now we're cooking" |
| Framework 13 | "woah is that 1 more inch?" |
| Ryzen AI 7 350 | "the latest gen and super quick" |
| 2.8K Display | "can you call it a macbook if they rounded the corners?" |

- Base laptop: 8GB RAM, 500GB SSD, 4 USB cards. Maxed: 48GB RAM, 2TB SSD.
- A Fancy card **replaces** one of your 4 cards. For a 5th card (fancy or not), buy a USB card first.
- The stylus doesn't work on the 13.

### Incremental costs

*Path cost* = coins to get there from nothing (the node + everything it requires, bought once).

| Node | Cost each | Cost maxed | Path cost (1st) | Path cost (maxed) |
| --- | --- | --- | --- | --- |
| Framework 12 | free | - | 0 | - |
| USB Expansion Card | 100 | no limit | 100 | - |
| Fancy Expansion Card | 100 | 400 (4 slots) | 100 | 400 |
| Framework Stylus | 500 | 500 | 500 | 500 |
| Framework 12 DIY Edition | 250 | 250 | 250 | 250 |
| RAM | 750 / 1300 / 2100 | 4150 | 1000 | 4400 |
| SSD | 1000 / 2000 | 3000 | 1250 | 3250 |
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
| + RAM ×3 (750 + 1300 + 2100) | 4150 | 10350 |
| + SSD ×2 (1000 + 2000) | 3000 | 13350 |
| + USB card + Fancy card ×4 (no stylus) | 500 | 13850 |
| + Stylus | 500 | 14350 |

Everything once (no repeats): 8650.

There's no true "everything maxed" anymore: USB cards have no limit, and each one lets you buy one more Fancy card.

### Max builds

| Build | What's in it | Coins |
| --- | --- | --- |
| **Max 12** | DIY + Core 3 → i5 → Core 5, RAM ×3, SSD ×2, USB + Fancy ×4, Stylus | 10700 |
| **Max 13** | Framework 13 + 2.8K + Ryzen AI 7 350, RAM ×3, SSD ×2, USB + Fancy ×4 (no stylus) | 13850 |

- Max 12 = everything except Framework 13, 2.8K Display, Ryzen AI 7 350
- Max 13 = everything except the Stylus (doesn't work on the 13")
- Core 3 / i5 / Core 5 are Framework 12 mainboards but Max 13 still has to buy them to unlock the Framework 13
- RAM, SSD, and expansion cards carry over to the 13
- Skipping the extra USB card (Fancy ×4 only, i.e. just your 4 slots upgraded) takes 100 off: **10600** / **13750**

**Hours/week needed** (same multiplier every week, from Prep 2: 4 coins, 13 plots, 3 apple seeds)

| $m$ | Max 12 | Max 13 | Max 13, no extra USB | FW13 path (3050) |
| --- | --- | --- | --- | --- |
| 0.8 | not possible | not possible | not possible | 21 |
| 0.9 | not possible | not possible | not possible | 19 |
| 1.0 | 44 | not possible | not possible | 18 |
| 1.1 | 40 | not possible | not possible | 17 |
| 1.2 | 36 | not possible | 45 | 16 |
| 1.3 | 34 | 42 | 41 | 16 |
| 1.4 | 31 | 39 | 38 | 15 |
| 1.5 | 30 | 36 | 36 | 15 |

Best possible at 45 h every week, $m = 1$: 10995 coins. Max 13 needs $m$ just over 1.2 at 45 h/week (or just 1.2 without the extra USB card).

## Samsung Tablet

Device: **Galaxy Tab S10 FE+**, "woah is that a better operating system I see?"

| Node                     | Cost | Limit | Requires         | Note |
| ------------------------ | ---- | ----- | ---------------- | ---- |
| Galaxy Tab S11           | 2400 | 1     | -                | "smaller but more powerful" |
| Smart Book Cover         | 800  | 1     | -                | "flippy floppy case!!" |
| Galaxy Tab S10+          | 800  | 1     | Galaxy Tab S11   | "slightly bigger but about equal power" |
| Book Cover Keyboard Slim | 400  | 1     | Smart Book Cover | "does this make it a laptop?" |

| Node | Path cost |
| --- | --- |
| Galaxy Tab S11 | 2400 |
| Smart Book Cover | 800 |
| Galaxy Tab S10+ | 3200 |
| Book Cover Keyboard Slim | 1200 |
| **Everything** | **4400** |

- The S10+ needs the S11 first, but is "about equal power", so it's a size upgrade you can only reach after the power one.

## Ipad

Device: **iPad Mini** (A17 Pro), "awwww it's so tiny!!"

| Node                 | Cost | Limit | Requires                      | Note |
| -------------------- | ---- | ----- | ----------------------------- | ---- |
| Apple Pencil         | 750  | 1     | -                             | "draw good" |
| iPad Air 11          | 400  | 1     | -                             | "a good bit bigger (M4)" |
| Smart Folio          | 600  | 1     | -                             | "flippy floppy case!!" |
| Apple Pencil Pro     | 400  | 1     | Apple Pencil                  | "draw gooder" |
| iPad Air 13          | 1600 | 1     | iPad Air 11                   | "2 more inches?!?! (still M4)" |
| iPad Pro 11          | 2000 | 1     | iPad Air 13                   | "ups and downs (11in but M5!)" |
| Magic Keyboard Folio | 1600 | 1     | Smart Folio **and** iPad Air 11 | "does this make it a laptop?" |

| Node | Path cost |
| --- | --- |
| Apple Pencil | 750 |
| iPad Air 11 | 400 |
| Smart Folio | 600 |
| Apple Pencil Pro | 1150 |
| iPad Air 13 | 2000 |
| iPad Pro 11 | 4000 |
| Magic Keyboard Folio | 2600 |
| **Everything** | **7350** |

- Device path: Mini (A17 Pro) → Air 11 (M4) → Air 13 (M4) → Pro 11 (M5)
- Magic Keyboard Folio is the only node in any tree with two requirements

## Tablets: hours/week needed

Everything in the tree, same multiplier every week, from Prep 2 (4 coins, 13 plots, 3 apple seeds).

| $m$ | Galaxy (4400) | iPad (7350) |
| --- | --- | --- |
| 0.8 | 27 | 41 |
| 0.9 | 24 | 36 |
| 1.0 | 22 | 32 |
| 1.1 | 21 | 29 |
| 1.2 | 20 | 27 |
| 1.3 | 19 | 26 |
| 1.4 | 18 | 24 |
| 1.5 | 17 | 23 |
