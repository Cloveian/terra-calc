import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TREES } from "../src/data.js";
import {
    treesFrom, ownedFrom, weekFrom, inventoryFrom, multiplyerFrom, farmFrom, stuckFrom, userIdFromToken,
} from "../userscript/fill.js";

// most fixtures hand made from capture shapes. device-upgrades-real is a real response, owned + purchases emptied, coins and address swapped for made up ones
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

test("treesFrom on the real response is data.js, node order aside", () => {
    const byId = (tree) => ({ ...tree, nodes: [...tree.nodes].sort((a, b) => a.id.localeCompare(b.id)) });
    const trees = treesFrom(fixture("device-upgrades-real"));
    for (const [id, tree] of Object.entries(TREES)) {
        const expected = byId(structuredClone(tree));
        for (const node of expected.nodes) if (node.totals) node.totals[0] = null;
        assert.deepEqual(byId(trees[id]), expected, id);
    }
    assert.deepEqual(Object.keys(trees), Object.keys(TREES));
});

test("treesFrom: tiered nodes lose the first tier's amount, plain ones keep their whole title", () => {
    const tiers = [{ price: 1, description: "(16GB total)" }];
    const node = (title, more) => ({ id: "n", title, x: 0, y: 0, price: 1, ...more });
    const body = { devices: [{ id: "d", title: "D", root: { x: 0, y: 0 }, nodes: [node("+8GB RAM", { tiers }), node("+1 Fancy Card")] }] };
    assert.deepEqual(treesFrom(body).d.nodes.map((n) => n.name), ["RAM", "+1 Fancy Card"]);
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
    // 3 this week + 2 from week 8 (still usable), 4 from week 7 expired, the 10 strawberrys are base seeds
    const inventory = inventoryFrom(fixture("player-currency"), fixture("inventory-sync"));
    assert.deepEqual(inventory, { coins: 42, plots: null, seeds: 5, baseSeeds: 10 });
});

test("inventoryFrom: no seeds -> 0s", () => {
    assert.deepEqual(inventoryFrom({ coins: 0 }, { usableWeeks: [9], items: [] }), { coins: 0, plots: null, seeds: 0, baseSeeds: 0 });
});

test("inventoryFrom: base seeds by subtype, so prep carrots count too, and expire like the rest", () => {
    const carrots = (quantity, weekNumber) => ({ itemId: "carrot_seed", type: "seed", subtype: "base", quantity, weekNumber });
    const inventory = { usableWeeks: [8], items: [carrots(6, 8), carrots(10, 7)] };
    assert.equal(inventoryFrom({ coins: 0 }, inventory).baseSeeds, 6);
});

test("inventoryFrom: missing either message -> null", () => {
    assert.equal(inventoryFrom(null, fixture("inventory-sync")), null);
    assert.equal(inventoryFrom(fixture("player-currency"), null), null);
    assert.equal(inventoryFrom({ water: 2 }, fixture("inventory-sync")), null);
});

// farm like schema.js gives it back, real FarmItem fields. p1-p6 plots, five with crops
const plot = (id) => ({ id, itemId: "dirt_plot", name: "Dirt Plot", isCrop: false, fedAt: 0, shippedAt: 0, grownAt: 0, witheredAt: 0, plantWeek: "", plotId: "", reviewState: "" });
const crop = (plotId, more) => ({ id: `c-${plotId}`, itemId: "apple_seed", name: "Apple", isCrop: true, fedAt: 0, shippedAt: 0, grownAt: 0, witheredAt: 0, plantWeek: "2026-W43", plotId, reviewState: "", ...more });
const farmState = {
    levelId: "farm-island",
    farmItems: new Map([
        ...["p1", "p2", "p3", "p4", "p5", "p6"].map((id) => [id, plot(id)]),
        ["c1", crop("p1", {})],
        ["c2", crop("p2", { fedAt: 1, itemId: "strawberry_seed", name: "Strawberry" })],
        ["c3", crop("p3", { fedAt: 1, shippedAt: 2, plantWeek: "2026-W42", reviewState: "review" })],
        ["c4", crop("p4", { fedAt: 1, shippedAt: 2, plantWeek: "2026-W42", reviewState: "changes" })],
        ["c5", crop("p5", { fedAt: 1, shippedAt: 2, grownAt: 3, plantWeek: "2026-W42", reviewState: "review" })],
    ]),
};

test("farmFrom: plots, empty ones, and each crop's stage the way the game works it out", () => {
    const farm = farmFrom(farmState, "me", "me");
    assert.equal(farm.plots, 6);
    assert.equal(farm.empty, 1);
    assert.deepEqual(farm.crops.map((c) => [c.seed, c.stage, c.review]), [
        ["apple_seed", "dry", null],
        ["strawberry_seed", "watered", null],
        ["apple_seed", "review", "review"],
        ["apple_seed", "review", "changes"],
        ["apple_seed", "ready", "review"],
    ]);
});

test("farmFrom: withered beats everything", () => {
    const state = { farmItems: new Map([["p", plot("p")], ["c", crop("p", { fedAt: 1, grownAt: 3, witheredAt: 4 })]]) };
    assert.equal(farmFrom(state, "me", "me").crops[0].stage, "withered");
});

test("farmFrom: not a farm, or someone else's -> null", () => {
    assert.equal(farmFrom({ levelId: "town-square", farmItems: new Map() }, null, "me"), null);
    assert.equal(farmFrom(farmState, "a-friend", "me"), null);
    assert.equal(farmFrom(farmState, "me", null), null);
    assert.equal(farmFrom(null, "me", "me"), null);
});

test("stuckFrom: waiting on review from before this week, and why", () => {
    const farm = farmFrom(farmState, "me", "me");
    assert.deepEqual(stuckFrom(farm, "2026-W43"), { count: 2, why: { review: 1, changes: 1 } });
    assert.deepEqual(stuckFrom(farm, "2026-W42"), { count: 0, why: {} }, "planted this week isn't stuck yet");
    assert.deepEqual(stuckFrom(farm, null), { count: 2, why: { review: 1, changes: 1 } });
    assert.deepEqual(stuckFrom(null, "2026-W43"), { count: 0, why: {} });
});

test("userIdFromToken: the userId out of the JWT", () => {
    const part = (json) => Buffer.from(JSON.stringify(json)).toString("base64url");
    const token = `${part({ alg: "HS256" })}.${part({ userId: "u-1234", username: "someone", exp: 1 })}.sig`;
    assert.equal(userIdFromToken(token), "u-1234");
    assert.equal(userIdFromToken("not-a-jwt"), null);
    assert.equal(userIdFromToken("a.%%%.c"), null);
    assert.equal(userIdFromToken(null), null);
});
