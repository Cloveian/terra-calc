<p align="center">
    <img src="assets/terra-calc-logo-wide.svg" alt="Terra Calc" width="520">
</p>

<p align="center"><b>How many hours a week do you need to code in Terra to afford your upgrades?</b></p>

<p align="center"><a href="https://cloveian.github.io/terra-calc/">cloveian.github.io/terra-calc</a></p>

---

[Terra](https://terra.hackclub.com) is a Hack Club event: you code, your coding hours become water, water grows crops, and crops sell for coins that buy upgrades for your laptop or tablet. Terra Calc takes what you have now and the upgrades you want, and tells you how many hours a week you need from now until Week 12.

## Using it

1. **Inventory**: your coins, dirt plots, apple seeds, any bok choy and eggplant seeds you have and today's date, then tick which bonus seeds are in Heidi's shop today.
2. **Settings**: your project review multiplier (0.8–1.5, use 1 if you don't know yet).
3. **Goal**: pick your device, then tick the upgrades you want in the tree (or press a quick pick like "Max 12"). Tick **own** for anything you've already bought.
4. **Your plan** shows:
   - the hours a week you need, and from which week
   - when you can afford each pick (use the arrows to buy something sooner or later)
   - a week-by-week table: plots, hours, coins spent and sold

Everything you type is saved in the page's link, so you can bookmark it or send it to someone.

## How the maths works

Each week: 1 hour of coding = 1 water, and 1 water + 1 seed + 1 dirt plot = 1 crop.

- The first 10 crops a week are the free carrots. In the main weeks they're rent for Ratticus, and the week's rent pays 20 coins × multiplier.
- Every hour past 10 needs a bought seed (apples: 5 coins, sell for 30 × multiplier) and a plot. Plots cost `min(plots − 9, 10)` each, up to 45.
- Coins from one week pay for the next week's seeds and plots, so the calculator simulates every week to Week 12 and finds the lowest steady hours a week that reaches your goal.

The full rules, where each one comes from (the game's code, the FAQ, or a Terra dev), and the formulas are in [research/how-terra-works.md](research/how-terra-works.md). What upgrades are worth in real money is in [research/real-prices.md](research/real-prices.md).

Prices are a snapshot, and new seeds are on the way. The calculator only knows about carrots and apples for now.

## Running it locally

It's plain HTML, CSS and JavaScript (ES modules) with no build step and no dependencies.

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
  week.js         date → Terra week
  farm.js         one week: plot cost, hours you can use, coins in and out
  route.js        every week to Week 12, hours needed, when you can afford each pick
  tree.js         picking upgrades: prerequisites, goal cost
  state.js        reading and writing the link
  view.js         zoom and pan maths for the tree
  sketch.js       the maths for the wobbly hand-drawn outlines
  outline.js      draws those outlines on the page
  ui.js           everything else on the page
test/             tests for everything except ui.js and outline.js
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
