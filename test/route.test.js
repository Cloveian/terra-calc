import { test } from "node:test";
import assert from "node:assert/strict";
import { simulateRoute, hoursNeeded, milestones } from "../src/route.js";

const PREP2 = { coins: 4, plots: 13, seeds: 3 }; // at t = 1

test("simulateRoute from Prep 3 at 45 h ends at 11685", () => {
    const route = simulateRoute({ coins: 344, plots: 13, seeds: 0 }, 2, 45, 1);
    assert.equal(route.length, 13); // Prep 3 + 12 main weeks
    assert.equal(route[0].wMax, 36);
    assert.equal(route.at(-1).endCoins, 11685);
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
    assert.equal(hoursNeeded(PREP2, 1, 3050, 1).cap, 17); // Framework 13
    assert.equal(hoursNeeded(PREP2, 1, 10700, 1).cap, 42); // Max 12
    assert.equal(hoursNeeded(PREP2, 1, 13850, 1), null); // Max 13: the best at 45 h is 11685
    assert.equal(hoursNeeded(PREP2, 1, 13850, 1.5).cap, 35);
});

test("hoursNeeded matches the tables in the notes", () => {
    // device-trees.md: Galaxy 4400 and iPad 7350 at m = 0.8 … 1.5
    const ms = [0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5];
    // (rent pays 20 × m a week in total, dev, 10 Oct)
    const galaxy = [26, 24, 22, 20, 19, 18, 17, 17];
    const ipad = [39, 34, 31, 29, 27, 25, 24, 22];
    const max12 = [null, null, 42, 38, 35, 33, 31, 29];
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

test("simulateRoute with an empty thisWeek is the old route", () => {
    // no bonus seeds -> bestMix only has apples, takes min(cap - 10, wMax - 10) of them, same as w = min(cap, wMax)
    const empty = { seeds: [], onHand: {} };
    const strip = (route) => route.map(({ mix, ...row }) => row);
    // m 1.1 too, that's where m * a + m * b comes out a last digit off
    for (const m of [1, 1.1]) {
        for (const [state, t] of [[PREP2, 1], [{ coins: 300, plots: 20, seeds: 0 }, 5]]) {
            for (let cap = 10; cap <= 45; cap++) {
                const route = simulateRoute(state, t, cap, m, empty);
                assert.ok(route[0].mix, `mix on the first row, cap ${cap}`);
                assert.ok(route.slice(1).every((row) => !("mix" in row)), `mix only on the first row, cap ${cap}`);
                assert.deepEqual(strip(route), simulateRoute(state, t, cap, m), `m ${m} t ${t} cap ${cap}`);
            }
        }
    }
});

test("simulateRoute first week with eggplants", () => {
    // main week (t = 5), 300 coins, 20 plots, cap 30 -> k = 20, plots up to 20 crops are free.
    // apples only: wMax(300, 20, 0) = 36, so 30 h, 20 apples (100) + 10 plots (10 each, 100) = 200
    // spent, sold 20 + 20 * 30 = 620.
    // with eggplants: 2e + a <= 20, crops 10 + e + a, plots past 20 cost 10 each.
    // e = 10, a = 0: 20 crops, no plots, cost 150, value 750 - 150 = 600 (apples: 600 - 200 = 400)
    const route = simulateRoute({ coins: 300, plots: 20, seeds: 0 }, 5, 30, 1, { seeds: ["eggplant"], onHand: {} });
    const row = route[0];
    assert.deepEqual(row.mix, { eggplant: 10 });
    assert.equal(row.wMax, 36);
    assert.equal(row.hours, 30); // 10 + 2 * 10
    assert.equal(row.newPlots, 0);
    assert.equal(row.spent, 150);
    assert.equal(row.sold, 770); // rent 20 + 750
    assert.equal(row.endCoins, 920); // 300 - 150 + 770
    // week after is apples only again, from 920 coins and still 20 plots
    assert.equal(route[1].startCoins, 920);
    assert.equal(route[1].plots, 20);
    assert.ok(!("mix" in route[1]));
});

test("hoursNeeded with eggplants in the shop is never worse", () => {
    assert.equal(hoursNeeded(PREP2, 1, 3050, 1).cap, 17); // apples only
    // 4 coins can't buy an eggplant (15) or a 4th apple (5), so week one is the same 3 free apples
    // and it's still 17
    const result = hoursNeeded(PREP2, 1, 3050, 1, 10, { seeds: ["eggplant"], onHand: {} });
    assert.equal(result.cap, 17);
    assert.deepEqual(result.route[0].mix, { apple: 3 });
});

test("milestones", () => {
    const route = simulateRoute(PREP2, 1, 35, 1); // ends at 8760
    const items = [
        { id: "a", cost: 3 },     // 4 coins now: already affordable
        { id: "b", cost: 1000 },  // total 1003: Prep 3 (t = 2) ends at 1020
        { id: "c", cost: 7700 },  // total 8703: only Week 12 (t = 14) ends above it, at 8760 (Week 11: 8115)
        { id: "d", cost: 5000 },  // total 13703: never
    ];
    const result = milestones(route, items);
    assert.deepEqual(result.map((m) => [m.total, m.now, m.week]), [
        [3, true, null],
        [1003, false, 2],
        [8703, false, 14],
        [13703, false, null],
    ]);
});
