import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHECKS, REST, IN } from "../userscript/endpoints.js";

function fixture(name) {
    return JSON.parse(readFileSync(new URL(`fixtures/${name}.json`, import.meta.url), "utf8"));
}

test("every fixture passes its check", () => {
    assert.deepEqual(CHECKS[REST.deviceUpgrades](fixture("device-upgrades")), []);
    assert.deepEqual(CHECKS[REST.currentWeek](fixture("current-week")), []);
    assert.deepEqual(CHECKS[IN.currency](fixture("player-currency")), []);
    assert.deepEqual(CHECKS[IN.inventory](fixture("inventory-sync")), []);
    assert.deepEqual(CHECKS[IN.marketItems](fixture("market-items")), []);
});

test("shapes from the 19 Oct capture pass", () => {
    const stock = { status: "available", dateKey: "2026-10-19", entries: [{ id: "dirt", category: "dirt_plots", itemId: "dirt_plot", name: "Dirt Plot", quantity: 1, priceCoins: 10 }, { id: "water", category: "water", itemId: null, priceCoins: 50 }] };
    assert.deepEqual(CHECKS[IN.shopStock](stock), []);
    const hours = { visible: true, weekKey: "2026-W43", goalSeconds: 36000, rentWeek: true, week: { totalSeconds: 0, creditedSeconds: 0 } };
    assert.deepEqual(CHECKS[IN.hours](hours), []);
    assert.deepEqual(CHECKS[IN.joinComplete]({ farmOwnerId: null, tutorialStep: "complete" }), []);
    assert.deepEqual(CHECKS[IN.marketItems]({ items: [], locked: [] }), []);
});

test("a changed field says where", () => {
    const body = fixture("device-upgrades");
    body.devices[0].nodes[3].price = "250";
    delete body.devices[1].root;
    assert.deepEqual(CHECKS[REST.deviceUpgrades](body), [
        "devices[0].nodes[3].price: expected number, got string",
        "devices[1].root: missing",
    ]);
});

test("optional bits can be missing or null, but not the wrong thing", () => {
    const body = fixture("device-upgrades");
    const ram = body.devices[0].nodes.find((n) => n.tiers);
    delete ram.tiers;
    assert.deepEqual(CHECKS[REST.deviceUpgrades](body), []);
    ram.tiers = [{ price: 1 }, { price: "2" }];
    assert.deepEqual(CHECKS[REST.deviceUpgrades](body), ["devices[0].nodes[4].tiers[1].price: expected number, got string"]);
    ram.requires = "framework_12_diy";
    assert.match(CHECKS[REST.deviceUpgrades](body)[0], /requires: expected a list/);
});

test("not even an object", () => {
    assert.deepEqual(CHECKS[IN.currency](null), ["body: missing"]);
    assert.deepEqual(CHECKS[IN.currency]("hi"), ["body: expected an object"]);
    assert.deepEqual(CHECKS[IN.currency]([]), ["body: expected an object"]);
    assert.deepEqual(CHECKS[IN.inventory]({ usableWeeks: 9, items: [] }), ["usableWeeks: expected a list"]);
});

test("at most 5 problems", () => {
    const items = Array.from({ length: 20 }, () => ({ itemId: 1, type: "seed", quantity: 1 }));
    assert.equal(CHECKS[IN.inventory]({ usableWeeks: [], items }).length, 5);
});
