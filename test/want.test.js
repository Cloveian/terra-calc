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
        stepper: false, text: "want", canAdd: true, canRemove: false, needed: false, rows: [],
    });
});

test("wantBit: owned limit-1 things get nothing, Terra already says owned", () => {
    assert.equal(wantBit(fw, own, own, "framework_12_diy"), null);
    assert.equal(wantBit(fw, own, own, "not_a_node"), null);
});

test("wantBit: RAM's a stepper, and Core 3 is 'needed' when something past it is wanted", () => {
    const want = { ...own, ram_12: 2, cpu_12: 1, cpu_i5_1334u: 1 };
    const ram = wantBit(fw, own, want, "ram_12");
    assert.deepEqual([ram.stepper, ram.text, ram.canAdd, ram.canRemove, ram.needed], [true, "want 2", true, true, false]);
    assert.equal(wantBit(fw, own, want, "cpu_12").needed, true);
    assert.equal(wantBit(fw, own, want, "cpu_i5_1334u").needed, false);
    assert.equal(wantBit(fw, own, { ...want, ram_12: 3 }, "ram_12").canAdd, false);
});

test("wantBit: a box per RAM tier, with the plan's week and hours, a plain RAM number fills both", () => {
    const want = { ...own, ram_12: 2, cpu_12: 1 };
    const plan = new Map([
        ["ram_12:1", { now: false, week: 6, hours: 14 }],
        ["ram_12:2", { now: false, week: null, hours: null }],
        ["cpu_12", { now: true, week: null, hours: 10 }],
    ]);
    assert.deepEqual(wantBit(fw, own, want, "ram_12", plan, { "ram_12:2": 1 }).rows, [
        { key: "ram_12:1", label: "RAM 16 GB", prio: null, when: "after Week 4, 14 h/wk" },
        { key: "ram_12:2", label: "RAM 32 GB", prio: 1, when: "doesn't fit" },
    ]);
    assert.deepEqual(wantBit(fw, own, want, "ram_12", plan, { ram_12: 3 }).rows.map((row) => row.prio), [3, 3]);
    assert.deepEqual(wantBit(fw, own, want, "cpu_12", plan).rows, [{ key: "cpu_12", label: null, prio: null, when: "can buy now" }]);
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
