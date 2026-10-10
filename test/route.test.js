import { test } from "node:test";
import assert from "node:assert/strict";
import { simulateRoute, hoursNeeded, milestones } from "../src/route.js";

const PREP2 = { coins: 4, plots: 13, seeds: 3 }; // at t = 1

test("simulateRoute from Prep 3 at 45 h ends at 13845", () => {
    const route = simulateRoute({ coins: 344, plots: 13, seeds: 0 }, 2, 45, 1);
    assert.equal(route.length, 13); // Prep 3 + 12 main weeks
    assert.equal(route[0].wMax, 36);
    assert.equal(route.at(-1).endCoins, 13845);
});

test("simulateRoute rows chain together", () => {
    const route = simulateRoute(PREP2, 1, 45, 1);
    for (let i = 1; i < route.length; i++) {
        assert.equal(route[i].startCoins, route[i - 1].endCoins);
        assert.equal(route[i].week, route[i - 1].week + 1);
    }
    for (const row of route) {
        assert.equal(row.endCoins, row.startCoins - row.spent + row.sold);
        assert.ok(row.hours <= row.wMax);
    }
});

test("simulateRoute before Terra starts at Prep 1, after Terra is empty", () => {
    assert.equal(simulateRoute(PREP2, -2, 10, 1)[0].week, 0);
    assert.deepEqual(simulateRoute(PREP2, 15, 10, 1), []);
});

test("simulateRoute stops when a main week is under 10 h", () => {
    const route = simulateRoute({ coins: 0, plots: 10, seeds: 0 }, 3, 5, 1);
    assert.equal(route.length, 1);
    assert.equal(route[0].out, true);
});

test("hoursNeeded from Prep 2", () => {
    assert.equal(hoursNeeded(PREP2, 1, 3050, 1).cap, 11); // Framework 13
    assert.equal(hoursNeeded(PREP2, 1, 10700, 1).cap, 35); // Max 12
    assert.equal(hoursNeeded(PREP2, 1, 13850, 1), null); // Max 13, 5 coins short at 45 h
    assert.equal(hoursNeeded(PREP2, 1, 13850, 1.5).cap, 29);
});

test("hoursNeeded matches the tables in the notes", () => {
    // device-trees.md: Galaxy 4400 and iPad 7350 at m = 0.8 … 1.5
    const ms = [0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5];
    const galaxy = [19, 17, 15, 14, 13, 12, 11, 11];
    const ipad = [31, 27, 24, 22, 20, 18, 17, 16];
    const max12 = [null, 40, 35, 31, 28, 26, 24, 23];
    ms.forEach((m, i) => {
        assert.equal(hoursNeeded(PREP2, 1, 4400, m)?.cap ?? null, galaxy[i], `galaxy m=${m}`);
        assert.equal(hoursNeeded(PREP2, 1, 7350, m)?.cap ?? null, ipad[i], `ipad m=${m}`);
        assert.equal(hoursNeeded(PREP2, 1, 10700, m)?.cap ?? null, max12[i], `max 12 m=${m}`);
    });
});

test("hoursNeeded totalHours adds up the route", () => {
    const result = hoursNeeded(PREP2, 1, 3050, 1);
    assert.equal(result.totalHours, result.route.reduce((sum, row) => sum + row.hours, 0));
});

test("milestones", () => {
    const route = simulateRoute(PREP2, 1, 35, 1); // Max 12 route, ends at 10920
    const items = [
        { id: "a", cost: 3 },     // 4 coins now: already affordable
        { id: "b", cost: 1000 },  // total 1003: Prep 3 (t = 2) ends at 1020
        { id: "c", cost: 9900 },  // total 10903: only Week 12 (t = 14) ends above it, at 10920
        { id: "d", cost: 5000 },  // total 15903: never
    ];
    const result = milestones(route, items);
    assert.deepEqual(result.map((m) => [m.total, m.now, m.week]), [
        [3, true, null],
        [1003, false, 2],
        [10903, false, 14],
        [15903, false, null],
    ]);
});
