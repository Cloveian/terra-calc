import { test } from "node:test";
import assert from "node:assert/strict";
import { clean, toHash, defaults, formatSelection, canAdd } from "../src/state.js";
import { TREES } from "../src/data.js";

const TODAY = "2026-10-10";
const raw = (hash) => Object.fromEntries(new URLSearchParams(hash));

test("empty hash gives defaults, no problems", () => {
    assert.deepEqual(clean({}, TODAY), { state: defaults(TODAY), problems: [] });
});

test("a good hash round-trips", () => {
    const hash = "coins=4&plots=13&seeds=3&m=1.2&cap=20&date=2026-10-09&goal=500&device=framework_12&own=framework_12_diy:1&want=framework_12_diy:1,ram_12:2&first=ram_12";
    const { state, problems } = clean(raw(hash), TODAY);
    assert.deepEqual(problems, []);
    assert.equal(state.goal, 500);
    assert.deepEqual(state.want, { framework_12_diy: 1, ram_12: 2 });
    assert.deepEqual(clean(raw(toHash(state, TODAY)), TODAY).state, state);
});

test("toHash leaves out today's date and empty things, keeps : and , readable", () => {
    const state = { ...defaults(TODAY), want: { ram_12: 2, framework_12_diy: 1 } };
    assert.equal(toHash(state, TODAY), "coins=25&plots=10&seeds=0&m=1&cap=10&device=framework_12&want=ram_12:2,framework_12_diy:1");
});

test("bad numbers are fixed and reported", () => {
    const { state, problems } = clean(raw("coins=lots&plots=99&seeds=-4&m=7&cap=3"), TODAY);
    assert.equal(state.coins, 25);
    assert.equal(state.plots, 45);
    assert.equal(state.seeds, 0);
    assert.equal(state.m, 1.5);
    assert.equal(state.cap, 10);
    assert.equal(problems.length, 5);
});

test("bad tree picks: unknown ids ignored, over-limit clamped, prerequisites added quietly", () => {
    const { state, problems } = clean(raw("want=ram_12:9,banana:1,stylus_12:x,cpu_ryzen_ai7_350"), TODAY);
    assert.equal(state.want.ram_12, 3);
    assert.equal(state.want.stylus_12, undefined);
    assert.equal(state.want.framework_13_upgrade, 1); // prerequisite of the Ryzen
    assert.equal(problems.length, 3); // banana, stylus_12:x, RAM over the limit
});

test("unknown device falls back to Framework, and picks are read against that tree", () => {
    const { state, problems } = clean(raw("device=toaster&want=apple_pencil"), TODAY);
    assert.equal(state.device, "framework_12");
    assert.deepEqual(state.want, {});
    assert.equal(problems.length, 2);
});

test("blank goal means 'use the tree'", () => {
    assert.equal(clean({ goal: "" }, TODAY).state.goal, null);
    assert.equal(clean({ goal: "0" }, TODAY).state.goal, 0);
});

test("bad date is reported", () => {
    const { state, problems } = clean({ date: "2026-13-45" }, TODAY);
    assert.equal(state.date, TODAY);
    assert.equal(problems.length, 1);
});

test("formatSelection drops zeros", () => {
    assert.equal(formatSelection({ ram_12: 0, ssd_12: 2 }), "ssd_12:2");
});

test("canAdd respects limits", () => {
    const fw = TREES.framework_12;
    assert.equal(canAdd(fw, { fancy_expansion_card_12: 4 }, "fancy_expansion_card_12"), false);
    assert.equal(canAdd(fw, { fancy_expansion_card_12: 4, expansion_card_12: 1 }, "fancy_expansion_card_12"), true);
    assert.equal(canAdd(fw, { ram_12: 3 }, "ram_12"), false);
});
