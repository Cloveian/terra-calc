# How Terra works (for Terra Calc)

Everything about the Terra game that matters for the calculator, in one place: how hours become coins, what eats coins, what the coins buy, and the rules that can knock you out.

**Sources** (each fact is tagged):
- **[code]**: read from the game's own JavaScript (client bundle, 9 Oct 2026) (analyzed with claude)
- **[server]**: a real reply from the game's API, captured 9 Oct 2026 (Prep 2) (analyzed with Claude)
- **[dev]**: answered by a Terra dev (miggy) on Slack, 10 Oct 2026. Beats every other source, including the FAQ.
- **[faq]**: the game's own FAQ / help text
- **[notes]**: from my research notes or Slack, not confirmed by code
- **[unknown]**: decided on the server, not visible anywhere yet

Prices are numbers the server sends. They can change at any time, and the Cidery says it needs your address "to make sure we're showing the right price and item availability" **[code]**, so prices may depend on your country.

---

## 1. Overview

1. You code. Coding time (tracked by Hackatime) becomes **water**.
2. **1 water + 1 seed + 1 dirt plot = 1 crop.**
3. In the main weeks, the first 10 crops each week are **rent** for Ratticus (they still pay 20 coins each). Miss too much rent and you're out.
4. Every other crop is **sold** to the market for **coins**.
5. Coins buy more **seeds and plots** (so you can grow more next time) and **upgrades** for your laptop/tablet in the Cidery.
6. Survive all 12 main weeks and you get the device, plus whatever upgrades you bought.

The calculator answers: *given what I have now and the upgrades I want, how many hours a week do I need?*

---

## 2. Calendar

Weeks run **Monday 00:00 → Sunday 23:59:59, US Eastern time** (`America/New_York`, so DST is handled). **[code]** The server's current week confirms Prep 2 = `2026-10-05T04:00Z` → `2026-10-12T03:59:59.999Z`. **[server]**

| `t` | Week | Dates | Rent? |
| --- | --- | --- | --- |
| 0 | Prep 1 | 9/28 – 10/4 | no |
| 1 | Prep 2 | 10/5 – 10/11 | no |
| 2 | Prep 3 | 10/12 – 10/18 | no |
| 3 | Week 1 | 10/19 – 10/25 | yes |
| … | … | … | yes |
| 14 | Week 12 | 1/4/2027 – 1/10/2027 | yes |

- "Prep weeks start 9/28 and go through 10/18, with the regular/required weeks starting 10/19 and ending 1/10." **[faq]**
- Prep weeks are optional, for building up coins. All 12 main weeks are required. **[faq]**
- `t = floor((date_ET − 2026-09-28) / 7 days)`. `t < 0` = not started, `t > 14` = over.
- The server has its own week numbers (Prep 2 is `number: 7`). Don't use those as `t`. **[server]**
- **Grace water:** water left over from last week can still go on *last week's* crops until a server-set time ("+N last week" in the purse). That's the "wiggle day". It can't be used on the new week's crops. **[code]** How long it lasts is **[unknown]** (notes say ~1 day).

---

## 3. Hours → water

- **Hackatime** tracks coding time; **lapse** can record art time. **[faq]**
- **AI coding counts at 1/3.** Captured example: 28 s of AI time was credited as 9 s. **[code] [server]**
- Up to **30%** of time can be art/assets. **[faq]**
- You **devlog** your time on a project, then **ship** it. A reviewer approves it, and can **deflate** (cut) your hours. **[code]**
- **Crops only grow once a ship is approved** for that week ("Approved ships grow your crops"). **[code]**
- In regular weeks, crops grow once **10 h** are approved for the week ("Crops grow at 10h this week"). **[dev]** You can ship early and **reship** later to add more hours; each ship only counts its own new devlogs. **[code]**
- Water from approved time is `floor((approved_seconds + 5) / 3600)`, so partial hours are dropped. **[code]** (The live estimate shows fractions, e.g. 13799 s = 3.83 water. **[server]**)
- Time only counts toward **that week's** project. Once the week is over, new Hackatime time goes to a new project. **[code]**
- Water **resets every week**. **[notes]**
- When you ship, you also have to **vote** on a few other projects (1–7 stars + Accept/Reject + a written reason). **[code]**

**For the calculator:** `w` = whole approved hours in a week. Deflation and rounding mean planned hours can come out slightly less in practice.

---

## 4. The farm

### Dirt plots

- You start with **10 free plots**. **[notes]**
- Plot price is **`min(1 + n, 10)`**, where `n` = plots you've bought so far. **[dev]** So the 11th plot costs 1, the 12th costs 2, … the 19th costs 9, and **every plot from the 20th on costs 10**. (My old notes had the price keep climbing to 35. That was wrong.) `n` counts plots *bought*, not owned: the 11th plot really costs 1 and the 12th costs 2 in game. **[notes]**
- **Max 45 plots.** The farm's build area is a 7×7 square minus its 4 corners = 45 tiles. **[code]** (Matches the hand-counted map in [island-layout.md](island-layout.md).)
- Plots stay between weeks.
- All 35 extra plots (11 → 45) cost **305** in total.

Price of the next plot when you own `p` plots (`p ≥ 10`) is `min(p − 9, 10)`, so the cost to go from `n` plots to `w` plots is:

$$\text{plotCost}(w, n) = \sum_{p=n}^{w-1} \min(p - 9,\ 10)$$

### Seeds

| Seed | Where | Cost | Notes |
| --- | --- | --- | --- |
| Carrot | Ratticus, free | 0 | 10 per week **[notes]**. In main weeks they're the rent crops. |
| Apple | Heidi's shop | 5 **[notes]** | Under the shop's "Seeds" tab (`bonus_seeds`) **[code]** |

- Items can be tied to a week (`weekNumber`, `usableUntil`), and ones outside the usable weeks are hidden. **[code]**
- **Apple seeds are not limited stock, but they go away at the end of the week.** **[dev]** So only buy what you'll plant that week; leftovers are wasted.

### Crops

- 1 water + 1 seed on an empty plot = 1 crop. **[faq] [code]**
- Crops can **spoil** (the market shows "spoils time"), so sell them in time. **[code]**
- Crops can **dry out** if a reviewer cuts your hours after you watered them. You can devlog more (or buy water) before the week ends to fix it. **[code]**

---

## 5. Rent and debt (how you get knocked out)

- **Main weeks:** the first **10 crops** you plant each week are rent.
- **Rent crops pay 20 coins × multiplier each** when you turn them in (so up to 200 × m a week). **[dev]** The FAQ says they earn nothing; the dev confirmed the FAQ is wrong. The "Rent paid" receipt shows these coins. **[code]**
- **Prep weeks:** no rent, every crop can be sold. **[faq]**
- Crops are held back for their week's rent ("N carrots from Week X are saved for its rent"). Only leftovers can be sold once that rent is paid. **[code]**

**Falling short is not an instant out.** **[code]**
- Being short on rent puts you into **debt** (counted in crops).
- Ratticus then gives you **extra seeds** the next week and expects you to grow all of them, so next week's rent is bigger.
- If debt ever goes **over 10 crops (10 h)**, you've failed Terra: "a full week behind". You keep your coins for the shop but **don't get the laptop**.
- Missing a whole week (no project) puts you off track, and "only an admin can excuse a missed week".

**For the calculator:** treat `w < 10` in a main week as out. That's slightly stricter than the real rule, but planning on debt is a bad idea anyway.

---

## 6. Selling crops (coins in)

| Crop | Base price |
| --- | --- |
| Carrot | 25 |
| Apple | 30 |

**[notes]** Prices come from the server.

- Each week your sell prices get a **multiplier, 0.8–1.5**, based on vote score, project quality and "shipped"-ness. **[notes]** (Olive on Slack)
- The market really does show a per-crop price that differs from base: "quality bonus from your project review (normally X)" or "adjusted by your project review (normally X)". **[code]** Rounding is **[unknown]**.
- **A crop uses the multiplier of the week it was planted**, not the week you sell it. **[dev]**
- The rent receipt also has a slot for a "going viral" bonus that stacks on top of the review multiplier. **[code]** It's **not implemented yet**. **[dev]**

Coins from a week:

- **Prep:** `m × (25 × min(w, 10) + 30 × k)`
- **Main:** `m × (20 × 10 + 30 × k)` (the 10 rent carrots pay 20 each)

where `k = max(0, w − 10)` = apples grown.

---

## 7. Heidi's shop (coins out)

Tabs: **Seeds** (`bonus_seeds`), **Water and plots** (`water`, `dirt_plots`), **Decor and prizes** (`decorations`, `prizes`). **[code]**

| Item | Price |
| --- | --- |
| Apple seed | 5 **[notes]**, not limited stock, expires at the end of the week **[dev]** |
| Dirt plot | `min(1 + n, 10)`, `n` = plots bought so far **[dev]** |
| Water | starts at 50, **+5 per water bought that week, up to 75** (50, 55, 60, 65, 70, 75, 75, …) **[dev]** |

- Stock **refreshes every night at 00:00 Eastern**, and a tab can be empty ("nothing in this basket today — check back tomorrow!"). **[code]** Apple seeds aren't limited. **[dev]**
- Buying water lets you skip coding hours. "If you plan it out, you can skip some hours or even a full week!" **[faq]**
- Buying water **never pays for itself**: one water grows one crop worth at most 30 × m, and water costs 50+. It's only worth it to cover rent hours you can't code. A full skipped week (10 water) costs **675**.

---

## 8. The Cidery (upgrade trees)

You pick **one main device** and buy upgrades for it with coins. **[code]**
- Upgrades are **refundable until they ship**.
- **Switching device refunds every upgrade** bought for the old one, unless something's already been fulfilled.
- If Framework doesn't ship to your country, you get a **$700 laptop grant** instead, upgradeable "just like the framework". **[faq]**

### How node prices and limits work **[code]**

- **Prerequisites** are a list. A node is locked until you own **every** node it requires.
- **Price steps:** some nodes get pricier each time you buy one (`tiers`). The tier count is also the node's limit.
- **Limits** come in three kinds:
  - fixed (default 1)
  - **none** (buy as many as you want)
  - **grows with another node** ("Limit grows with each X you own"): limit = (how many X you own) + a fixed number

### Framework 12 tree **[server]**

| Node                     | Price                                      | Limit                   | Requires     |
| ------------------------ | ------------------------------------------ | ----------------------- | ------------ |
| USB Expansion Card       | 100                                        | **no limit**            | –            |
| Fancy Expansion Card     | 100                                        | **4 + USB cards owned** | –            |
| Framework Stylus         | 500                                        | 1                       | –            |
| Framework 12 DIY Edition | 250                                        | 1                       | –            |
| RAM                      | **750 → 1300 → 2100** (+8GB, +16GB, +16GB) | 3                       | DIY Edition  |
| SSD                      | **1000 → 2000** (+500GB, +1TB)             | 2                       | DIY Edition  |
| Core 3 304               | 400                                        | 1                       | DIY Edition  |
| i5-1334U                 | 400                                        | 1                       | Core 3 304   |
| Core 5 320               | 1500                                       | 1                       | i5-1334U     |
| Framework 13             | 500                                        | 1                       | Core 5 320   |
| 2.8K Display             | 900                                        | 1                       | Framework 13 |
| Ryzen AI 7 350           | 2250                                       | 1                       | Framework 13 |

All RAM = **4150**, all SSD = **3000**. (My old notes had 750×3 = 2250 and 1000×2 = 2000. Those were wrong.)

Device description: *"The most basic of fw12's"*

**Node notes** (word for word from the game) **[server]**

| Node | Note |
| --- | --- |
| USB Expansion Card | "An additional usb A or C expansion card. (the default laptop comes with 4 of these)" |
| Fancy Expansion Card | "Upgrade one of your expansion cards to a fancy one. If you want this to be in addition to the other ones, buy a regular card as well. This includes: audio, displayport, ethernet, hdmi, microsd, and sd." |
| Framework Stylus | "you can draw with this?! (but not on the fw 13 pro btw :p)" |
| Framework 12 DIY Edition | "build it yourself — and pick your own parts while you're at it" |
| +8GB RAM | "get your ram game up!!!! (16GB total)" |
| +16GB RAM (2nd) | "more ram, more tabs (32GB total)" |
| +16GB RAM (3rd) | "at this point it's just showing off (48GB total)" |
| +500GB SSD | "you can download your whole steam library on this one! (1TB total)" |
| +1TB SSD (2nd) | "now you can just about download unreal engine (2TB total)" |
| Core 3 304 | "a proper step up from the base chip" |
| i5-1334U | "get that i5-1334U you've always wanted" |
| Core 5 320 | "now we're cooking" |
| Framework 13 | "woah is that 1 more inch?" |
| Ryzen AI 7 350 | "the latest gen and super quick" |
| 2.8K Display | "can you call it a macbook if they rounded the corners?" |

**What the notes tell us**
- **The stylus doesn't work on the Framework 13.** The game says so itself, so leaving it out of Max 13 is right.
- **The base laptop has 8GB RAM, 500GB SSD and 4 USB cards.** Maxed out it's 48GB RAM and 2TB SSD.
- **Why the Fancy card limit is "4 + USB cards":** a Fancy card *replaces* one of your 4 cards. Want more than 4 Fancy? Buy an extra USB card first, then upgrade that one too. So "USB ×1 + Fancy ×4" (the Max presets) means 5 cards: 4 fancy and 1 plain extra. If you only want your 4 slots upgraded, Fancy ×4 alone (400) is enough. That saves 100 off each preset.

### iPad Mini tree **[server]**

| Node | Price | Requires |
| --- | --- | --- |
| Apple Pencil | 750 | – |
| iPad Air 11 | 400 | – |
| Smart Folio | 600 | – |
| Apple Pencil Pro | 400 | Apple Pencil |
| iPad Air 13 | 1600 | iPad Air 11 |
| iPad Pro 11 | 2000 | iPad Air 13 |
| Magic Keyboard Folio | 1600 | Smart Folio **and** iPad Air 11 |

Everything: **7350**. All limits are 1.

Device description: *"awwww it's so tiny!! (A17 Pro)"*

**Node notes** **[server]**

| Node | Note |
| --- | --- |
| Apple Pencil | "draw good" |
| iPad Air 11 | "a good bit bigger (M4)" |
| Smart Folio | "flippy floppy case!!" |
| Apple Pencil Pro | "draw gooder" |
| iPad Air 13 | "2 more inches?!?! (still M4)" |
| iPad Pro 11 | "ups and downs (11in but M5!)" |
| Magic Keyboard Folio | "does this make it a laptop?" |

So the device path goes iPad Mini (A17 Pro) → Air 11 (M4) → Air 13 (M4) → Pro 11 (M5).

### Galaxy Tab S10 FE+ tree **[server]**

| Node | Price | Requires |
| --- | --- | --- |
| Galaxy Tab S11 | 2400 | – |
| Smart Book Cover | 800 | – |
| Galaxy Tab S10+ | 800 | Galaxy Tab S11 |
| Book Cover Keyboard Slim | 400 | Smart Book Cover |

Everything: **4400**. All limits are 1.

Device description: *"woah is that a better operating system I see?"*

**Node notes** **[server]**

| Node | Note |
| --- | --- |
| Galaxy Tab S11 | "smaller but more powerful" |
| Smart Book Cover | "flippy floppy case!!" |
| Galaxy Tab S10+ | "slightly bigger but about equal power" |
| Book Cover Keyboard Slim | "does this make it a laptop?" |

Odd one: the S10+ needs the S11 first, but the note calls it "about equal power". So it's a size upgrade you can only reach after the power upgrade.

---

## 9. Referrals

Counts people you referred who **complete a week**, not just sign-ups. **[server]**

| Referred people who complete a week | Coins |
| ----------------------------------- | ----- |
| 1                                   | 10    |
| 5                                   | 25    |
| 15                                  | 50    |
| 50                                  | 200   |
| 100                                 | 500   |
|                                     |       |

A referral who just signs up and gets verified earns a cosmetic ("Referrer's Hat"), no coins. **[server]** Not part of the calculator. It's too unpredictable to plan around.

---

## 10. The calculator's model

### One week

Inputs: coins `B`, plots `n`, apple seeds on hand `a`, hours `w`, multiplier `m`.

$$k = \max(0,\ w - 10)$$
$$C = 5\max(0,\ k - a) + \text{plotCost}(w, n)$$
$$S = \begin{cases} m\left(25 \cdot \min(w, 10) + 30k\right) & \text{prep week} \\ m\left(20 \cdot 10 + 30k\right) & \text{main week} \end{cases}$$
$$B \leftarrow B - C + S \qquad n \leftarrow \max(n, w) \qquad a \leftarrow 0$$

(`a` resets to 0 because apple seeds expire at the end of the week.)

Coins are spent during the week (seeds + plots) and only come back once the ship is approved and crops sell. So the coins you have *now* cap how many hours you can use this week: past `w_max`, extra hours have no seed or plot to go into. `w_max` is the biggest `w ≤ 45` with `C ≤ B`. With the capped plot price it's easiest to find with a loop over `w = 0…45` (46 checks, instant). The closed-form `w_max` in [math-stuff.md](math-stuff.md) was built for the old, uncapped plot price and no longer applies.

### Whole run

From the current week to Week 12, each week do `w = min(cap, w_max)`, then the one-week update. Try `cap = 10, 11, … 45` and pick the first one that ends with enough coins for the goal.

### What it means with the real prices

Starting from Prep 2 (4 coins, 13 plots, 3 apple seeds), same multiplier every week:

| Goal | Coins | m = 0.8 | m = 1.0 | m = 1.2 | m = 1.5 |
| --- | --- | --- | --- | --- | --- |
| Framework 13 path (DIY → … → FW13) | 3050 | 13 h | 11 h | 10 h | 10 h |
| Galaxy, everything | 4400 | 19 h | 15 h | 13 h | 11 h |
| iPad, everything | 7350 | 31 h | 24 h | 20 h | 16 h |
| Max 12 (all FW12 nodes, USB ×1, Fancy ×4) | 10700 | no | 35 h | 28 h | 23 h |
| Max 13, no extra USB (Fancy ×4 only) | 13750 | no | 45 h | 36 h | 29 h |
| Max 13 (Max 12 − stylus + FW13, 2.8K, Ryzen) | 13850 | no | no (5 coins short at 45 h) | 36 h | 29 h |

The most coins possible at 45 h every week, m = 1, is **13845**. Doing only the 10 h minimum in main weeks ends with about **2904** coins (rent pay alone is 200 × 12 = 2400).

### Plots are the only thing that compounds

- Coins → more plots → more hours you can use → more coins. Plots are cheap now (305 for all of them), so you hit 45 plots in **Week 1** at full hours.
- After that, every 45 h main week is a flat `(200 + 1050) × m = 1250 × m` coins.
- A crop gets the multiplier of the week it's planted in, so a high multiplier matters in the weeks you plant the most: every main week at 45 h counts the same.

---

## 11. Still unknown

Answered by the dev on 10 Oct: shop stock (not limited), seed expiry (end of week), plot price, water curve, rent pay, which week's multiplier applies, the growth goal, and the viral bonus (not implemented).

| Thing | Why it matters | How to find out |
| --- | --- | --- |
| Multiplier rounding | Coin totals at m ≠ 1 | Sell crops and compare `unitPriceCoins` to base |
| How long grace water lasts | Planning around the wiggle day | Watch the purse after a week ends |
| Prices outside your country | Calculator defaults for other people | Make tree costs editable |
