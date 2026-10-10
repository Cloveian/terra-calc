# ~~Meth~~ Math n' Stuff

## Info

### Dirt plots
You start with 10 free plots. Each plot after that costs 1 coin more than the last.

| Plot # | 1-10 | 11 | 12 | 13 | ... | 45 |
| --- | --- | --- | --- | --- | --- | --- |
| Cost | free | 1 | 2 | 3 | ... | 35 |

If you own *n* plots, the next one costs *n* - 9 coins. Max is 45 (build-able tiles on the island).

### Sell multiplier
Sell prices get multiplied by 0.8-1.5 each week (vote score, project quality, "shipped"ness).

## Ways to Get Coins

### Plants

| Item | Buy | Sell | Max/week |
| --- | --- | --- | --- |
| Carrot | N/A | 25 | 10 |
| Apple | 5 | 30 | N/A |

### Referrals

| Referrals | Coins |
| --------- | ----- |
| 1         | 10    |
| 5         | 25    |
| 15        | 50    |
| 50        | 200   |
| 100       | 500   |


## Difrent 'methods' getting coins

### Givens
- During 'real' weeks 10 plots and 10 carrots are deticated to rent.
- To plant something you need a dirt plot 
- Every crop needs 1 water (1 hour coded)
- 10 carrots can be sold during prep weeks

### Apples

**Cost**
- Seed: 5 coins
- Plot: $n - 9$ coins (only once)
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
- Real weeks: 0 coins

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

| Hour | Carrots | Apples | Cost                                                | Profit         |
| ---- | ------- | ------ | --------------------------------------------------- | -------------- |
| 0-10 | $w$     | 0      | 0                                                   | $25w\cdot m$   |
| 11+  | 10      | $k$    | $C=5k+\max\left(0,\ \frac{(w-n)(w+n-19)}{2}\right)$ | $m(30k+250)-C$ |



*Real Week*

| Hour | Carrots | Apples | Cost                                                | Profit   |
| ---- | ------- | ------ | --------------------------------------------------- | -------- |
| 0-9  | DEATH   | DEATH  | DEATH                                               | DEATH    |
| 10   | 10      | 0      | 0                                                   | 0        |
| 11+  | 10      | $k$    | $C=5k+\max\left(0,\ \frac{(w-n)(w+n-19)}{2}\right)$ | $30km-C$ |


$w$=$\lfloor \text{week's hours} \rfloor$
$k$=hours over 10, aka $(w-10)$
$n$= Total dirt plots owned
$m$=project multiplier


> [!math]- Dirt Plot Cost ~~Meth~~ math scratch-pad
> $$DirtPlotCost = \sum_{i=n}^{w-1} (i - 9)$$
> $$\sum_{i=n}^{w-1}(i-9) = \sum_{i=10}^{w-1}(i-9) - \sum_{i=10}^{n-1}(i-9)$$
> $$\sum_{i=10}^{w-1}(i-9) = 1 + 2 + \cdots + (w-10) = \frac{(w-10)(w-9)}{2}$$
> $$DirtPlotCost = \frac{(w-10)(w-9)}{2} - \frac{(n-10)(n-9)}{2} = \frac{(w-n)(w+n-19)}{2}$$
> $$DirtPlotCost=\max\left(0,\ \frac{(w-n)(w+n-19)}{2}\right)$$


### Most useful hours in a week

Hours aren't an input, they're what the route decides. But each week there's a cap: past it, extra hours have no seed + plot to go into and are wasted.

**Inputs**
- $B$ = coin balance at the start of the week
- $n$ = dirt plots owned
- $m$ = multiplier (guess)

**What caps $w$** (whichever is smallest wins)
1. Plots: $w \le 45$
2. Coins: $C \le B$, so $w \le w_{coins}$

$$w_{coins} = \begin{cases} 10 + \left\lfloor \frac{B}{5} \right\rfloor & \text{if } 10 + \left\lfloor \frac{B}{5} \right\rfloor \le n \text{ (enough plots already)} \\[6pt] \left\lfloor \frac{9 + \sqrt{4n^2 - 76n + 481 + 8B}}{2} \right\rfloor & \text{otherwise (buying plots)} \end{cases}$$

$$w_{max} = \min\left(45,\ w_{coins}\right)$$

The route picks a $w$ for each week:
- Real weeks: $10 \le w \le w_{max}$ (under 10 = out)
- Prep weeks: $0 \le w \le w_{max}$

> [!math]- Coin limit ~~Meth~~ math scratch-pad
> No new plots ($w \le n$), seeds cost coins:
> $$5(w-10) \le B \implies w \le 10 + \frac{B}{5}$$
> Buying plots ($w > n$):
> $$5(w-10) + \frac{(w-n)(w+n-19)}{2} \le B$$
> $$10w - 100 + w^2 - 19w - n^2 + 19n \le 2B$$
> $$w^2 - 9w - (n^2 - 19n + 100 + 2B) \le 0$$
> $$w \le \frac{9 + \sqrt{81 + 4(n^2 - 19n + 100 + 2B)}}{2} = \frac{9 + \sqrt{4n^2 - 76n + 481 + 8B}}{2}$$

| $B$ | $n$ | $w_{coins}$ | Check: $C(w)$ |
| --- | --- | ----------- | ------------- |
| 10  | 10  | 11          | 6 ≤ 10        |
| 21  | 10  | 13          | 21 ≤ 21       |
| 18  | 12  | 13          | 18 ≤ 18       |
| 15  | 15  | 13          | 15 ≤ 15       |

**End of week**
- Balance $= B + Profit$ (Profit already has $C$ taken out)



## Route from your inventory

Plug in what you have right now, and the date picks which week you're in.

**Inputs**
- $B$ = coins (Balance)
- $n$ = dirt plots owned
- $a$ = apple seeds owned (not planted yet)
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
- Wiggle day: on a Monday you can still harvest last week's crops, but new hours are for week $t$

### Most useful hours (with seeds on hand)

Seeds you already own don't cost coins, but they can't pay for plots either, so there are two cases.

$$w_{seeds} = \left\lfloor \frac{9 + \sqrt{4n^2 - 76n + 481 + 8(B + 5a)}}{2} \right\rfloor \quad \left(\text{or } 10 + a + \left\lfloor \tfrac{B}{5} \right\rfloor \text{ if that's} \le n\right)$$

$$w_{plots} = \max\left(n,\ \left\lfloor \frac{19 + \sqrt{1 + 4(n-10)(n-9) + 8B}}{2} \right\rfloor\right)$$

$$w_{coins} = \begin{cases} w_{seeds} & \text{if } w_{seeds} > 10 + a \text{ (you'll run out of owned seeds and buy more)} \\[6pt] \min(10 + a,\ w_{plots}) & \text{otherwise (owned seeds are enough, only plots cost coins)} \end{cases}$$

$$w_{max} = \min\left(45,\ w_{coins}\right)$$

When $a = 0$ this is the same as the $w_{coins}$ above.

> [!math]- Seeds on hand ~~Meth~~ math scratch-pad
> Cost with $a$ seeds owned, $k = w - 10$ apples:
> $$C = 5\max(0,\ k - a) + \max\left(0,\ \frac{(w-n)(w+n-19)}{2}\right)$$
> If $k > a$: $5(k - a) = 5(w - 10) - 5a$, so it's the old formula with $B$ swapped for $B + 5a$ (each owned seed is worth 5 coins).
> If $k \le a$: only plots cost coins:
> $$\frac{(w-10)(w-9)}{2} - \frac{(n-10)(n-9)}{2} \le B$$
> $$w^2 - 19w + 90 - (n-10)(n-9) - 2B \le 0$$
> $$w \le \frac{19 + \sqrt{1 + 4(n-10)(n-9) + 8B}}{2}$$
> Checked against brute force for $0 \le B < 1500$, $10 \le n \le 45$, $0 \le a < 40$: no mismatches.

### Each week after that

Start at week $t$ with $(B, n, a)$, then repeat until week 14:

$$w = \min(\text{cap},\ w_{max}) \qquad k = \max(0,\ w - 10)$$

$$C = 5\max(0,\ k - a) + \max\left(0,\ \frac{(w-n)(w+n-19)}{2}\right)$$

$$S = m\left(25 \cdot \min(w, 10) \cdot [\text{prep}] + 30k\right)$$

$$B \leftarrow B - C + S \qquad n \leftarrow \max(n, w) \qquad a \leftarrow \max(0,\ a - k)$$

($[\text{prep}]$ = 1 in prep weeks, 0 in real weeks.) In real weeks, if $w < 10$ you're out.

The final $B$ is what you can spend on the upgrade tree.

## Multi-week run

Example (my situation), simulated with a script. Starts from the end of Prep 2 if all 13 hours get done: 13 plots, 344 coins.

**Assumptions**
- $m = 1$ every week
- Plots stay between weeks, seeds get bought the week they're planted
- Prep 3 sells all crops, real weeks give the 10 carrots to rent
- Coins are saved up and spent on upgrades at the end
- Each week: $w = \min(w_{max}, \text{cap})$, cap = hours you're willing to do per week

### Goals

| Goal              | Coins | Flat cap needed                                   | Total hours (Prep 3 + 12 weeks) |
| ----------------- | ----- | ------------------------------------------------- | ------------------------------- |
| Framework 13 path | 3050  | 18 h/week                                         | 234                             |
| Everything once   | 8650  | 37 h/week                                         | 475                             |
| Everything maxed, no stylus | 10950 | 45 h/week (ends at 10995, just barely) | 584 (Prep 2 + Prep 3 + 12 weeks) |
| Everything maxed  | 11450 | not possible at $m=1$ (45 h/week ends at 10995) | -                               |

## Multiplier vs hours for max (no stylus)

Goal: **10950** coins (everything maxed minus the stylus, it doesn't work on the 13").
Starts from right now (Prep 2: 4 coins, 13 plots, 3 apple seeds, 13 hours). Same multiplier every week.

At $m = 1$ and 45 h every week you end at 10995, only 45 coins of slack. A better multiplier buys you fewer hours:

| $m$ | Hours/week needed | Total hours | End coins |
| --- | --- | --- | --- |
| 0.9 | not possible (45 h ends at 9591) | - | - |
| 1.0 | 45 | 584 | 10995 |
| 1.1 | 41 | 537 | 11195 |
| 1.2 | 37 | 490 | 11097 |
| 1.3 | 34 | 455 | 11085 |
| 1.4 | 32 | 429 | 11165 |
| 1.5 | 30 | 403 | 11085 |

With the stylus (11450): needs $m \ge 1.033$ at 45 h/week, or e.g. 39 h/week at $m = 1.2$.

### Frontloading

- Plots are the only thing that compounds. A high multiplier early means more coins early, so more plots sooner.
- At 1.5 in Prep 2, Prep 3 can do 37 useful hours instead of 31.
- Plots hit 45 in Week 1 either way, so after that there's nothing left to unlock.
- After plots are maxed, every week at 45 h sells the same $1050m$, so a point of multiplier is worth the same in Week 2 as in Week 12.

**So**
- Prep 3 is where quality pays off extra (unlocks plots + it's a big prep week).
- Weeks with more crops are worth more multiplier. Prep 2 (13 crops) is the smallest week, Week 1+ (45 crops) the biggest.
