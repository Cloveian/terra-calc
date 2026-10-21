import { test } from "node:test";
import assert from "node:assert/strict";
import { linesFor } from "../userscript/panel.js";
import { stuckFrom } from "../userscript/fill.js";

const NOW = Date.parse("2026-10-20T04:00:00Z");
// apples planted last week unless told otherwise
const crops = (stage, n, { review = null, name = "Apple", seed = "apple_seed", week = "2026-W42" } = {}) =>
    Array.from({ length: n }, () => ({ seed, name, stage, review, week }));

test("before the farm's been seen", () => {
    const plan = { t: 3, inventory: { coins: 0, plots: null, unplaced: 0, seeds: 1, baseSeeds: 10, baseKinds: { strawberry: 10 } }, m: 1.1, mGuessed: true, loans: 0, farm: null, stuck: null, steps: [] };
    assert.deepEqual(linesFor(plan, NOW), [
        "Week 1",
        "0 coins, 1 apple seed, 10 strawberry seeds",
        "plots: go to your farm or open Heidi's shop",
        "multiplier 1.1, a guess till a review comes back",
    ]);
});

test("the 19 Oct farm, everything stuck on last week's review", () => {
    const farm = {
        plots: 36,
        empty: 0,
        crops: [...crops("review", 26, { review: "review" }), ...crops("review", 10, { review: "review", name: "Carrot", seed: "carrot_seed" })],
        seenAt: NOW - 3 * 3600000,
    };
    const plan = { t: 3, inventory: { coins: 42.6, plots: 36, unplaced: 0, seeds: 0, baseSeeds: 10, baseKinds: { strawberry: 10 } }, m: 1.2, loans: 0, farm, stuck: stuckFrom(farm, "2026-W43"), steps: [] };
    assert.deepEqual(linesFor(plan, NOW), [
        "Week 1",
        "42 coins, 0 apple seeds, 10 strawberry seeds",
        "36 plots",
        "multiplier 1.2",
        "36 waiting on last week's review (26 apple, 10 carrot)",
        "(farm as of 3 h ago)",
    ]);
});

test("20 Oct, Ratticus lent a plot per stuck crop and there's 2 bought ones in the bag too", () => {
    const farm = { plots: 36, empty: 0, crops: crops("review", 36, { review: "review" }), seenAt: NOW };
    const plan = { t: 3, inventory: { coins: 0, plots: 38, unplaced: 38, seeds: 0, baseSeeds: 10, baseKinds: { strawberry: 10 } }, m: 1.1, mGuessed: true, loans: 36, farm, stuck: stuckFrom(farm, "2026-W43"), steps: [] };
    const lines = linesFor(plan, NOW);
    assert.ok(lines.includes("36 loan plots to place, Ratticus takes them back when you harvest the stuck crops"));
    assert.ok(lines.includes("2 plots in your bag to place"));
});

test("this week's target and the steps go last", () => {
    const farm = { plots: 36, empty: 0, crops: crops("review", 36, { review: "review" }), seenAt: NOW };
    const steps = [{ do: "place", n: 10 }, { do: "plantBase", n: 10 }, { do: "code", n: 7.5 }, { do: "ship", n: 10 }];
    const plan = {
        t: 3, inventory: { coins: 0, plots: 36, unplaced: 36, seeds: 0, baseSeeds: 10, baseKinds: { strawberry: 10 } }, m: 1.1, mGuessed: true, loans: 36,
        farm, stuck: stuckFrom(farm, "2026-W43"), target: { w: 10, cap: 10, reachable: null, out: false }, steps,
    };
    assert.deepEqual(linesFor(plan, NOW).slice(-6), [
        "this week: 10 crops (rent, no goal yet)",
        "next:",
        "place 10 plots",
        "plant 10 strawberry seeds",
        "code 7.5 h",
        "ship this week's project so the 10 grow",
    ]);
});

test("a mixed farm", () => {
    const farm = {
        plots: 12,
        empty: 2,
        crops: [
            ...crops("ready", 2), ...crops("ready", 1, { name: "Carrot" }), ...crops("dry", 1), ...crops("watered", 2),
            ...crops("review", 2, { review: "changes" }), ...crops("review", 2, { review: "review", week: "2026-W43" }),
        ],
        seenAt: NOW - 5 * 60000,
    };
    const plan = { t: 1, inventory: { coins: 1, plots: 12, unplaced: 0, seeds: 2, baseSeeds: 0, baseKinds: {} }, m: 1 / 0.9, loans: 0, farm, stuck: stuckFrom(farm, "2026-W43"), steps: [] };
    assert.deepEqual(linesFor(plan, NOW), [
        "Prep 2",
        "1 coin, 2 apple seeds, 0 carrot seeds",
        "12 plots",
        "multiplier 1.11",
        "2 empty plots",
        "3 ready to harvest (2 apple, 1 carrot)",
        "1 need water (apple)",
        "2 watered, ship this week's project for them to grow (apple)",
        "2 waiting on you, a reviewer asked for changes, reship last week's project (apple)",
        "2 waiting on this week's review (apple)",
        "(farm as of 5 min ago)",
    ]);
});

test("a review reason it doesn't know still shows", () => {
    const farm = { plots: 1, empty: 0, crops: crops("review", 1, { review: "frozen" }), seenAt: NOW };
    const plan = { t: 3, inventory: { coins: 0, plots: 1, unplaced: 0, seeds: 0, baseSeeds: 0, baseKinds: {} }, m: 1.1, mGuessed: true, loans: 0, farm, stuck: stuckFrom(farm, null), steps: [] };
    assert.ok(linesFor(plan, NOW).includes("1 stuck (frozen) (apple)"));
    assert.ok(linesFor(plan, NOW).includes("(farm as of just now)"));
});

test("a crop with no name goes by its seed id", () => {
    const farm = { plots: 1, empty: 0, crops: crops("dry", 1, { name: "", seed: "mystery_seed" }), seenAt: NOW };
    const plan = { t: 3, inventory: { coins: 0, plots: 1, unplaced: 0, seeds: 0, baseSeeds: 0, baseKinds: {} }, m: 1.1, mGuessed: true, loans: 0, farm, stuck: stuckFrom(farm, null), steps: [] };
    assert.ok(linesFor(plan, NOW).includes("1 need water (mystery_seed)"));
});

test("free seeds go by name, both kinds when prep carrots are still good", () => {
    const plan = { t: 3, inventory: { coins: 0, plots: 10, unplaced: 0, seeds: 0, baseSeeds: 16, baseKinds: { carrot: 6, strawberry: 10 } }, m: 1.1, mGuessed: true, loans: 0, farm: null, stuck: null, steps: [] };
    assert.equal(linesFor(plan, NOW)[1], "0 coins, 0 apple seeds, 6 carrot seeds, 10 strawberry seeds");
});
