# Goal Picker

*How the upgrade tree on the page turns picks into a goal. The general decisions are in [random-ah-design-specs.md](random-ah-design-specs.md).*

## Why

Nobody already knows "I need 10700 coins" (except me lol (*>艸<)). They know "I want a Framework 13 with max RAM". The picker turns tree picks into goal coins and feeds them to `hoursNeeded`, so the page answers "how many h/week for *this*".

## Presets

What's in `data.js`:

| Device | Preset | Coins |
| --- | --- | --- |
| Framework | Up to Framework 13 (DIY → Core 3 → i5 → Core 5 → FW13) | 3050 |
| Framework | Max 12 | 10700 |
| Framework | Max 12 (no USB card) | 10600 |
| Framework | Max 13 | 13850 |
| Framework | Max 13 (no USB card) | 13750 |
| iPad | Everything | 7350 |
| Galaxy | Everything | 4400 |

| Decision | What it does |
| --- | --- |
| What "max" means | Everything that still makes sense on that device: Max 12 keeps the stylus, Max 13 drops it (it doesn't work on the 13) |
| iPad / Galaxy presets | One "Everything" preset each. Their trees are small, so more presets aren't worth it |
| Extra USB card in Max presets | Kept, with "no USB card" variants next to them. Saves 100 coins; Max 13 needs m ≥ 1.2 either way |
| Other presets | None for now, but easy to add later. Candidates: "Max 12 without stylus", "FW13 + 2.8K", "RAM + SSD only" |
| Preset button when things are already picked | Replaces `want` (doesn't add to it). "Clear" empties `want` |

## Picking

| Decision | What it does |
| --- | --- |
| Layout | Like Terra's own tree: its x/y positions from `/device-upgrades`, stretched so cards don't overlap, lines to prerequisites (changed 10 Oct, was an indented list) |
| Controls | Checkbox for limit-1 nodes, − / + stepper for RAM, SSD, USB, Fancy |
| Owned vs want | Two columns per node: **Own** and **Want** |
| Want below owned | Not allowed: Want can't go below Own (refunds aren't modelled) |
| Unpicking a prerequisite | Also unpicks everything that needs it, and says so ("also removed Core 5, FW13") |
| USB lowered under what Fancy needs | Fancy drops to the new limit |
| Switching device | Clears `want` and `owned`, with a note that switching in-game refunds everything |
| Stylus + Framework 13 both picked | Allowed, small red note "the stylus doesn't work on the 13" |

## Showing cost

| Decision | What it does |
| --- | --- |
| Per node | Price (or the next tier's price) and "≈ X h" from `nodeHours` |
| Total | Goal coins (want − owned), right above the h/week answer |
| The "Goal coins" field from step 5 | The tree fills it. Typing a number by hand switches to a custom goal and greys out the tree |
| Not reachable | Milestones list with ✅ / ❌, so you see which picks fit and which don't |

`nodeHours` is `coins / (30m − 5)` today, apples only. New seeds are coming (dev, 10 Oct); with a seed list it becomes `coins / (best profit per crop)`, see [how-terra-works.md §10](../research/how-terra-works.md#more-than-one-seed-type). The "≈ X h" numbers can only go down.

## Milestones

| Decision | What it does |
| --- | --- |
| Order picks are "bought" in | Tree order by default (prerequisites first, cheapest sibling first). You can move a pick sooner or later to buy it first |
| What counts as affordable | First week whose end coins ≥ running total in that order |
| Where to show it | Extra column in the route table ("can afford: RAM ×1") or its own list under the total |

## State / URL

| Decision | What it does |
| --- | --- |
| New state fields | `device`, `owned`, `want` (state shape is in the [design spec](random-ah-design-specs.md#decide-before-coding-these-change-the-data-model)) |
| URL hash format | `device=framework_12&want=ram_12:3,ssd_12:2&own=framework_12_diy:1` |
| Bad ids / quantities in the hash | Ignore unknown ids, clamp to `limitOf`, then run `withPrereqs`. If anything was off, show a goofy error panel (drawing still to do, see [art-assets.md](art-assets.md#8-big-pictures)) |
| Userscript | Fills `owned` and `device` from `/device-upgrades` (`owned`, `mainDevice`) |

## New code (rough)

- `tree.js`
  - `unpick(tree, selection, id)`: remove a node and everything that needs it
  - `clampToLimits(tree, selection)`: e.g. fewer USB → fewer Fancy
  - `milestones(route, tree, want, owned)`: week each pick becomes affordable (or `route.js`)
- `data.js`: iPad / Galaxy presets, any new Framework presets
- `ui.js`: device picker, preset buttons, Own / Want list, goal total, hash fields

Tests:

| Function | Input | Expected |
| --- | --- | --- |
| `goalCost` | Max 13, owned DIY + Core 3 | 13200 |
| `unpick` | Max 13, unpick `cpu_core5_320` | removes `framework_13_upgrade`, `display_2k8_12`, `cpu_ryzen_ai7_350` |
| `clampToLimits` | USB 0, Fancy 5 | Fancy 4 |
| `milestones` | | |

## Research to do

- What `owned` and `purchases` look like in `/device-upgrades` when you own something (the 9 Oct capture had `owned: {}`). Especially: do tiered nodes (RAM, SSD) report a count?
- Does the $700 laptop grant have its own tree, or the same Framework one? (FAQ says "upgradeable just like the framework")
