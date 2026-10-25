<p align="center">
    <img src="assets/terra-calc-logo-wide.svg" alt="Terra Calc" width="520">
</p>

<p align="center"><b>How many hours a week do you need to code in Terra to afford your upgrades?</b></p>

<p align="center"><a href="https://cloveian.github.io/terra-calc/dist/terra-calc.user.js"><b>Install the userscript</b></a></p>

---

[Terra](https://terra.hackclub.com) is a Hack Club event: you code, your coding hours become water, water grows crops, and crops sell for coins that buy upgrades for your laptop or tablet. Terra Calc runs inside Terra itself. It reads your coins, seeds, plots, farm and upgrades straight from the game, works out how many hours a week you need to get the upgrades you want by Week 12, and turns that into this week's checklist.

## Install

1. Get a userscript manager: [Violentmonkey](https://violentmonkey.github.io) or [Tampermonkey](https://www.tampermonkey.net).
2. Open [terra-calc.user.js](https://cloveian.github.io/terra-calc/dist/terra-calc.user.js) and press install.
3. Open (or reload) [Terra](https://terra.hackclub.com).

The script auto updates, so you will probably always have the latest version.

## Using it

1. Open the device tree (the **Goal** button under Terra's own buttons) and press **want** on the upgrades you're after. The number box next to want is a priority, 1 is what you care about most.
2. Terra's **This Week** card turns into your checklist: buy seeds and plots, plant, code, ship. Steps tick off as you do them.
3. Visit your island once a day so it can see your farm, and open Heidi's shop so it knows what seeds she has today.
4. Optional: on Terra's calendar, type how many hours you can give on a day, and the plan works around it.

The **(?)** in the bottom right of the card opens a help book with all of this and an FAQ.

## What it does

**The This Week card**
- this week's steps in order ("buy 12 eggplant seeds", "code 21.9h"), nested under what they wait on and ticked off as you go
- seeds wait for the wiggle day (the Monday after the week, when you can still buy, plant and use last week's water), except the best one Heidi ever has, like eggplant. On the wiggle day it says what to buy with the water you have left, and only suggests something like cabbage if it's all there is
- where your goal stands, when each pick lands, and what your usual week gets you by Week 12
- whether the seeds you'd buy actually get watered in enough of your past weeks to be worth their price (once it's seen three of your weeks)
- when waiting for a better seed in Heidi's shop beats today's
- where your goal lands if Heidi only had her worst or best seed from now on
- a little (i) on lines with maths in them: hover it for the formula, then the same with your numbers in it. The TeX is drawn by [Temml](https://temml.org), loaded from jsdelivr the first time you hover one
- a red line when something Terra sends looks different, so you know when a number might be off

**Around Terra**
- a want button on each upgrade in the device tree, with a priority number and the week you can afford it
- an hour box on each day left on Terra's calendar, what you usually code that weekday under it, and what you coded on days already gone
- coins-an-hour badges on Heidi's seeds, with how many the plan buys (off until you turn them on in settings)
- Island / Hub and Goal buttons at the bottom of Terra's button column, or next to the water meter on short screens
- a Terra Calc section in Terra's settings, to turn each part on or off, set your own multiplier, or type your numbers in yourself if reading the game ever breaks

**Hackatime (optional)**
- add your Hackatime key in settings (it's the `api_key` line in your `.wakatime.cfg`) and Terra Calc knows how your weeks usually go right away, instead of after a few weeks of its own notes
- it scales Hackatime's hours down to what Terra actually credited, so AI time counts a third like in Terra
- the key stays in your browser and only ever goes to Hackatime

It's a work in progress and Terra changes a lot, so expect a broken bit now and then.

## How the maths works

Each week: 1 hour of coding = 1 water, and 1 water + 1 seed + 1 dirt plot = 1 crop (an eggplant takes 2 water).

- The first 10 crops a week are free (carrots in the prep weeks, strawberries after). In the main weeks they're rent for Ratticus, and the week's rent pays 20 coins \* multiplier.
- Every hour past 10 needs a bought seed (apples: 5 coins, sell for 30 \* multiplier) and a plot. Plots cost `min(plots - 9, 10)` each, up to 45.
- Coins from one week pay for the next week's seeds and plots, so Terra Calc simulates every week to Week 12 and finds the lowest steady hours a week that reaches your goal.

The full rules, where each one comes from (the game's code, the FAQ, or a Terra dev), and the formulas are in [research/how-terra-works.md](research/how-terra-works.md). What upgrades are worth in real money is in [research/real-prices.md](research/real-prices.md).

Terra Calc plans this week with whatever Heidi actually has, and the weeks after with a typical day in her shop, off what it's seen there so far.

## Building it yourself

No dependencies. The userscript is bundled from `userscript/` and the shared maths in `src/`:

```sh
npm run build:userscript
# writes dist/terra-calc.user.js, drag it into the browser to install (or add it from the manager's dashboard)
```

Tests use Node's built-in test runner (Node 20+):

```sh
npm test
```

## The old website

[cloveian.github.io/terra-calc](https://cloveian.github.io/terra-calc/) is where Terra Calc started: you type in your coins, plots and seeds, pick upgrades in a tree, and it plans your hours. It's no longer accurate, and probably never will be, because Terra keeps changing its seeds ┻━┻︵ \\(°□°)/ ︵ ┻━┻, prices and rules. It's still up, but use the userscript. To run it locally it's plain HTML, CSS and JavaScript:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Layout

```
index.html        the old website
style.css         its look (Pico CSS + hand-drawn outlines)
src/              the maths, shared by the site and the userscript, plus the site's page files
  data.js         upgrade trees, prices, schedule (just data)
  week.js         date -> Terra week
  farm.js         one week: plot cost, hours you can use, the seed mix, coins in and out
  route.js        every week to Week 12, hours needed, when you can afford each pick
  tree.js         picking upgrades: prerequisites, goal cost
  state.js        reading and writing the link
  stepper.js      the up / down arrows on number boxes
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
  help.js         the how-to book behind the card's ?, on the Terra Tome's look
  tip.js          the maths behind a number when you hover it
  want.js         want buttons and priorities on Terra's device tree
  shop.js         the badges in Heidi's shop
  hud.js          the Island / Hub and Goal buttons
  travel.js       the spawn tag the Hub button's trip needs
  fetch.js        the game's own fetch calls: that spawn tag, and seeing your upgrade buys
  calendar.js     the hours boxes on Terra's calendar
  settings.js     the Terra Calc section in Terra's settings
  page.js         Terra's class names, and redrawing our bits when the page changes
  store.js        saving to Terra's localStorage
  daylog.js       a small log per day: Heidi's bonus seeds, and your hours so far that week
  predict.js      how your week usually goes, the odds behind waiting for a better seed, and Heidi's worst and best seeds
  risk.js         whether the seeds you'd buy get watered often enough to be worth it
  hackatime.js    your hours per day from Hackatime, if you give it a key
  debug.js        console logging
  meta.js         the userscript header
scripts/
  build-userscript.js   bundles userscript/ into dist/terra-calc.user.js
.github/workflows/pages.yml   tests, builds the userscript and puts it all on GitHub Pages on every push
test/             tests for everything except the site's page files (ui.js, outline.js, treeview.js, columns.js) and the userscript's main.js, api.js, hud.js, store.js and debug.js
research/         how Terra works, prices, the maths
docs/             design notes and the build plan
assets/           logos and hand-drawn icons
```

## Credits

- Icons and logos hand-drawn by Cloveian. The icons are traced over [Lucide](https://lucide.dev) (ISC) and [Pico CSS](https://picocss.com) (MIT) icons, see [assets/icons/README.md](assets/icons/README.md).
- [Pico CSS](https://picocss.com) for the base styles, [Patrick Hand](https://fonts.google.com/specimen/Patrick+Hand) for the font.
- Thanks to Miggy for answering questions about the rules.

## AI use (Prep week 1)

- **Me:** the research into how Terra works, the design docs and spec, the stupid amount of ~~meth~~ math (@_@), all the art (logos and icons), reviewing the code and testing it.
- **Claude (Claude Code):** wrote most of the code from those docs, and helped with some of the research and a little with the docs. [research/real-prices.md](research/real-prices.md) was researched by Claude.

## AI use (Week 1)
I used AI to dig through Terra's client JS and some HAR captures for facts.
Some code refactoring (just spliting a file into multiple cuz it was too long for my taste)
Some of the site updates when the first new plants were releaced (not really relavent anymore)
Helping me understand javascript (it'd dumb), like 'what fucion would work best in this situation'
Debugging
Updateing some of the comments when they were stale.
Quick fix on the recomendations

## License

[MIT](LICENSE). The icons traced over Lucide also keep Lucide's ISC licence ([assets/icons/LICENSE-lucide](assets/icons/LICENSE-lucide)).

Not made by the Terra team. Terra is a [Hack Club](https://hackclub.com) event.
