# Feature ideas

Possible features for the userscript

## First

What makes it feel finished, before anything new. In order:

1. ~~The steps go by the mix ("buy 12 eggplant seeds", "plant 12 eggplants"), and "code N h" is the water your crops still need minus what's in your pool~~ done 22 Oct
2. People can install and update the userscript: the built file where its update URL points, and an install bit in the README
3. ~~Goals without the console: presets and a custom coin box in our settings section~~ done 22 Oct
4. ~~The fallback, when reading Terra fails you type the numbers in by hand (Plumbing)~~ done 22 Oct
5. One go through everything in the real game
6. Site: ~~the week table scrolls sideways around 1280 px~~ done 22 Oct, and bok choy and eggplant need their own icons (i have to draw those)

## Fills itself in (reading only)

- [x] Coins, plots, seeds and crops from `player.currency` and `inventory.sync`
- [x] Device trees, prices, tiers and what you own from `GET /device-upgrades`
- [x] Current week from `/ysws/current-week`
- [x] week's real multiplier: `unitPriceCoins / baseUnitCoins` from the market (once that week is reviewed)
- [x] Water earned this week counts as hours already done, the water pool plus `unclaimed`
- [x] New seeds picked up automatically from the `bonus_seeds` category in `shop.stock`, and the ones already in your bag
- [x] Your farm: what's ready, dry, withered, or stuck on review and why (changes asked, short on hours, rejected)
- [x] Ratticus's loan plots
- [x] Your water pool (`player.currency` `water`, it's your devlogged credited hours minus what you've watered with, decimals and all)
- [x] Hours not devlogged yet, `hours.update`'s `unclaimed`
- [x] How much water each planted crop still needs (`waterRequired` - `waterApplied`)
- [ ] Plot prices off the shop instead of the formula
- [ ] A "Terra updated" notice when `version.json`'s build id changes (maybe but probably just if something doesnt work)

## Planning

- [x] Remaining hours needed this week
- [x] A live progress bar toward your goal: coins now plus crops ready to sell (faded), under the goal line on the This Week card
- [x] Crops you've grown and not sold count as coins, with a sell step first
- [x] Simple plan summary: "this week: buy 5 plots + 25 apple seeds, code 35 h"
- [x] Priorities: a number per pick, RAM and SSD tiers each their own, with the week it's covered and the h/week to get that far
- [x] This week's best seed mix out of today's shop and your bag
- [x] Steps that go by the mix, and a code step that counts the water pool, plus a devlog step when there's water waiting on one
- [x] Presets and a custom coin goal inside Terra, in our settings section
- [ ] A refund planner: what you'd get back by switching device or refunding a pick
- [ ] Real-money value on each upgrade, from [real-prices.md](../research/real-prices.md)

## Your time

Nobody's coding 80 h a week, so the plan should start from how much time you actually have. Worked out in [your-time.md](your-time.md).

- [x] Hours you can give each week, set per week (ex. finals week can be 10 h)
- [x] ...and per day, the week's just the days added up
- [x] Set them on Terra's own calendar, a box per day
- [x] What you coded on the days already gone, on the calendar
- [x] Suggested hours for each day and week from that history
- [x] A projection: what your usual week gets you by Week 12, on the card
- [x] "What can I get": when your goal doesn't fit your hours, plan at your hours and say which picks you get, in your priority order
- [x] Picks that don't fit your hours get marked on the tree tags ("doesn't fit") and in the site's milestone list ("not with your hours")
- [x] Both numbers when it doesn't fit: "not on my days, a flat 31 h/week would do it"
- [x] The code step follows your days, and says what's left of today
- [x] The same hours on the site, a box per week in the week table
- [x] A log per day of the week's credited hours so far (`daylog.js`), raw stuff for the day predictions
- [x] An optional Hackatime key for real per-day hours

## Buying with risk

The maths is in [buying-seeds.md](buying-seeds.md).

- [x] Water order for a short week, best sale per water first
- [x] Buy a seed only if the chance it gets watered beats its break-even
- [ ] P(hours >= x) from a spread you set
- [x] P(hours >= x) from your history
- [x] The card says it: "all 10 seeds to buy get watered at 26h more (2 of my last 4 weeks)"
- [ ] The same on the site with a "how sure am I about my hours" slider
- [ ] P(hours >= x) off the per-day predictions

## Waiting for a better seed

Also in [buying-seeds.md](buying-seeds.md).

- [x] Odds per seed from the shop log
- [x] What waiting is worth, worked back from Sunday
- [x] Waiting on water i'm not sure of yet
- [x] The chance i'm not back before Monday night
- [x] The card says when waiting beats today's seed

## Daily shop and deadlines

- [x] A heads up when today's shop has a better seed (the "check Heidi's shop" step)
- [x] The plant steps count down the last 2 days before seeds die
- [x] The devlog and ship steps count down too
- [x] Last week's hours vs the plan, the first 2 days of a new week

## Shortcut Buttons

What the game sends to buy, water and plant is in [terra-api.md](../research/terra-api.md), and `terraCalc.buy` in the console sends a purchase.

- [ ] Open Heidi's shop from anywhere (she's in town, walking you there's the only honest way)
- [ ] "Buy this week's plots" through `shop.purchase`
- [ ] "Buy this week's seeds", the mix the plan picked
- [ ] "Water everything planted" through `farm.interact`
- [ ] "Buy next upgrade" through `/device-upgrades/purchase`
- [ ] A "sell all crops" button in the market
- [x] "Go to your island" button in Terra's own column
- [x] On your island it's Hub instead
- [x] "Pick your goal", the round button under that one
- [ ] Art for the three round buttons, they've got a word in them for now
- [x] On short screens the buttons go next to the water meter

## Inside Terra's pages

- [ ] A "what to do next" panel with the plan and the buttons (the plan half's the This Week card)
- [x] Pick your goal on Terra's own device tree: want / wanted, steppers for RAM, SSD and the cards, prerequisites come along
- [x] Asks first when a click would take other picks out, or move your goal to another device
- [x] The steps nested under what they wait on, ticked off when they're done, and the h a day on the code step
- [x] A box for your own multiplier in the settings
- [x] "Affordable in Week N" on the device tree, in the want tags with the h/week to get there
- [ ] A full overview: the whole plan like the site's, inside Terra
- [x] Coins-an-hour badges on Heidi's seeds
- [x] A red line on Heidi's "Buy this?" when the plan doesn't need more of that seed
- [x] Our part of the This Week card folds up on its own, separate from Terra's ("hide Terra Calc", and Terra's own checklist comes back)
- [ ] Browser notifications when crops are ready or a review comes back
- [x] Our own section in Terra's settings tab to turn each part on or off
- [x] Try to make look like it is native terra (reuse it's css and stuff)

| Decision | What it does |
| --- | --- |
| Full overview | **Decision:** where does it open, a Terra-style window, a Terra Calc tab in Terra's big panel next to inventory and friends, or the calendar once Your time is in? Default: the window, like the device tree's, from a "full plan" link on the This Week card |

## Plumbing

- [x] Build step to bundle `src/` into one `.user.js`
- [x] A WebSocket hook at `document-start` that reads the game's messages
- [x] One file for every URL and message name, and checks that each response looks the way it should
- [x] Tests against saved responses, starting with the HAR shapes and later a Chrome capture
- [x] A fallback: if anything fails, type the numbers in by hand like the site does now (First, 4)
- [x] Your farm, goal and checklist saved per account, another account on the same browser doesn't get them
- [x] A notice when Terra changes something the plan uses (farm fields renamed)
- [x] `terraCalc` in the console, for the plan, a goal by hand and debug logging

## Later

- [ ] Tooltips with the maths behind the numbers, in TeX
- [ ] Those same tooltips with my own numbers filled in: "v = (1.2 \* 75 - 15) / 2 = 37.5" next to the general formula
