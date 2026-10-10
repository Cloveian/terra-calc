# Random Ahh Design Specs

*Decisions that come up mid-coding, with a default for each (drafted with Claude). Change the default, not the code, when you change your mind.*

## Decide before coding (these change the data model)

| Decision               | Default                                                                                                                                                                                                            |                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Half-done current week | Buying plots/seeds, planting and watering can all happen on the last day, so the week is just "total water". Inputs: inventory + "hours so far this week" (+ "crops already planted" for people who planted early) | y                                                                                                                           |
| Credited or real hours | Plan in **credited** hours. Inputs `humanHours` + `aiHours`, credited = human + ai/3. Optional "% AI" setting turns the h/week answer back into real hours                                                         | have spot to put ai and normal hours                                                                                        |
| When sale coins arrive | Week $t$'s sales pay for week $t+1$, no buying plots mid-week with this week's sales                                                                                                                               | plan on that                                                                                                                |
| Upgrades already owned | `owned` and `want` (both `{ id: qty }`), presets fill `want`. Goal cost = want − owned, per tier (own RAM ×1, want ×3 → 1300 + 2100)                                                                               | we will have a tree that people can sellect wjat they have and what they wany (want can have presets for like 'max' things) |
| Node ids               | Use Terra's own ids from `/device-upgrades`, so a userscript can pass them straight through                                                                                                                        | y                                                                                                                           |
| State                  | One object `{ coins, plots, seeds, humanHours, aiHours, m, cap, device, owned, want, mode }`, the UI only reads/writes that                                                                                        | y                                                                                                                           |


## Game model

Facts from the dev (10 Oct), not decisions: all seeds expire at the end of the week (so `seeds` resets to 0 after this week), apple seeds aren't limited stock, more seed types are coming ("a few more before next week"), and prices already in the game are unlikely to change but small adjustments are possible before Week 1 (19 Oct). See [how-terra-works.md](../research/how-terra-works.md).

| Decision                  | Default                                                                                                                                          |                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Multiplier rounding       | Keep decimals, round only for display, show "≈"                                                                                                  | exact when possable                                              |
| Partial hours             | Whole credited hours only (water is `floor(seconds / 3600)`)                                                                                     | y                                                                |
| Under 10 h in a main week | Out (stricter than the debt rule, but safe)                                                                                                      | y                                                                |
| Plot buying               | Only buy the plots needed that week                                                                                                              | y                                                                |
| Buying upgrades           | All at the end (refundable until shipped, so no difference)                                                                                      | y                                                                |
| Prep weeks                | Optional, 0 h allowed                                                                                                                            | y                                                                |
| Buying water              | Not modelled (50, +5 each, max 75; never pays for itself). Later: "emergency fund" setting that keeps X coins aside | low priority                                                     |
| Ship timing               | Warn on the page: "ship before the last day". A reviewer cut after the week ends dries out crops and can't be fixed, so you end up short on rent | y                                                                |
| Late reviews              | Next week's coins only arrive once this week's ship is approved and sold. Assume they arrive in time, mention it in the UI                       | y                                                                |
| Country prices            | Prices may depend on your country, and the $700 laptop grant (no Framework shipping) is upgradeable too. Make tree costs editable: "Prices may differ in your country, edit them" | |
| Price changes before Week 1 | Re-check shop + tree prices on 19 Oct, update `data.js` and `PRICES_AS_OF` | |

## New seeds

Nothing about them is known yet (price, sell, water, growth time, stock, weeks, tab). Math for any seed list is in [how-terra-works.md §10](../research/how-terra-works.md#more-than-one-seed-type), planned code in the [build plan](build-plan.md#any-seed-list-for-the-new-seeds). These are the choices that math raises.

| Decision                                  | Default                                                                                                                                                                                                      |     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- |
| Where seed numbers live                   | `SEEDS` in `data.js`, one row per seed: `buy, sell, water, weeks, stock, from, until`. Only `buy` / `sell` are in the math for now. Editable in the UI like tree costs, so a seed can be typed in the day it drops |     |
| Fields nobody knows yet                   | Assume the simple case (1 water, grows in-week, not limited, every week) and show "assumed" next to it                                                                                                       |     |
| Which seeds go in the extra hours         | `seedMix`: seeds on hand first, then the best-profit seed the budget allows, the cheapest seed fills the rest (at most two types). Route table shows it: "7 apples + 8 X"                                     |     |
| Hours vs better seeds                     | Always use every hour up to the cap (`w = min(cap, wMax)`), *then* pick the mix. Plots are permanent and the question is hours, even if a coin now and then would've bought a better seed instead of a plot |     |
| First 10 hours in prep weeks              | Free carrots, as now. Loses at most `5m − 5` a crop against apples (≤ 25 coins/week). Revisit if a new seed earns a lot more than `25m`                                                                      |     |
| Rent with new seeds                       | Still 10 carrots × 20 × m. Unknown whether other crops can pay rent or what they'd pay                                                                                                                       |     |
| Seeds on hand in state / hash             | `seeds` becomes `{ id: count }`, one input per seed type. Hash `seeds=apple:3,x:2`; a bare number (`seeds=3`) still means apples                                                                              |     |
| Seeds only in some weeks                  | `seedsFor(t)` filters by `from` / `until`. A seed with unknown weeks counts as always available                                                                                                               |     |
| A seed that needs `water ≠ 1`, `weeks > 1` or `stock` | Not modelled. Show it in the list with "not in the math yet" and leave it out of the mix until §10's "what breaks it" gets built                                                                 |     |
| Hours tables and tests                    | Stay apples-only (the baseline). Don't recompute until real seed numbers exist. The general code has to reproduce them with `[apple]`                                                                        |     |

## Solver

| Decision                 | Default                                                                             |                |
| ------------------------ | ----------------------------------------------------------------------------------- | -------------- |
| What it optimises        | `mode` picks: **What do I need?** (goal → lowest flat h/week), **What can I get?** (h/week → final coins + what that buys), later **Custom weeks** (hours per week) | have user pick |
| Different hours per week | One cap for now. Later: per-week overrides (Week 6 Thanksgiving, Week 10 Christmas) | y              |
| Multiplier               | One for every week. Later: per-week (frontloading). A crop gets the multiplier of the week it's **planted**, not sold (dev) | y              |
| Goal not reachable       | Show the best reachable coins and what that buys                                    | y              |
| Milestones               | Show the week each picked node becomes affordable                                   | y              |

## Dates

| Decision               | Default                                                             |     |
| ---------------------- | ------------------------------------------------------------------- | --- |
| "Today"                | US Eastern calendar date. Monday = new week, even on the wiggle day | y   |
| Before Terra ($t < 0$) | Plan from Prep 1                                                    | y   |
| After Terra ($t > 14$) | Show "Terra's over"                                                 | y   |

## Input / userscript

| Decision             | Default                                                                                                                                  |                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Getting inventory in | Form fields + URL hash (`#coins=4&plots=13&seeds=3`)                                                                                     | y                                                                               |
| Bad hash values      | Clamp (plots 10-45, coins ≥ 0), ignore unknown ids, fall back to defaults                                                                | y                                                                               |
| Live prices          | `data.js` is the default, live prices (from a userscript) merge on top. Too big for the URL, so later via `localStorage` / `postMessage` | y                                                                               |
| Userscript           | Later week. Reads inventory read-only, adds a "Plan my route" button that opens the site with the hash. Ask in #terra-help first         | ~~asked miggy~~ oked by miggy, just be clear in the UI that it does `GET` stuff |

## Code / UI

| Decision        | Default                                                                    |     |
| --------------- | -------------------------------------------------------------------------- | --- |
| Saving          | URL hash (shareable) + `localStorage` (remembers last inventory)           | y   |
| Stale prices    | "Prices as of 9 Oct 2026" in `data.js` and on the page                     | y   |
| Floats in tests | Small tolerance, or whole-number cases at $m = 1$                          | y   |
| Look            | Plain first, own styling, don't copy Terra's art, credit Terra / Hack Club | y   |
| License         | MIT                                                                        | y   |
| Phones          | Table scrolls sideways at least                                            | y   |
