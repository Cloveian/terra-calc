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

test("treesFrom gives back TREES", () => {
    // totals[0] (none bought) not in response so null there
    const expected = structuredClone(TREES);
    for (const tree of Object.values(expected)) {
        for (const node of tree.nodes) if (node.totals) node.totals[0] = null;
    }
    assert.deepEqual(treesFrom(fixture("device-upgrades")), expected);
});

test("treesFrom: unspaced totals like the real API", () => {
    const tiers = [{ price: 750, description: "+8GB of RAM (16GB total)" }, { price: 1300, description: "(1TB total)" }];
    const body = { devices: [{ id: "d", title: "D", root: { x: 0, y: 0 }, nodes: [{ id: "n", title: "N", tiers, x: 0, y: 0 }] }] };
    assert.deepEqual(treesFrom(body).d.nodes[0].totals, [null, "16 GB", "1 TB"]);
});

test("treesFrom: a tier with no total -> no totals at all", () => {
    const tiers = [{ price: 1, description: "(16GB total)" }, { price: 2, description: "more" }];
    const body = { devices: [{ id: "d", title: "D", root: { x: 0, y: 0 }, nodes: [{ id: "n", title: "N", tiers, x: 0, y: 0 }] }] };
    assert.equal("totals" in treesFrom(body).d.nodes[0], false);
});

test("treesFrom: not the right shape -> null", () => {
    assert.equal(treesFrom(null), null);
    assert.equal(treesFrom({ error: "nope" }), null);
});

test("ownedFrom", () => {
    assert.deepEqual(ownedFrom(fixture("device-upgrades")), { device: "framework_12", own: { framework_12_diy: 1 } });
    assert.deepEqual(ownedFrom({ mainDevice: "ipad_mini", owned: { apple_pencil: 0 } }), { device: "ipad_mini", own: {} });
    assert.equal(ownedFrom({ owned: {} }), null);
});

test("weekFrom: Week 1 is t = 3", () => {
    assert.equal(weekFrom(fixture("current-week")), 3);
});

test("weekFrom: prep weeks and labels it doesn't know", () => {
    assert.equal(weekFrom({ number: 7, label: "Prep Week 2" }), 1);
    assert.equal(weekFrom({ label: "Week 12" }), 14);
    assert.equal(weekFrom({ label: "Bonus Week" }), null);
    assert.equal(weekFrom(null), null);
});

test("multiplyerFrom: 36 / 30", () => {
    assert.equal(multiplyerFrom(fixture("market-items")), 1.2);
});

test("multiplyerFrom: goes off the biggest base price", () => {
    // m = 1.15: carrots 25 -> 28.75 -> 29 (1.16), apples 30 -> 34.5 -> 35 (1.1667). carrots win this one but apples are off by 0.5 / 30 max vs carrots 0.5 / 25
    const items = [{ baseUnitCoins: 25, unitPriceCoins: 29 }, { baseUnitCoins: 30, unitPriceCoins: 35 }];
    assert.equal(multiplyerFrom({ items }), 35 / 30);
});

test("multiplyerFrom: nothing to sell -> null", () => {
    assert.equal(multiplyerFrom({ items: [], locked: [] }), null);
    assert.equal(multiplyerFrom(null), null);
});

test("inventoryFrom: coins, and apple seeds from the usable weeks only", () => {
    // 3 this week + 2 from week 8 (still usable), 4 from week 7 expired, strawberrys are base seeds
    assert.deepEqual(inventoryFrom(fixture("player-currency"), fixture("inventory-sync")), { coins: 42, plots: null, seeds: 5 });
});

test("inventoryFrom: no apple seeds -> 0", () => {
    assert.deepEqual(inventoryFrom({ coins: 0 }, { usableWeeks: [9], items: [] }), { coins: 0, plots: null, seeds: 0 });
});

test("inventoryFrom: missing either message -> null", () => {
    assert.equal(inventoryFrom(null, fixture("inventory-sync")), null);
    assert.equal(inventoryFrom(fixture("player-currency"), null), null);
    assert.equal(inventoryFrom({ water: 2 }, fixture("inventory-sync")), null);
});
