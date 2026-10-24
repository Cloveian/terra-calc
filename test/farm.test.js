import { test } from "node:test";
import assert from "node:assert/strict";
import { plotCost, weekCost, wMax, weekSales, baseSales, bestMix, mixWords } from "../src/farm.js";
import { CROPS } from "../src/data.js";

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
    assert.equal(weekSales(13, 1, true), 340); // 10 carrots * 25 + 3 apples * 30
    assert.equal(weekSales(45, 1, false), 1070); // 20 for the 10 rent crops + 35 apples * 30
    assert.equal(weekSales(45, 1.5, false), 1605);
    assert.equal(weekSales(5, 1, true), 125); // prep, only 5 carrots grown
});

test("baseSales", () => {
    assert.equal(baseSales(13, 1, true), 250); // 10 carrots * 25, the apples aren't in it
    assert.equal(baseSales(5, 1, true), 125); // 5 carrots * 25
    assert.equal(baseSales(45, 1.5, false), 30); // rent 20 * 1.5
});

// all the bestMix ones have 30 plots and k = 20, so up to 30 crops the plots are free
const AE = ["apple", "eggplant"];

test("bestMix with lots of coins takes eggplants", () => {
    // profit per crop: eggplant 75 - 15 = 60 for 2 water, apple 30 - 5 = 25 for 1.
    // 2e + a <= 20 so a = 20 - 2e, value 60e + 25(20 - 2e) = 500 + 10e, biggest e = 10:
    // 10 eggplants = 600, beats 20 apples = 500. cost 10 * 15 = 150, sales 10 * 75 = 750
    assert.deepEqual(bestMix(20, 10000, 30, {}, AE, 1), {
        counts: { eggplant: 10 }, crops: 20, water: 20, cost: 150, sales: 750,
    });
});

test("bestMix with a tight budget sticks to apples", () => {
    // 15e + 5a <= 100 is 3e + a <= 20, tighter than the water (2e + a <= 20).
    // a = 20 - 3e, value 60e + 25(20 - 3e) = 500 - 15e, so e = 0: 20 apples, cost 100, sales 600
    assert.deepEqual(bestMix(20, 100, 30, {}, AE, 1), {
        counts: { apple: 20 }, crops: 30, water: 20, cost: 100, sales: 600,
    });
});

test("bestMix plants the eggplants on hand first", () => {
    // 0 coins, 5 eggplants held: only the free ones, 5 * 75 = 375 (water 10, the rest unaffordable)
    assert.deepEqual(bestMix(20, 0, 30, { eggplant: 5 }, AE, 1), {
        counts: { eggplant: 5 }, crops: 15, water: 10, cost: 0, sales: 375,
    });
    // 50 coins: 5 free eggplants + 10 apples (50 coins, 10 water left) = 375 + 300 - 50 = 625.
    // a 6th eggplant: 15 + 5a <= 50 so a <= 7, 450 + 210 - 50 = 610. 4 eggplants: a <= 10, 300 + 300 - 50 = 550
    assert.deepEqual(bestMix(20, 50, 30, { eggplant: 5 }, AE, 1), {
        counts: { eggplant: 5, apple: 10 }, crops: 25, water: 20, cost: 50, sales: 675,
    });
});

test("bestMix bok choy vs apples", () => {
    const AB = ["apple", "bokchoy"];
    // both 1 water, bok choy 37 - 10 = 27 profit, apple 25. lots of coins: 20 bok choy,
    // cost 200, sales 740
    assert.deepEqual(bestMix(20, 1000, 30, {}, AB, 1), {
        counts: { bokchoy: 20 }, crops: 30, water: 20, cost: 200, sales: 740,
    });
    // 100 coins: 10b + 5a <= 100 so a = 20 - 2b, value 27b + 25(20 - 2b) = 500 - 23b, b = 0
    assert.deepEqual(bestMix(20, 100, 30, {}, AB, 1), {
        counts: { apple: 20 }, crops: 30, water: 20, cost: 100, sales: 600,
    });
    // 150 coins: b <= 10 the water binds, a = 20 - b, value 500 + 2b and cost 100 + 5b <= 150.
    // past 10 the coins bind, a = 30 - 2b, value 750 - 23b (497 at 11). so 10 + 10, cost 150,
    // sales 370 + 300 = 670
    assert.deepEqual(bestMix(20, 150, 30, {}, AB, 1), {
        counts: { bokchoy: 10, apple: 10 }, crops: 30, water: 20, cost: 150, sales: 670,
    });
});

test("bestMix takes the game's own seed table, for seeds data.js doesn't know yet", () => {
    // a made up 1 water seed worth 80 a crop, plenty of coins and plots: all 10 extra hours go to it
    const table = { ...CROPS, pumpkin: { buy: 20, sell: 100, water: 1 } };
    const mix = bestMix(10, 1000, 30, {}, ["apple", "pumpkin"], 1, table);
    assert.deepEqual(mix.counts, { pumpkin: 10 });
    assert.equal(mix.cost, 200);
});

test("bestMix with no apples: a cabbage only day fills with cabbage, an empty shop plants only what's on hand", () => {
    const table = { ...CROPS, cabbage: { buy: 2, sell: 20, water: 1 } };
    assert.deepEqual(bestMix(10, 1000, 30, {}, ["cabbage"], 1, table).counts, { cabbage: 10 });
    const empty = bestMix(10, 1000, 30, { eggplant: 2 }, [], 1, table);
    assert.deepEqual(empty.counts, { eggplant: 2 });
    assert.equal(empty.water, 4);
});

test("bestMix plants eggplants you've got even when the shop doesn't have them today, but can't buy more", () => {
    // 6 on hand, shop has apples only, k = 20, plenty of coins: 6 eggplants (12 water, free) + 8 apples
    const mix = bestMix(20, 1000, 30, { eggplant: 6 }, ["apple"], 1);
    assert.deepEqual(mix.counts, { eggplant: 6, apple: 8 });
    assert.equal(mix.cost, 40);
});

test("mixWords: biggest first, nothing for apples only", () => {
    assert.equal(mixWords({ apple: 14, eggplant: 10, bokchoy: 0 }), "14 apple + 10 eggplant");
    assert.equal(mixWords({ apple: 3, eggplant: 10 }), "10 eggplant + 3 apple");
    assert.equal(mixWords({ apple: 14 }), null);
    assert.equal(mixWords(undefined), null);
    // a seed from today's shop that CROPS doesn't know
    assert.equal(mixWords({ apple: 2, pumpkin: 4 }, (id) => ({ pumpkin: "Pumpkin" })[id] ?? id), "4 pumpkin + 2 apple");
});
