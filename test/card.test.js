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
        tasks: [{ text: "go to your island", depth: 0, done: false }],
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
        details: ["36 in review (26 apple, 10 carrot)", "(farm as of 3h ago)"],
    });
});

test("20 Oct, Ratticus lent a plot per stuck crop", () => {
    const farm = { plots: 36, empty: 0, crops: crops("review", 36, { review: "review" }), seenAt: NOW };
    const plan = { t: 3, inventory: { coins: 0, plots: 38, unplaced: 38, seeds: 0, baseSeeds: 10, baseKinds: { strawberry: 10 } }, m: 1.1, mGuessed: true, loans: 36, farm, stuck: stuckFrom(farm, "2026-W43"), steps: [] };
    assert.ok(cardFor(plan, NOW).details.includes("36 loan plots from Ratticus"));
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
        { text: "code 7.5h", depth: 0, done: false },
        { text: "ship this week's project", depth: 1, done: false },
    ]);
});

test("a mix with bonus seeds gets a line, biggest first, apples only doesn't", () => {
    const farm = { plots: 36, empty: 0, crops: [], seenAt: NOW };
    const plan = (mix) => ({
        t: 5, inventory: { coins: 300, plots: 36, seeds: 0, baseSeeds: 10, baseKinds: { strawberry: 10 } }, m: 1, farm, steps: [],
        target: { w: 30, cap: 30, reachable: null, out: false, mix },
        crops: { bokchoy: { name: "Bok Choy", buy: 10, sell: 37, water: 1 } },
    });
    assert.deepEqual(cardFor(plan({ eggplant: 6, apple: 8, bokchoy: 0 }), NOW).details, ["today's best: 8 apple + 6 eggplant"], "not in crops, so it's the id");
    assert.deepEqual(cardFor(plan({ apple: 3, bokchoy: 5 }), NOW).details, ["today's best: 5 bok choy + 3 apple"]);
    assert.deepEqual(cardFor(plan({ apple: 10 }), NOW).details, []);
    assert.deepEqual(cardFor(plan(null), NOW).details, []);
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
        stuck: null, target: { w: 18, cap: 18, reachable: true, out: false, route: [] }, goal, steps: [], selling: { crops: 0, coins: 0 },
    };
    assert.deepEqual(cardFor(plan, NOW).details, [
        "goal: 2800 coins (Framework 12), 2758 to go",
        { bar: { coins: 42.6, selling: 0, goal: 2800 } },
        "next pick: Core 3 304 in Week 3",
        "all of it in Week 9",
    ]);
});

test("a goal you can't reach says the best you'd get, one you can buy now says that", () => {
    const route = [{ endCoins: 900 }, { endCoins: 11685.4 }];
    const base = { t: 3, inventory: { coins: 3000, plots: 36, seeds: 0, baseSeeds: 10, baseKinds: { strawberry: 10 } }, m: 1.1, farm: null, stuck: null, steps: [], selling: { crops: 0, coins: 0 } };
    const far = cardFor({
        ...base, target: { w: 45, cap: 45, reachable: false, out: false, route },
        goal: { device: "Framework 12", coins: 20000, custom: true, milestones: [] },
    }, NOW).details;
    assert.ok(far.includes("goal: 20000 coins, 17000 to go"));
    assert.ok(far.includes("out of reach, max 11685 coins"));
    assert.ok(!far.some((line) => String(line).startsWith("not on my days")));
    const short = cardFor({
        ...base, target: { w: 20, cap: null, reachable: false, flat: 31, out: false, route },
        goal: { device: "Framework 12", coins: 20000, custom: true, milestones: [] },
    }, NOW).details;
    assert.ok(short.includes("not on my days, a flat 31 h/week would do it"));
    const now = cardFor({
        ...base, target: { w: 10, cap: 10, reachable: true, out: false, route },
        goal: { device: "iPad Mini", coins: 750, custom: false, milestones: [{ name: "Apple Pencil", qty: 1, total: 750, now: true, week: null }] },
    }, NOW).details;
    assert.ok(now.includes("goal: 750 coins (iPad Mini), 0 to go"));
    assert.ok(now.includes("all affordable now"));
});

test("the first 2 days of a week say how last week went, at least, it's only as of when it was last seen", () => {
    // NOW is a day into the week that started 19 Oct 04:00 UTC
    const plan = (lastWeek, now = NOW) => cardFor({
        t: 3, inventory: { coins: 0, plots: 10, seeds: 0, baseSeeds: 0, baseKinds: {} }, m: 1, farm: null, stuck: null, steps: [],
        weekEnds: Date.parse("2026-10-26T03:59:59.999Z"), lastWeek,
    }, now).details;
    assert.ok(plan({ coded: 31.24, seenAt: Date.parse("2026-10-19T01:00:00Z"), w: 40 }).includes("last week: 31.2h+ (plan 40h)"));
    assert.ok(plan({ coded: 20, seenAt: Date.parse("2026-10-16T12:00:00Z"), w: null }).includes("last week: 20h+"));
    assert.ok(plan({ coded: 19.96, seenAt: Date.parse("2026-10-16T12:00:00Z"), w: null }).includes("last week: 19.9h+"));
    assert.ok(!plan({ coded: 20, seenAt: NOW, w: 40 }, NOW + 2 * 86400000).some((line) => String(line).startsWith("last week")));
});

test("crops waiting to sell come off what's to go, and get a sell step", () => {
    const plan = {
        t: 3, inventory: { coins: 500, plots: 20, seeds: 0, baseSeeds: 0, baseKinds: {} }, m: 1, farm: null, stuck: null,
        target: { w: 10, cap: 10, reachable: true, out: false, route: [{ endCoins: 900 }] },
        selling: { crops: 10, coins: 300 },
        goal: { device: "iPad Mini", coins: 750, custom: false, milestones: [{ name: "Apple Pencil", qty: 1, total: 750, now: true, week: null }] },
        steps: [{ do: "harvest", n: 4 }, { do: "sell", n: 10, coins: 300 }, { do: "buyPlots", n: 2 }],
    };
    const { tasks, details } = cardFor(plan, NOW);
    assert.ok(details.includes("goal: 750 coins (iPad Mini), 0 to go after selling"));
    assert.ok(details.includes("all affordable after selling"));
    assert.deepEqual(tasks.slice(0, 3).map(({ text, depth }) => [text, depth]), [
        ["harvest 4", 0],
        ["sell 10 crops (~300 coins)", 1],
        ["buy 2 plots", 2],
    ]);
});

test("short on hours just says so, the devlog step says what to do", () => {
    const farm = { plots: 1, empty: 0, crops: crops("review", 1, { review: "short" }), seenAt: NOW };
    const plan = {
        t: 3, inventory: { coins: 0, plots: 1, seeds: 0, baseSeeds: 0, baseKinds: {} }, m: 1.1, mGuessed: true, farm,
        stuck: stuckFrom(farm, "2026-W43"), steps: [{ do: "devlog", n: 1 }],
    };
    const card = cardFor(plan, NOW);
    assert.ok(card.details.includes("1 short on hours (apple)"));
    assert.deepEqual(texts(card.tasks), ["devlog and reship last week's project"]);
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
    assert.deepEqual(cardFor(plan, NOW).details, ["2 need changes (apple)"]);
});

test("a review reason it doesn't know still shows", () => {
    const farm = { plots: 1, empty: 0, crops: crops("review", 1, { review: "frozen" }), seenAt: NOW };
    const plan = { t: 3, inventory: { coins: 0, plots: 1, seeds: 0, baseSeeds: 0, baseKinds: {} }, m: 1.1, mGuessed: true, farm, stuck: stuckFrom(farm, null), steps: [] };
    assert.deepEqual(cardFor(plan, NOW).details, ["1 stuck (frozen) (apple)"]);
});

test("a crop with no name goes by its seed id", () => {
    const farm = { plots: 1, empty: 0, crops: crops("review", 1, { review: "review", name: "", seed: "mystery_seed" }), seenAt: NOW };
    const plan = { t: 3, inventory: { coins: 0, plots: 1, seeds: 0, baseSeeds: 0, baseKinds: {} }, m: 1.1, mGuessed: true, farm, stuck: stuckFrom(farm, null), steps: [] };
    assert.deepEqual(cardFor(plan, NOW).details, ["1 in review (mystery_seed)"]);
});

test("the code step says the h a day, under a day just the hours left", () => {
    const plan = (weekEnds) => ({
        t: 3, inventory: { coins: 0, plots: 10, seeds: 0, baseSeeds: 0, baseKinds: {} }, m: 1.1,
        farm: { plots: 10, empty: 0, crops: [], seenAt: NOW }, stuck: null, steps: [{ do: "code", n: 28 }], weekEnds,
    });
    const code = (weekEnds) => cardFor(plan(weekEnds), NOW).tasks[0].text;
    assert.equal(code(NOW + 3.5 * 86400000), "code 28h (8h/d)");
    assert.equal(code(NOW + 5 * 3600000), "code 28h (5h left in week)");
    assert.equal(code(NOW + 20 * 60000), "code 28h (<1h left in week)");
    assert.equal(code(null), "code 28h");
    assert.equal(code(NOW - 1), "code 28h");
    // typed today on the calendar
    assert.equal(cardFor({ ...plan(NOW + 3.5 * 86400000), todayHours: 4 }, NOW).tasks[0].text, "code 28h (4h today)");
    assert.equal(cardFor({ ...plan(NOW + 3.5 * 86400000), todayHours: 40 }, NOW).tasks[0].text, "code 28h (28h today)");
    assert.equal(cardFor({ ...plan(NOW + 5 * 3600000), todayHours: 4 }, NOW).tasks[0].text, "code 28h (5h left in week)");
    const ticked = { ...plan(NOW + 3.5 * 86400000), steps: [{ do: "code", n: 28, done: true }] };
    assert.equal(cardFor(ticked, NOW).tasks[0].text, "code 28h");
});

test("devlog and ship count down to the week's end once it's under 2 days away", () => {
    const plan = (weekEnds, done = false) => ({
        t: 3, inventory: { coins: 0, plots: 10, seeds: 0, baseSeeds: 0, baseKinds: {} }, m: 1,
        farm: { plots: 10, empty: 0, crops: [], seenAt: NOW }, stuck: null, weekEnds,
        steps: [{ do: "claim", n: 2.2, done }, { do: "code", n: 3 }, { do: "ship", n: 10, done }],
    });
    const lines = (weekEnds, done) => texts(cardFor(plan(weekEnds, done), NOW).tasks);
    assert.deepEqual(lines(NOW + 3.5 * 86400000), ["devlog 2.2h", "code 3h (0.9h/d)", "ship this week's project"]);
    assert.deepEqual(lines(NOW + 30 * 3600000), ["devlog 2.2h (1d 6h left)", "code 3h (2.4h/d)", "ship this week's project (1d 6h left)"]);
    assert.deepEqual(lines(NOW + 30 * 3600000, true), ["devlog 2.2h", "code 3h (2.4h/d)", "ship this week's project"]);
    assert.deepEqual(lines(null), ["devlog 2.2h", "code 3h", "ship this week's project"]);
});

test("per seed steps say which seed, the shop's name first, and the devlog step just has the hours", () => {
    const farm = { plots: 14, empty: 14, crops: [], seenAt: NOW };
    const plan = {
        t: 3, inventory: { coins: 0, plots: 14, seeds: 0, baseSeeds: 0, baseKinds: {} }, m: 1, farm, stuck: null,
        crops: { eggplant: { name: "Eggplant" } },
        steps: [
            { do: "checkShop", n: 1 }, { do: "buySeeds", seed: "eggplant", n: 1 }, { do: "buySeeds", seed: "bokchoy", n: 2 },
            { do: "plant", seed: "apple", n: 1 }, { do: "claim", n: 0.8 }, { do: "claim", n: 1 },
        ],
    };
    assert.deepEqual(texts(cardFor(plan, NOW).tasks), [
        "check Heidi's shop",
        "buy 1 eggplant seed",
        "buy 2 bok choy seeds",
        "plant 1 apple seed",
        "devlog 0.8h",
        "devlog 1h",
    ]);
});

test("plant steps count down to the seeds' deadline once it's under 2 days away", () => {
    const plan = (seedsDie) => ({
        t: 3, inventory: { coins: 0, plots: 10, seeds: 0, baseSeeds: 0, baseKinds: {}, seedsDie }, m: 1,
        farm: { plots: 10, empty: 10, crops: [], seenAt: NOW }, stuck: null, crops: {},
        steps: [{ do: "plant", seed: "apple", n: 4 }, { do: "plant", seed: "eggplant", n: 1, done: true }, { do: "plantBase", n: 1 }],
    });
    const lines = (seedsDie) => texts(cardFor(plan(seedsDie), NOW).tasks);
    assert.deepEqual(lines(NOW + 28 * 3600000), [
        "plant 4 apple seeds (1d 4h left)",
        "plant 1 eggplant seed",
        "plant 1 strawberry seed (1d 4h left)",
    ]);
    assert.equal(lines(NOW + 5 * 3600000)[0], "plant 4 apple seeds (5h left)");
    assert.equal(lines(NOW + 20 * 60000)[0], "plant 4 apple seeds (<1h left)");
    assert.equal(lines(NOW + 3 * 86400000)[0], "plant 4 apple seeds");
    assert.equal(lines(null)[0], "plant 4 apple seeds");
});

test("free seeds go by name, both kinds when prep carrots are still good", () => {
    const farm = { plots: 16, empty: 16, crops: [], seenAt: NOW };
    const plan = {
        t: 3, inventory: { coins: 0, plots: 16, seeds: 0, baseSeeds: 16, baseKinds: { carrot: 6, strawberry: 10 } }, m: 1.1, mGuessed: true,
        farm, stuck: null, steps: [{ do: "plantBase", n: 16 }],
    };
    assert.deepEqual(texts(cardFor(plan, NOW).tasks), ["plant 16 carrot or strawberry seeds"]);
});
