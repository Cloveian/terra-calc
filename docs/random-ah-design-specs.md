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

Facts from the dev (10 Oct), not decisions: all seeds expire at the end of the week (so `seeds` resets to 0 after this week), apple seeds aren't limited stock. See [how-terra-works.md](../research/how-terra-works.md).

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
