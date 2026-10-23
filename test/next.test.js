import { test } from "node:test";
import assert from "node:assert/strict";
import { weekTarget, stepsFrom, routeState, rowHours, nestSteps, tickSteps } from "../userscript/next.js";
import { stuckFrom } from "../userscript/fill.js";
import { hoursNeeded } from "../src/route.js";

const crops = (stage, n, { review = null, week = "2026-W42" } = {}) =>
    Array.from({ length: n }, () => ({ seed: "apple_seed", name: "Apple", stage, review, week }));
// what inventoryFrom gives back, nothing in it unless the test says
const bag = (more) => ({ coins: 0, seeds: 0, baseSeeds: 0, unplaced: 0, baseKinds: {}, bonus: {}, water: 0, ...more });
// weekTarget minus route (simulateRoute output)
const target = (...args) => {
    const { route, ...rest } = weekTarget(...args);
    assert.ok(route.length > 0);
    return rest;
};

test("weekTarget: no goal plans the rent week, like the site with nothing picked", () => {
    // 42 coins = 18 crops, capped at 10
    assert.deepEqual(target({ coins: 42, plots: 36, seeds: 0 }, 3, null, 1.1), { w: 10, cap: 10, reachable: null, out: false, mix: null });
});

test("weekTarget: with a goal it's the first week of hoursNeeded's route", () => {
    const state = { coins: 42, plots: 36, seeds: 0 };
    const result = hoursNeeded(state, 3, 2000, 1.1);
    assert.deepEqual(target(state, 3, 2000, 1.1), { w: result.route[0].hours, cap: result.cap, reachable: true, out: false, mix: null });
    assert.deepEqual(weekTarget(state, 3, 2000, 1.1).route, result.route);
});

test("weekTarget: a goal you can't reach still goes as hard as it can", () => {
    assert.deepEqual(target({ coins: 42, plots: 36, seeds: 0 }, 3, 1e6, 1.1), { w: 18, cap: 45, reachable: false, out: false, mix: null });
});

test("weekTarget: eggplants in the bag and the shop go in the first week's mix", () => {
    const state = { coins: 300, plots: 20, seeds: 0 };
    const thisWeek = { seeds: ["eggplant", "bokchoy"], onHand: { eggplant: 6 }, crops: {} };
    const result = hoursNeeded(state, 5, 3000, 1, 10, thisWeek);
    const { w, mix, route } = weekTarget(state, 5, 3000, 1, thisWeek);
    assert.ok(mix.eggplant > 0);
    assert.deepEqual(mix, result.route[0].mix);
    assert.equal(w, result.route[0].hours);
    assert.ok(route.slice(1).every((row) => !("mix" in row)), "apples only after this week");
});

test("rowHours: thisWeek goes on to hoursNeeded", () => {
    const state = { coins: 300, plots: 20, seeds: 0 };
    const thisWeek = { seeds: ["eggplant"], onHand: { eggplant: 6 }, crops: {} };
    const rows = rowHours(state, 5, [{ total: 3000 }, { total: 8000 }], 1, thisWeek);
    assert.deepEqual(rows.map((row) => row.hours), [3000, 8000].map((total) => hoursNeeded(state, 5, total, 1, 10, thisWeek)?.cap ?? null));
});

test("rowHours: each row's h/week, same as hoursNeeded on its own (build plan numbers)", () => {
    const prep2 = { coins: 4, plots: 13, seeds: 3 };
    const rows = rowHours(prep2, 1, [{ total: 3050 }, { total: 10700 }, { total: 13850 }], 1);
    assert.deepEqual(rows.map((row) => row.hours), [17, 42, null]);
});

test("routeState: this week's planted apples count as seeds you've got", () => {
    const farm = { crops: [...crops("dry", 4, { week: "2026-W43" }), ...crops("review", 6)] };
    const inventory = { coins: 12, seeds: 1, baseSeeds: 0, unplaced: 0 };
    assert.deepEqual(routeState(inventory, 20, farm, "2026-W43"), { coins: 12, plots: 20, seeds: 5 });
    assert.deepEqual(routeState(inventory, 20, null, "2026-W43"), { coins: 12, plots: 20, seeds: 1 });
});

test("stepsFrom: 20 Oct, 36 stuck and 36 loan plots in the bag", () => {
    const farm = { plots: 36, empty: 0, crops: crops("review", 36, { review: "review" }) };
    const steps = stepsFrom({
        farm, inventory: bag({ seeds: 1, baseSeeds: 10, unplaced: 36 }), stuck: stuckFrom(farm, "2026-W43"), loans: 36,
        weekKey: "2026-W43", w: 10,
    });
    assert.deepEqual(steps, [
        { do: "place", n: 10 },
        { do: "plantBase", n: 10 },
        { do: "code", n: 10 },
        { do: "ship", n: 10 },
    ]);
});

test("stepsFrom: 19 Oct, stuck with nothing lent yet, so the plots would have to be bought", () => {
    const farm = { plots: 36, empty: 0, crops: crops("review", 36, { review: "review" }) };
    const steps = stepsFrom({
        farm, inventory: bag({ baseSeeds: 10 }), stuck: stuckFrom(farm, "2026-W43"), loans: 0,
        weekKey: "2026-W43", w: 10,
    });
    assert.deepEqual(steps, [
        { do: "buyPlots", n: 10 },
        { do: "waitForLoans", n: 10 },
        { do: "place", n: 10 },
        { do: "plantBase", n: 10 },
        { do: "code", n: 10 },
        { do: "ship", n: 10 },
    ]);
});

test("stepsFrom: a busy week, harvesting last week's pays the loans back", () => {
    const farm = {
        plots: 12,
        empty: 1,
        crops: [
            ...crops("withered", 1), ...crops("ready", 2), ...crops("review", 1, { review: "changes" }),
            ...crops("dry", 1, { week: "2026-W43" }), ...crops("watered", 2, { week: "2026-W43" }),
        ],
    };
    const steps = stepsFrom({
        farm, inventory: bag({ seeds: 5, baseSeeds: 10, unplaced: 2, water: 0.5 }), stuck: stuckFrom(farm, "2026-W43"),
        loans: 2, weekKey: "2026-W43", w: 20,
    });
    // free on farm: 1 empty + 1 withered + 2 ready - 2 paid back = 2. 17 still to plant, 15 seeds.
    // water: the dry one's 1 + the 17 going in = 18, half an hour's in the pool, so 17.5 to code
    assert.deepEqual(steps, [
        { do: "clear", n: 1 },
        { do: "harvest", n: 2 },
        { do: "reship", n: 1 },
        { do: "buySeeds", seed: "apple", n: 2 },
        { do: "buyPlots", n: 13 },
        { do: "place", n: 15 },
        { do: "plantBase", n: 10 },
        { do: "plant", seed: "apple", n: 7 },
        { do: "code", n: 17.5 },
        { do: "ship", n: 20 },
    ]);
    // place under buyPlots, planting under place, ship under code
    assert.deepEqual(nestSteps(steps).map((step) => step.depth), [0, 0, 0, 0, 0, 1, 2, 2, 0, 1]);
});

test("tickSteps: steps that are gone are done, with the count they started with", () => {
    const week = "2026-W43";
    const first = tickSteps(null, [{ do: "buyPlots", n: 4 }, { do: "place", n: 4 }, { do: "code", n: 28.3 }], week, 40);
    assert.ok(first.steps.every((step) => !step.done));
    // bought the plots, placed 1 of them
    const later = tickSteps(first.saved, [{ do: "place", n: 3 }, { do: "code", n: 27 }], week, 40);
    assert.deepEqual(later.steps, [
        { do: "buyPlots", n: 4, done: true },
        { do: "place", n: 3, done: false },
        { do: "code", n: 27, done: false },
    ]);
});

test("tickSteps: a new step goes after the one before it, a new target or week starts over", () => {
    const week = "2026-W43";
    const { saved } = tickSteps(null, [{ do: "place", n: 4 }, { do: "code", n: 20 }], week, 30);
    const withShip = tickSteps(saved, [{ do: "place", n: 4 }, { do: "code", n: 20 }, { do: "ship", n: 30 }], week, 30);
    assert.deepEqual(withShip.steps.map((step) => step.do), ["place", "code", "ship"]);
    const withHarvest = tickSteps(withShip.saved, [{ do: "harvest", n: 2 }, { do: "code", n: 20 }], week, 30);
    assert.deepEqual(withHarvest.steps.map((step) => [step.do, step.done]), [["harvest", false], ["place", true], ["code", false], ["ship", true]]);
    // new goal = new w, old list was for another plan
    assert.deepEqual(tickSteps(withShip.saved, [{ do: "code", n: 10 }], week, 10).steps, [{ do: "code", n: 10, done: false }]);
    assert.deepEqual(tickSteps(withShip.saved, [{ do: "code", n: 10 }], "2026-W44", 30).steps, [{ do: "code", n: 10, done: false }]);
});

test("tickSteps: a list saved with apples only keeps its ticks as apple steps", () => {
    const saved = { weekKey: "2026-W43", w: 14, steps: [{ do: "buySeeds", n: 4 }, { do: "plantApples", n: 4 }, { do: "code", n: 14 }] };
    const steps = [{ do: "buySeeds", seed: "eggplant", n: 1 }, { do: "plant", seed: "apple", n: 4 }, { do: "code", n: 13 }];
    assert.deepEqual(tickSteps(saved, steps, "2026-W43", 14).steps, [
        { do: "buySeeds", seed: "eggplant", n: 1, done: false },
        { do: "buySeeds", n: 4, seed: "apple", done: true },
        { do: "plant", seed: "apple", n: 4, done: false },
        { do: "code", n: 13, done: false },
    ]);
});

test("nestSteps: a step goes back left when what it waits on is done", () => {
    const depths = (...names) => nestSteps(names.map((name) => ({ do: name, n: 1 }))).map((step) => step.depth);
    // plots already placed, apples only wait on the seeds now
    assert.deepEqual(depths("buySeeds", "plant", "code"), [0, 1, 0]);
    assert.deepEqual(depths("buyPlots", "waitForLoans", "place"), [0, 1, 1]);
    assert.deepEqual(depths("plant", "ship"), [0, 0]);
});

test("stepsFrom: no target just plants what you've got and waters the dry ones", () => {
    const farm = { plots: 3, empty: 1, crops: crops("dry", 2, { week: "2026-W43" }) };
    const steps = stepsFrom({ farm, inventory: bag({ seeds: 3 }), stuck: stuckFrom(farm, "2026-W43"), loans: 0, weekKey: "2026-W43", w: null });
    assert.deepEqual(steps, [
        { do: "buyPlots", n: 2 },
        { do: "place", n: 2 },
        { do: "plant", seed: "apple", n: 3 },
        { do: "code", n: 5 },
        { do: "ship", n: 5 },
    ]);
});

test("stepsFrom: the mix's eggplants get bought and planted as eggplants, 2 water each, devlog first", () => {
    const farm = { plots: 14, empty: 14, crops: [] };
    const steps = stepsFrom({
        farm, inventory: bag({ baseSeeds: 10, bonus: { eggplant: 3 }, water: 2 }), stuck: stuckFrom(farm, "2026-W43"), loans: 0, weekKey: "2026-W43",
        w: 18, mix: { eggplant: 4 }, unclaimed: 3,
    });
    // water: 10 base + 4 eggplants * 2 = 18, 2 in the pool, 3 more once they're devlogged, 13 to code
    assert.deepEqual(steps, [
        { do: "buySeeds", seed: "eggplant", n: 1 },
        { do: "plantBase", n: 10 },
        { do: "plant", seed: "eggplant", n: 4 },
        { do: "claim", n: 3 },
        { do: "code", n: 13 },
        { do: "ship", n: 14 },
    ]);
    // planting eggplants waits on buying eggplants
    assert.deepEqual(nestSteps(steps).map((step) => step.depth), [0, 0, 1, 0, 0, 1]);
});

test("stepsFrom: the devlog step has all the unclaimed hours, and none when the pool covers it", () => {
    const farm = { plots: 2, empty: 0, crops: crops("dry", 2, { week: "2026-W43" }) };
    const waterSteps = (water, unclaimed) => stepsFrom({ farm, inventory: bag({ water }), stuck: stuckFrom(farm, "2026-W43"), loans: 0, weekKey: "2026-W43", w: 2, mix: {}, unclaimed })
        .filter((step) => step.do === "claim" || step.do === "code");
    assert.deepEqual(waterSteps(1, 3), [{ do: "claim", n: 3 }]);
    assert.deepEqual(waterSteps(2, 3), []);
});

test("stepsFrom: mid week, eggplants already planted count off the mix and their water's still owed", () => {
    const eggplant = { seed: "eggplant_seed", id: "eggplant", name: "Eggplant", stage: "dry", water: 2, week: "2026-W43" };
    const farm = { plots: 14, empty: 12, crops: [eggplant, eggplant] };
    const steps = stepsFrom({
        farm, inventory: bag({ bonus: { eggplant: 1 } }), stuck: stuckFrom(farm, "2026-W43"), loans: 0, weekKey: "2026-W43", w: 8, mix: { eggplant: 4 },
    });
    // 2 more to plant, 1 in the bag. water: 2 planted * 2 + 2 going in * 2 = 8
    assert.deepEqual(steps, [
        { do: "buySeeds", seed: "eggplant", n: 1 },
        { do: "plant", seed: "eggplant", n: 2 },
        { do: "code", n: 8 },
        { do: "ship", n: 4 },
    ]);
});

test("stepsFrom: without today's shop it says to check it first, and the buying waits on that", () => {
    const farm = { plots: 14, empty: 14, crops: [] };
    const steps = stepsFrom({
        farm, inventory: bag({ baseSeeds: 10 }), stuck: stuckFrom(farm, "2026-W43"), loans: 0, weekKey: "2026-W43", w: 12, mix: { eggplant: 1 }, shopToday: false,
    });
    assert.deepEqual(steps.slice(0, 2), [{ do: "checkShop", n: 1 }, { do: "buySeeds", seed: "eggplant", n: 1 }]);
    assert.deepEqual(nestSteps(steps).slice(0, 2).map((step) => step.depth), [0, 1]);
});

test("stepsFrom: no shop check once the week's all planted, or with no target", () => {
    const eggplant = { seed: "eggplant_seed", id: "eggplant", name: "Eggplant", stage: "dry", water: 2, week: "2026-W43" };
    const planted = { plots: 14, empty: 13, crops: [eggplant] };
    const checks = (farm, inventory, w) => stepsFrom({
        farm, inventory, stuck: stuckFrom(farm, "2026-W43"), loans: 0, weekKey: "2026-W43", w, mix: { eggplant: 1 }, shopToday: false,
    }).filter((step) => step.do === "checkShop");
    assert.deepEqual(checks(planted, bag(), 1), []);
    // 3 apples to plant, but with no target the mix isn't what it plants
    assert.deepEqual(checks({ plots: 14, empty: 14, crops: [] }, bag({ seeds: 3 }), null), []);
});

test("stepsFrom: nothing to go on without the farm", () => {
    assert.deepEqual(stepsFrom({ farm: null, inventory: { seeds: 3, baseSeeds: 0, unplaced: 0 } }), []);
});
