import { test } from "node:test";
import assert from "node:assert/strict";
import { weekTarget, stepsFrom } from "../userscript/next.js";
import { stuckFrom } from "../userscript/fill.js";
import { hoursNeeded } from "../src/route.js";

const crops = (stage, n, { review = null, week = "2026-W42" } = {}) =>
    Array.from({ length: n }, () => ({ seed: "apple_seed", name: "Apple", stage, review, week }));

test("weekTarget: no goal plans the rent week, like the site with nothing picked", () => {
    // 42 coins = 18 crops, capped at 10
    assert.deepEqual(weekTarget({ coins: 42, plots: 36, seeds: 0 }, 3, null, 1.1), { w: 10, cap: 10, reachable: null, out: false });
});

test("weekTarget: with a goal it's the first week of hoursNeeded's route", () => {
    const state = { coins: 42, plots: 36, seeds: 0 };
    const result = hoursNeeded(state, 3, 2000, 1.1);
    assert.deepEqual(weekTarget(state, 3, 2000, 1.1), { w: result.route[0].hours, cap: result.cap, reachable: true, out: false });
});

test("weekTarget: a goal you can't reach still goes as hard as it can", () => {
    assert.deepEqual(weekTarget({ coins: 42, plots: 36, seeds: 0 }, 3, 1e6, 1.1), { w: 18, cap: 45, reachable: false, out: false });
});

test("stepsFrom: 20 Oct, 36 stuck and 36 loan plots in the bag", () => {
    const farm = { plots: 36, empty: 0, crops: crops("review", 36, { review: "review" }) };
    const steps = stepsFrom({
        farm, inventory: { seeds: 1, baseSeeds: 10, unplaced: 36 }, stuck: stuckFrom(farm, "2026-W43"), loans: 36,
        weekKey: "2026-W43", hoursDone: 0, w: 10,
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
        farm, inventory: { seeds: 0, baseSeeds: 10, unplaced: 0 }, stuck: stuckFrom(farm, "2026-W43"), loans: 0,
        weekKey: "2026-W43", hoursDone: 0, w: 10,
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
        farm, inventory: { seeds: 5, baseSeeds: 10, unplaced: 2 }, stuck: stuckFrom(farm, "2026-W43"), loans: 2,
        weekKey: "2026-W43", hoursDone: 2.5, w: 20,
    });
    // free on farm: 1 empty + 1 withered + 2 ready - 2 paid back = 2. 17 still to plant, 15 seeds
    assert.deepEqual(steps, [
        { do: "clear", n: 1 },
        { do: "harvest", n: 2 },
        { do: "reship", n: 1 },
        { do: "buyPlots", n: 13 },
        { do: "buySeeds", n: 2 },
        { do: "place", n: 15 },
        { do: "plantBase", n: 10 },
        { do: "plantApples", n: 7 },
        { do: "code", n: 17.5 },
        { do: "ship", n: 20 },
    ]);
});

test("stepsFrom: no target just plants what you've got and waters the dry ones", () => {
    const farm = { plots: 3, empty: 1, crops: crops("dry", 2, { week: "2026-W43" }) };
    const steps = stepsFrom({
        farm, inventory: { seeds: 3, baseSeeds: 0, unplaced: 0 }, stuck: stuckFrom(farm, "2026-W43"), loans: 0,
        weekKey: "2026-W43", hoursDone: 0, w: null,
    });
    assert.deepEqual(steps, [
        { do: "buyPlots", n: 2 },
        { do: "place", n: 2 },
        { do: "plantApples", n: 3 },
        { do: "code", n: 5 },
        { do: "ship", n: 5 },
    ]);
});

test("stepsFrom: nothing to go on without the farm", () => {
    assert.deepEqual(stepsFrom({ farm: null, inventory: { seeds: 3, baseSeeds: 0, unplaced: 0 } }), []);
});
