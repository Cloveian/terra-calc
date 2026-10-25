# This Week, with priorities

*Plan for two things that go together: ranking the upgrades you care about most, down to single RAM and SSD tiers, and putting the plan inside Terra's own "This Week" card instead of the floating panel. Follows on from [goal-in-terra.md](goal-in-terra.md). How the card is drawn is in [how-terra-looks.md](../research/how-terra-looks.md).*

## Why

The panel works (the tree tags too, first time in the real game on 21 Oct), but it's a wall of plain text in a box that looks like it fell out of another website, and it treats the goal as one lump of coins. Nobody wants "11350 coins". They want *the RAM first*, then the Framework 13, and the Ryzen if there's time.

## Priorities

### What gets ranked

One row per thing you'd click Buy on, so tiers are separate:

```
1. Framework 13          (pulls in DIY, Core 3, i5, Core 5)
2. RAM 16GB              (tier 1)
3. SSD 1TB               (tier 1)
4. RAM 32GB              (tier 2)
5. Ryzen AI 7 350
6. RAM 64GB              (tier 3)
```

| Decision | What it does |
| --- | --- |
| Which nodes split | **Decision:** tiers only (RAM, SSD), or the stacking cards too (USB, Fancy)? Default: tiers only. Four Fancy cards are the same card four times, so they stay one row, "Fancy \*4" |
| Names | The tier's total from Terra's own text, "RAM 16GB", not "RAM 2/3". `treesFrom` already reads the totals |
| Prerequisites | They don't get their own row unless you wanted them on their own. They ride along with the first thing that needs them, like `buyOrder` does now |
| Tiers in order | RAM 32GB can't go above RAM 16GB, same as a prerequisite. Moving 32GB up drags 16GB with it |
| Nothing ranked yet | Same order as now: prerequisites first, then cheapest, then tree order |

### What a priority actually changes

Not *when you click Buy*. Upgrades don't arrive till the end anyway, and coins sitting in a RAM stick aren't buying plots (the "bought too early" bit in goal-in-terra). The plan still buys everything in the last week. Priority is what's safe first:

- **milestones go in your order**, so "RAM 16GB by Week 4" means 16GB is covered by Week 4, no matter what's still missing further down the list
- **when it's not reachable, the bottom falls off**, not some random middle bit. "you'll get 1-4, not the Ryzen or RAM 64GB"
- **hours per row:** each row can say what h/week gets you *that far down the list*, `hoursNeeded(..., row.total, m).cap`, up to 36 route runs a row. Like "1-2: 14 h, 1-4: 22 h, all: 31 h". This is the nicest bit honestly, you can see what the Ryzen is costing you in hours

| Decision | What it does |
| --- | --- |
| Hours this week | **Decision:** the card's "code N h" aims for the whole list (like now), or for a cut-off line you set ("must have" down to row 3, the rest is a bonus)? Default: the whole list, and the per-row hours (below) let you see what to trim |

### Where you set it

A number box on the tree tag, right next to want (decided 22 Oct, no dialog). 1 is what you care about most.

```
 Framework 13             RAM (want 3)
 [wanted] [1]             [-] want 3 [+]
                          16GB [2]  32GB [4]  64GB [ ]
```

- limit-1 nodes get one box, tiered ones get one per wanted tier, labelled with the tier's total
- **blank** means no priority: it comes after everything numbered, in the default order
- **ties** are fine, two 3s go in the default order between them. No renumbering everything when you slot one in, just type 2.5 or whatever lol
- a prerequisite counts as early as the earliest thing that needs it, and a lower tier as early as the highest one you ranked (32GB at 1 pulls 16GB up to 1 with it). That's `buyOrder`'s `rank` already, it just works per row now
- unwanting something drops its numbers. Prerequisites that only got pulled in get a box too, but you don't have to touch it

| Decision | What it does |
| --- | --- |
| Per-row hours | The "1-2: 14 h, 1-4: 22 h" thing has no dialog to live in now. **Decision:** put it on the tag under the number ("22 h/wk to here"), in the card's goal line for the top one only, or drop it? Default: on the tag, small, next to the week it lands |
| Keys | The game listens for keys on the page (B for build mode, walking), so the box `stopPropagation`s keydown / keyup / keypress as well as the clicks, or typing 2 might walk you somewhere |

### Data

The saved goal gets `prio`, a number per row:

```js
prio: { "framework_13_upgrade": 1, "ram_12:1": 2, "ram_12:2": 4 }
```

- `id:n` is the n-th one you'd ever own (counting what you have), so it doesn't shift when you buy one. Limit-1 nodes are just `id`
- `buyOrder(tree, want, owned, prio)` sorts by number, blanks last, and returns one item per row instead of per node, `{ id, unit, name, cost }`. `milestones` doesn't change at all, it already just walks the list adding up `cost`
- the site's `first` (the order from its arrows) turns into the same thing, `first[i]` -> `i + 1`, so `buyOrder` only has one way in. Old site links keep working, a plain id there means every unit of it

| Decision | What it does |
| --- | --- |
| The site | `buyOrder` is shared. **Decision:** does the site switch to rows too? Default: yes, the site's milestone list shows "RAM 16GB" rows and its arrows move rows. Otherwise there are two buy orders to keep in sync |

## Inside Terra's This Week card

### How their card's built

From the 9 Oct game JS (`GameCanvas`), the weekly one:

```
._container_          fixed, top right, a column of cards, pointer-events: none
  ._quest_            the orange frame
    ._questInner_     quest-card-bg.svg
      ._questHeader_  "This Week" + ▼, click toggles collapsed
      ._questBody_    only exists while it's expanded
        ._task_._taskCurrent_   ._taskCheckbox_ + ._taskLabel_ ("Plant your seeds")
        ._objectiveDetail_      "You have 1 more seed to plant on your island"
        ._objectiveCountdown_   only with a deadline
```

Quest cards (not the weekly one) also have `._stepTitle_` and a `._tasks_` list, one `._task_` per task, done ones with `._taskCheckboxDone_` (a ✓) and `._taskLabelDone_` (struck out, .5 opacity).

In the 20 Oct build it's in its own chunk that only loads with the card, and that capture never opened it, so the JS is just missing, not changed. The CSS module hash (`k6rzi`) is the same in both builds, so the card's the same as far as we can tell. A capture with the card open would make sure (todo, not urgent).

### What we put in it

Ours **replace** their checklist (decided 22 Oct). Their header stays ("This Week" and the ▼), their task row and its detail line get hidden, and our steps go in with their classes on them. Steps that wait on another step sit indented under it, like the site's milestone list does with upgrades:

```
This Week                                     ▼
● harvest 10                                  <- current
○ buy 29 apple seeds from Heidi
○ buy 4 plots from Heidi
   ○ place 4 plots
      ○ plant 10 strawberry seeds
      ○ plant 30 apple seeds
○ code 28.3 h  (11h 47m done)
   ○ ship this week's project so the 40 grow
  Framework 13 by Week 9, RAM 16GB Week 4     <- objectiveDetail style
  hide Terra Calc                             <- link
```

What waits on what, a table in next.js next to the steps (the steps' own `requires`, like the tree's):

| Step | Waits on |
| --- | --- |
| sell | harvest |
| buy seeds | check Heidi's shop, sell |
| buy plots | sell |
| place | buy plots |
| plant (free seeds) | place, clear, harvest |
| plant apples | place, buy seeds, clear, harvest |
| ship | code |
| "or wait for Ratticus" | buy plots (it's the other way to get them) |

A step's indent is one more than the deepest step it waits on that's still on the list, and the order doesn't change, same as the site's milestone list (built 22 Oct, `nestSteps`). For that to read right, buy seeds now comes before buy plots, so place sits right under the plots. Ticked steps stay on the list and keep their spot in the indent (step 6), so the list doesn't jump around as you go.

- **hiding theirs:** a `data-terra-calc` attribute on their `._questBody_`, and one `<style>` rule, `[data-terra-calc] > :not(.terra-calc-steps) { display: none }`. Solid only rewrites the classes it set itself, an attribute it never set stays put. No touching their elements' classes or inline styles
- **countdowns:** the plant, devlog and ship steps count down the week's last 2 days, "plant 6 eggplant seeds (1d 4h left)" (seeds go Monday 11:59 PM EDT, the items' `usableUntil`)
- **last week:** the first 2 days of a week get "last week: 31.2h+ (plan 40h)". The + is cuz it's as of the last time Terra Calc saw that week and Hackatime keeps counting with Terra closed, last week's real total from the API would fix that. What i sold's left out, a week's sales are mostly the week before's crops
- **their countdown** is the one bit of theirs we don't have, the game knows deadlines we don't. **Decision:** hide it too, or keep it under ours? Default: keep it

- **classes** come off their own elements on the page (`[class*="_taskLabel_"]` -> its real class), and the done ones out of `document.styleSheets` by local name. No hash in our code, so a rebuild doesn't break it as long as the local names stay
- **finding the card:** the `._questTitle_` whose text is "This Week". An observer like the tree's puts our rows back whenever the body's rebuilt (collapse/expand, a new objective, Solid redrawing)
- **collapsed** means collapsed, ours go too. That's what you'd expect from their ▼
- **no weekly card** (Solid only draws it `when` there's an objective): we add our own `._quest_` to their `._container_`, built the same way, titled "Terra Calc"
- **clicks:** the container is `pointer-events: none` and cards turn it back on, so links work. Our rows `stopPropagation` like the tree tags, in case

| Decision | What it does |
| --- | --- |
| Ticking | **Decision:** steps vanish when done (like the panel now), or stay ticked ✓ for the rest of the week? Default: ticked, it looks like theirs and it's satisfying lol. Needs the week's first list saved per `weekKey`, then a step is done when what's left of it hits 0 |
| The floating panel | **Decision:** goes away, or stays as a "details" thing? Default: goes. Notices ("Terra's prices changed") become detail lines in the card, coins/multiplier/farm age are in `terraCalc.plan()` for debugging. ~~The m guess still shows~~ not anymore (22 Oct), the real m shows up within like a second so the guess note was just noise. Overriding m goes in our settings instead |
| Settings | The existing `settings.panel` turns the card rows off, same as it turns the panel off now |

## Order to build it

1. ~~`buyOrder` per row with `prio` numbers (the site's `first` turned into numbers), tests~~ done 22 Oct
2. ~~`prio` in the saved goal + per-row hours, tests~~ done 22 Oct (`terraCalc.goal({ prio: {...} })` to try it till the boxes exist)
3. ~~the steps' "waits on" table and the indent, tests~~ done 22 Oct (`nestSteps`)
4. ~~our steps in Terra's This Week card, hiding theirs, the observer, the no-card fallback. Panel goes~~ done 22 Oct (`card.js`, was panel.js). Checked against the dumped css with a fake card (`research/terra-js/card-test.html`), not in the real game yet
5. ~~the number boxes on the tree tags~~ done 22 Oct, checked on a fake tree with the dumped css (`research/terra-js/tree-test.html`), not in the real game yet
6. ~~ticking, if that's a yes~~ done 22 Oct with the default (ticked, `tickSteps`). The week's list starts over when the week's crop target changes, so a new goal doesn't show stuff as done that just stopped being needed. If w wobbles by one mid week the ticks reset too, ill just have to see if that happens in the real game

## Captures that would help

- a HAR with the This Week card open, for the 20 Oct+ chunk (just to be sure it's the same as 9 Oct)
- the card in a prep week or whenever there's no objective, does `._container_` still exist
- the card with a quest going too, to see how ours sit next to a second card
