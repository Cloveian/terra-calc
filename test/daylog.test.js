import { test } from "node:test";
import assert from "node:assert/strict";
import { logShop, logHours, codedBefore, KEEP_DAYS } from "../userscript/daylog.js";

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

test("logShop keeps the day's bonus seed ids, an empty day too", () => {
    let log = logShop({}, "2026-10-22", [{ id: "eggplant" }, { id: "bokchoy" }]);
    log = logShop(log, "2026-10-23", []);
    assert.deepEqual(log, { "2026-10-22": ["bokchoy", "eggplant"], "2026-10-23": [] });
    assert.equal(logShop(log, null, []), log); // no dateKey, nothing to say
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
