import { test } from "node:test";
import assert from "node:assert/strict";
import { weekIndex, weekName, isPrep, easternDay, isWeekAfter, weekDay, LAST_WEEK } from "../src/week.js";

test("weekDay: monday 0 ... sunday 6, before Terra too", () => {
    assert.equal(weekDay("2026-10-19"), 0); // Week 1 monday
    assert.equal(weekDay("2026-10-23"), 4);
    assert.equal(weekDay("2026-10-25"), 6);
    assert.equal(weekDay("2026-09-27"), 6); // the sunday before Prep 1
});

test("isWeekAfter: the next ISO week, over new year too (2026 has a W53)", () => {
    assert.equal(isWeekAfter("2026-W43", "2026-W44"), true);
    assert.equal(isWeekAfter("2026-W43", "2026-W45"), false);
    assert.equal(isWeekAfter("2026-W44", "2026-W43"), false);
    assert.equal(isWeekAfter("2026-W53", "2027-W01"), true);
    assert.equal(isWeekAfter("2026-W52", "2027-W01"), false);
});

test("weekIndex from Eastern day strings", () => {
    assert.equal(weekIndex("2026-10-09"), 1); // Prep 2
    assert.equal(weekIndex("2026-10-19"), 3); // Week 1
    assert.equal(weekIndex("2026-09-27"), -1);
    assert.equal(weekIndex("2026-09-28"), 0);
    assert.equal(weekIndex("2026-10-18"), 2); // last day of Prep 3
    assert.equal(weekIndex("2027-01-10"), 14); // last day of Week 12
    assert.equal(weekIndex("2027-01-11"), 15); // over
});

test("weekIndex from a Date uses the Eastern day, not UTC", () => {
    // 2026-10-19 02:00 UTC is still Sunday 18 Oct in New York (Prep 3)
    assert.equal(weekIndex(new Date("2026-10-19T02:00:00Z")), 2);
    // 04:00 UTC is midnight Eastern (EDT), Week 1 starts
    assert.equal(weekIndex(new Date("2026-10-19T04:00:00Z")), 3);
    // after DST ends (1 Nov), midnight Eastern is 05:00 UTC
    assert.equal(easternDay(new Date("2026-11-09T04:30:00Z")), "2026-11-08");
    assert.equal(weekIndex(new Date("2026-11-09T05:00:00Z")), 6); // Week 4
});

test("weekName and isPrep", () => {
    assert.equal(weekName(0), "Prep 1");
    assert.equal(weekName(1), "Prep 2");
    assert.equal(weekName(3), "Week 1");
    assert.equal(weekName(LAST_WEEK), "Week 12");
    assert.equal(isPrep(2), true);
    assert.equal(isPrep(3), false);
});
