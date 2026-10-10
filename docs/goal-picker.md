# Goal Picker

*Scaffold drafted with Claude. Defaults are suggestions; fill in the third column like [random-ah-design-specs.md](random-ah-design-specs.md).*

## Why

Nobody already knows "I need 10700 coins"(exept me lol (*>艸<)). They know "I want a Framework 13 with max RAM". The picker will turn tree picks into goal coins and feed them to `hoursNeeded`, so the page answers "how many h/week for *this*".

## Presets

What exists in `data.js` now:

| Device | Preset | Coins |
| --- | --- | --- |
| Framework | Framework 13 (DIY → Core 3 → i5 → Core 5 → FW13) | 3050 |
| Framework | Max 12 | 10700 |
| Framework | Max 13 | 13850 |
| iPad | *(none)* | |
| Galaxy | *(none)* | |

| Decision                                     | Default                                                                                                             |                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| What "optimal max" means                     | Everything that still makes sense on that device: Max 12 keeps the stylus, Max 13 drops it (doesn't work on the 13) | y                        |
| iPad / Galaxy presets                        | One "Everything" preset each (7350 / 4400). Their trees are small, so more presets aren't worth it                  | y                        |
| Extra USB card in Max presets                | Keep it, add "no extra USB" variants (10600 / 13750). At m = 1, Max 13 is only reachable *without* it               | y                        |
| Other presets                                | None for now. Candidates: "Max 12 without stylus", "FW13 + 2.8K", "RAM + SSD only"                                  | later, leave east adding |
| Preset button when things are already picked | Replaces `want` (doesn't add to it). "Clear" empties `want`                                                         | y                        |

## Picking

| Decision                           | Default                                                                                       |     |
| ---------------------------------- | --------------------------------------------------------------------------------------------- | --- |
| Layout                             | Like Terra's own tree: its x/y positions from `/device-upgrades`, stretched so cards don't overlap, lines to prerequisites (was: indented list) | y, changed 10 Oct |
| Controls                           | Checkbox for limit-1 nodes, − / + stepper for RAM, SSD, USB, Fancy                            | y   |
| Owned vs want                      | Two columns per node: **Own** and **Want**                                                    | y   |
| Want below owned                   | Not allowed: Want can't go below Own (refunds aren't modelled)                                | y   |
| Unpicking a prerequisite           | Also unpicks everything that needs it, and says so ("also removed Core 5, FW13")              | y   |
| USB lowered under what Fancy needs | Fancy drops to the new limit                                                                  | y   |
| Switching device                   | Clears `want` and `owned`, with a note that switching in-game refunds everything              | y   |
| Stylus + Framework 13 both picked  | Allowed, small red note "the stylus doesn't work on the 13"                                   | y   |

## Showing cost

| Decision                           | Default                                                                                 |     |
| ---------------------------------- | --------------------------------------------------------------------------------------- | --- |
| Per node                           | Price (or the next tier's price) and "≈ X h" from `nodeHours`                           | y   |
| Total                              | Goal coins (want − owned), right above the h/week answer                                | y   |
| The "Goal coins" field from step 5 | Tree fills it. Typing a number by hand switches to a custom goal and greys out the tree | y   |
| Not reachable                      | Milestones list with ✅ / ❌, so you see which picks fit and which don't                  | y   |

`nodeHours` is `coins / (30m − 5)` today, apples only. New seeds are coming (dev, 10 Oct); with a seed list it becomes `coins / (best profit per crop)`, see [how-terra-works.md §10](../research/how-terra-works.md#more-than-one-seed-type). The "≈ X h" numbers can only go down.

## Milestones

| Decision                    | Default                                                                                |                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Order picks are "bought" in | Tree order, prerequisites first, cheapest sibling first                                | user can spesify what they want 'first' but that is a good default |
| What counts as affordable   | First week whose end coins ≥ running total in that order                               | y                                                                  |
| Where to show it            | Extra column in the route table ("can afford: RAM ×1") or its own list under the total | y                                                                  |

## State / URL

| Decision                         | Default                                                                                                                                     |                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| New state fields                 | `device`, `owned`, `want` (state shape is in the [design spec](random-ah-design-specs.md#decide-before-coding-these-change-the-data-model)) | y                                                                 |
| URL hash format                  | `device=framework_12&want=ram_12:3,ssd_12:2&own=framework_12_diy:1`                                                                         | y                                                                 |
| Bad ids / quantities in the hash | Ignore unknown ids, clamp to `limitOf`, then run `withPrereqs`                                                                              | if there are errors, i wanna make a really goofy error image/page |
| Userscript                       | Fills `owned` and `device` from `/device-upgrades` (`owned`, `mainDevice`)                                                                  | y                                                                 |

## New code (rough)

- `tree.js`
  - `unpick(tree, selection, id)`: remove a node and everything that needs it
  - `clampToLimits(tree, selection)`: e.g. fewer USB → fewer Fancy
  - `milestones(route, tree, want, owned)`: week each pick becomes affordable (or `route.js`)
- `data.js`: iPad / Galaxy presets, any new Framework presets
- `ui.js`: device picker, preset buttons, Own / Want list, goal total, hash fields

Tests to add (fill in expected values once the defaults above are settled):

| Function | Input | Expected |
| --- | --- | --- |
| `goalCost` | Max 13, owned DIY + Core 3 | 13200 |
| `unpick` | Max 13, unpick `cpu_core5_320` | removes `framework_13_upgrade`, `display_2k8_12`, `cpu_ryzen_ai7_350` |
| `clampToLimits` | USB 0, Fancy 5 | Fancy 4 |
| `milestones` | | |

## Research to do

- What `owned` and `purchases` look like in `/device-upgrades` when you own something (the 9 Oct capture had `owned: {}`). Especially: do tiered nodes (RAM, SSD) report a count?
- Does the $700 laptop grant have its own tree, or the same Framework one? (FAQ says "upgradeable just like the framework")
