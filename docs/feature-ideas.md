# Feature ideas

Possible features for the userscript

## First

What makes it feel finished, before anything new. In order:

1. ~~The steps go by the mix ("buy 12 eggplant seeds", "plant 12 eggplants"), and "code N h" is the water your crops still need minus what's in your pool~~ done 22 Oct
2. People can install and update the userscript: the built file where its update URL points, and an install bit in the README
3. ~~Goals without the console: presets and a custom coin box in our settings section~~ done 22 Oct
4. ~~The fallback, when reading Terra fails you type the numbers in by hand (Plumbing)~~ done 22 Oct
5. One go through everything in the real game: the settings section, the tags' new look, ticking, bonus seeds, and the new stuff: the sell step and goal bar (open the market once), the shop badges and the "Buy this?" line (tick them on first), the last week line on a monday
6. Site: ~~the week table scrolls sideways around 1280 px~~ done 22 Oct, and bok choy and eggplant need their own icons (i have to draw those)

## Fills itself in (reading only)

- [x] Coins, plots, seeds and crops from `player.currency` and `inventory.sync`
- [x] Device trees, prices, tiers and what you own from `GET /device-upgrades`
- [x] Current week from `/ysws/current-week`
- [x] week's real multiplier: `unitPriceCoins / baseUnitCoins` from the market (once that week is reviewed)
- [x] Water earned this week counts as hours already done (ended up as the water pool plus `unclaimed`, not `reward-estimate`)
- [x] New seeds picked up automatically from the `bonus_seeds` category in `shop.stock`, and the ones already in your bag
- [x] Your farm: what's ready, dry, withered, or stuck on review and why (changes asked, short on hours, rejected)
- [x] Ratticus's loan plots
- [x] Your water pool (`player.currency` `water`, it's your devlogged credited hours minus what you've watered with, decimals and all)
- [x] Hours not devlogged yet, `hours.update`'s `unclaimed`
- [x] How much water each planted crop still needs (`waterRequired` - `waterApplied`)
- [ ] Plot prices read from the shop instead of the formula, with a warning if they don't match. Half there: the shop's next plot price gives your plot count (under 19), and one that doesn't match the formula only goes to the debug log, cuz an old farm count looks the same as a wrong price
- [ ] A "Terra updated" notice when `version.json`'s build id changes (maybe but probably just if something doesnt work)

## Planning

- [x] Remaining hours needed this week
- [x] A live progress bar toward your goal: coins now plus crops ready to sell (faded), under the goal line on the This Week card
- [x] Crops you've grown and not sold count as coins: the market's list, the ready ones on your farm and the ones harvested since, with a sell step that buying waits on and "N to go once you sell your crops"
- [x] Simple plan summary: "this week: buy 5 plots + 25 apple seeds, code 35 h"
- [x] Priorities: a number per pick, RAM and SSD tiers each their own, with the week it's covered and the h/week to get that far
- [x] This week's best seed mix out of today's shop and your bag, the most profit that fits your hours, coins and plots (apples fill the rest)
- [x] Steps that go by the mix, and a code step that counts the water pool, plus a devlog step when there's water waiting on one
- [x] Presets and a custom coin goal inside Terra, in our settings section
- [ ] A refund planner: what you'd get back by switching device or refunding a pick
- [ ] Real-money value on each upgrade, from [real-prices.md](../research/real-prices.md)

## Your time

Nobody's coding 80 h a week, so the plan should start from how much time you actually have.

- [ ] Hours you can give each week, set per week (ex. finals week can be 10 h)
- [ ] ...and per day, the week's just the days added up
- [ ] Set them in Terra's own calendar (the userscript puts a little hours box on each day)
- [ ] Your hours history on the calendar, read from your devlogs and ships (Terra's number, AI time already only counts a third)
- [ ] Suggested hours for each day and week from that history, as the default till you change it
- [ ] A projection: at the hours you usually do, what you end up with by Week 12
- [ ] "What can I get": when your goal doesn't fit your hours, plan at your hours and say which picks you get, in your priority order
- [ ] Picks that don't fit your hours get marked on the tree tags and in the site's milestone list
- [ ] Show both when it doesn't fit: "needs 31 h a week, you've got 20"
- [ ] This week's "code N h" never asks for more than you said you'd give, and the h a day follows your days, not an even split
- [ ] The same hours on the site, a box per week in the week table

## Buying with risk

"Should I buy this, and how many?" A seed you don't water by Monday night is lost at its price, so it's the newsvendor problem with your hours as the demand. It needs the hours you'll actually give first (Your time's first item). The plan only buys what its own hours water, so with a spread around those every seed's watered at least half the time, and the break-evens are all under that (27% at most at m 1, 34% at m 0.8), so nothing's ever a gamble. With your hours and a spread you set it works, and the full thing comes once Your time has your history.

- [ ] Water order for a short week: best sale per water first (at m 1 that's eggplant 37.5, bok choy 37, apple 30), so the k-th seed gets water once you've coded W_k h, the water for everything ahead of it plus its own
- [ ] Buy the k-th seed only if P(hours >= W_k) > buy / (m \* sell). The break-even chance at m 1 is apple 17%, eggplant 20%, bok choy 27%, so apples get bought generously and bok choy carefully, even tho it's cheaper than eggplant. That's exact for the last seed in the order, one further up also pushes everything behind it later by its own water, and that counts against it
- [ ] P(hours >= x) from your plan with a spread you set, then from your history. Mid-week only the days left are uncertain
- [ ] A rejected review pays nothing, the payoff gets \* (1 - p_rejected), yours to set
- [ ] The card says it: "buy 6 eggplants + 4 apples, all watered if you code 26 h (3 of your last 4 weeks)", "a 7th eggplant pushes that to 28 h, skip it"
- [ ] The same on the site with a "how sure am I about my hours" slider, it has no history

## Daily shop and deadlines

- [x] A heads up when today's shop has a seed that beats apples. Ended up as a "check what Heidi has today" step when you haven't opened the shop today, and once you have, the steps buy whatever's best ("buy 12 eggplant seeds from Heidi")
- [x] Seeds about to die, the plant steps count down for the last 2 days: "plant 6 eggplant seeds (1 day 4 h left to plant and water them)" (they go Monday 11:59 PM EDT, the items' `usableUntil`)
- [ ] Ship and devlog reminders before the week ends, like "devlog now, 59 min aren't counting" (that's `unclaimed`)
- [x] A recap when the week rolls over, the first 2 days of a week: "last week: coded at least 31.2 h, the plan wanted 40 h" (at least cuz it's as of the last time Terra Calc saw that week, hackatime keeps counting with Terra closed. last week's real total from the API would fix that). What you sold's left out, a week's sales are mostly the week before's crops

## Shortcut Buttons

What the game sends to buy, water and plant is captured now: `shop.purchase { stockEntryId, requestId, expectedPriceCoins }` buys, `farm.interact { farmItemId }` waters a crop all the way in one go (an eggplant takes both its water at once), and `farm.place { inventoryItemId }` plants where your player's standing, so planting stays by hand. The game encodes what it sends as msgpackr records, so sending has to match that. Terra only ever sends `farm.interact` for the crop you're standing next to tho, so whether the server takes one from across the farm is a test-it-and-see thing.

- [ ] Open Heidi's shop from anywhere, not just at her stall. Her window can't be opened by a script (it only opens from her dialogue), so this would be our own shop window, with stock from `shop.requestStock` and buying through `shop.purchase`, if the server takes those away from her
- [ ] "Buy this week's plots" through `shop.purchase`
- [ ] "Buy this week's seeds", the mix the plan picked
- [ ] "Water everything planted" through `farm.interact`
- [ ] "Buy next upgrade" through `/device-upgrades/purchase`
- [ ] A "sell all crops" button in the market
- [x] "Go to your island" from anywhere, a link on the This Week card. It fires the game's own `visit_farm` window event (the friends list's "visit their farm"), with no user in it, that's your own farm. Not tried in the real game yet

## Inside Terra's pages

- [ ] A "what to do next" panel with the plan and the buttons above (the plan half's done, it's Terra's own This Week card now, go to your island's on it too, the rest of the buttons still to come)
- [x] Pick your goal on Terra's own device tree: want / wanted, steppers for RAM, SSD and the cards, prerequisites come along
- [x] Asks first when a click would take other picks out, or move your goal to another device
- [x] The steps nested under what they wait on, ticked off when they're done, and the h a day on the code step
- [x] A box for your own multiplier in the settings
- [x] "Affordable in Week N" labels on the device tree nodes (ended up in the want tags, with the h/week to get there)
- [ ] A full overview: the whole plan like the site's (week by week, what you get when, h/week per pick). **Decision:** where does it open, a Terra-style window, a Terra Calc tab in Terra's big panel next to inventory and friends, or the calendar once Your time is in? Default: the window, like the device tree's, from a "full plan" link on the This Week card
- [x] Profit-per-hour badges on shop seeds at your multiplier ("30/h" on each seed in Heidi's shop, matched by name, plots not counted, off till you tick it in our settings). Not tried in the real game yet
- [x] A warning before buying seeds you can't plant this week: the shop badges say how many the plan buys ("36/h, buy 12"), and Heidi's "Buy this?" gets a red line when the plan doesn't need any more of that seed. Only with the badges on, and not tried in the real game yet
- [x] Our part of the This Week card folds up on its own, separate from Terra's ("hide Terra Calc", and Terra's own checklist comes back)
- [ ] Browser notifications when crops are ready or a review comes back
- [x] A settings popup to turn each part on or off (ended up as a section in Terra's own settings tab)
- [x] Try to make look like it is native terra (reuse it's css and stuff)

## Plumbing

- [x] Build step to bundle `src/` into one `.user.js`
- [x] A WebSocket hook at `document-start` that reads the game's messages
- [x] One file for every URL and message name, and checks that each response looks the way it should
- [x] Tests against saved responses, starting with the HAR shapes and later a Chrome capture
- [x] A fallback: if anything fails, type the numbers in by hand like the site does now (First, 4)
- [x] Your farm, goal and checklist saved per account, another account on the same browser doesn't get them
- [x] A notice when Terra changes something the plan uses (farm fields renamed, the apple price moved)
- [x] `terraCalc` in the console, for the plan, a goal by hand and debug logging
