// next steps: farm chores now + this weeks crops and hours from site route
import { hoursNeeded, simulateRoute } from "../src/route.js";
import { RENT, MAX_PLOTS } from "../src/data.js";
import { APPLE_SEED } from "./fill.js";

// this weeks crops (= hours) from site route (src/route.js). goal in coins, none = rent week at 10 h like site with nothing picked. w counts whole week, planted or not. out = main week without coins for 10 crops (rent). route for milestones
export function weekTarget(state, t, goal, m) {
    let cap = RENT;
    let route;
    let reachable = null;
    if (goal > 0) {
        const result = hoursNeeded(state, t, goal, m);
        reachable = result !== null;
        cap = result?.cap ?? MAX_PLOTS;
        route = result?.route ?? simulateRoute(state, t, cap, m);
    } else {
        route = simulateRoute(state, t, cap, m);
    }
    const row = route[0];
    return { w: row?.hours ?? 0, cap, reachable, out: row?.out ?? false, route };
}

// h/week from now to have each milestone row (n everything above it) by Week 12, null past 45 h. totals only go up so each search starts at the last cap, ~36 route runs for the whole list
export function rowHours(state, t, rows, m) {
    let from = RENT;
    return rows.map((row) => {
        const result = hoursNeeded(state, t, row.total, m, from);
        from = result?.cap ?? MAX_PLOTS + 1;
        return { ...row, hours: result?.cap ?? null };
    });
}

// route state from mid-week. planted apples are paid for, counted back as seeds or route buys them agian n comes out low. coins + plots already have this weeks spending
export function routeState(inventory, plots, farm, weekKey) {
    const planted = (farm?.crops ?? []).filter((crop) => crop.week === weekKey && crop.seed === APPLE_SEED).length;
    return { coins: inventory.coins, plots, seeds: inventory.seeds + planted };
}

// steps in doing order, n = crops, plots, seeds or hours. nothing without farm (no spots to count). w null = no target, plants what you have
export function stepsFrom({ farm, inventory, stuck, loans, weekKey, hoursDone, w }) {
    if (!farm || !inventory) return [];
    const steps = [];
    const add = (step) => step.n > 0 && steps.push(step);
    const count = (keep) => farm.crops.filter(keep).length;

    const withered = count((crop) => crop.stage === "withered");
    const ready = count((crop) => crop.stage === "ready");
    add({ do: "clear", n: withered });
    add({ do: "harvest", n: ready });
    add({ do: "reship", n: stuck.why.changes ?? 0 });
    add({ do: "devlog", n: stuck.why.short ?? 0 });

    // free once dead + ready ones are gone. harvesting last weeks pays a loan plot back (one per harvest i think), frees nothing
    const repaid = Math.min(loans, count((crop) => crop.stage === "ready" && crop.week < weekKey));
    const free = farm.empty + withered + ready - repaid;

    // still to plant this week + what to buy for it. base seeds free, only apples bought
    const planted = count((crop) => crop.week === weekKey);
    const have = inventory.seeds + inventory.baseSeeds;
    const want = w === null ? have : Math.max(0, w - planted);
    const buySeeds = Math.max(0, want - have);
    const buyPlots = Math.max(0, want - free - inventory.unplaced);
    // seeds first, place n the "or wait" go right under buyPlots in nestSteps
    add({ do: "buySeeds", n: buySeeds });
    add({ do: "buyPlots", n: buyPlots });
    // stuck crops with nothing lent yet, ratticus might cover some plots for free
    if (loans === 0) add({ do: "waitForLoans", n: Math.min(buyPlots, stuck.count) });
    add({ do: "place", n: Math.min(inventory.unplaced + buyPlots, Math.max(0, want - free)) });
    // free seeds first, model counts first 10 crops as free ones (rent in main weeks)
    const base = Math.min(want, inventory.baseSeeds);
    add({ do: "plantBase", n: base });
    add({ do: "plantApples", n: want - base });

    // hour a crop like model. no target = dry ones + ones about to go in
    const hours = w === null ? count((crop) => crop.stage === "dry") + want : w - hoursDone;
    add({ do: "code", n: Math.max(0, Math.ceil(hours * 10) / 10) });
    // this weeks not off for review yet + ones about to be planted
    const unshipped = count((crop) => crop.week === weekKey && (crop.stage === "dry" || crop.stage === "watered"));
    add({ do: "ship", n: unshipped + want });
    return steps;
}

// what each step waits on, like tree node requires. clear + harvest free plots for planting, the "or wait" is the other way to get plots
const STEP_NEEDS = {
    place: ["buyPlots"],
    waitForLoans: ["buyPlots"],
    plantBase: ["place", "clear", "harvest"],
    plantApples: ["place", "buySeeds", "clear", "harvest"],
    ship: ["code"],
};

// depth for checklist indent, one past the deepest step it waits on thats still to do. order kept like sites milestone list, works cuz stepsFrom puts every step after its needs (a need further down never counts)
export function nestSteps(steps) {
    const depth = {};
    return steps.map((step) => {
        const under = (STEP_NEEDS[step.do] ?? []).filter((need) => need in depth).map((need) => depth[need] + 1);
        depth[step.do] = Math.max(0, ...under);
        return { ...step, depth: depth[step.do] };
    });
}
