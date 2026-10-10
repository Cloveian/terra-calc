# How Terra works (for Terra Calc)

Everything about the Terra game that matters for the calculator, in one place: how hours become coins, what eats coins, what the coins buy, and the rules that can knock you out.

**Sources** (each fact is tagged):
- **[code]**: read from the game's own JavaScript (client bundle, 9 Oct 2026) (analyzed with claude)
- **[server]**: a real reply from the game's API, captured 9 Oct 2026 (Prep 2) (analyzed with Claude)
- **[dev]**: answered by a Terra dev (miggy) on Slack, 10 Oct 2026. Beats every other source, including the FAQ.
- **[faq]**: the game's own FAQ / help text
- **[notes]**: from my research notes or Slack, not confirmed by code
- **[unknown]**: decided on the server, not visible anywhere yet

Prices are numbers the server sends. They can change at any time, and the Cidery says it needs your address "to make sure we're showing the right price and item availability" **[code]**, so prices may depend on your country. The dev says things already in the game are "not that likely to change", but "there might be some small adjustments before the required weeks start" (Mon 19 Oct). **[dev]** (10 Oct) So: re-check every price (shop + device trees) when Week 1 starts.

**New seeds are coming.** Asked if there'll ever be more seeds than apples: "yeah! we're hoping to release a few more before next week :3". **[dev]** (10 Oct) Nothing else is known about them (price, sell value, water, growth time, stock, tab). Every number in this doc is for carrots + apples, and §10 has the model with any seed list so they can be dropped in.

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
| New seeds | ? | ? | "a few more before next week" **[dev]** (10 Oct). Price, sell value, water per crop, weeks to grow, stock, tab: all **[unknown]** |

- Items can be tied to a week (`weekNumber`, `usableUntil`), and ones outside the usable weeks are hidden. **[code]** So a new seed could be for some weeks only.
- **Apple seeds are not limited stock, but they go away at the end of the week.** **[dev]** So only buy what you'll plant that week; leftovers are wasted.
- The expiry answer was "all seeds", so new seeds should expire at the end of the week too. Whether a *planted* crop that takes more than a week to grow survives the week end is **[unknown]** (no such crop exists yet).

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
| New seeds | **[unknown]** |

**[notes]** Prices come from the server.

- Each week your sell prices get a **multiplier, 0.8–1.5**, based on vote score, project quality and "shipped"-ness. **[notes]** (Olive on Slack)
- The market really does show a per-crop price that differs from base: "quality bonus from your project review (normally X)" or "adjusted by your project review (normally X)". **[code]** Rounding is **[unknown]**.
- **A crop uses the multiplier of the week it was planted**, not the week you sell it. **[dev]**
- The rent receipt also has a slot for a "going viral" bonus that stacks on top of the review multiplier. **[code]** It's **not implemented yet**. **[dev]**

Coins from a week (apples only, the version with any seed list is in §10):

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
| New seeds | **[unknown]**, coming "before next week" **[dev]** (10 Oct). Probably under Seeds (`bonus_seeds`), not confirmed |

- Stock **refreshes every night at 00:00 Eastern**, and a tab can be empty ("nothing in this basket today — check back tomorrow!"). **[code]** Apple seeds aren't limited. **[dev]** Whether new seeds are limited is **[unknown]**. If one is, the nightly refresh means the weekly cap could be 7 × the daily one.
- Prices of things already in the shop are unlikely to change, small adjustments possible before Week 1. **[dev]** (10 Oct)
- Buying water lets you skip coding hours. "If you plan it out, you can skip some hours or even a full week!" **[faq]**
- Buying water **never pays for itself** (with apples): one water grows one crop worth at most 30 × m, and water costs 50+. It's only worth it to cover rent hours you can't code. A full skipped week (10 water) costs **675**. A new seed that sells for more than ~50/m per water would change this, so re-check once the numbers are out.

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

### One week (apples only)

This is what the code does now, with carrots + apples as the only seeds. The version for any seed list is in "More than one seed type" below; with apples only it collapses back to this.

Inputs: coins `B`, plots `n`, apple seeds on hand `a`, hours `w`, multiplier `m`.

$$k = \max(0,\ w - 10)$$
$$C = 5\max(0,\ k - a) + \text{plotCost}(w, n)$$
$$S = \begin{cases} m\left(25 \cdot \min(w, 10) + 30k\right) & \text{prep week} \\ m\left(20 \cdot 10 + 30k\right) & \text{main week} \end{cases}$$
$$B \leftarrow B - C + S \qquad n \leftarrow \max(n, w) \qquad a \leftarrow 0$$

(`a` resets to 0 because apple seeds expire at the end of the week.)

Coins are spent during the week (seeds + plots) and only come back once the ship is approved and crops sell. So the coins you have *now* cap how many hours you can use this week: past `w_max`, extra hours have no seed or plot to go into. `w_max` is the biggest `w ≤ 45` with `C ≤ B`. With the capped plot price it's easiest to find with a loop over `w = 0…45` (46 checks, instant). The closed-form `w_max` in [math-stuff.md](math-stuff.md) was built for the old, uncapped plot price and no longer applies.

### Whole run

From the current week to Week 12, each week do `w = min(cap, w_max)`, then the one-week update. Try `cap = 10, 11, … 45` and pick the first one that ends with enough coins for the goal.

### More than one seed type

New seeds are coming **[dev]** (10 Oct), numbers unknown. This is the one-week model with any list of seeds, so adding one should be a new row in `data.js`, not new math. Nothing here is implemented yet (see [build-plan.md](../docs/build-plan.md#farmjs)).

**Seed list.** Each seed $i$ has a buy price $b_i$ and a sell price $s_i$. One crop of it at multiplier $m$ is worth

$$p_i = m s_i - b_i$$

more coins than you started with. Apple: $p = 30m - 5$. The free carrots are $b = 0$, $s = 25$ (20 as rent), 10 a week.

| Seed | $b_i$ | $s_i$ | $p_i$ at $m = 1$ | Water per crop | Weeks to grow | Stock per week | Which weeks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Carrot | 0 | 25 | 25 | 1 | grows in-week | 10 (free) | all |
| Apple | 5 | 30 | 25 | 1 | grows in-week | not limited | all |
| new seed(s) | ? | ? | ? | ? | ? | ? | ? |

**The simple case** (assume this for a new seed until something says otherwise): 1 water per crop, grows the week it's planted, not limited stock, in the shop every week, expires at the end of the week like apples. Everything below is for the simple case. "What breaks it" covers the rest.

**One week with any seeds.** The first 10 hours are the free carrots (rent in main weeks). Extra hours $k = \max(0,\ w - 10)$ each need a bought seed. Coins left for seeds after plots:

$$B' = B - \text{plotCost}(w, n)$$

Pick how many of each seed to plant, $x_i \ge 0$:

$$\sum_i x_i = k \qquad \sum_i b_i x_i \le B' \qquad \text{maximise } \sum_i p_i x_i$$

Seeds are bought with this week's coins and sales only come in after the ship is approved, so the budget is a real limit: you can't always plant the best seed in every slot. Then

$$C = \text{plotCost}(w, n) + \sum_i b_i x_i$$

$$S = \begin{cases} m\left(25 \cdot \min(w, 10) + \sum_i s_i x_i\right) & \text{prep week} \\ m\left(20 \cdot 10 + \sum_i s_i x_i\right) & \text{main week} \end{cases}$$

$$B \leftarrow B - C + S \qquad n \leftarrow \max(n, w) \qquad a_i \leftarrow 0$$

Same as before, just $\sum_i$ instead of apples. Written out, end-of-week coins are $B - \text{plotCost}(w, n) + (\text{carrot coins}) + \sum_i p_i x_i$, so picking the $x_i$ that maximise $\sum p_i x_i$ is the same as maximising next week's coins. Doing that week by week is the best you can do for the whole run, since sales from week $t$ are what pay for week $t + 1$.

**Solving it.** Two constraints, so the best answer mixes **at most two seed types**: the best one you can afford, and a cheaper one to fill the hours the budget can't cover. First drop any seed that another seed beats on both price and profit (cheaper *and* $p$ at least as high), and any seed with $p_i \le 0$.

With apples (A, $b_A = 5$) and one new seed X that costs more and earns more ($b_X > b_A$, $p_X > p_A$):

$$x_X = \min\left(k,\ \left\lfloor \frac{B' - b_A k}{b_X - b_A} \right\rfloor\right) \qquad x_A = k - x_X$$

(only makes sense when $b_A k \le B'$, i.e. $w \le w_{max}$.) Read it as: pay for $k$ apples first, then every $b_X - b_A$ coins left over upgrades one apple to an X. If X is cheaper *and* better than apples, X just replaces apples everywhere ($b_{min}$ becomes $b_X$).

With more seeds: try every single seed and every pair with the formula above, keep the best feasible one. The exact (fractional) optimum is always a pair, so this finds it, and rounding to whole seeds costs at most one swapped seed. A handful of seed types, so it's instant. Checked against brute force on random cases.

**$w_{max}$.** Hour $w$ is usable only if you can afford a plot and *some* seed for it, so the **cheapest** seed decides how many hours you can use, and the **best** seed decides what they earn:

$$w_{max} = \text{biggest } w \le 45 \text{ with } \text{plotCost}(w, n) + b_{min} \max\left(0,\ k - \textstyle\sum_i a_i\right) \le B$$

$b_{min}$ = cheapest buyable seed (5 while that's apples), $a_i$ = seeds of type $i$ on hand. This is the current `wMax` with `5` → $b_{min}$ and `a` → $\sum a_i$. At $w_{max}$ itself the budget is spent on cheap seeds; with fewer hours there's money for better ones.

**Hours vs better seeds.** Near $w_{max}$, one more hour needs a plot (up to 10) and a cheap seed (5), 15 coins for $p_A$ back (25 at $m = 1$). Those 15 coins could instead turn one apple into an X for $p_X - p_A$ more. Which is better depends on the numbers, but the plot is permanent and the calculator's question is "how many hours", so keep the rule: use every hour up to the cap, *then* pick the best mix. Worth remembering if a new seed turns out to be much better than apples.

**Seeds on hand.** The `a` term becomes per type, $a_i$. They're already paid for and expire at the end of the week, so plant them first (they cost 0 now), then run the mix on the remaining $k - \sum_i a_i$ hours with budget $B'$. Strictly a free seed $i$ is worth $m s_i$ and buying X is worth $p_X$, so if $p_X > m s_i$ you'd rather buy; ignore that, it's a few coins on a few seeds.

**Worked example, made-up numbers.** Pretend a seed X costs **20** and sells for **65**. (Not real. Just to see the math move.) $m = 1$, prep week, $B = 200$, $n = 25$ plots, nothing on hand. So $p_A = 25$, $p_X = 45$.

| Plan | $w$ | $k$ | Plots | Seeds | $C$ | $S$ | End coins |
| --- | --- | --- | --- | --- | --- | --- | --- |
| all apples | 25 | 15 | 0 | 15 × 5 = 75 | 75 | 250 + 450 = 700 | 825 |
| best mix | 25 | 15 | 0 | 8 X + 7 A = 160 + 35 = 195 | 195 | 250 + 520 + 210 = 980 | **985** |
| all apples at $w_{max}$ | 33 | 23 | 80 | 23 × 5 = 115 | 195 | 250 + 690 = 940 | 945, +8 plots |

- Mix at $w = 25$: $B' = 200$. All X would cost 300. $x_X = \lfloor (200 - 75) / 15 \rfloor = 8$, $x_A = 7$. 9 X + 6 A would cost 210, too much. Check: $200 + 250 + 8 \cdot 45 + 7 \cdot 25 = 985$.
- $w_{max}$: $w = 33$ costs $80 + 115 = 195 \le 200$, $w = 34$ costs $90 + 120 = 210$. Same as apples-only, because apples are still the cheapest seed. At $w = 33$, $B' = 120$ and 23 apples cost 115, so $x_X = \lfloor 5 / 15 \rfloor = 0$.
- So this week, 25 h with the mix beats 33 h of apples (985 vs 945), but the 33 h week ends with 8 more plots. That's the "hours vs better seeds" trade-off above.

**What breaks the simple case.** Each of these needs data the calculator doesn't have a slot for yet.

- *Limited stock.* Add $x_i \le q_i$. The mix fills the best seed up to its cap, then the next best, and the pair rule above runs on what's left. $w_{max}$ only changes if *every* seed is limited (then $w_{max} \le 10 + \sum_i q_i + \sum_i a_i$). Stock refreshes nightly **[code]**, so a weekly $q_i$ may be 7 × daily. Needs: `stock` per seed (null = not limited).
- *More than 1 water per crop.* Hours stop being crops. A crop of seed $i$ takes $h_i$ water, so $\sum_i h_i x_i = k$, plots used are $\sum_i x_i$, plotCost and $n \leftarrow \max(n, \cdot)$ run on crops not hours, and the thing to compare is profit per water, $p_i / h_i$. Rent stays 10 crops only if carrots stay 1 water. Needs: `water` per seed.
- *Takes more than a week to grow.* Coins arrive $g_i - 1$ weeks later, so the week's $S$ splits into "now" and "later" and the state needs a queue of pending sales. The plot stays occupied, so next week has fewer free plots. The crop keeps the multiplier of the week it was planted **[dev]**, which already fits. Whether the planted crop survives the week end (seeds don't) is **[unknown]**. Needs: `weeks` per seed, plus `pending: [{ week, coins }]` and `busyPlots` in the state.
- *Only in some weeks.* Items carry `weekNumber` / `usableUntil` and are hidden outside them **[code]**. The seed list becomes a function of $t$: in week $t$ only seeds with $\text{from}_i \le t \le \text{until}_i$ are buyable, so $b_{min}$, the best $p_i$ and $w_{max}$ can differ week to week. Needs: `from` / `until` per seed (in `t`), default "always".

**Rent.** The 10 rent crops are the 10 free carrots. Whether a new crop can pay rent, and what it'd pay, is **[unknown]**. Until then, rent = 10 carrots at 20 × m and new seeds only go in the extra hours. One side effect of the general model: in prep weeks nothing forces carrots into the first 10 hours, and at $m > 1$ an apple ($30m - 5$) already beats a free carrot ($25m$) by $5m - 5$ a crop, at most 25 coins a week. The calculator keeps carrots first. If a new seed has $p_i$ far above $25m$, that choice is worth revisiting (see the design spec).

**Effort estimate.** `nodeHours(coins, m) = coins / (30m − 5)` becomes

$$\text{nodeHours}(coins, m) = \frac{coins}{\max_i p_i(m)}$$

over the seeds buyable that week. It's rough either way: ignores plots, the budget cap and rent pay.

**Numbers in this doc.** Every table (hours per goal at each $m$, 13845 best possible at 45 h, 2904 at the 10 h minimum, 1250 × m per full main week) is the **apples-only baseline**. A new seed with $p_i > 30m - 5$ can only lower the hours needed; a new seed with $p_i \le 30m - 5$ changes nothing. They're not recomputed until real numbers exist.

### What it means with the real prices (apples-only baseline)

Starting from Prep 2 (4 coins, 13 plots, 3 apple seeds), same multiplier every week, carrots + apples only:

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
- After that, every 45 h main week is a flat `(200 + 1050) × m = 1250 × m` coins (apples only; a better seed raises the 1050).
- A crop gets the multiplier of the week it's planted in, so a high multiplier matters in the weeks you plant the most: every main week at 45 h counts the same.

---

## 11. Still unknown

Answered by the dev on 10 Oct: shop stock (not limited), seed expiry (end of week), plot price, water curve, rent pay, which week's multiplier applies, the growth goal, the viral bonus (not implemented), more seeds coming (yes, "before next week"), and price stability (unlikely to change, small adjustments possible before Week 1).

| Thing | Why it matters | How to find out |
| --- | --- | --- |
| Multiplier rounding | Coin totals at m ≠ 1 | Sell crops and compare `unitPriceCoins` to base |
| How long grace water lasts | Planning around the wiggle day | Watch the purse after a week ends |
| Prices outside your country | Calculator defaults for other people | Make tree costs editable |
| New seeds: buy price, sell price | $p_i = m s_i - b_i$, the whole §10 mix | Shop + market once they're released |
| New seeds: water per crop, weeks to grow | Whether the simple case holds (hours = crops, coins same week) | Plant one and watch |
| New seeds: stock per week, which weeks | Caps on $x_i$, seed list per week (`weekNumber`, `usableUntil`) | Shop tab over a few days / weeks |
| Can other crops pay rent, and what do they pay | The `20 × 10` rent term | Try it in Week 1, or ask |
| Re-check all prices when Week 1 starts (19 Oct) | Dev: small adjustments possible before then | `/device-upgrades` + shop on 19 Oct, update `data.js` and `PRICES_AS_OF` |
