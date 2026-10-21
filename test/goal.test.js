import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanGoal, goalCoins, goalItems } from "../userscript/goal.js";
import { treesFrom } from "../userscript/fill.js";
import { PRESETS } from "../src/data.js";

const trees = treesFrom(JSON.parse(readFileSync(new URL("fixtures/device-upgrades-real.json", import.meta.url), "utf8")));
const owned = { device: "framework_12", own: { framework_12_diy: 1 } };
const UP_TO_13 = PRESETS.framework_12["Up to Framework 13"];

test("cleanGoal: nothing till the trees are in", () => {
    assert.equal(cleanGoal(null, null, owned), null);
    assert.equal(cleanGoal(null, trees, null), null);
});

// normalize keeps want >= own, so "nothing wanted" still has the DIY
const NOTHING = { device: "framework_12", want: { framework_12_diy: 1 }, goal: null, first: [] };

test("cleanGoal: no saved goal is your device with nothing new wanted, so the rent week", () => {
    const { goal, problems } = cleanGoal(null, trees, owned);
    assert.deepEqual(goal, NOTHING);
    assert.deepEqual(problems, []);
    assert.equal(goalCoins(goal, trees, owned.own), null);
});

test("cleanGoal + goalCoins: up to Framework 13 with the DIY already bought", () => {
    const { goal, own } = cleanGoal({ device: "framework_12", want: UP_TO_13 }, trees, owned);
    assert.equal(goalCoins(goal, trees, own), 3050 - 250);
    assert.deepEqual(goalItems(goal, trees, own).map((item) => item.id), ["cpu_12", "cpu_i5_1334u", "cpu_core5_320", "framework_13_upgrade"]);
});

test("cleanGoal: a node Terra dropped goes, too many RAM gets cut, both say so", () => {
    const { goal, problems } = cleanGoal({ device: "framework_12", want: { ram_12: 9, banana_12: 1 } }, trees, owned);
    assert.equal(goal.want.ram_12, 3);
    assert.equal("banana_12" in goal.want, false);
    assert.equal(problems.length, 2);
});

test("cleanGoal: a device that's gone falls back to yours", () => {
    const { goal, problems } = cleanGoal({ device: "toaster", want: { bread: 1 } }, trees, owned);
    assert.deepEqual(goal, NOTHING);
    assert.deepEqual(problems, ["there's no toaster in Terra anymore, so your goal's gone"]);
});

test("cleanGoal: wanting another device's stuff, you own nothing there", () => {
    const { goal, own } = cleanGoal({ device: "ipad_mini", want: { apple_pencil: 1 } }, trees, owned);
    assert.deepEqual(own, {});
    assert.equal(goalCoins(goal, trees, own), 750);
});

test("a custom coin goal skips the picks", () => {
    const { goal, own } = cleanGoal({ device: "framework_12", want: UP_TO_13, goal: 5000 }, trees, owned);
    assert.equal(goalCoins(goal, trees, own), 5000);
    assert.deepEqual(goalItems(goal, trees, own), []);
});

test("goalCoins: everything wanted's already owned, back to the rent week", () => {
    const { goal, own } = cleanGoal({ device: "framework_12", want: { framework_12_diy: 1 } }, trees, owned);
    assert.equal(goalCoins(goal, trees, own), null);
});
