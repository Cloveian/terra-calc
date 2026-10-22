import { test } from "node:test";
import assert from "node:assert/strict";
import { cardFor } from "../userscript/card.js";
import { stuckFrom } from "../userscript/fill.js";

const NOW = Date.parse("2026-10-20T04:00:00Z");
// apples planted last week unless told otherwise
const crops = (stage, n, { review = null, name = "Apple", seed = "apple_seed", week = "2026-W42" } = {}) =>
    Array.from({ length: n }, () => ({ seed, name, stage, review, week }));
const texts = (tasks) => tasks.map((task) => task.text);

test("before the farm's been seen it just says go look", () => {
    const plan = { t: 3, inventory: { coins: 0, plots: null, seeds: 1, baseSeeds: 10, baseKinds: { strawberry: 10 } }, m: 1.1, mGuessed: true, farm: null, stuck: null, steps: [] };
    assert.deepEqual(cardFor(plan, NOW), {
        tasks: [{ text: "go to your farm so Terra Calc can count your plots", depth: 0, done: false }],
        details: [],
    });
});

test("the 19 Oct farm, everything stuck on last week's review, farm 3 h old", () => {
    const farm = {
        plots: 36,
        empty: 0,
        crops: [...crops("review", 26, { review: "review" }), ...crops("review", 10, { review: "review", name: "Carrot", seed: "carrot_seed" })],
        seenAt: NOW - 3 * 3600000,
    };
    const plan = { t: 3, inventory: { coins: 42.6, plots: 36, seeds: 0, baseSeeds: 10, baseKinds: { strawberry: 10 } }, m: 1.2, farm, stuck: stuckFrom(farm, "2026-W43"), steps: [] };
    assert.deepEqual(cardFor(plan, NOW), {
        tasks: [],
        details: ["36 waiting on last week's review (26 apple, 10 carrot)", "(farm as of 3 h ago)"],
    });
});

test("20 Oct, Ratticus lent a plot per stuck crop", () => {
    const farm = { plots: 36, empty: 0, crops: crops("review", 36, { review: "review" }), seenAt: NOW };
    const plan = { t: 3, inventory: { coins: 0, plots: 38, unplaced: 38, seeds: 0, baseSeeds: 10, baseKinds: { strawberry: 10 } }, m: 1.1, mGuessed: true, loans: 36, farm, stuck: stuckFrom(farm, "2026-W43"), steps: [] };
    assert.ok(cardFor(plan, NOW).details.includes("36 loan plots from Ratticus, he takes them back when you harvest the stuck crops"));
});

test("the steps are the tasks, indented under what they wait on", () => {
    const farm = { plots: 36, empty: 0, crops: [], seenAt: NOW };
    const steps = [{ do: "place", n: 10 }, { do: "plantBase", n: 10 }, { do: "code", n: 7.5 }, { do: "ship", n: 10 }];
    const plan = {
        t: 3, inventory: { coins: 0, plots: 36, unplaced: 36, seeds: 0, baseSeeds: 10, baseKinds: { strawberry: 10 } }, m: 1.1, mGuessed: true,
        farm, stuck: stuckFrom(farm, "2026-W43"), target: { w: 10, cap: 10, reachable: null, out: false }, steps,
    };
    assert.deepEqual(cardFor(plan, NOW).tasks, [
        { text: "place 10 plots", depth: 0, done: false },
        { text: "plant 10 strawberry seeds", depth: 1, done: false },
        { text: "code 7.5 h", depth: 0, done: false },
        { text: "ship this week's project so the 10 grow", depth: 1, done: false },
    ]);
});

test("a goal shows before the farm's been seen, with the next pick and when it's all done", () => {
    const goal = {
        device: "Framework 12", coins: 2800, custom: false,
        milestones: [
            { name: "Core 3 304", qty: 1, now: false, week: 5 },
            { name: "RAM 16 GB", qty: 1, now: false, week: 8 },
            { name: "Framework 13", qty: 1, now: false, week: 11 },
        ],
    };
    const plan = {
        t: 3, inventory: { coins: 42.6, plots: 36, seeds: 0, baseSeeds: 10, baseKinds: { strawberry: 10 } }, m: 1.1, mGuessed: true, farm: null,
        stuck: null, target: { w: 18, cap: 18, reachable: true, out: false, route: [] }, goal, steps: [],
    };
    assert.deepEqual(cardFor(plan, NOW).details, [
        "goal: 2800 coins (Framework 12), 2758 to go",
        "next pick: Core 3 304 in Week 3",
        "all of it in Week 9",
    ]);
});

test("a goal you can't reach says the best you'd get, one you can buy now says that", () => {
    const route = [{ endCoins: 900 }, { endCoins: 11685.4 }];
    const base = { t: 3, inventory: { coins: 3000, plots: 36, seeds: 0, baseSeeds: 10, baseKinds: { strawberry: 10 } }, m: 1.1, farm: null, stuck: null, steps: [] };
    const far = cardFor({
        ...base, target: { w: 45, cap: 45, reachable: false, out: false, route },
        goal: { device: "Framework 12", coins: 20000, custom: true, milestones: [] },
    }, NOW).details;
    assert.ok(far.includes("goal: 20000 coins, 17000 to go"));
    assert.ok(far.includes("can't get all of it even at 45 h, best is 11685 coins"));
    const now = cardFor({
        ...base, target: { w: 10, cap: 10, reachable: true, out: false, route },
        goal: { device: "iPad Mini", coins: 750, custom: false, milestones: [{ name: "Apple Pencil", qty: 1, now: true, week: null }] },
    }, NOW).details;
    assert.ok(now.includes("goal: 750 coins (iPad Mini), 0 to go"));
    assert.ok(now.includes("you can buy all of it now"));
});

test("short on hours just says so, the devlog step says what to do", () => {
    const farm = { plots: 1, empty: 0, crops: crops("review", 1, { review: "short" }), seenAt: NOW };
    const plan = {
        t: 3, inventory: { coins: 0, plots: 1, seeds: 0, baseSeeds: 0, baseKinds: {} }, m: 1.1, mGuessed: true, farm,
        stuck: stuckFrom(farm, "2026-W43"), steps: [{ do: "devlog", n: 1 }],
    };
    const card = cardFor(plan, NOW);
    assert.ok(card.details.includes("1 need more approved hours (apple)"));
    assert.deepEqual(texts(card.tasks), ["devlog and reship last week's project, 1 short on hours"]);
});

test("a mixed farm only explains the stuck ones, a 5 min old farm doesn't say its age", () => {
    const farm = {
        plots: 12,
        empty: 2,
        crops: [
            ...crops("ready", 2), ...crops("ready", 1, { name: "Carrot" }), ...crops("dry", 1), ...crops("watered", 2),
            ...crops("review", 2, { review: "changes" }), ...crops("review", 2, { review: "review", week: "2026-W43" }),
        ],
        seenAt: NOW - 5 * 60000,
    };
    const plan = { t: 1, inventory: { coins: 1, plots: 12, seeds: 2, baseSeeds: 0, baseKinds: {} }, m: 1 / 0.9, farm, stuck: stuckFrom(farm, "2026-W43"), steps: [] };
    assert.deepEqual(cardFor(plan, NOW).details, ["2 waiting on you, a reviewer asked for changes (apple)"]);
});

test("a review reason it doesn't know still shows", () => {
    const farm = { plots: 1, empty: 0, crops: crops("review", 1, { review: "frozen" }), seenAt: NOW };
    const plan = { t: 3, inventory: { coins: 0, plots: 1, seeds: 0, baseSeeds: 0, baseKinds: {} }, m: 1.1, mGuessed: true, farm, stuck: stuckFrom(farm, null), steps: [] };
    assert.deepEqual(cardFor(plan, NOW).details, ["1 stuck (frozen) (apple)"]);
});

test("a crop with no name goes by its seed id", () => {
    const farm = { plots: 1, empty: 0, crops: crops("review", 1, { review: "review", name: "", seed: "mystery_seed" }), seenAt: NOW };
    const plan = { t: 3, inventory: { coins: 0, plots: 1, seeds: 0, baseSeeds: 0, baseKinds: {} }, m: 1.1, mGuessed: true, farm, stuck: stuckFrom(farm, null), steps: [] };
    assert.deepEqual(cardFor(plan, NOW).details, ["1 waiting on last week's review (mystery_seed)"]);
});

test("the code step says how many days are left and the h a day, under a day just the hours", () => {
    const plan = (weekEnds) => ({
        t: 3, inventory: { coins: 0, plots: 10, seeds: 0, baseSeeds: 0, baseKinds: {} }, m: 1.1,
        farm: { plots: 10, empty: 0, crops: [], seenAt: NOW }, stuck: null, steps: [{ do: "code", n: 28 }], weekEnds,
    });
    const code = (weekEnds) => cardFor(plan(weekEnds), NOW).tasks[0].text;
    assert.equal(code(NOW + 3.5 * 86400000), "code 28 h (3 days left, about 8 h a day)");
    assert.equal(code(NOW + 5 * 3600000), "code 28 h (5 h left in the week)");
    assert.equal(code(NOW + 20 * 60000), "code 28 h (under an hour left in the week)");
    assert.equal(code(null), "code 28 h");
    assert.equal(code(NOW - 1), "code 28 h");
    const ticked = { ...plan(NOW + 3.5 * 86400000), steps: [{ do: "code", n: 28, done: true }] };
    assert.equal(cardFor(ticked, NOW).tasks[0].text, "code 28 h");
});

test("free seeds go by name, both kinds when prep carrots are still good", () => {
    const farm = { plots: 16, empty: 16, crops: [], seenAt: NOW };
    const plan = {
        t: 3, inventory: { coins: 0, plots: 16, seeds: 0, baseSeeds: 16, baseKinds: { carrot: 6, strawberry: 10 } }, m: 1.1, mGuessed: true,
        farm, stuck: null, steps: [{ do: "plantBase", n: 16 }],
    };
    assert.deepEqual(texts(cardFor(plan, NOW).tasks), ["plant 16 carrot or strawberry seeds"]);
});
