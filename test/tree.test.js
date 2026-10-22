import { test } from "node:test";
import assert from "node:assert/strict";
import { TREES, PRESETS } from "../src/data.js";
import {
    withPrereqs, nodeCost, nextPrice, limitOf, goalCost, nodeHours,
    dependentsOf, unpick, clampToLimits, normalize, buyOrder, displayOrder, treeLayout, waitsOn, prioFrom,
} from "../src/tree.js";

const fw = TREES.framework_12;
const ipad = TREES.ipad_mini;
const galaxy = TREES.galaxy_tab_s10_fe;
const node = (tree, id) => tree.nodes.find((n) => n.id === id);
const everything = (tree) => Object.fromEntries(tree.nodes.map((n) => [n.id, 1]));

test("nodeCost", () => {
    assert.equal(nodeCost(node(fw, "ram_12"), 3), 4150);
    assert.equal(nodeCost(node(fw, "ram_12"), 2), 2050);
    assert.equal(nodeCost(node(fw, "ssd_12"), 2), 3000);
    assert.equal(nodeCost(node(fw, "fancy_expansion_card_12"), 4), 400);
    assert.equal(nodeCost(node(fw, "ram_12"), 3, 1), 3400); // own 1, want 3
    assert.equal(nodeCost(node(fw, "ram_12"), 1, 2), 0); // own more than wanted
});

test("limitOf", () => {
    const fancy = node(fw, "fancy_expansion_card_12");
    assert.equal(limitOf(fancy, {}), 4);
    assert.equal(limitOf(fancy, { expansion_card_12: 1 }), 5);
    assert.equal(limitOf(node(fw, "expansion_card_12")), Infinity);
    assert.equal(limitOf(node(fw, "ram_12")), 3);
    assert.equal(limitOf(node(fw, "stylus_12")), 1);
});

test("goalCost of presets and whole trees", () => {
    assert.equal(goalCost(fw, PRESETS.framework_12["Up to Framework 13"]), 3050);
    assert.equal(goalCost(fw, PRESETS.framework_12["Max 12"]), 10700);
    assert.equal(goalCost(fw, PRESETS.framework_12["Max 13"]), 13850);
    assert.equal(goalCost(ipad, everything(ipad)), 7350);
    assert.equal(goalCost(galaxy, everything(galaxy)), 4400);
});

test("goalCost minus what's owned", () => {
    const owned = { framework_12_diy: 1, cpu_12: 1, ram_12: 1 };
    assert.equal(goalCost(fw, PRESETS.framework_12["Max 13"], owned), 13850 - 250 - 400 - 750);
});

test("presets use real ids and stay within limits", () => {
    for (const [device, presets] of Object.entries(PRESETS)) {
        const tree = TREES[device];
        for (const preset of Object.values(presets)) {
            assert.deepEqual(clampToLimits(tree, preset), preset);
            for (const id of Object.keys(preset)) assert.ok(node(tree, id), `${device}: ${id}`);
        }
    }
});

test("preset costs", () => {
    const fwPresets = PRESETS.framework_12;
    assert.equal(goalCost(fw, fwPresets["Max 12 (no USB card)"]), 10600);
    assert.equal(goalCost(fw, fwPresets["Max 13 (no USB card)"]), 13750);
    assert.equal(goalCost(ipad, PRESETS.ipad_mini.Everything), 7350);
    assert.equal(goalCost(galaxy, PRESETS.galaxy_tab_s10_fe.Everything), 4400);
});

test("withPrereqs", () => {
    assert.deepEqual(withPrereqs(fw, { cpu_ryzen_ai7_350: 1 }), {
        cpu_ryzen_ai7_350: 1, framework_13_upgrade: 1, cpu_core5_320: 1,
        cpu_i5_1334u: 1, cpu_12: 1, framework_12_diy: 1,
    });
    assert.deepEqual(withPrereqs(ipad, { magic_keyboard_folio: 1 }), {
        magic_keyboard_folio: 1, smart_folio: 1, ipad_air_11: 1,
    });
    assert.deepEqual(withPrereqs(fw, { ram_12: 3 }), { ram_12: 3, framework_12_diy: 1 }); // keeps qty
    assert.deepEqual(withPrereqs(fw, { ram_12: 0 }), { ram_12: 0 }); // 0 = not picked
});

test("every requires points at a real node in the same tree", () => {
    for (const tree of Object.values(TREES)) {
        for (const n of tree.nodes) {
            for (const req of n.requires) assert.ok(node(tree, req), `${n.id} requires ${req}`);
        }
    }
});

test("nodeHours", () => {
    assert.equal(nodeHours(250, 1), 10); // 250 / (30 - 5)
});

test("goalCost with Max 13 and DIY + Core 3 owned (goal-picker.md)", () => {
    assert.equal(goalCost(fw, PRESETS.framework_12["Max 13"], { framework_12_diy: 1, cpu_12: 1 }), 13200);
});

test("nextPrice", () => {
    assert.equal(nextPrice(node(fw, "ram_12"), 0), 750);
    assert.equal(nextPrice(node(fw, "ram_12"), 2), 2100);
    assert.equal(nextPrice(node(fw, "ram_12"), 3), null); // maxed
    assert.equal(nextPrice(node(fw, "expansion_card_12"), 7), 100);
});

test("dependentsOf and unpick", () => {
    assert.deepEqual(dependentsOf(fw, "cpu_core5_320").sort(), ["cpu_ryzen_ai7_350", "display_2k8_12", "framework_13_upgrade"]);
    assert.deepEqual(dependentsOf(ipad, "ipad_air_11").sort(), ["ipad_air_13", "ipad_pro_11", "magic_keyboard_folio"]);
    const after = unpick(fw, PRESETS.framework_12["Max 13"], "cpu_core5_320");
    for (const gone of ["cpu_core5_320", "framework_13_upgrade", "display_2k8_12", "cpu_ryzen_ai7_350"]) {
        assert.equal(after[gone], undefined, gone);
    }
    assert.equal(after.ram_12, 3); // unrelated picks stay
    assert.equal(after.cpu_i5_1334u, 1);
});

test("clampToLimits", () => {
    assert.deepEqual(clampToLimits(fw, { expansion_card_12: 0, fancy_expansion_card_12: 5 }), { expansion_card_12: 0, fancy_expansion_card_12: 4 });
    assert.deepEqual(clampToLimits(fw, { expansion_card_12: 2, fancy_expansion_card_12: 6 }), { expansion_card_12: 2, fancy_expansion_card_12: 6 });
    assert.deepEqual(clampToLimits(fw, { ram_12: 9, stylus_12: 2 }), { ram_12: 3, stylus_12: 1 });
});

test("normalize", () => {
    // owning something means owning its prerequisites, and want is at least own
    assert.deepEqual(normalize(fw, { cpu_12: 1 }, { ram_12: 2 }), {
        own: { cpu_12: 1, framework_12_diy: 1 },
        want: { ram_12: 2, framework_12_diy: 1, cpu_12: 1 },
    });
    // zeros dropped, limits applied to both
    assert.deepEqual(normalize(fw, { ram_12: 0 }, { fancy_expansion_card_12: 7 }), {
        own: {},
        want: { fancy_expansion_card_12: 4 },
    });
});

test("buyOrder: prerequisites first, then cheapest", () => {
    const order = buyOrder(fw, PRESETS.framework_12["Up to Framework 13"]).map((item) => item.id);
    assert.deepEqual(order, ["framework_12_diy", "cpu_12", "cpu_i5_1334u", "cpu_core5_320", "framework_13_upgrade"]);

    const max13 = buyOrder(fw, PRESETS.framework_12["Max 13"]);
    assert.equal(max13[0].id, "expansion_card_12"); // 100, cheapest thing with no prerequisites
    assert.equal(max13.reduce((sum, item) => sum + item.cost, 0), 13850);
    const position = (id) => max13.findIndex((item) => item.id === id);
    assert.ok(position("framework_12_diy") < position("ram_12"));
    assert.ok(position("framework_13_upgrade") < position("cpu_ryzen_ai7_350"));
});

test("buyOrder: owned things are skipped and count as done", () => {
    const order = buyOrder(fw, { framework_12_diy: 1, ram_12: 3 }, { framework_12_diy: 1, ram_12: 1 });
    assert.deepEqual(order, [
        { key: "ram_12:2", id: "ram_12", unit: 2, name: "RAM 32 GB", qty: 1, cost: 1300 },
        { key: "ram_12:3", id: "ram_12", unit: 3, name: "RAM 48 GB", qty: 1, cost: 2100 },
    ]);
});

test("buyOrder: a priority pulls a pick (and its prerequisites) forward", () => {
    const order = buyOrder(fw, PRESETS.framework_12["Max 13"], {}, { cpu_ryzen_ai7_350: 1 }).map((item) => item.id);
    assert.deepEqual(order.slice(0, 6), [
        "framework_12_diy", "cpu_12", "cpu_i5_1334u", "cpu_core5_320", "framework_13_upgrade", "cpu_ryzen_ai7_350",
    ]);
});

test("buyOrder: priorities on picks you don't want do nothing", () => {
    const want = PRESETS.framework_12["Up to Framework 13"];
    assert.deepEqual(buyOrder(fw, want, {}, { cpu_ryzen_ai7_350: 1 }), buyOrder(fw, want));
    // Max 12 has no FW13: wanting the Ryzen first must not pull DIY ahead of the 100-coin USB card
    assert.equal(buyOrder(fw, PRESETS.framework_12["Max 12"], {}, { cpu_ryzen_ai7_350: 1 })[0].id, "expansion_card_12");
});

test("buyOrder: tiers are rows of their own, stacking cards aren't", () => {
    const keys = buyOrder(fw, { framework_12_diy: 1, ram_12: 3, fancy_expansion_card_12: 4 }).map((item) => item.key);
    // all 4 Fancy cards are one 400 coin row, so DIY at 250 goes first
    assert.deepEqual(keys, ["framework_12_diy", "fancy_expansion_card_12", "ram_12:1", "ram_12:2", "ram_12:3"]);
});

test("buyOrder: a tier's priority pulls the tiers under it along, not the ones above", () => {
    const want = { framework_12_diy: 1, ram_12: 3, ssd_12: 2 };
    // RAM 32 GB first: 16 GB has to come before it, 48 GB stays wherever cheapest puts it
    const keys = buyOrder(fw, want, {}, { "ram_12:2": 1 }).map((item) => item.key);
    assert.deepEqual(keys, ["framework_12_diy", "ram_12:1", "ram_12:2", "ssd_12:1", "ssd_12:2", "ram_12:3"]);
});

test("buyOrder: a plain id counts for every tier, blanks go after numbers, ties stay cheapest first", () => {
    const want = { framework_12_diy: 1, ram_12: 2, ssd_12: 2 };
    const keys = (prio) => buyOrder(fw, want, {}, prio).map((item) => item.key);
    assert.deepEqual(keys({ ssd_12: 1 }), ["framework_12_diy", "ssd_12:1", "ssd_12:2", "ram_12:1", "ram_12:2"]);
    assert.deepEqual(keys({ "ssd_12:2": 2, "ram_12:2": 2 }), keys({}));
});

test("waitsOn: prerequisites further up, and lower tiers of the same node", () => {
    const row = (key) => buyOrder(fw, { framework_12_diy: 1, ram_12: 2, cpu_12: 1 }).find((item) => item.key === key);
    assert.ok(waitsOn(fw, row("ram_12:2"), row("ram_12:1")));
    assert.ok(!waitsOn(fw, row("ram_12:1"), row("ram_12:2")));
    assert.ok(waitsOn(fw, row("ram_12:2"), row("framework_12_diy")));
    assert.ok(!waitsOn(fw, row("cpu_12"), row("ram_12:1")));
});

test("prioFrom: the site's arrow order as numbers", () => {
    assert.deepEqual(prioFrom(["ram_12:2", "cpu_12"]), { "ram_12:2": 1, cpu_12: 2 });
});

test("displayOrder puts children under their first prerequisite", () => {
    const rows = displayOrder(ipad).map((row) => `${"  ".repeat(row.depth)}${row.node.id}`);
    assert.deepEqual(rows, [
        "apple_pencil", "  apple_pencil_pro",
        "ipad_air_11", "  ipad_air_13", "    ipad_pro_11",
        "smart_folio", "  magic_keyboard_folio",
    ]);
    const keyboard = displayOrder(ipad).find((row) => row.node.id === "magic_keyboard_folio");
    assert.deepEqual(keyboard.alsoNeeds, ["ipad_air_11"]);
    for (const tree of Object.values(TREES)) {
        assert.equal(displayOrder(tree).length, tree.nodes.length); // nothing lost or doubled
    }
});

test("treeLayout: no two cards overlap, everything inside the canvas", () => {
    const card = { w: 168, h: 150 };
    for (const [device, tree] of Object.entries(TREES)) {
        const layout = treeLayout(tree, card);
        const centres = Object.entries(layout.centres);
        assert.equal(centres.length, tree.nodes.length + 1, device); // nodes + root
        for (const [id, c] of centres) {
            assert.ok(c.x - card.w / 2 >= 0 && c.x + card.w / 2 <= layout.width, `${device} ${id} x`);
            assert.ok(c.y - card.h / 2 >= 0 && c.y + card.h / 2 <= layout.height, `${device} ${id} y`);
        }
        for (let i = 0; i < centres.length; i++) {
            for (let j = i + 1; j < centres.length; j++) {
                const [a, ca] = centres[i];
                const [b, cb] = centres[j];
                const apart = Math.abs(ca.x - cb.x) >= card.w || Math.abs(ca.y - cb.y) >= card.h;
                assert.ok(apart, `${device}: ${a} overlaps ${b}`);
            }
        }
    }
});

test("treeLayout: stays compact (fits a laptop-width page)", () => {
    // i5 and Core 5 are only 25 apart sideways in Terra's layout; separating them sideways
    // instead of up/down once made the Framework tree ~7× wider
    for (const tree of Object.values(TREES)) {
        assert.ok(treeLayout(tree, { w: 168, h: 150 }).width < 1150, tree.device);
    }
});

test("treeLayout: keeps Terra's shape (root at the bottom, Framework 13 above Core 5)", () => {
    const { centres } = treeLayout(fw, { w: 168, h: 150 });
    assert.ok(centres.root.y > centres.framework_12_diy.y);
    assert.ok(centres.framework_13_upgrade.y < centres.cpu_core5_320.y);
    assert.ok(centres.ram_12.x < centres.framework_12_diy.x && centres.framework_12_diy.x < centres.ssd_12.x);
});

test("treeLayout: edges go to each prerequisite, or the device for top-level nodes", () => {
    const { edges } = treeLayout(ipad, { w: 168, h: 150 });
    assert.equal(edges.length, 8); // 7 nodes, Magic Keyboard Folio has two prerequisites
    assert.deepEqual(edges.filter(([from]) => from === "magic_keyboard_folio"), [
        ["magic_keyboard_folio", "smart_folio"], ["magic_keyboard_folio", "ipad_air_11"],
    ]);
    assert.ok(edges.some(([from, to]) => from === "apple_pencil" && to === "root"));
});

test("totals (RAM/SSD): one per tier plus what you start with", () => {
    for (const tree of Object.values(TREES)) {
        for (const n of tree.nodes.filter((node) => node.totals)) {
            assert.equal(n.totals.length, n.tiers.length + 1, n.id);
        }
    }
    assert.equal(node(fw, "ram_12").totals.at(-1), "48 GB");
    assert.equal(node(fw, "ssd_12").totals.at(-1), "2 TB");
});
