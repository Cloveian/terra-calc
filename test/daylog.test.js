import { test } from "node:test";
import assert from "node:assert/strict";
import { logShop, logHours, codedBefore, knownSeeds, idsOn, KEEP_DAYS } from "../userscript/daylog.js";

test("codedBefore: the week's hours as of the latest day before today", () => {
    const h = 3600;
    const log = {
        "2026-10-18": { weekKey: "2026-W42", seconds: 40 * h },
        "2026-10-21": { weekKey: "2026-W43", seconds: 5 * h },
        "2026-10-22": { weekKey: "2026-W43", seconds: 8 * h },
        "2026-10-23": { weekKey: "2026-W43", seconds: 9 * h },
    };
    assert.equal(codedBefore(log, "2026-10-23", "2026-W43"), 8);
    assert.equal(codedBefore(log, "2026-10-19", "2026-W43"), 0); // monday, nothing yet
});

test("logShop keeps the day's seed rows by id, an empty day too", () => {
    const cabbage = { id: "cabbage", name: "Cabbage", buy: 2, sell: 20, water: 1 };
    const apple = { id: "apple", name: "Apple", buy: 5, sell: 30, water: 1 };
    let log = logShop({}, "2026-10-23", [cabbage, apple]);
    log = logShop(log, "2026-10-24", []);
    assert.deepEqual(log, { "2026-10-23": [apple, cabbage], "2026-10-24": [] });
    assert.equal(logShop(log, null, []), log); // no dateKey, nothing to say
});

test("knownSeeds: newest numbers win, old id-only days have none", () => {
    const log = {
        "2026-10-22": ["apple", "eggplant"],
        "2026-10-23": [{ id: "cabbage", name: "Cabbage", buy: 3, sell: 20, water: 1 }],
        "2026-10-24": [{ id: "cabbage", name: "Cabbage", buy: 2, sell: 20, water: 1 }],
    };
    assert.deepEqual(knownSeeds(log), { cabbage: { name: "Cabbage", buy: 2, sell: 20, water: 1 } });
    assert.deepEqual(idsOn(log["2026-10-22"]), ["apple", "eggplant"]);
    assert.deepEqual(idsOn(log["2026-10-24"]), ["cabbage"]);
});

test("logHours keeps the last snapshot of each day", () => {
    let log = logHours({}, "2026-10-23", "2026-W43", 3600);
    log = logHours(log, "2026-10-23", "2026-W43", 7200);
    assert.deepEqual(log, { "2026-10-23": { weekKey: "2026-W43", seconds: 7200 } });
});

test("logs keep the last KEEP_DAYS days", () => {
    let log = {};
    for (let i = 0; i < KEEP_DAYS + 5; i++) {
        const day = new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10);
        log = logHours(log, day, "w", i);
    }
    const days = Object.keys(log).sort();
    assert.equal(days.length, KEEP_DAYS);
    assert.equal(log[days.at(-1)].seconds, KEEP_DAYS + 4);
});
