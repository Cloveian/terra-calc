import { test } from "node:test";
import assert from "node:assert/strict";
import { dayHours, sinceStart, typicalDays, weekShape, restOfWeeks, typicalCrop, seedOdds, waitTable, waitFor, waitWorth, dayOdds, MIN_SHOP_DAYS } from "../userscript/predict.js";
import { EVEN_WEEK } from "../src/route.js";
import { perHour } from "../src/farm.js";
import { CROPS } from "../src/data.js";

// n days of shop log, eggplant on the first `egg` of them, apples on the last `apples`
const shopLog = (n, egg, apples = n) => Object.fromEntries(Array.from({ length: n }, (_, i) => {
    const seeds = [];
    if (i < egg) seeds.push("eggplant");
    if (i >= n - apples) seeds.push("apple");
    return [`day${String(i).padStart(2, "0")}`, seeds];
}));
// waitFor at m 1 with daysLeft shop days to go, like plan() feeds it
const waitOn = (log, today, daysLeft, back) => waitFor(log, today, CROPS, 1, waitWorth(log, CROPS, 1, daysLeft, back));

test("waitFor: only with enough log, something in the shop today, n waiting ahead", () => {
    // eggplant half the days, apples every day, bok choy (27) today, one shop day left: waiting's worth 27.5
    assert.deepEqual(waitOn(shopLog(14, 7), ["bokchoy"], 1), { best: "bokchoy", top: "eggplant", odds: 0.5 });
    assert.equal(waitOn(shopLog(MIN_SHOP_DAYS - 1, 7), ["bokchoy"], 1), null); // not enough log yet
    assert.equal(waitOn(shopLog(14, 7), ["eggplant"], 1), null); // nothing beats it
    assert.equal(waitOn(shopLog(14, 7), [], 3), null); // nothing to buy today
    assert.equal(waitOn(shopLog(14, 7), ["bokchoy"], 0), null); // sunday, last shop of the week
    assert.equal(waitOn(shopLog(14, 2), ["bokchoy"], 1), null); // eggplant's rare, 25 + 5/7 < 27
    // apples only today n 3 days left, an eggplant day in there is likely: 29.4 > 25
    assert.deepEqual(waitOn(shopLog(14, 7), ["apple"], 3), { best: "apple", top: "eggplant", odds: 0.5 });
    // on terra 90% of days, tomorrow's 27.5 is 24.75, bok choy wins
    assert.equal(waitOn(shopLog(14, 7), ["bokchoy"], 1, 0.9), null);
    // apples on half the days too, tomorrow's only worth 15 + 6.25, bok choy wins
    assert.equal(waitOn(shopLog(14, 7, 7), ["bokchoy"], 1), null);
});

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

test("sinceStart: from my first day with hours, in the week i first shipped once i have", () => {
    const day = (d, h) => ({ day: d, h, lumped: false });
    const days = [day("2026-10-21", 3), day("2026-09-21", 5), day("2026-10-19", 0), day("2026-10-20", 0), day("2026-10-22", 0)];
    assert.equal(sinceStart(days)[0].day, "2026-09-21"); // no ship yet, first coded day at all
    // first shipped week started the 19th, nothing coded till the 21st
    assert.deepEqual(sinceStart(days, "2026-10-19").map((d) => d.day), ["2026-10-21", "2026-10-22"]);
    assert.deepEqual(sinceStart([day("2026-10-01", 0)]), []);
});

test("typicalDays: median of clean days per weekday, null till there's enough", () => {
    const mondays = ["2026-10-05", "2026-10-12", "2026-10-19"].map((day, i) => ({ day, h: [2, 6, 3][i], lumped: false }));
    const typical = typicalDays([...mondays, { day: "2026-10-26", h: 40, lumped: true }, { day: "2026-10-20", h: 4, lumped: false }]);
    assert.equal(typical[0], 3);
    assert.equal(typical[1], null); // one tuesday < MIN_SAMPLES
});

test("weekShape: shares of my week, a weekday with no number yet gets the average of the known ones", () => {
    assert.deepEqual(weekShape([1, 1, 1, 1, 2, 3, 1]), [0.1, 0.1, 0.1, 0.1, 0.2, 0.3, 0.1]);
    // weekends only so far: 6 n 4, the 5 weekdays get 5 each
    assert.deepEqual(weekShape([null, null, null, null, null, 6, 4]), [5, 5, 5, 5, 5, 6, 4].map((h) => h / 35));
    assert.deepEqual(weekShape(Array(7).fill(null)), EVEN_WEEK);
    assert.deepEqual(weekShape([0, 0, 0, 0, 0, 0, 0]), EVEN_WEEK);
});

test("restOfWeeks: thursday to sunday of each week before this one, lumped weeks out", () => {
    // 1h a day the week of the 5th, 2h the 12th, 3h the 19th, then 9h this week
    const days = [];
    for (const [monday, h] of [[5, 1], [12, 2], [19, 3], [26, 9]]) {
        for (let i = 0; i < 7; i++) days.push({ day: new Date(Date.UTC(2026, 9, monday + i)).toISOString().slice(0, 10), h, lumped: false });
    }
    assert.deepEqual(restOfWeeks(days, "2026-10-29"), [4, 8, 12]);
    // sunday, just the one day each
    assert.deepEqual(restOfWeeks(days, "2026-11-01"), [1, 2, 3]);
    // terra not open thursday on the week of the 5th, thats a 0 week
    assert.deepEqual(restOfWeeks(days.filter((d, i) => i < 3 || i >= 7), "2026-10-29"), [0, 8, 12]);
    // or not at all the week of the 12th
    assert.deepEqual(restOfWeeks(days.filter((d, i) => i < 7 || i >= 14), "2026-10-29"), [4, 0, 12]);
    // the 12th's saturday had wed n thu in it, 2 weeks is under MIN_WEEKS
    days[12] = { ...days[12], lumped: true };
    assert.deepEqual(restOfWeeks(days, "2026-10-29"), []);
});

test("the values waitTable gets, perHour off CROPS: eggplant 30, bok choy 27, apple 25 at m 1", () => {
    assert.deepEqual(["eggplant", "bokchoy", "apple"].map((id) => perHour(CROPS[id], 1)), [30, 27, 25]);
    assert.equal(perHour(CROPS.eggplant, 1.2), 37.5);
});

test("typicalCrop: each day's best seed per water, averaged, a day with nothing is 0", () => {
    const cabbage = { id: "cabbage", name: "Cabbage", buy: 2, sell: 20, water: 1 };
    const eggplant = { id: "eggplant", name: "Eggplant", buy: 15, sell: 75, water: 2 };
    // under MIN_SHOP_DAYS: the last day that had something
    assert.deepEqual(typicalCrop({ a: [eggplant], b: [cabbage], c: [] }, CROPS, 1), { buy: 2, sell: 20, water: 1 });
    assert.deepEqual(typicalCrop({ a: [cabbage, eggplant] }, CROPS, 1), { buy: 7.5, sell: 37.5, water: 1 }); // eggplant's 30 a water beats 18
    assert.deepEqual(typicalCrop({ a: ["eggplant"] }, CROPS, 1), { buy: 7.5, sell: 37.5, water: 1 }); // old id-only day off the table
    assert.equal(typicalCrop({}, CROPS, 1), null);
    // 14 days, eggplant on half of them n nothing on the rest
    const log = Object.fromEntries(Array.from({ length: 14 }, (_, i) => [`day${String(i).padStart(2, "0")}`, i < 7 ? [eggplant] : []]));
    assert.deepEqual(typicalCrop(log, CROPS, 1), { buy: 3.75, sell: 18.75, water: 1 });
});

test("seedOdds: share of logged days", () => {
    const odds = seedOdds({ a: ["eggplant"], b: ["bokchoy", "eggplant"], c: [], d: ["eggplant"] });
    assert.deepEqual(odds, { eggplant: 0.75, bokchoy: 0.25 });
});

test("waitTable: eggplant half the days vs apples every day", () => {
    const table = waitTable({ eggplant: 30, apple: 25 }, { eggplant: 0.5, apple: 1 }, 2);
    assert.deepEqual(table, [0, 27.5, 28.75]);
    // bok choy today (27) with one shop day left loses to waiting (27.5), by a hair
    assert.ok(27 < table[1]);
    // a seed thats never been seen doesnt count
    assert.deepEqual(waitTable({ eggplant: 30, mystery: 99 }, { eggplant: 0.5 }, 1), [0, 15]);
});

test("waitTable: a day im not on terra is a day its shop doesnt count", () => {
    // on half the days: tomorrow's 27.5 if im there, 0 if not
    assert.deepEqual(waitTable({ eggplant: 30, apple: 25 }, { eggplant: 0.5, apple: 1 }, 2, 0.5), [0, 13.75, 0.5 * 27.5 + 0.5 * 13.75]);
    assert.deepEqual(waitTable({ eggplant: 30 }, { eggplant: 1 }, 3, 0), [0, 0, 0, 0]);
});

test("dayOdds: days terra was open over the days since the log started, 90% under a week", () => {
    const log = (...days) => Object.fromEntries(days.map((d) => [`2026-10-${d}`, { weekKey: "2026-W43", seconds: 0 }]));
    assert.equal(dayOdds({}, "2026-10-25"), 0.9);
    assert.equal(dayOdds(log(20, 21, 23), "2026-10-23"), 0.9);
    // 8 of the 10 days from the 14th
    assert.equal(dayOdds(log(14, 15, 16, 18, 19, 20, 22, 23), "2026-10-23"), 0.8);
});

test("waitTable: same as trying every mix of whos in the shop", () => {
    const values = { eggplant: 30, bokchoy: 27, apple: 25, cabbage: 18 };
    const odds = { eggplant: 0.3, bokchoy: 0.2, apple: 0.8, cabbage: 0.4 };
    const ids = Object.keys(values);
    const brute = [0];
    for (let n = 1; n <= 6; n++) {
        let worth = 0;
        for (let mask = 0; mask < 1 << ids.length; mask++) {
            let p = 1;
            let best = brute[n - 1];
            ids.forEach((id, i) => {
                const there = (mask >> i) & 1;
                p *= there ? odds[id] : 1 - odds[id];
                if (there) best = Math.max(best, values[id]);
            });
            worth += p * best;
        }
        brute.push(worth);
    }
    waitTable(values, odds).forEach((v, n) => assert.ok(Math.abs(v - brute[n]) < 1e-9, `V_${n}`));
});
