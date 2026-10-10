# Terra Calc build plan

## What it does

A static site that takes your current Terra stats, what your goal(device) is, and how much time you are willing to put in,

## Stack

- Plain HTML + CSS + JavaScript (ES modules), **no build step**
- Tests with Node's built-in test runner (`node --test`, Node 20+), no dependencies
- Hosted on GitHub Pages straight from the `main` branch

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

export const CROPS = {
    carrot: { buy: null, sell: 25 },
    apple:  { buy: 5,    sell: 30 },
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

## Functions

### `week.js`

```js
weekIndex(date) → t   // 0-2 prep, 3-14 main, <0 not started, >14 over
weekName(t) → "Prep 2" / "Week 5"
isPrep(t) → boolean
```

`t = floor((date - PREP1_START) / 7 days)`, using the **US Eastern** calendar date, not the user's local date. Get it with `Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" })` (en-CA formats as `YYYY-MM-DD`), then count whole days between the two dates.

### `farm.js`

From `math-stuff.md`:

```js
plotCost(w, n)          // max(0, (w-n)(w+n-19)/2), coins to go from n plots to w
weekCost(w, n, a)       // 5*max(0, k-a) + plotCost(w, n), k = max(0, w-10)
wMax(B, n, a)           // min(45, w_coins), the two-case formula with seeds on hand
simulateWeek(state, w, m, prep) → newState
```

`state = { coins, plots, seeds }`. `simulateWeek` does:

```
k = max(0, w - 10)
C = weekCost(w, n, a)
S = m * (25 * min(w, 10) * (prep ? 1 : 0) + 30k)
coins ← coins - C + S
plots ← max(plots, w)
seeds ← max(0, seeds - k)
```

Return `null` (or `{ out: true }`) if it's a main week and `w < 10`.

Tip: write `wMax` as the closed-form formula **and** keep a tiny brute-force loop in the tests to check it against, like the scratch-pad check.

### `route.js`

```js
simulateRoute(state, t, cap, m) → [{ week, startCoins, plots, wMax, hours, newPlots, spent, sold, endCoins }, ...]
hoursNeeded(state, t, goalCoins, m) → { cap, totalHours, route } or null if impossible
```

- `simulateRoute`: for each week from `t` to 14, `w = min(cap, wMax(...))`, then `simulateWeek`
- `hoursNeeded`: try `cap = 10, 11, ... 45`, return the first one whose final coins ≥ goal (that's how the tables in the notes were made)
- Optional later: per-week multipliers (array instead of one `m`) for the frontloading view

### `tree.js`

```js
withPrereqs(tree, selection) → selection   // add everything the picks require (all of `requires`, recursively)
nodeCost(node, qty) → coins                // cost × qty, or the first qty tiers added up
limitOf(node, selection) → number|Infinity // 1, no limit, or base + selection[per]
goalCost(tree, selection) → coins          // Σ nodeCost over the selection
nodeHours(coins, m) → hours                // coins / (30m - 5), rough "effort" for a node
```

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
| `wMax` | B=10, n=10, a=0 | 11 |
| `wMax` | B=4, n=13, a=3 | 13 (current Prep 2 state) |
| `wMax` | B=344, n=13, a=0 | 31 |
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
| `hoursNeeded` | Prep 2 state, goal 3050, m=1 | cap 18 |
| `hoursNeeded` | Prep 2 state, goal 10700, m=1 | cap 44 |
| `hoursNeeded` | Prep 2 state, goal 13850, m=1 | null (impossible) |
| `hoursNeeded` | Prep 2 state, goal 13850, m=1.5 | cap 36 |
| `simulateRoute` | Prep 3, B=344, n=13, cap 45, m=1 | ends at 10995 |

"Prep 2 state" = `{ coins: 4, plots: 13, seeds: 3 }` at `t = 1`.

Run with `node --test`.

## Page layout (`index.html`)

1. **Inventory**: coins, plots, apple seeds (number inputs). Date defaults to today, with an override.
2. **Settings**: multiplier slider (0.8-1.5, default 1.0), max hours/week you're willing to do.
3. **Goal**: device picker (Framework / iPad / Galaxy), preset buttons (Framework 13, Max 12, Max 13, Clear) + the tree as checkboxes / quantity steppers (respecting `limitOf`). Picking a node auto-picks its prerequisites. Show the goal total and each node's rough hours.
4. **Result**:
   - "You need **X h/week** (Y total)" or "Not reachable, best you can get is Z coins"
   - Week-by-week table (same columns as the notes)
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

- Water price escalation (only matters for a future "skip hours" feature)
