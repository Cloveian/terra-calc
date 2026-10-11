# ~~Meth~~ Math n' Stuff

> [!note] Updated 10 Oct 2026
> Rewritten with the rules a Terra dev confirmed: plots cost `min(1 + n, 10)`, the week's rent pays **20 × m in total** (all 10 crops together, not 20 each like I first read it), apple seeds expire at the end of the week, and a crop uses the multiplier of the week it was planted. Sources and details are in [how-terra-works.md](how-terra-works.md).

## Info

### Dirt plots
You start with 10 free plots. Each plot after that costs 1 coin more than the last, **until it hits 10**.

| Plot # | 1-10 | 11 | 12 | 13 | ... | 19 | 20-45 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cost | free | 1 | 2 | 3 | ... | 9 | 10 each |

If you own *n* plots, the next one costs $\min(n - 9,\ 10)$ coins. Max is 45 (build-able tiles on the island). All 35 extra plots cost **305** in total.

### Sell multiplier
Sell prices get multiplied by 0.8-1.5 each week (vote score, project quality, "shipped"ness). A crop uses the multiplier of the week it was **planted**, not the week you sell it.

## Ways to Get Coins

### Plants

| Item | Buy | Sell | Max/week |
| --- | --- | --- | --- |
| Carrot | N/A | 25 (prep), 2 (rent: 20 for all 10) | 10 |
| Apple | 5 | 30 | N/A |
| New seeds | ? | ? | ? |

New seeds are coming ("a few more before next week", dev, 10 Oct). No numbers yet. Everything below is **carrots + apples only**; the general version is in [how-terra-works.md §10](how-terra-works.md#more-than-one-seed-type) and the short form is under "New seeds" below.

### Referrals

Counts people you referred who **complete a week**.

| Referrals | Coins |
| --------- | ----- |
| 1         | 10    |
| 5         | 25    |
| 15        | 50    |
| 50        | 200   |
| 100       | 500   |


## Difrent 'methods' getting coins

### Givens
- During 'real' weeks 10 plots and 10 carrots are deticated to rent (they still pay 20 in total, for all 10).
- To plant something you need a dirt plot 
- Every crop needs 1 water (1 hour coded)
- 10 carrots can be sold during prep weeks
- Apple seeds go away at the end of the week, so only buy what you'll plant
- Seeds are bought with this week's coins, sales arrive after, so the budget caps what you can plant

### Apples

**Cost**
- Seed: 5 coins
- Plot: $\min(n - 9,\ 10)$ coins (only once)
- Water: 1 hour

**What you get**
- 30 \* (multiplier) coins

### Carrots

**Cost**
- Seed: free
- Plot: free
- Water: 1 hour

**What you get**
- Prep weeks: 25 \* (multiplier) coins
- Real weeks: 20 \* (multiplier) coins for the whole week's rent, all 10 carrots together (paid when you turn in rent), so 2 \* (multiplier) a carrot

**Limit**
- 10 per week

### New seeds (numbers unknown)

Seed $i$: buy $b_i$, sell $s_i$. One crop is worth

$$p_i = m s_i - b_i$$

more than you started with (apple: $30m - 5$). For $k$ extra hours with $B'$ coins left after plots, plant $x_i$ of each:

$$\sum_i x_i = k \qquad \sum_i b_i x_i \le B' \qquad \text{maximise } \sum_i p_i x_i$$

At most two seed types get mixed: the best one you can afford, and the cheapest one fills the rest. With apples and one new seed X ($b_X > 5$, $p_X > p_A$):

$$x_X = \min\left(k,\ \left\lfloor \frac{B' - 5k}{b_X - 5} \right\rfloor\right) \qquad x_A = k - x_X$$

Then $C = \text{plotCost}(w, n) + \sum_i b_i x_i$ and $S = m\left(\text{carrots} + \sum_i s_i x_i\right)$.

Assumes 1 water per crop, grows in the week, not limited stock, in the shop every week. If a new seed breaks any of those, see [how-terra-works.md §10](how-terra-works.md#more-than-one-seed-type) ("What breaks the simple case"). Rent stays 10 carrots until someone finds out otherwise.

## Each week

### Items
- $n$ - total owned dirt plots
- 10 Carrot seeds
- 0 water (hours)
- Coin Balance (25 if just starting)

### Per hour gain

**Prep week**

| Hour | Carrots | Apples | Cost                         | Profit         |
| ---- | ------- | ------ | ---------------------------- | -------------- |
| 0-10 | $w$     | 0      | 0                            | $25w\cdot m$   |
| 11+  | 10      | $k$    | $C=5k+\text{plotCost}(w, n)$ | $m(30k+250)-C$ |



*Real Week*

| Hour | Carrots | Apples | Cost                         | Profit         |
| ---- | ------- | ------ | ---------------------------- | -------------- |
| 0-9  | DEATH   | DEATH  | DEATH                        | DEATH          |
| 10   | 10      | 0      | 0                            | $20m$          |
| 11+  | 10      | $k$    | $C=5k+\text{plotCost}(w, n)$ | $m(30k+20)-C$  |


$w$=$\lfloor \text{week's hours} \rfloor$
$k$=hours over 10, aka $(w-10)$
$n$= Total dirt plots owned
$m$=project multiplier

(DEATH = out after too much rent debt, see [how-terra-works.md](how-terra-works.md#5-rent-and-debt-how-you-get-knocked-out). Being a bit short isn't instant death, but don't plan on it.)


> [!math]- Dirt Plot Cost ~~Meth~~ math scratch-pad
> $P(w)$ = coins to go from 10 plots to $w$ plots:
> $$P(w) = \sum_{i=10}^{w-1} \min(i - 9,\ 10)$$
> Up to 19 plots the price is still $1, 2, \ldots, 9$:
> $$P(w) = 1 + 2 + \cdots + (w-10) = \frac{(w-10)(w-9)}{2} \qquad (w \le 19)$$
> That's 45 at $w = 19$. Every plot after that is 10:
> $$P(w) = 45 + 10(w - 19) \qquad (w > 19)$$
> Check: $P(45) = 45 + 260 = 305$.
> $$\text{plotCost}(w, n) = \max\left(0,\ P(w) - P(n)\right)$$


### Most useful hours in a week

Hours aren't an input, they're what the route decides. But each week there's a cap: past it, extra hours have no seed + plot to go into and are wasted.

**Inputs**
- $B$ = coin balance at the start of the week
- $n$ = dirt plots owned
- $m$ = multiplier (guess)

**What caps $w$** (whichever is smallest wins)
1. Plots: $w \le 45$
2. Coins: $C \le B$, so $w \le w_{coins}$

$$w_{coins} = \text{the biggest } w \text{ with } 5\max(0,\ w - 10) + \text{plotCost}(w, n) \le B$$

$$w_{max} = \min\left(45,\ w_{coins}\right)$$

The cost only goes up as $w$ goes up, so just try $w = 0, 1, \ldots, 45$ and keep the last one you can afford. That's 46 checks, instant.

With more seed types the `5` becomes $b_{min}$, the cheapest buyable seed: the cheapest seed decides how many hours you can *use*, the best seed decides what they earn. As long as apples stay the cheapest, $w_{coins}$ doesn't change.

The route picks a $w$ for each week:
- Real weeks: $10 \le w \le w_{max}$ (under 10 = out)
- Prep weeks: $0 \le w \le w_{max}$

> [!math]- Why not a formula anymore
> The old closed form solved $5(w-10) + \frac{(w-n)(w+n-19)}{2} \le B$ as a quadratic. With the price capped at 10, plot cost is quadratic up to 19 plots and a straight line after, so it'd need two cases (and two more for owned seeds). A loop over 46 values is simpler and can't be wrong.

| $B$ | $n$ | $w_{coins}$ | Check: $C(w)$ |
| --- | --- | ----------- | ------------- |
| 10  | 10  | 11          | 6 ≤ 10        |
| 21  | 10  | 13          | 21 ≤ 21       |
| 18  | 12  | 13          | 18 ≤ 18       |
| 15  | 15  | 13          | 15 ≤ 15       |
| 344 | 13  | 36          | 339 ≤ 344     |

**End of week**
- Balance $= B + Profit$ (Profit already has $C$ taken out)



## Route from your inventory

Plug in what you have right now, and the date picks which week you're in.

**Inputs**
- $B$ = coins (Balance)
- $n$ = dirt plots owned
- $a$ = apple seeds owned (not planted yet, only matters this week)
- $d$ = today's date/time (US Eastern)
- $m$ = multiplier (guess)
- cap = most hours you're willing to do per week

### Which week is it?

Weeks start Monday 00:00 ET. Prep 1 starts Mon 9/28/2026.

$$t = \left\lfloor \frac{d - \text{2026-09-28}}{7 \text{ days}} \right\rfloor$$

| $t$ | 0 | 1 | 2 | 3 | ... | 14 |
| --- | --- | --- | --- | --- | --- | --- |
| Week | Prep 1 | Prep 2 | Prep 3 | Week 1 | ... | Week 12 |

- Prep week if $t \le 2$
- Weeks left (counting this one): $15 - t$
- $t < 0$: Terra hasn't started, $t > 14$: it's over
- Wiggle day: after the week ends, leftover water can still go on last week's crops for a bit (how long is unknown), but new hours are for week $t$

### Most useful hours (with seeds on hand)

Seeds you already own this week don't cost coins, but they can't pay for plots either. Same loop, just with the seed cost changed:

$$C = 5\max(0,\ k - a) + \text{plotCost}(w, n) \qquad k = \max(0,\ w - 10)$$

$$w_{max} = \text{the biggest } w \le 45 \text{ with } C \le B$$

Seeds expire at the end of the week, so $a$ only matters for the current week. After that it's always 0.

### Each week after that

Start at week $t$ with $(B, n, a)$, then repeat until week 14:

$$w = \min(\text{cap},\ w_{max}) \qquad k = \max(0,\ w - 10)$$

$$C = 5\max(0,\ k - a) + \text{plotCost}(w, n)$$

$$S = \begin{cases} m\left(25 \cdot \min(w, 10) + 30k\right) & \text{prep week} \\ m\left(20 + 30k\right) & \text{real week} \end{cases}$$

$$B \leftarrow B - C + S \qquad n \leftarrow \max(n, w) \qquad a \leftarrow 0$$

In real weeks, if $w < 10$ you're out.

The final $B$ is what you can spend on the upgrade tree.

## Multi-week run

Example (my situation), simulated with a script. Starts from the end of Prep 2 if all 13 hours get done: 13 plots, 344 coins.

**Assumptions**
- $m = 1$ every week
- Plots stay between weeks, seeds get bought the week they're planted
- Prep 3 sells all crops, real weeks turn in the 10 carrots as rent (20 total)
- Coins are saved up and spent on upgrades at the end
- Each week: $w = \min(w_{max}, \text{cap})$, cap = hours you're willing to do per week

### Goals

From right now (Prep 2: 4 coins, 13 plots, 3 apple seeds), $m = 1$. Costs are in [device-trees.md](device-trees.md). **Apples-only baseline**: a new seed with $p_i > 30m - 5$ can only bring these hours down, one with $p_i \le 30m - 5$ changes nothing. Not recomputed until real numbers exist.

| Goal | Coins | Flat cap needed | Total hours (Prep 2 → Week 12) |
| --- | --- | --- | --- |
| Framework 13 path | 3050 | 17 h/week | 234 |
| Galaxy, everything | 4400 | 22 h/week | 299 |
| iPad, everything | 7350 | 31 h/week | 416 |
| Max 12 | 10700 | 42 h/week | 553 |
| Max 13 | 13850 | not possible at $m = 1$ (2165 coins short at 45 h) | - |
| Max 13, no extra USB | 13750 | not possible at $m = 1$ either (needs $m \ge 1.2$) | - |

Best possible at 45 h every week, $m = 1$: 11685 coins. Doing only the 10 h minimum ends with about 744, most of that from the two prep weeks (rent pay alone is 20 × 12 = 240).

## Multiplier vs hours

The full table (every goal, $m$ = 0.8 to 1.5) is in [device-trees.md](device-trees.md#max-builds). The short version:

| $m$ | Max 12 (10700) | Max 13 (13850) |
| --- | --- | --- |
| 1.0 | 42 h/week | not possible (not even without the extra USB) |
| 1.2 | 35 h/week | 43 h/week |
| 1.5 | 29 h/week | 35 h/week |

### Frontloading

- Plots are the only thing that compounds. A high multiplier early means more coins early, so more plots sooner.
- Plots are cheap now (305 for all of them). At 1.5 in Prep 2, Prep 3 can do 45 useful hours instead of 36.
- Plots hit 45 in Prep 3 at 1.5 and Week 1 at 1.0, so after that there's nothing left to unlock.
- After plots are maxed, every real week at 45 h makes the same $1070m$ (20 rent + 1050 apples, apples-only), so a point of multiplier is worth the same in Week 2 as in Week 12.

**So**
- Prep 3 is where quality pays off extra (unlocks plots + it's a big prep week).
- Weeks with more crops are worth more multiplier. Prep 2 (13 crops) is the smallest week, Week 1+ (45 crops) the biggest.
- A crop uses the multiplier of the week it was planted, so it's the multiplier from the week you did the hours that counts.

## Pay per hour

How much real money an hour of (credited) coding gets you. Real values are from [real-prices.md](real-prices.md): $699 base laptop + each upgrade's real price difference.

**The laptop:** 12 weeks × 10 h rent = 120 h for a $699 laptop, and those rent crops also pay 240 coins at $m = 1$ (≈ $30 of upgrades at 8 coins per \$1). So ≈ **\$6.10/h**. That's still the best rate, every hour past rent earns less.

**Extra hours:** 1 extra hour = 1 apple ≈ $30m - 5$ coins (plus at most 10 for its plot, only once), and the tree is priced at ≈ 8 coins per real \$1, so an extra hour ≈ **\$3/h** at $m = 1$, **≈ \$5/h** at $m = 1.5$. With new seeds the $30m - 5$ becomes the best $p_i$ you can afford, so these rates are the apples-only floor.

| Goal | $m$ | h/week | Total hours | Real value | $/h overall |
| --- | --- | --- | --- | --- | --- |
| Laptop only | 1.0 | 10 | 120 | $699 + ~240 coins | ≈ 6.10 |
| Framework 13 path | 1.0 | 17 | 234 | $1049 | 4.48 |
| Framework 13 path | 1.5 | 14 | 195 | $1049 | 5.38 |
| Max 12 | 1.0 | 42 | 553 | $1943 | 3.51 |
| Max 12 | 1.5 | 29 | 390 | $1943 | 4.98 |
| Max 13 | 1.5 | 35 | 468 | $2324 | 4.97 |

- The multiplier matters most: Max 12 is \$4.98/h at 1.5 but \$3.51/h at 1.0.
- Real rate is lower: AI time counts 1/3, partial hours get dropped, reviewers can cut hours, and thinking/reading away from the editor isn't tracked.
- Hack Club's YSWS guideline is about \$5/h. Only the laptop by itself (rent hours) clears that. With rent paying just 20 × m a week, every upgrade is basically bought with apples at ≈ \$3/h, so the Framework 13 path is a bit under \$5/h at $m = 1$ and a bit over at 1.5, and the big builds only get close to it at 1.5.
