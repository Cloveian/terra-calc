import { test } from "node:test";
import assert from "node:assert/strict";
import { perHour } from "../userscript/shop.js";
import { CROPS } from "../src/data.js";

test("perHour: apple 25, bok choy 27, eggplant 30 at m 1, eggplant's 2 water halves it", () => {
    assert.equal(perHour(CROPS.apple, 1), 25);
    assert.equal(perHour(CROPS.bokchoy, 1), 27);
    assert.equal(perHour(CROPS.eggplant, 1), 30);
    // 1.2 * 75 = 90, minus 15 is 75, over 2 h
    assert.equal(perHour(CROPS.eggplant, 1.2), 37.5);
});
