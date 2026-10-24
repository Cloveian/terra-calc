<p align="center">
    <img src="assets/terra-calc-logo-wide.svg" alt="Terra Calc" width="520">
</p>

<p align="center"><b>How many hours a week do you need to code in Terra to afford your upgrades?</b></p>

<p align="center"><a href="https://cloveian.github.io/terra-calc/">cloveian.github.io/terra-calc</a></p>

---

[Terra](https://terra.hackclub.com) is a Hack Club event: you code, your coding hours become water, water grows crops, and crops sell for coins that buy upgrades for your laptop or tablet. Terra Calc takes what you have now and the upgrades you want, and tells you how many hours a week you need from now until Week 12.

## Using it

1. **Inventory**: your coins, dirt plots, apple seeds, any bok choy and eggplant seeds you have and today's date, then tick which bonus seeds are in Heidi's shop today.
2. **Settings**: your project review multiplier (0.8-1.5, use 1 if you don't know yet).
3. **Goal**: pick your device, then tick the upgrades you want in the tree (or press a quick pick like "Max 12"). Tick **own** for anything you've already bought.
4. **Your plan** shows:
   - the hours a week you need, and from which week
   - when you can afford each pick (use the arrows to buy something sooner or later)
   - a week-by-week table: plots, hours, coins spent and sold. Type the hours you can give into any week (finals week, a trip), and the weeks you leave blank make up the rest

Everything you type is saved in the page's link, so you can bookmark it or send it to someone.

## Inside Terra (userscript)

There's also a userscript that runs inside Terra itself, so there's nothing to type in:

- reads your coins, seeds, plots, farm, upgrades and the week straight from the game
- puts this week's steps in Terra's own "This Week" card ("buy 12 eggplant seeds", "code 21.9h"), and ticks them off as you do them
- a want button on each upgrade in Terra's device tree, and a priority number and the week you can afford it on the ones you want
- coins-an-hour badges on Heidi's seeds, with how many the plan buys (off until you turn them on)
- Island / Hub and Goal buttons at the bottom of Terra's button column (Hub doesn't really work yet, the server sends you back home)
- a Terra Calc section in Terra's settings, to turn each part on or off, set your own multiplier, or type your numbers in yourself if reading the game ever breaks

It's a work in progress and Terra changes a lot, so expect a broken bit now and then.

There's no install link yet. To try it, build it and install the file with a userscript manager like [Violentmonkey](https://violentmonkey.github.io) or Tampermonkey:

```sh
npm run build:userscript
# writes dist/terra-calc.user.js, drag it into the browser to install (or add it from the manager's dashboard)
```

## How the maths works

Each week: 1 hour of coding = 1 water, and 1 water + 1 seed + 1 dirt plot = 1 crop (an eggplant takes 2 water).

- The first 10 crops a week are free (carrots in the prep weeks, strawberries after). In the main weeks they're rent for Ratticus, and the week's rent pays 20 coins \* multiplier.
- Every hour past 10 needs a bought seed (apples: 5 coins, sell for 30 \* multiplier) and a plot. Plots cost `min(plots - 9, 10)` each, up to 45.
- Coins from one week pay for the next week's seeds and plots, so the calculator simulates every week to Week 12 and finds the lowest steady hours a week that reaches your goal.

The full rules, where each one comes from (the game's code, the FAQ, or a Terra dev), and the formulas are in [research/how-terra-works.md](research/how-terra-works.md). What upgrades are worth in real money is in [research/real-prices.md](research/real-prices.md).

Prices are a snapshot. Bonus seeds (bok choy and eggplant so far) are only in Heidi's shop on some days, so the plan uses them in the first week and apples after that.

## Running it locally

The site is plain HTML, CSS and JavaScript (ES modules) with no build step and no dependencies.

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Tests use Node's built-in test runner (Node 20+):

```sh
npm test
```

## Layout

```
index.html        the page
style.css         the look (Pico CSS + hand-drawn outlines)
src/
  data.js         upgrade trees, prices, schedule (just data)
  week.js         date -> Terra week
  farm.js         one week: plot cost, hours you can use, the seed mix, coins in and out
  route.js        every week to Week 12, hours needed, when you can afford each pick
  tree.js         picking upgrades: prerequisites, goal cost
  state.js        reading and writing the link
  view.js         zoom and pan maths for the tree
  treeview.js     dragging and zooming the tree
  sketch.js       the maths for the wobbly hand-drawn outlines
  outline.js      draws those outlines on the page
  columns.js      the column divider on wide screens
  ui.js           everything else on the page
userscript/       Terra Calc inside Terra, uses the src/ files that don't touch the page
  main.js         where it all gets wired up
  socket.js       reads the game's websocket
  msgpack.js      decodes its messages
  schema.js       decodes the room state (your farm)
  api.js          Terra's REST calls
  endpoints.js    every URL and message name, and what each response should look like
  fill.js         game messages -> the numbers the plan needs
  next.js         this week's steps
  goal.js         your goal, checked against Terra's live upgrade trees
  card.js         the steps in Terra's This Week card
  want.js         want buttons and priorities on Terra's device tree
  shop.js         the badges in Heidi's shop
  hud.js          the Island / Hub and Goal buttons
  calendar.js     the hours boxes on Terra's calendar
  settings.js     the Terra Calc section in Terra's settings
  page.js         Terra's class names, and redrawing our bits when the page changes
  store.js        saving to Terra's localStorage
  daylog.js       a small log per day: Heidi's bonus seeds, and your hours so far that week
  predict.js      a typical day from that log, and the odds behind waiting for a better seed
  debug.js        console logging
  meta.js         the userscript header
scripts/
  build-userscript.js   bundles userscript/ into dist/terra-calc.user.js
test/             tests for everything except the site's page files (ui.js, outline.js, treeview.js, columns.js) and the userscript's main.js, api.js, hud.js, store.js and debug.js
research/         how Terra works, prices, the maths
docs/             design notes and the build plan
assets/           logos and hand-drawn icons
```

## Credits

- Icons and logos hand-drawn by Cloveian. The icons are traced over [Lucide](https://lucide.dev) (ISC) and [Pico CSS](https://picocss.com) (MIT) icons, see [assets/icons/README.md](assets/icons/README.md).
- [Pico CSS](https://picocss.com) for the base styles, [Patrick Hand](https://fonts.google.com/specimen/Patrick+Hand) for the font.
- Thanks to Miggy for answering questions about the rules.

## AI use

- **Me:** the research into how Terra works, the design docs and spec, the stupid amount of ~~meth~~ math (@_@), all the art (logos and icons), reviewing the code and testing it.
- **Claude (Claude Code):** wrote most of the code from those docs, and helped with some of the research and a little with the docs. [research/real-prices.md](research/real-prices.md) was researched by Claude.

## License

[MIT](LICENSE). The icons traced over Lucide also keep Lucide's ISC licence ([assets/icons/LICENSE-lucide](assets/icons/LICENSE-lucide)).

Not made by the Terra team. Terra is a [Hack Club](https://hackclub.com) event.
