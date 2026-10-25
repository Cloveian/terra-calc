import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TREES } from "../src/data.js";
import {
    treesFrom, ownedFrom, weekFrom, firstShipped, inventoryFrom, multiplyerFrom, farmFrom, stuckFrom, userIdFromToken,
    shopFrom, shopProblems, farmSchemaProblems, loansFrom, seedsFrom, forSaleFrom,
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

test("firstShipped: eastern day the first shipped week starts, null till one is", () => {
    const rows = [
        { startsAt: "2026-10-12T04:00:00.000Z", shipped: false },
        { startsAt: "2026-10-26T04:00:00.000Z", shipped: true },
        { startsAt: "2026-10-19T04:00:00.000Z", shipped: true },
    ];
    assert.equal(firstShipped({ rows }), "2026-10-19");
    assert.equal(firstShipped({ rows: rows.slice(0, 1) }), null);
    assert.equal(firstShipped(null), null);
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

test("forSaleFrom: 12 apples at 36 and 10 carrots at 30, the locked ones don't sell", () => {
    assert.deepEqual(forSaleFrom(fixture("market-items")), { crops: 22, coins: 732 });
    assert.equal(forSaleFrom(null), null);
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
    // 3 this week + 2 from week 8 (still usable), 4 from week 7 expired, the 10 strawberrys are base seeds, 36 plots are loans like in a capture (no week)
    const inventory = inventoryFrom(fixture("player-currency"), fixture("inventory-sync"));
    assert.deepEqual(inventory, { coins: 42, plots: null, unplaced: 36, seeds: 5, baseSeeds: 10, baseKinds: { strawberry: 10 }, bonus: {}, water: 2.8633, seedsDie: Date.parse("2026-10-20T03:59:59.999Z") });
});

test("inventoryFrom: no seeds -> 0s", () => {
    assert.deepEqual(inventoryFrom({ coins: 0 }, { usableWeeks: [9], items: [] }), { coins: 0, plots: null, unplaced: 0, seeds: 0, baseSeeds: 0, baseKinds: {}, bonus: {}, water: 0, seedsDie: null });
});

test("inventoryFrom: bonus seeds by id, apples and base seeds aren't in there, old ones expire", () => {
    // no bought ones in a capture yet, shaped like the apple seeds in inventory-sync.json
    const seed = (itemId, quantity, weekNumber = 9, subtype = "") => ({ itemId, type: "seed", subtype, quantity, weekNumber });
    const inventory = {
        usableWeeks: [9],
        items: [seed("eggplant_seed", 4), seed("eggplant_seed", 2), seed("bokchoy_seed", 3), seed("bokchoy_seed", 7, 8),
            seed("apple_seed", 5), seed("strawberry_seed", 10, 9, "base")],
    };
    const result = inventoryFrom({ coins: 0 }, inventory);
    assert.deepEqual(result.bonus, { eggplant: 6, bokchoy: 3 });
    assert.equal(result.seeds, 5);
    assert.equal(result.baseSeeds, 10);
});

test("inventoryFrom: base seeds by subtype, so prep carrots count too, and expire like the rest", () => {
    const carrots = (quantity, weekNumber) => ({ itemId: "carrot_seed", type: "seed", subtype: "base", quantity, weekNumber });
    const inventory = { usableWeeks: [8], items: [carrots(6, 8), carrots(10, 7)] };
    assert.equal(inventoryFrom({ coins: 0 }, inventory).baseSeeds, 6);
    assert.deepEqual(inventoryFrom({ coins: 0 }, inventory).baseKinds, { carrot: 6 });
});

test("inventoryFrom: missing either message -> null", () => {
    assert.equal(inventoryFrom(null, fixture("inventory-sync")), null);
    assert.equal(inventoryFrom(fixture("player-currency"), null), null);
    assert.equal(inventoryFrom({ water: 2 }, fixture("inventory-sync")), null);
});

// farm like schema.js gives it back, real FarmItem fields. p1-p6 plots, five with crops
const plot = (id) => ({ id, itemId: "dirt_plot", name: "Dirt Plot", isCrop: false, fedAt: 0, shippedAt: 0, grownAt: 0, witheredAt: 0, plantWeek: "", plotId: "", reviewState: "" });
const crop = (plotId, more) => ({ id: `c-${plotId}`, itemId: "apple_seed", name: "Apple", isCrop: true, fedAt: 0, shippedAt: 0, grownAt: 0, witheredAt: 0, plantWeek: "2026-W43", plotId, reviewState: "", waterRequired: 1, waterApplied: 0, ...more });
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

test("farmFrom: the water each crop still needs, an eggplant takes its 2 in one go", () => {
    const eggplant = (more) => crop("p", { itemId: "eggplant_seed", name: "Eggplant", waterRequired: 2, ...more });
    const water = (c) => farmFrom({ farmItems: new Map([["p", plot("p")], ["c", c]]) }, "me", "me").crops[0];
    assert.deepEqual([water(eggplant({})).id, water(eggplant({})).water], ["eggplant", 2]);
    assert.equal(water(eggplant({ waterApplied: 2, fedAt: 5 })).water, 0);
    assert.equal(water(crop("p", {})).water, 1);
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

// fake decoder, FarmItem fields from a real handshake
const REAL_FARM_ITEM = ["id", "itemId", "name", "spriteId", "x", "z", "plantedAtMs", "isCrop", "waterApplied", "waterRequired", "fedAt", "shippedAt", "reviewState", "grownAt", "witheredAt", "plantWeek", "plotId"];
const decoderWith = (itemFields, root = ["serverTime", "levelId", "players", "npcs", "farmItems"]) => ({
    rootFields: root.map((name) => ({ name, ref: name === "farmItems" ? 4 : undefined })),
    fieldsOf: (id) => (id === 4 ? itemFields.map((name) => ({ name })) : []),
});

test("farmSchemaProblems: the real FarmItem has everything", () => {
    assert.deepEqual(farmSchemaProblems(decoderWith(REAL_FARM_ITEM)), []);
});

test("farmSchemaProblems: renamed fields show up, no farmItems or no decoder is fine", () => {
    const renamed = REAL_FARM_ITEM.map((name) => (name === "grownAt" ? "grownAtMs" : name)).filter((name) => name !== "plotId");
    assert.deepEqual(farmSchemaProblems(decoderWith(renamed)), ["plotId", "grownAt"]);
    assert.deepEqual(farmSchemaProblems(decoderWith([], ["serverTime", "levelId"])), []);
    assert.deepEqual(farmSchemaProblems(null), []);
});

test("stuckFrom: waiting on review from before this week, and why", () => {
    const farm = farmFrom(farmState, "me", "me");
    const stuck = stuckFrom(farm, "2026-W43");
    assert.equal(stuck.count, 2);
    assert.deepEqual(stuck.why, { review: 1, changes: 1 });
    // same objects as farm.crops
    assert.deepEqual(stuck.crops.map((crop) => crop.review), ["review", "changes"]);
    assert.ok(stuck.crops.every((crop) => farm.crops.includes(crop)));
    assert.deepEqual(stuckFrom(farm, "2026-W42"), { count: 0, why: {}, crops: [] }, "planted this week isn't stuck yet");
    assert.equal(stuckFrom(farm, null).count, 2);
});

test("loansFrom: as many unplaced as stuck (or more) means that many are loans", () => {
    const stuck = (count) => ({ count, why: { review: count }, crops: [] });
    assert.equal(loansFrom({ unplaced: 36 }, stuck(36)), 36, "the 20 Oct capture");
    assert.equal(loansFrom({ unplaced: 40 }, stuck(36)), 36, "the other 4 are bought ones");
    assert.equal(loansFrom({ unplaced: 20 }, stuck(36)), 0, "some placed already, can't tell");
    assert.equal(loansFrom({ unplaced: 5 }, stuck(0)), 0, "nothing stuck, nothing lent");
    assert.equal(loansFrom({ unplaced: 5 }, null), 0, "farm not seen yet");
    assert.equal(loansFrom(null, stuck(3)), 0);
});

test("userIdFromToken: the userId out of the JWT", () => {
    const part = (json) => Buffer.from(JSON.stringify(json)).toString("base64url");
    const token = `${part({ alg: "HS256" })}.${part({ userId: "u-1234", username: "someone", exp: 1 })}.sig`;
    assert.equal(userIdFromToken(token), "u-1234");
    assert.equal(userIdFromToken("not-a-jwt"), null);
    assert.equal(userIdFromToken("a.%%%.c"), null);
    assert.equal(userIdFromToken(null), null);
});

// shop.stock like the capture minus sprites n decriptions
const stock = (plotPrice, applePrice = 5) => ({
    status: "available",
    dateKey: "2026-10-19",
    entries: [
        { id: "apple", category: "bonus_seeds", itemId: "apple_seed", name: "Apple Seed", quantity: 1, priceCoins: applePrice },
        { id: "water", category: "water", itemId: null, name: "Water", quantity: 1, priceCoins: 50 },
        { id: "dirt", category: "dirt_plots", itemId: "dirt_plot", name: "Dirt Plot", quantity: 1, priceCoins: plotPrice },
    ],
});

test("shopFrom: prices, and plots when the price says", () => {
    assert.deepEqual(shopFrom(stock(10)), { plotPrice: 10, plots: null }, "10 is anything from 19 up");
    assert.deepEqual(shopFrom(stock(1)).plots, 10);
    assert.deepEqual(shopFrom(stock(3)).plots, 12);
    assert.deepEqual(shopFrom(stock(9)).plots, 18);
});

test("shopFrom: closed or missing bits", () => {
    assert.equal(shopFrom({ status: "closed", entries: [] }), null);
    assert.equal(shopFrom(null), null);
    assert.deepEqual(shopFrom({ status: "available", entries: [] }), { plotPrice: null, plots: null });
});

// shop.stock like the 22 Oct capture, the first one with bonus seeds
const stock22 = {
    status: "available",
    dateKey: "2026-10-22",
    entries: [
        { id: "admin-a1", category: "bonus_seeds", itemId: "apple_seed", name: "Apple Seed", priceCoins: 5, waterNeeded: 1, cropValue: 30 },
        { id: "water", category: "water", itemId: null, name: "Water", priceCoins: 50, waterNeeded: null, cropValue: null },
        { id: "dirt", category: "dirt_plots", itemId: "dirt_plot", name: "Dirt Plot", priceCoins: 10, waterNeeded: null, cropValue: null },
        { id: "blahaj", category: "prizes", itemId: "blahaj", name: "Blahaj", priceCoins: 400, waterNeeded: null, cropValue: null },
        { id: "admin-341c", category: "bonus_seeds", itemId: "eggplant_seed", name: "Eggplant Seeds", priceCoins: 15, waterNeeded: 2, cropValue: 75 },
        { id: "admin-b2", category: "bonus_seeds", itemId: "bokchoy_seed", name: "Bok Choy Seeds", priceCoins: 10, waterNeeded: 1, cropValue: 37 },
    ],
};

test("seedsFrom: every seed in today's stock, apples too", () => {
    assert.deepEqual(seedsFrom(stock22), [
        { id: "apple", name: "Apple", buy: 5, sell: 30, water: 1 },
        { id: "eggplant", name: "Eggplant", buy: 15, sell: 75, water: 2 },
        { id: "bokchoy", name: "Bok Choy", buy: 10, sell: 37, water: 1 },
    ]);
});

test("seedsFrom: closed shop, no numbers on the entry, or nothing at all -> []", () => {
    assert.deepEqual(seedsFrom({ ...stock22, status: "closed" }), []);
    assert.deepEqual(seedsFrom(null), []);
    // the 19 Oct entries had no waterNeeded or cropValue
    const old = { category: "bonus_seeds", itemId: "eggplant_seed", name: "Eggplant Seeds", priceCoins: 15 };
    assert.deepEqual(seedsFrom({ status: "available", entries: [old] }), []);
});

test("shopProblems: nothing when the shop matches the model", () => {
    assert.deepEqual(shopProblems(shopFrom(stock(10)), 36), []);
    assert.deepEqual(shopProblems(shopFrom(stock(3)), 12), []);
    assert.deepEqual(shopProblems(shopFrom(stock(3)), null), [], "can't check the plot price without plots");
    assert.deepEqual(shopProblems(null, 12), []);
});

test("shopProblems: says what changed, plot price only", () => {
    assert.deepEqual(shopProblems(shopFrom(stock(5, 6)), 12), ["the next plot costs 5, the plan thinks 3 at 12 plots"]);
});
