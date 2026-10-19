import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TREES } from "../src/data.js";
import { treesFrom, ownedFrom, weekFrom, inventoryFrom, multiplyerFrom } from "../userscript/fill.js";

// hand made from data.js
// TODO: swap in real (cleaned) capture once i deal with chromeium
function fixture(name) {
    return JSON.parse(readFileSync(new URL(`fixtures/${name}.json`, import.meta.url), "utf8"));
}

test("treesFrom gives back TREES", { todo: true }, () => {
    const trees = treesFrom(fixture("device-upgrades"));
    // TODO: drop totals[0] from compare or find where it comes from (not in fixture)
    assert.deepEqual(trees, TREES);
});

test("ownedFrom", { todo: true }, () => {
    assert.deepEqual(ownedFrom(fixture("device-upgrades")), { device: "framework_12", own: { framework_12_diy: 1 } });
});

test("weekFrom: number 9 is Week 1", { todo: true }, () => {
    assert.equal(weekFrom(fixture("current-week")), 3);
});

test("multiplyerFrom: 36 / 30", { todo: true }, () => {
    assert.equal(multiplyerFrom(fixture("market-items")), 1.2);
});

test("multiplyerFrom: nothing to sell -> null", { todo: true }, () => {
    assert.equal(multiplyerFrom({ items: [], locked: [] }), null);
});

// needs inventory.sync fixture (needs real item types first)
test("inventoryFrom", { todo: true }, () => {
    assert.ok(inventoryFrom({ coins: 4 }, { items: [], usableWeeks: [] }));
});
