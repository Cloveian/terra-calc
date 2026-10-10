# Random Ahh Design Specs

*Decisions that come up mid-coding, with a default for each (drafted with Claude). Change the default, not the code, when you change your mind.*

## Decide before coding (these change the data model)

| Decision               | Default                                                                                            |     |
| ---------------------- | -------------------------------------------------------------------------------------------------- | --- |
| Half-done current week | Buying plots/seeds, planting and watering can all happen on the last day, so the week is just "total water". Inputs: inventory + "hours so far this week" (+ "crops already planted" for people who planted early) |     |
| Credited or real hours | Plan in **credited** hours (AI already divided by 3). Optional "AI share" converter later          |     |
| When sale coins arrive | Week $t$'s sales pay for week $t+1$, no buying plots mid-week with this week's sales               |     |
| Upgrades already owned | `owned: { id: qty }` in state, goal cost only counts what's missing (next RAM tier, not the first) |     |
| Node ids               | Use Terra's own ids from `/device-upgrades`, so a userscript can pass them straight through        |     |
| State                  | One object `{ coins, plots, seeds, m, cap, device, goal, owned }`, the UI only reads/writes that   |     |

## Game model

| Decision | Default |
| --- | --- |
| Multiplier rounding | Keep decimals, round only for display, show "≈" |
| Partial hours | Whole credited hours only (water is `floor(seconds / 3600)`) |
| Under 10 h in a main week | Out (stricter than the debt rule, but safe) |
| Seeds expiring | Ratticus's weekly seeds expire ("plant and water by <date>, or it's lost"). Bought apple seeds: unknown, assume they don't and say so in the UI |
| Plot buying | Only buy the plots needed that week |
| Buying upgrades | All at the end (refundable until shipped, so no difference) |
| Prep weeks | Optional, 0 h allowed |
| Buying water | Not modelled. Later: "emergency fund" setting that keeps X coins aside |
| Ship timing | Warn on the page: "ship before the last day". A reviewer cut after the week ends dries out crops and can't be fixed, so you end up short on rent |
| Shop stock | Stock refreshes nightly and can run out. Warn: "buy apple seeds before the last day" until stock limits are known |
| Late reviews | Next week's coins only arrive once this week's ship is approved and sold. Assume they arrive in time, mention it in the UI |

## Solver

| Decision | Default |
| --- | --- |
| What it optimises | Lowest flat h/week that reaches the goal |
| Different hours per week | One cap for now. Later: per-week overrides (Week 6 Thanksgiving, Week 10 Christmas) |
| Multiplier | One for every week. Later: per-week (frontloading) |
| Goal not reachable | Show the best reachable coins and what that buys |
| Milestones | Show the week each picked node becomes affordable |

## Dates

| Decision | Default |
| --- | --- |
| "Today" | US Eastern calendar date. Monday = new week, even on the wiggle day |
| Before Terra ($t < 0$) | Plan from Prep 1 |
| After Terra ($t > 14$) | Show "Terra's over" |

## Input / userscript

| Decision | Default |
| --- | --- |
| Getting inventory in | Form fields + URL hash (`#coins=4&plots=13&seeds=3`) |
| Bad hash values | Clamp (plots 10-45, coins ≥ 0), ignore unknown ids, fall back to defaults |
| Live prices | `data.js` is the default, live prices (from a userscript) merge on top. Too big for the URL, so later via `localStorage` / `postMessage` |
| Userscript | Later week. Reads inventory read-only, adds a "Plan my route" button that opens the site with the hash. Ask in #terra-help first |

## Code / UI

| Decision | Default |
| --- | --- |
| Saving | URL hash (shareable) + `localStorage` (remembers last inventory) |
| Stale prices | "Prices as of 9 Oct 2026" in `data.js` and on the page |
| Floats in tests | Small tolerance, or whole-number cases at $m = 1$ |
| Look | Plain first, own styling, don't copy Terra's art, credit Terra / Hack Club |
| License | MIT |
| Phones | Table scrolls sideways at least |
