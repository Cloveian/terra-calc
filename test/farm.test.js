import { test } from "node:test";
import assert from "node:assert/strict";
import { plotCost, weekCost, wMax, weekSales, simulateWeek } from "../src/farm.js";

test("plotCost", () => {
    assert.equal(plotCost(11, 10), 1);
    assert.equal(plotCost(21, 19), 20); // price capped at 10
    assert.equal(plotCost(45, 10), 305);
    assert.equal(plotCost(10, 13), 0); // already own more than needed
});

test("weekCost", () => {
    assert.equal(weekCost(11, 10, 0), 6);
    assert.equal(weekCost(13, 10, 0), 21);
    assert.equal(weekCost(13, 12, 0), 18);
    assert.equal(weekCost(13, 15, 0), 15);
});

test("wMax", () => {
    assert.equal(wMax(10, 10, 0), 11);
    assert.equal(wMax(4, 13, 3), 13); // current Prep 2 state
    assert.equal(wMax(344, 13, 0), 36);
    assert.equal(wMax(0, 10, 2), 10); // seeds can't buy plots
});

test("weekSales", () => {
    assert.equal(weekSales(13, 1, true), 340); // 10 carrots × 25 + 3 apples × 30
    assert.equal(weekSales(45, 1, false), 1250); // 10 rent × 20 + 35 apples × 30
    assert.equal(weekSales(45, 1.5, false), 1875);
    assert.equal(weekSales(5, 1, true), 125); // prep, only 5 carrots grown
});

test("simulateWeek", () => {
    // Prep 2 state → Prep 3 (344 coins, matches the route tests)
    assert.deepEqual(simulateWeek({ coins: 4, plots: 13, seeds: 3 }, 13, 1, true), { coins: 344, plots: 13, seeds: 0 });
    // main week under 10 h is out
    assert.equal(simulateWeek({ coins: 0, plots: 10, seeds: 0 }, 9, 1, false), null);
    // prep week with 0 h is fine
    assert.deepEqual(simulateWeek({ coins: 25, plots: 10, seeds: 0 }, 0, 1, true), { coins: 25, plots: 10, seeds: 0 });
});
