import { test } from "node:test";
import assert from "node:assert/strict";
import { dayHours, typicalDays, seedOdds, waitTable } from "../userscript/predict.js";
import { perHour } from "../userscript/shop.js";
import { CROPS } from "../src/data.js";

const h = 3600;

test("dayHours: differences day to day, a gap gets lumped", () => {
    const log = {
        "2026-10-19": { weekKey: "2026-W43", seconds: 2 * h }, // monday
        "2026-10-20": { weekKey: "2026-W43", seconds: 5 * h },
        "2026-10-23": { weekKey: "2026-W43", seconds: 11 * h }, // wed n thu not logged
        "2026-10-27": { weekKey: "2026-W44", seconds: 3 * h }, // tuesday, monday not logged
    };
    assert.deepEqual(dayHours(log), [
        { day: "2026-10-19", h: 2, lumped: false },
        { day: "2026-10-20", h: 3, lumped: false },
        { day: "2026-10-23", h: 6, lumped: true },
        { day: "2026-10-27", h: 3, lumped: true },
    ]);
});

test("typicalDays: median of clean days per weekday, null till there's enough", () => {
    const mondays = ["2026-10-05", "2026-10-12", "2026-10-19"].map((day, i) => ({ day, h: [2, 6, 3][i], lumped: false }));
    const typical = typicalDays([...mondays, { day: "2026-10-26", h: 40, lumped: true }, { day: "2026-10-20", h: 4, lumped: false }]);
    assert.equal(typical[0], 3);
    assert.equal(typical[1], null); // one tuesday < MIN_SAMPLES
});

test("the values waitTable gets, perHour off CROPS: eggplant 30, bok choy 27, apple 25 at m 1", () => {
    assert.deepEqual(["eggplant", "bokchoy", "apple"].map((id) => perHour(CROPS[id], 1)), [30, 27, 25]);
    assert.equal(perHour(CROPS.eggplant, 1.2), 37.5);
});

test("seedOdds: share of logged days", () => {
    const odds = seedOdds({ a: ["eggplant"], b: ["bokchoy", "eggplant"], c: [], d: ["eggplant"] });
    assert.deepEqual(odds, { eggplant: 0.75, bokchoy: 0.25 });
});

test("waitTable: eggplant half the days vs apples", () => {
    const table = waitTable({ eggplant: 30 }, { eggplant: 0.5 }, 25, 2);
    assert.deepEqual(table, [25, 27.5, 28.75]);
    // bok choy today (27) with one shop day left loses to waiting (27.5), by a hair
    assert.ok(27 < table[1]);
    // a seed thats never been seen doesnt count
    assert.deepEqual(waitTable({ eggplant: 30, mystery: 99 }, { eggplant: 0.5 }, 25, 1), [25, 27.5]);
});
