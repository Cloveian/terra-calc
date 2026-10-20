import { test } from "node:test";
import assert from "node:assert/strict";
import { linesFor } from "../userscript/panel.js";

const NOW = Date.parse("2026-10-20T04:00:00Z");
const crops = (stage, n, review = null) => Array.from({ length: n }, () => ({ seed: "apple_seed", stage, review, week: "2026-W42" }));

test("before the farm's been seen", () => {
    const plan = { t: 3, inventory: { coins: 0, plots: null, seeds: 1, baseSeeds: 10, baseKinds: { strawberry: 10 } }, m: null, farm: null, stuck: null };
    assert.deepEqual(linesFor(plan, NOW), [
        "Week 1",
        "0 coins, 1 apple seed, 10 strawberry seeds",
        "plots: go to your farm or open Heidi's shop",
        "multiplier: open the market with crops to sell",
    ]);
});

test("the 19 Oct farm, everything stuck on last week's review", () => {
    const farm = { plots: 36, empty: 0, crops: crops("review", 36, "review"), seenAt: NOW - 3 * 3600000 };
    const plan = { t: 3, inventory: { coins: 42.6, plots: 36, seeds: 0, baseSeeds: 10, baseKinds: { strawberry: 10 } }, m: 1.2, farm, stuck: { count: 36, why: { review: 36 } } };
    assert.deepEqual(linesFor(plan, NOW), [
        "Week 1",
        "42 coins, 0 apple seeds, 10 strawberry seeds",
        "36 plots",
        "multiplier 1.2",
        "36 waiting on last week's review",
        "(farm as of 3 h ago)",
    ]);
});

test("a mixed farm", () => {
    const farm = {
        plots: 12,
        empty: 2,
        crops: [...crops("ready", 3), ...crops("dry", 1), ...crops("watered", 2), ...crops("review", 2, "changes"), ...crops("review", 2, "review")],
        seenAt: NOW - 5 * 60000,
    };
    const plan = { t: 1, inventory: { coins: 1, plots: 12, seeds: 2, baseSeeds: 0, baseKinds: {} }, m: 1 / 0.9, farm, stuck: { count: 2, why: { changes: 2 } } };
    assert.deepEqual(linesFor(plan, NOW), [
        "Prep 2",
        "1 coin, 2 apple seeds, 0 carrot seeds",
        "12 plots",
        "multiplier 1.11",
        "2 empty plots",
        "3 ready to harvest",
        "1 need water",
        "2 watered, ship this week's project for them to grow",
        "2 waiting on you, a reviewer asked for changes, reship last week's project",
        "2 waiting on this week's review",
        "(farm as of 5 min ago)",
    ]);
});

test("a review reason it doesn't know still shows", () => {
    const farm = { plots: 1, empty: 0, crops: crops("review", 1, "frozen"), seenAt: NOW };
    const plan = { t: 3, inventory: { coins: 0, plots: 1, seeds: 0, baseSeeds: 0, baseKinds: {} }, m: null, farm, stuck: { count: 1, why: { frozen: 1 } } };
    assert.ok(linesFor(plan, NOW).includes("1 stuck (frozen)"));
    assert.ok(linesFor(plan, NOW).includes("(farm as of just now)"));
});

test("free seeds go by name, both kinds when prep carrots are still good", () => {
    const plan = { t: 3, inventory: { coins: 0, plots: 10, seeds: 0, baseSeeds: 16, baseKinds: { carrot: 6, strawberry: 10 } }, m: null, farm: null, stuck: null };
    assert.equal(linesFor(plan, NOW)[1], "0 coins, 0 apple seeds, 6 carrot seeds, 10 strawberry seeds");
});
