import { test } from "node:test";
import assert from "node:assert/strict";
import { buyRisk } from "../userscript/risk.js";
import { CROPS } from "../src/data.js";

const buy = (seed, n) => ({ do: "buySeeds", seed, n });

test("buyRisk: every bought seed watered in 2 of my last 4 weeks, all over their break-even", () => {
    // 6 eggplants (12 water) + 4 apples on top of 10 h already owed
    const steps = [buy("eggplant", 6), buy("apple", 4), { do: "code", n: 26 }];
    assert.deepEqual(buyRisk(steps, CROPS, 1, [30, 20, 26, 10], 0), { h: 26, weeks: 2, of: 4, kept: 10, skip: {} });
    // 4h coded today already, so a past week needed 30
    assert.deepEqual(buyRisk(steps, CROPS, 1, [30, 20, 26, 10], 4).weeks, 1);
});

test("buyRisk: bok choy needs 27%, 1 of 4 weeks is under, an apple after it still makes 17%", () => {
    const steps = [buy("eggplant", 6), buy("bokchoy", 4), buy("apple", 1), { do: "code", n: 27 }];
    // eggplants to 22h, 1st bok choy at 23 (2 weeks), 2nd at 24 only 1 week, the apple at 24 is fine with that
    assert.deepEqual(buyRisk(steps, CROPS, 1, [30, 20, 23, 10], 0), { h: 24, weeks: 1, of: 4, kept: 8, skip: { bokchoy: { n: 3, weeks: 1 } } });
});

test("buyRisk: nothing without history or with nothing to buy", () => {
    assert.equal(buyRisk([buy("apple", 4), { do: "code", n: 4 }], CROPS, 1, [], 0), null);
    assert.equal(buyRisk([{ do: "code", n: 4 }], CROPS, 1, [10, 10, 10], 0), null);
    // pool covers it all, no code step
    assert.deepEqual(buyRisk([buy("apple", 2)], CROPS, 1, [0, 0, 0], 0), { h: 0, weeks: 3, of: 3, kept: 2, skip: {} });
});
