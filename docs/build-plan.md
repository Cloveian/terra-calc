# Terra Calc build plan

## What it does

A static site that takes your current Terra stats, what your goal(device) is, and how much time you are willing to put in, and outputs what *you* need to do to accomplish that

## Stack

- Plain HTML + CSS + JavaScript (ES modules), **no build step**
- Tests with Node's built-in test runner (`node --test`, Node 20+), no dependencies
- Hosted on GitHub Pages straight from the `master` branch

No build step means: edit a file, refresh the browser, done. GitHub Pages serves the repo as-is.

## File layout

```
terra-calc/
├── index.html          the page
├── style.css
├── src/
│   ├── data.js         tree, shop prices, schedule (just data, no logic)
│   ├── week.js         date → week index
│   ├── farm.js         one-week math: plot cost, w_max, simulateWeek
│   ├── route.js        multi-week: simulateRoute, hoursNeeded
│   ├── tree.js         upgrade selection: prerequisites, goal cost
│   └── ui.js           reads inputs, calls the above, draws tables
├── test/
│   ├── week.test.js
│   ├── farm.test.js
│   ├── route.test.js
│   └── tree.test.js
├── research/           (existing notes)
└── docs/
```

Rule: **only `ui.js` touches the page.** Everything else is pure functions (inputs in, numbers out), so it can be tested in Node without a browser.

## Data (`src/data.js`)

```js
export const PREP1_START = "2026-09-28"; // Monday, US Eastern
export const PREP_WEEKS = 3;
export const MAIN_WEEKS = 12;

export const MAX_PLOTS = 45;
export const FREE_PLOTS = 10;
export const BASE_SEEDS = 10; // carrots from Ratticus each week
export const RENT = 10;       // crops, main weeks only

// One row per seed type. New seeds (dev, 10 Oct: "a few more before next week") get a row here, nothing else.
// buy/sell: coins. water: per crop. weeks: to grow (1 = sells the week it's planted).
// stock: per week, null = not limited. from/until: week index t it's in the shop, null = always.
// Only the simple case (water 1, weeks 1, stock null, always) is modelled; the rest is data the
// model will need later (how-terra-works.md §10 "What breaks the simple case").
export const SEEDS = {
    carrot: { name: "Carrot", buy: 0, sell: 25, water: 1, weeks: 1, stock: 10,   from: null, until: null, free: true },
    apple:  { name: "Apple",  buy: 5, sell: 30, water: 1, weeks: 1, stock: null, from: null, until: null },
    // placeholder, fill in when released, numbers below are NOT real:
    // newseed: { name: "?", buy: null, sell: null, water: 1, weeks: 1, stock: null, from: null, until: null },
};

export const MULTIPLIER = { min: 0.8, max: 1.5 };
export const STARTING_COINS = 25;

// cost: one price, or tiers: a price per buy (limit = tiers.length)
// limit: 1 by default, null = no limit, { base, per } = base + how many `per` you own
// requires: list of node ids, all needed first ([] = hangs off the device itself)
export const TREES = {
    framework: {
        device: "Framework 12",
        nodes: [
            { id: "stylus",  name: "Framework Stylus",         cost: 500,  requires: [] },
            { id: "usb",     name: "USB Expansion Card",       cost: 100,  requires: [], limit: null },
            { id: "fancy",   name: "Fancy Expansion Card",     cost: 100,  requires: [], limit: { base: 4, per: "usb" } },
            { id: "diy",     name: "Framework 12 DIY Edition", cost: 250,  requires: [] },
            { id: "ram",     name: "RAM",                      tiers: [750, 1300, 2100], requires: ["diy"] },
            { id: "ssd",     name: "SSD",                      tiers: [1000, 2000],      requires: ["diy"] },
            { id: "core3",   name: "Core 3 304",               cost: 400,  requires: ["diy"] },
            { id: "i5",      name: "i5-1334U",                 cost: 400,  requires: ["core3"] },
            { id: "core5",   name: "Core 5 320",               cost: 1500, requires: ["i5"] },
            { id: "fw13",    name: "Framework 13",             cost: 500,  requires: ["core5"] },
            { id: "display", name: "2.8K Display",             cost: 900,  requires: ["fw13"] },
            { id: "ryzen",   name: "Ryzen AI 7 350",           cost: 2250, requires: ["fw13"] },
        ],
    },
    ipad: {
        device: "iPad Mini",
        nodes: [
            { id: "pencil",    name: "Apple Pencil",         cost: 750,  requires: [] },
            { id: "air11",     name: "iPad Air 11",          cost: 400,  requires: [] },
            { id: "folio",     name: "Smart Folio",          cost: 600,  requires: [] },
            { id: "pencilpro", name: "Apple Pencil Pro",     cost: 400,  requires: ["pencil"] },
            { id: "air13",     name: "iPad Air 13",          cost: 1600, requires: ["air11"] },
            { id: "pro11",     name: "iPad Pro 11",          cost: 2000, requires: ["air13"] },
            { id: "keyboard",  name: "Magic Keyboard Folio", cost: 1600, requires: ["folio", "air11"] },
        ],
    },
    galaxy: {
        device: "Galaxy Tab S10 FE+",
        nodes: [
            { id: "s11",      name: "Galaxy Tab S11",           cost: 2400, requires: [] },
            { id: "cover",    name: "Smart Book Cover",         cost: 800,  requires: [] },
            { id: "s10plus",  name: "Galaxy Tab S10+",          cost: 800,  requires: ["s11"] },
            { id: "keyboard", name: "Book Cover Keyboard Slim", cost: 400,  requires: ["cover"] },
        ],
    },
};

export const PRESETS = {
    framework: {
        "Framework 13": { diy: 1, core3: 1, i5: 1, core5: 1, fw13: 1 },
        "Max 12": { stylus: 1, usb: 1, fancy: 4, diy: 1, ram: 3, ssd: 2, core3: 1, i5: 1, core5: 1 },
        "Max 13": { usb: 1, fancy: 4, diy: 1, ram: 3, ssd: 2, core3: 1, i5: 1, core5: 1, fw13: 1, display: 1, ryzen: 1 },
    },
};
```

Prices and limits are from [`research/device-trees.md`](../research/device-trees.md). They come from the server and can change (maybe by country too), so keep them in `data.js` only, and consider letting people edit them in the UI.

The code currently has `CROPS = { carrot, apple }` with just `buy` / `sell`, and `farm.js` hardcodes `CROPS.apple` for the extra hours. The plan is to rename it `SEEDS` with the shape above and make `farm.js` read the list instead of `apple`. Seed ids should be Terra's own item ids once known, same as tree nodes. The dev says prices already in the game are unlikely to change but small adjustments are possible before Week 1 (19 Oct): re-check `SEEDS`, the shop and `TREES` on 19 Oct and bump `PRICES_AS_OF`.

## Functions

### `week.js`

```js
weekIndex(date) → t   // 0-2 prep, 3-14 main, <0 not started, >14 over
weekName(t) → "Prep 2" / "Week 5"
isPrep(t) → boolean
```

`t = floor((date - PREP1_START) / 7 days)`, using the **US Eastern** calendar date, not the user's local date. Get it with `Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" })` (en-CA formats as `YYYY-MM-DD`), then count whole days between the two dates.

### `farm.js`

From [how-terra-works.md](../research/how-terra-works.md#10-the-calculators-model) (rules confirmed by the dev on 10 Oct):

Apples-only (what's built now):

```js
plotCost(w, n)          // sum of min(p-9, 10) for p = n … w-1, coins to go from n plots to w
weekCost(w, n, a)       // 5*max(0, k-a) + plotCost(w, n), k = max(0, w-10)
wMax(B, n, a)           // biggest w ≤ 45 with weekCost(w, n, a) ≤ B (loop w = 0…45)
simulateWeek(state, w, m, prep) → newState
```

`state = { coins, plots, seeds }`. `simulateWeek` does:

```
k = max(0, w - 10)
C = weekCost(w, n, a)
S = m * ((prep ? 25 * min(w, 10) : 200) + 30k)   // rent carrots pay 20 each
coins ← coins - C + S
plots ← max(plots, w)
seeds ← 0                // apple seeds expire at the end of the week
```

Return `null` (or `{ out: true }`) if it's a main week and `w < 10`.

The old closed-form `wMax` from `math-stuff.md` assumed plots kept getting pricier. With the price capped at 10 a loop is simpler and just as fast (46 checks).

#### Any seed list (for the new seeds)

Math in [how-terra-works.md §10, "More than one seed type"](../research/how-terra-works.md#more-than-one-seed-type). Every function takes the seed list as an argument (not read from `data.js` inside) so tests can pass a made-up list. `onHand` is `{ id: count }`, `seeds` is the buyable list for the week (carrots excluded).

```js
plotCost(w, n)                               // unchanged
seedsFor(t)                                  // buyable SEEDS in week t: not free, from ≤ t ≤ until (null = always)
profit(seed, m)                              // p = m * sell − buy
minSeedCost(k, onHand, seeds)                // bMin * max(0, k − Σ onHand), bMin = cheapest buy in `seeds`
weekCost(w, n, onHand, seeds)                // minSeedCost(k, …) + plotCost(w, n): least you must spend to use w hours
wMax(B, n, onHand, seeds)                    // biggest w ≤ 45 with weekCost ≤ B, same loop
seedMix(k, budget, m, onHand, seeds) → { counts: { id: x }, cost, sales } | null
simulateWeek(state, w, m, prep, seeds) → newState
```

`seedMix` is the one new piece:

```
plant onHand first (cost 0), k' = k − Σ onHand, if k' ≤ 0 done
drop seeds with p ≤ 0, and any seed another seed beats on both buy and p
if bMin * k' > budget → null (w is past wMax)
best = all k' of one seed, for every seed with buy * k' ≤ budget
for every pair (cheap, dear) with cheap.buy < dear.buy:
    xDear  = min(k', floor((budget − cheap.buy * k') / (dear.buy − cheap.buy)))
    xCheap = k' − xDear
    keep if Σ p x beats best
counts = onHand + best, cost = Σ buy x, sales = Σ sell x
```

Then `simulateWeek`:

```
k = max(0, w − 10)
plots = plotCost(w, n)
mix = seedMix(k, coins − plots, m, onHand, seeds)
C = plots + mix.cost
S = m * ((prep ? 25 * min(w, 10) : 200) + mix.sales)
coins ← coins − C + S
plots ← max(plots, w)
seeds ← {}               // all seeds expire at the end of the week (dev)
```

With `seeds = [apple]` and `onHand = { apple: a }` every line matches the apples-only version, so the old tests must still pass unchanged. The route should keep `w = min(cap, wMax)` and only then pick the mix (see "Hours vs better seeds" in §10).

Not modelled, data slots only: `water ≠ 1` (hours ≠ crops), `weeks > 1` (coins arrive later, plot stays busy, needs a `pending` queue in the state), `stock` (cap `x` per seed). If a released seed needs one of these, §10 says what changes.

### `route.js`

```js
simulateRoute(state, t, cap, m) → [{ week, startCoins, plots, wMax, hours, newPlots, spent, sold, endCoins }, ...]
hoursNeeded(state, t, goalCoins, m) → { cap, totalHours, route } or null if impossible
```

- `simulateRoute`: for each week from `t` to 14, `w = min(cap, wMax(...))`, then `simulateWeek`
- `hoursNeeded`: try `cap = 10, 11, ... 45`, return the first one whose final coins ≥ goal (that's how the tables in the notes were made)
- Optional later: per-week multipliers (array instead of one `m`) for the frontloading view
- With more seed types: `simulateRoute` calls `seedsFor(week)` each week (seeds can be week-limited, `weekNumber` / `usableUntil`) and adds a `planted: { id: x }` column so the table can say "7 apples + 8 X". `state.seeds` becomes `{ id: count }`.

### `tree.js`

```js
withPrereqs(tree, selection) → selection   // add everything the picks require (all of `requires`, recursively)
nodeCost(node, qty) → coins                // cost × qty, or the first qty tiers added up
limitOf(node, selection) → number|Infinity // 1, no limit, or base + selection[per]
goalCost(tree, selection) → coins          // Σ nodeCost over the selection
nodeHours(coins, m, seeds) → hours         // coins / best profit(seed, m), rough "effort" for a node
```

`nodeHours` is `coins / (30m − 5)` now (apples hardcoded). With a seed list it's `coins / max p_i`, the best seed buyable this week. Still rough: ignores plots, the budget cap and rent pay.

`selection` is `{ id: qty }`. Examples:
- `withPrereqs(framework, { ryzen: 1 })` → `{ ryzen: 1, fw13: 1, core5: 1, i5: 1, core3: 1, diy: 1 }`
- `nodeCost(ram, 2)` → 750 + 1300 = 2050
- `limitOf(fancy, { usb: 1 })` → 5

The UI should stop people picking more than `limitOf` allows (e.g. a 5th Fancy card needs a USB card first).

## Tests (expected answers from the notes)

If these pass, the code matches the math.

| Function | Input | Expected |
| --- | --- | --- |
| `plotCost` | w=11, n=10 | 1 |
| `weekCost` | w=11, n=10, a=0 | 6 |
| `weekCost` | w=13, n=10, a=0 | 21 |
| `weekCost` | w=13, n=12, a=0 | 18 |
| `weekCost` | w=13, n=15, a=0 | 15 |
| `plotCost` | w=21, n=19 | 20 (price capped at 10) |
| `plotCost` | w=45, n=10 | 305 |
| `wMax` | B=10, n=10, a=0 | 11 |
| `wMax` | B=4, n=13, a=3 | 13 (current Prep 2 state) |
| `wMax` | B=344, n=13, a=0 | 36 |
| `wMax` | B=0, n=10, a=2 | 10 (seeds can't buy plots) |
| `weekIndex` | 2026-10-09 | 1 (Prep 2) |
| `weekIndex` | 2026-10-19 | 3 (Week 1) |
| `weekIndex` | 2026-09-27 | -1 |
| `nodeCost` | RAM × 3 | 4150 |
| `nodeCost` | SSD × 2 | 3000 |
| `limitOf` | Fancy, no USB | 4 |
| `limitOf` | Fancy, 1 USB | 5 |
| `limitOf` | USB | Infinity |
| `goalCost` | Framework 13 preset | 3050 |
| `goalCost` | Max 12 preset | 10700 |
| `goalCost` | Max 13 preset | 13850 |
| `goalCost` | iPad, everything | 7350 |
| `goalCost` | Galaxy, everything | 4400 |
| `withPrereqs` | `{ ryzen: 1 }` | adds fw13, core5, i5, core3, diy |
| `withPrereqs` | iPad `{ keyboard: 1 }` | adds folio, air11 |
| `hoursNeeded` | Prep 2 state, goal 3050, m=1 | cap 11 |
| `hoursNeeded` | Prep 2 state, goal 10700, m=1 | cap 35 |
| `hoursNeeded` | Prep 2 state, goal 13850, m=1 | null (5 coins short at 45 h) |
| `hoursNeeded` | Prep 2 state, goal 13850, m=1.5 | cap 29 |
| `simulateRoute` | Prep 3, B=344, n=13, cap 45, m=1 | ends at 13845 |

"Prep 2 state" = `{ coins: 4, plots: 13, seeds: 3 }` at `t = 1`.

All of the above is **apples-only** and stays as the baseline: with `seeds = [apple]` the general functions have to give exactly these answers.

**Seed-list tests** (made-up seeds, test-only, not in `data.js`): `X = { buy: 20, sell: 65 }`, `Y = { buy: 10, sell: 30 }` (worse than apples on both), `Z = { buy: 3, sell: 40 }` (cheaper *and* better than apples). Worked by hand in [how-terra-works.md §10](../research/how-terra-works.md#more-than-one-seed-type).

| Function | Input | Expected |
| --- | --- | --- |
| `profit` | apple, m=1 / X, m=1 / X, m=0.8 | 25 / 45 / 32 |
| `seedMix` | k=15, budget=200, m=1, [apple, X] | `{ apple: 7, x: 8 }`, cost 195, sales 730 |
| `seedMix` | k=15, budget=300, m=1, [apple, X] | `{ x: 15 }`, cost 300 |
| `seedMix` | k=15, budget=74, m=1, [apple, X] | null (15 apples cost 75) |
| `seedMix` | k=23, budget=120, m=1, [apple, X] | `{ apple: 23 }`, cost 115 (5 left, not enough to upgrade one) |
| `seedMix` | k=5, budget=100, m=1, [apple, Y] | `{ apple: 5 }` (Y is dominated) |
| `seedMix` | k=5, budget=15, m=1, [apple, Z] | `{ z: 5 }`, cost 15 |
| `seedMix` | k=5, budget=10, onHand `{ apple: 3 }`, [apple, X] | `{ apple: 5 }` (3 free + 2 bought), cost 10 |
| `seedMix` | k=0, any | `{}`, cost 0 |
| `weekCost` | w=13, n=10, onHand `{ apple: 0 }`, [apple, X] | 21 (same as apples-only, apples are still cheapest) |
| `wMax` | B=200, n=25, {}, [apple, X] | 33 |
| `wMax` | B=10, n=10, {}, [apple, Z] | 12 (bMin = 3; apples-only gives 11) |
| `simulateWeek` | `{ coins: 200, plots: 25, seeds: {} }`, w=25, m=1, prep, [apple, X] | coins 985, plots 25 |
| `simulateWeek` | same but [apple] | coins 825 |
| `simulateWeek` | `{ coins: 4, plots: 13, seeds: { apple: 3 } }`, w=13, m=1, prep, [apple] | coins 344 (the old test, new shape) |
| `seedsFor` | seed with from=5, until=8: t=4 / t=5 / t=8 / t=9 | out / in / in / out |
| `nodeHours` | 1000, m=1, [apple] / [apple, X] | 40 / 22.2 |

Run with `node --test`.

## Page layout (`index.html`)

1. **Inventory**: coins, plots, seeds on hand (one number input per seed type in `SEEDS`, so a new seed adds a field by itself). Date defaults to today, with an override.
2. **Settings**: multiplier slider (0.8-1.5, default 1.0), max hours/week you're willing to do.
3. **Goal**: device picker (Framework / iPad / Galaxy), preset buttons (Framework 13, Max 12, Max 13, Clear) + the tree as checkboxes / quantity steppers (respecting `limitOf`). Picking a node auto-picks its prerequisites. Show the goal total and each node's rough hours.
4. **Result**:
   - "You need **X h/week** (Y total)" or "Not reachable, best you can get is Z coins"
   - Week-by-week table (same columns as the notes, plus "planted" once there's more than one buyable seed)
   - Warning if this week's hours would go past `w_max` (wasted water)

Start ugly, make it pretty later. A plain table is fine for a first ship.

## Hosting on GitHub Pages

1. Create the repo on GitHub and push (`gh repo create terra-calc --public --source . --push`)
2. Repo **Settings → Pages → Build and deployment → Deploy from a branch**, branch `main`, folder `/ (root)`
3. Site shows up at `https://<username>.github.io/terra-calc/`

ES modules need to be served over HTTP, opening `index.html` as a file won't work. Locally, run `python3 -m http.server` in the project folder and open `http://localhost:8000`.

Keep `.obsidian/` in `.gitignore` (it already is).

## Order to build it

1. `data.js` + `week.js` + their tests
2. `farm.js` + tests (the important one)
3. `route.js` + tests
4. `tree.js` + tests
5. Bare-bones `index.html` + `ui.js`: inventory in, route table out
6. Push, turn on Pages, check the live link
7. Goal picker, presets, multiplier slider
8. Styling

Steps 1-6 is a shippable first version.

## Shipping (for Terra)

- Live GitHub Pages link + repo link
- Short demo video (screen recording of putting in an inventory and getting a route)
- README: what it is, how to use it, where the numbers come from
- Devlog: what you built, and which parts were AI (e.g. this plan, the formula derivations, any code Claude wrote)

## Unknowns to keep as settings

- Multiplier rounding (keep decimals until it's known)
- Prices in other countries (make tree costs editable)
- New seeds: everything (buy, sell, water, weeks, stock, which weeks). Keep `SEEDS` editable like tree costs so people can type in a seed the day it comes out.
- Whether anything but carrots can pay rent (rent is hardcoded as 10 carrots × 20)

Known but not modelled yet: water costs 50, +5 per water bought that week, up to 75 (for a future "skip hours" feature). Also re-check all prices when Week 1 starts (19 Oct), the dev said small adjustments are possible before then.
