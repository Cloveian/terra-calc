# ~~Meth~~ Math n' Stuff

> [!note] Updated 10 Oct 2026
> Rewritten with the rules a Terra dev confirmed: plots cost `min(1 + n, 10)`, rent crops pay **20 × m** each, apple seeds expire at the end of the week, and a crop uses the multiplier of the week it was planted. Sources and details are in [how-terra-works.md](how-terra-works.md).

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
| Carrot | N/A | 25 (prep), 20 (rent) | 10 |
| Apple | 5 | 30 | N/A |

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
- During 'real' weeks 10 plots and 10 carrots are deticated to rent (they still pay 20 each).
- To plant something you need a dirt plot 
- Every crop needs 1 water (1 hour coded)
- 10 carrots can be sold during prep weeks
- Apple seeds go away at the end of the week, so only buy what you'll plant

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
- Real weeks: 20 \* (multiplier) coins (paid when you turn in rent)

**Limit**
- 10 per week

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
| 10   | 10      | 0      | 0                            | $200m$         |
| 11+  | 10      | $k$    | $C=5k+\text{plotCost}(w, n)$ | $m(30k+200)-C$ |


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

$$S = \begin{cases} m\left(25 \cdot \min(w, 10) + 30k\right) & \text{prep week} \\ m\left(20 \cdot 10 + 30k\right) & \text{real week} \end{cases}$$

$$B \leftarrow B - C + S \qquad n \leftarrow \max(n, w) \qquad a \leftarrow 0$$

In real weeks, if $w < 10$ you're out.

The final $B$ is what you can spend on the upgrade tree.

## Multi-week run

Example (my situation), simulated with a script. Starts from the end of Prep 2 if all 13 hours get done: 13 plots, 344 coins.

**Assumptions**
- $m = 1$ every week
- Plots stay between weeks, seeds get bought the week they're planted
- Prep 3 sells all crops, real weeks turn in the 10 carrots as rent (20 each)
- Coins are saved up and spent on upgrades at the end
- Each week: $w = \min(w_{max}, \text{cap})$, cap = hours you're willing to do per week

### Goals

From right now (Prep 2: 4 coins, 13 plots, 3 apple seeds), $m = 1$. Costs are in [device-trees.md](device-trees.md).

| Goal | Coins | Flat cap needed | Total hours (Prep 2 → Week 12) |
| --- | --- | --- | --- |
| Framework 13 path | 3050 | 11 h/week | 154 |
| Galaxy, everything | 4400 | 15 h/week | 208 |
| iPad, everything | 7350 | 24 h/week | 325 |
| Max 12 | 10700 | 35 h/week | 468 |
| Max 13 | 13850 | not possible at $m = 1$ (5 coins short at 45 h) | - |
| Max 13, no extra USB | 13750 | 45 h/week | 589 |

Best possible at 45 h every week, $m = 1$: 13845 coins. Doing only the 10 h minimum ends with about 2904, almost the Framework 13 path just from rent pay.

## Multiplier vs hours

The full table (every goal, $m$ = 0.8 to 1.5) is in [device-trees.md](device-trees.md#max-builds). The short version:

| $m$ | Max 12 (10700) | Max 13 (13850) |
| --- | --- | --- |
| 1.0 | 35 h/week | not possible (45 h without the extra USB) |
| 1.2 | 28 h/week | 36 h/week |
| 1.5 | 23 h/week | 29 h/week |

### Frontloading

- Plots are the only thing that compounds. A high multiplier early means more coins early, so more plots sooner.
- Plots are cheap now (305 for all of them). At 1.5 in Prep 2, Prep 3 can do 45 useful hours instead of 36.
- Plots hit 45 in Prep 3 at 1.5 and Week 1 at 1.0, so after that there's nothing left to unlock.
- After plots are maxed, every real week at 45 h makes the same $1250m$ (200 rent + 1050 apples), so a point of multiplier is worth the same in Week 2 as in Week 12.

**So**
- Prep 3 is where quality pays off extra (unlocks plots + it's a big prep week).
- Weeks with more crops are worth more multiplier. Prep 2 (13 crops) is the smallest week, Week 1+ (45 crops) the biggest.
- A crop uses the multiplier of the week it was planted, so it's the multiplier from the week you did the hours that counts.

## Pay per hour

How much real money an hour of (credited) coding gets you. Real values are from [real-prices.md](real-prices.md): $699 base laptop + each upgrade's real price difference.

**The laptop:** 12 weeks × 10 h rent = 120 h for a $699 laptop, and those rent crops also pay 2400 coins at $m = 1$ (≈ $300 of upgrades at 8 coins per \$1). So ≈ **\$8.30/h**. That's the best rate, every hour past rent earns less.

**Extra hours:** 1 extra hour = 1 apple ≈ $30m - 5$ coins (plus at most 10 for its plot, only once), and the tree is priced at ≈ 8 coins per real \$1, so an extra hour ≈ **\$3/h** at $m = 1$, **≈ \$5/h** at $m = 1.5$.

| Goal | $m$ | h/week | Total hours | Real value | $/h overall |
| --- | --- | --- | --- | --- | --- |
| Laptop only | 1.0 | 10 | 120 | $699 + ~2400 coins | ≈ 8.30 |
| Framework 13 path | 1.0 | 11 | 154 | $1049 | 6.81 |
| Framework 13 path | 1.5 | 10 | 140 | $1049 | 7.49 |
| Max 12 | 1.0 | 35 | 468 | $1943 | 4.15 |
| Max 12 | 1.5 | 23 | 312 | $1943 | 6.23 |
| Max 13 | 1.5 | 29 | 390 | $2324 | 5.96 |

- The multiplier matters most: Max 12 is \$6.23/h at 1.5 but \$4.15/h at 1.0.
- Real rate is lower: AI time counts 1/3, partial hours get dropped, reviewers can cut hours, and thinking/reading away from the editor isn't tracked.
- Hack Club's YSWS guideline is about \$5/h. With rent paying coins, small goals come out above that, and the big builds come out close to it.
