# Feature ideas

Possible features for the userscript

## Fills itself in (reading only)

- [x] Coins, plots, seeds and crops from `player.currency` and `inventory.sync`
- [x] Device trees, prices, tiers and what you own from `GET /device-upgrades`
- [x] Current week from `/ysws/current-week`
- [x] week's real multiplier: `unitPriceCoins / baseUnitCoins` from the market (once that week is reviewed)
- [ ] Water earned this week `reward-estimate` (plan can count those hours as already done)
- [x] New seeds picked up automatically from the `bonus_seeds` category in `shop.stock`
- [ ] Plot prices read from the shop instead of the formula, with a warning if they don't match
- [ ] A "Terra updated" notice when `version.json`'s build id changes (maybe but probably just if something doesnt work)

## Planning

- [x] Remaining hours needed this week
- [ ] A live progress bar toward your goal: coins now plus crops ready to sell
- [x] Simple plan summary: "this week: buy 5 plots + 25 apple seeds, code 35 h"
- [ ] A refund planner: what you'd get back by switching device or refunding a pick
- [ ] Real-money value on each upgrade, from [real-prices.md](../research/real-prices.md)

## Shortcut Buttons

- [ ] "Buy this week's plots and seeds" through `shop.purchase`
- [ ] "Buy next upgrade" through `/device-upgrades/purchase`
- [ ] A "sell all crops" button in the market

## Inside Terra's pages

- [ ] A "what to do next" panel with the plan and the buttons above
- [x] "Affordable in Week N" labels on the device tree nodes (ended up in the want tags, with the h/week to get there)
- [ ] Profit-per-hour badges on shop seeds at your multiplier
- [ ] A warning before buying seeds you can't plant this week
- [x] A settings popup to turn each part on or off (ended up as a section in Terra's own settings tab)
- [x] Try to make look like it is native terra (reuse it's css and stuff)

## Plumbing

- [x] Build step to bundle `src/` into one `.user.js`
- [x] A WebSocket hook at `document-start` that reads the game's messages
- [x] One file for every URL and message name, and checks that each response looks the way it should
- [x] Tests against saved responses, starting with the HAR shapes and later a Chrome capture
- [ ] A fallback: if anything fails, type the numbers in by hand like the site does now

