import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { wantBit, changeWant } from "../userscript/want.js";
import { treesFrom } from "../userscript/fill.js";

const trees = treesFrom(JSON.parse(readFileSync(new URL("fixtures/device-upgrades-real.json", import.meta.url), "utf8")));
const fw = trees.framework_12;
const own = { framework_12_diy: 1 };

test("wantBit: a limit-1 thing you don't have is a toggle", () => {
    assert.deepEqual(wantBit(fw, own, own, "cpu_12"), {
        stepper: false, text: "want", canAdd: true, canRemove: false, needed: false, when: null,
    });
});

test("wantBit: owned limit-1 things get nothing, Terra already says owned", () => {
    assert.equal(wantBit(fw, own, own, "framework_12_diy"), null);
    assert.equal(wantBit(fw, own, own, "not_a_node"), null);
});

test("wantBit: RAM's a stepper, and Core 3 is 'needed' when something past it is wanted", () => {
    const want = { ...own, ram_12: 2, cpu_12: 1, cpu_i5_1334u: 1 };
    const ram = wantBit(fw, own, want, "ram_12", { now: false, week: 6 });
    assert.deepEqual(ram, { stepper: true, text: "want 2", canAdd: true, canRemove: true, needed: false, when: "Week 4" });
    assert.equal(wantBit(fw, own, want, "cpu_12").needed, true);
    assert.equal(wantBit(fw, own, want, "cpu_i5_1334u").needed, false);
    assert.equal(wantBit(fw, own, { ...want, ram_12: 3 }, "ram_12").canAdd, false);
    assert.equal(wantBit(fw, own, want, "cpu_12", { now: true, week: null }).when, "can buy now");
    assert.equal(wantBit(fw, own, want, "cpu_12", { now: false, week: null }).when, "doesn't fit");
});

test("changeWant: picking Framework 13 brings the cpus along", () => {
    const { want, removed } = changeWant(fw, own, own, "framework_13_upgrade", 1);
    assert.deepEqual(want, { framework_12_diy: 1, framework_13_upgrade: 1, cpu_core5_320: 1, cpu_i5_1334u: 1, cpu_12: 1 });
    assert.deepEqual(removed, []);
});

test("changeWant: taking Core 3 out takes out everything that needs it, and says so", () => {
    const start = changeWant(fw, own, own, "framework_13_upgrade", 1).want;
    const { want, removed } = changeWant(fw, own, start, "cpu_12", -1);
    assert.deepEqual(want, own);
    assert.deepEqual(removed.sort(), ["cpu_core5_320", "cpu_i5_1334u", "framework_13_upgrade"]);
});

test("changeWant: not under what you own, not over the limit", () => {
    assert.deepEqual(changeWant(fw, own, own, "framework_12_diy", -1), { want: own, removed: [] });
    const full = { ...own, ram_12: 3 };
    assert.deepEqual(changeWant(fw, own, full, "ram_12", 1), { want: full, removed: [] });
});

test("changeWant: one less USB card cuts the Fancy cards down to fit", () => {
    const want = { ...own, expansion_card_12: 1, fancy_expansion_card_12: 5 };
    const result = changeWant(fw, own, want, "expansion_card_12", -1);
    assert.equal(result.want.fancy_expansion_card_12, 4);
    assert.deepEqual(result.removed, ["fancy_expansion_card_12"]);
});
