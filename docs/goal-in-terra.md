# Goal in Terra

*How the userscript lets you set your goal without ever leaving Terra, plus a pile of other stuff it should do once it has one (drafted with Claude, 20 Oct). The site's version of all this is [goal-picker.md](goal-picker.md), and most of it carries over as-is.*

## Why

Right now the panel only knows the rent week. It can say "place 10 plots, code 10 h", but not "code 25 h cuz you want a Framework 13 by Week 9", becuase the goal lives on the site and the site lives in another tab. Copying numbers between two tabs every few hours is exactly the thing the userscript was supposed to kill.

Terra already *has* a device tree, with your device, what you own and the prices, so the goal should just be picked on that. No second tree to keep in sync. *Yippee.*

## Opening the real tree

The game opens its tree when a `window` event fires:

```js
window.dispatchEvent(new CustomEvent("open_device_upgrades"));
```

That's what the game itself does when you use the upgrade thing on the map (`GameCanvas`, the `open_device_upgrades` action in the interaction list). So our button is one line, and the tree that opens is Terra's real one, with Terra's prices, not a copy.

| Decision | What it does |
| --- | --- |
| The button | "pick your goal" in the panel. Fires the event, nothing else |
| When the game opens the tree itself | Same Want bits show up, it doesn't matter who opened it |
| Spotting that it's open | A `MutationObserver` on `document.body`, now the one shared one in `page.js` (`watchPage`), and the tags just look for `[data-node]` cards each time |
| Off the farm / in town | Should still work, the listener is on `window` for the whole game, not per room. Needs checking |

## Want on Terra's own tree

Terra's tree is plain DOM (Solid.js, `DeviceUpgradesUI-*.js`), not the canvas, so we can add stuff to it. Every node is a `<div data-node="ram_12">` placed with `left`/`top`, and the device in the middle is `data-node="root"`. The class names are CSS modules (`_node_zskb9_255`), the `zskb9` part changes with every build, so **never select by class**, only by `data-node`.

What goes on each node card is a small Want bit:

- limit-1 nodes (DIY, Core 3, FW13...): a toggle, "want" / "wanted"
- tiered or stacking nodes (RAM, SSD, USB, Fancy): `- want 2 +`
- prerequisites that got pulled in by something else: a fainter "needed" tag, so it's clear why it's wanted
- once there's a route: "Week 6" under it, the week it becomes affordable (from `milestones`)

| Decision | What it does |
| --- | --- |
| Rules | Same as the site: picking adds prerequisites (`withPrereqs`), unpicking takes out what needs it (`unpick`), Want can't go below Own (`normalize`), too few USB cards drops Fancy (`clampToLimits`) |
| Own | From `/device-upgrades` `owned`, never typed in. Re-read when the tree opens, you might've just bought something |
| Clicks | The game opens its buy popup from a click on anything inside `[data-node]`, and drags the view on pointerdown. Our bits `stopPropagation` on `pointerdown` and `click` so tapping want doesn't open Buy or start a pan |
| Solid redrawing | Solid mostly updates attributes in place, but switching device rebuilds the nodes. The observer puts the bits back on any `[data-node]` that's missing them. **Todo:** check Solid doesn't strip an extra child when it rewrites a node's text |
| Looks | Small and quiet, like a sticky note on the card. Terra's own badge style if we can borrow it (see "other stuff") |

### Other devices (browse mode)

The tree can show devices you don't have, with a "Switch to this device" banner. Wanting stuff there means the goal includes switching, and switching refunds *everything* on the old device (`POST /device-upgrades/select-device` comes back with `refunded`).

| Decision | What it does |
| --- | --- |
| Want on a device you're not on | **Decision:** allow it, or only let you want things on your main device? Default: allow it, own counts as `{}` there, and the plan adds what the refund would give back |
| One goal device or one per device | One, like the site. Wanting something on another device asks first, "switch your goal to iPad Mini? (clears your Framework wants)" |

## Presets and custom goals

The tree has nowhere sensible for preset buttons, so those go in the panel.

| Decision | What it does |
| --- | --- |
| Presets | The site's `PRESETS` (Framework 13, Max 12, Max 13, the no-USB ones, iPad / Galaxy "Everything"), in the panel under "pick your goal". Replaces `want`, like the site |
| Custom coins | A number box in the panel. Typing in it switches to a custom goal and greys the Want bits out, same as the site |
| Clear | In the panel. Goes back to the rent week |
| Buy order (`first`) | ~~skip for now~~ not skipped anymore, it's priorities now, per tier too. See [this-week.md](this-week.md) |

## Saving it

Same idea as the saved farm (`terra-calc-farm`): `localStorage`, tagged with your user id from the token so another account on the same browser doesn't get your goal.

```js
// terra-calc-goal
{ userId, goal: { device: "framework_12", want: { ram_12: 2, ... }, goal: null, prio: { "ram_12:1": 1 }, cap: null, mode: "need" } }
```

- `goal: null` means "use the want picks", a number means custom coins, like the site's state
- `mode` is the site's **What do I need?** / **What can I get?**. "can get" uses `cap` as your hours a week instead of a goal
- loaded through the same cleaning as the site's hash (unknown ids dropped, limits clamped). If Terra renamed a node and something got dropped, a notice says so, "your goal lost Core 5 (Terra renamed it?)"
- the tree to check against is the live one from `treesFrom`, not `data.js`. So `clean` in `src/state.js` needs to take the trees as an argument instead of importing `TREES`, small refactor, todo

## Site and Terra talking

You never *have* to leave Terra, but if you like the site's big table you should be able to hop over and back.

| Way | How |
| --- | --- |
| Terra -> site | "open in Terra Calc" in the panel. Builds the site's hash with `toHash` from what the userscript read plus the goal, opens it in a new tab. This is the old "Plan my route" button from the design spec |
| Site -> Terra | A "send to Terra" link on the site: `https://terra.hackclub.com/#terra-calc=device=framework_12&want=...`. The userscript reads it at `document-start`, asks "use this goal? (Max 12, 10700 coins)", saves it, and wipes the hash with `history.replaceState` |
| Paste | A "paste a Terra Calc link" box in the panel, for when the link thing breaks |

**Todo:** check the game doesn't route on the hash itself. Solid's router *can* (`vendor-solid` mentions `location.hash`), Terra might not use that part. If it does, use a query string instead, or just the paste box.

Only the goal goes Site -> Terra. Coins, plots and stuff always come from the game, the site's typed numbers would just be older.

## The plan with a goal

Most of this is already built and just waiting for a goal that isn't `null`:

- `goalCost(tree, want, own)` -> goal coins
- `weekTarget(state, t, goalCoins, m)` -> this week's crops, already handles "can't reach it" by going as hard as it can (45 h cap)
- `stepsFrom` already turns crops into buy plots / buy seeds / place / plant / code / ship
- `buyOrder` + `milestones` -> the week each pick's affordable

What the panel would say:

```
goal: Framework 13, 3050 coins, 1870 to go
this week: 18 crops
on track: Core 3 Week 4, Core 5 Week 7, Framework 13 Week 9
next:
buy 8 plots from Heidi
...
code 18 h
```

| Decision | What it does |
| --- | --- |
| Not reachable | "can't get all of it, best is 11685 coins", then which picks fit and which don't (words, not ticks and crosses, the panel's tiny) |
| Multiplier guess | ~~While m is the 1.1 guess the goal line says "(guessing m 1.1)"~~ not anymore (22 Oct), the real m is there within a second. You can set your own m in our settings instead, see [this-week.md](this-week.md). A goal that's only reachable at m 1.2+ says that (todo) |
| "What can I get" mode | "at 20 h a week you end with 6200 coins: Max 12 minus the SSD" or whatever fits, in buy order |
| Week rollover | Goal stays, plan reworks itself when `hours.update` says it's a new week (already re-reads REST then) |

### Upgrades bought too early

Upgrades are refundable until shipped, and the plan assumes you buy them all at the end. If you already bought one, those coins are stuck in the tree instead of buying plots. The panel could say "750 coins are in RAM, refund it and buy it back in Week 12, you'd end with ~X more". `purchases` from `/device-upgrades` has the ids for a refund.

**Decision:** say it at all? It's *technically* right but feels kinda naggy (〃▽〃;). Default: one line, only when the difference is more than like 100 coins.

## Progress bar

Coins now + crops ready to sell (at m) + refunds of what's bought, against the goal. In the panel, and maybe a thin strip on Terra's tree header next to its own coin count. Stuck crops count as "maybe", drawn lighter, cuz they don't pay till the review comes back.

## Buttons (later, but doing them)

Basicaly got the ok already. Still read-only for now, these come after the goal stuff works.

| Button | How | Notes |
| --- | --- | --- |
| "buy this week's plots and seeds" | `shop.purchase` over the websocket | shape not captured yet, need a debug log of buying one plot by hand |
| "buy next upgrade" | `POST /device-upgrades/purchase { nodeId }` | only makes sense in the last week, or for picks you want right now |
| "sell all" | `npc.sellCrops` with `selections`, what the market sends | |
| "refund" | `POST /device-upgrades/purchases/{id}/refund` | for the too-early thing above |

Rules for every button: it says exactly what it's about to do and what it costs before it does it, one click is one thing, it never runs by itself, and after it the plan re-reads from the game instead of assuming it worked. A setting turns all of them off. **Decision:** do they start off or on? Default: off till you flip it.

## Other stuff

Random things that came up, roughly in how much i want them:

- **hours left this week.** The code step already subtracts `creditedSeconds`. A line like "7.5 h left, 4 days to go" would be nice, the week ends Sunday night US Eastern (from `hours.update` / `current-week`)
- **/admin guard.** The `@exclude` only works on a full page load. If Terra ever navigates to /admin inside the page, `main.js` should notice (`history.pushState` hook or just checking `location.pathname` on each draw) and hide the panel
- **settings ~~popup~~.** ~~A little gear on the panel~~ our own section in Terra's own settings tab now (22 Oct), above their logout: your own multiplier, fill, the This Week steps, debug. The Want bits and buttons get a box once they're switchable
- **looking native.** Terra's CSS module names change per build, but we could find its panel/badge styles by the stable part of the name (`_panel_`, `_nodeBadge_`) in `document.styleSheets` and copy the computed look. Low priority, ugly hack, prolly worth it eventually
- **moving the panel.** It sits on top of stuff in the bottom right. Draggable, or collapse to a little tab
- **seed shop badges.** "profit per hour at your m" on each seed in Heidi's shop, and a warning before buying more seeds than you have plots for this week (both from feature-ideas)

## Known gaps (from the loan plot stuff, still open)

- once loan plots are placed they count as yours, `loansFrom` only sees unplaced ones. Need a capture after placing some
- the shop's plot count might already include plots in your bag, so `plotsNow` could double count. Need `shop.stock` while holding bag plots
- when on Wednesday the loans actually land (they came Tuesday for me), so the "or wait" hint doesn't know when waiting is pointless
- the steps only show once the farm's been seen. If the plan has a goal but no farm it could still say "this week: N crops, code N h"

## Order to build it

1. ~~`clean` takes the trees as an argument, goal saving/loading in the userscript, tests~~ done 20 Oct (`goal.js`)
2. presets + custom coins in the panel, `weekTarget` gets the real goal. Already useful with no tree stuff at all. ~~the goal part~~ done, presets + the coin box still todo (`terraCalc.goal({ goal: 5000 })` in the console for now)
3. ~~the "pick your goal" button~~ done
4. Want bits on Terra's tree (observer, `data-node`, click blocking). ~~the logic~~ done and tested (`want.js`), the DOM half hasn't been run in the real game yet *at all*, no fake tree DOM test either
5. "Week N" labels on the tree from `milestones`
6. site <-> Terra links
7. progress bar, too-early refund line, hours left
8. buttons

1-3 is the "never leave Terra" version, if you don't mind picking a preset. 4 is the one that makes it actually nice.

## Captures that would help

- a debug log of opening the tree, wanting nothing, closing it (checks the observer story, and if the tree reloads `/device-upgrades` itself)
- the tree on another device in browse mode, for the switch case
- buying one plot by hand with debug on, for the `shop.purchase` shape
- a HAR after placing some loan plots
