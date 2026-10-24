# Seeds from the shop

## Why

The seeds were hardcoded twice over: `CROPS` in data.js has apple, bok choy and eggplant with their prices, and the plan treats apples as the seed that's always there and fills every week. Then apples turned out to not always be there either, and every new seed so far has meant a code change the day it dropped. The shop already says everything the plan needs per seed (`priceCoins`, `cropValue`, `waterNeeded`, the name), so the userscript should just read it. A seed Terra adds tomorrow should work tomorrow, no update. Case in point, the 24 Oct shop: cabbage and nothing else ("well at least it's something"), 2 coins, 1 water, sells for 20, so 18 a water at m 1, under apple's 25. No apples, and the card still says buy apples.

## What you set

| Decision | What it does |
| --- | --- |
| The seeds in data.js | **Decided (24 Oct):** they stay, but nothing *needs* them. They're known values: the fallback before the shop's ever been open, and known highs and lows for the risk maths (the best and worst seed by water it knows, eggplant and apple right now). The site keeps planning off them, it can't read the shop |
| Weeks after this one | **Decided (24 Oct):** a typical day off the shop log, see "Later weeks". Till the log has 14 days, the last stock seen |
| No stock seen yet | **Decided (24 Oct):** the card asks to open Heidi's shop once, and plans off data.js till then |
| Stock limits | `quantity: 1` on an entry looks like what one purchase gives, not how many are left. Treated as no limit till something says otherwise |

## What changes

- **Every seed from the stock:** `seedsFrom` takes every `bonus_seeds` entry with `cropValue` and `waterNeeded`, apple included (it's in that tab too). Apples stop being special: no `APPLE_SEED` filter, no `applePrice`
- **The shop log keeps the rows:** `{ dateKey: [{ id, name, buy, sell, water }] }` instead of just ids, so the log is also where every seed's last known numbers live. Known seeds = everything the log's seen (newest numbers win), then data.js for ones it hasn't. Older days in the log are just ids and get read as ids. The log keeps 60 days, so a seed Heidi hasn't had in that long falls back to data.js or drops out
- **This week's mix:** bestMix picks from today's stock. Apples "fill whatever's left" now cuz they're the cheap one that's always there, that becomes the best seed in the stock for the leftover water (whatever it is that day). Bonus seeds are today only, so this week never plans off yesterday's stock: no stock today = apples off data.js till the shop's open, with the "check Heidi's shop" step like now (the typical day as a seed would put "buy 20 typical seed" on the card)
- **Later weeks:** see below
- **Names, badges, boxes:** the card's seed names, the shop badges and the typed seed boxes in settings come off the known seeds, not today's shop + `CROPS` (names, badges) or `BONUS_SEEDS` (settings)
- **Price check:** the "prices changed, the plan's off" notice goes. Prices come from the shop now, so there's nothing to be off from. A seed worth more or less than the highs and lows in data.js just goes to the debug log
- **Not touched:** Ratticus's free seeds (carrots, strawberries) aren't in the shop, they keep the numbers in data.js. The site keeps data.js too

## Later weeks

The route plans every week to Week 12, but only today's shop is known. A typical day: for each logged day, the best seed that day by water (perHour), and its buy and sell per water. Averaged over the logged days, that's one made-up crop with water 1 the route plans every later week with. A day with eggplant pulls it up, a day with only apples pulls it down, so it lands where my weeks actually would.

- a logged day with nothing in the shop (no apples either) is worth 0 a water, the plan shouldn't count on a day like that
- under 14 logged days (`MIN_SHOP_DAYS`, same as the wait odds): the best seed in the last stock seen instead
- it's an average, so a week planned with it can be off either way. The risk maths is where the spread goes (the highs and lows in data.js are the bounds)

## Order to build it

1. `seedsFrom` with apples in, the log keeping rows, known seeds (log, then data.js), tests. research/terra-api.md's `shop.stock` gets `itemId`, `cropValue`, `waterNeeded` and `dateKey`
2. bestMix with no apple special case, this week's route off today's stock
3. the typical day for later weeks: it goes where `weekCost`, `weekSales`, `applesFor` and `wMax` in farm.js use `CROPS.apple` now. predict.js's V_0 = apple becomes the typical day too, and the typed "apple seeds" box in settings just one more seed box
4. names, badges, settings boxes off known seeds, the price notice out, the "open Heidi's shop once" step
5. README, the "Weeks after this one" line in new-seeds.md points here
