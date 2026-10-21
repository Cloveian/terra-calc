// next steps: farm chores now + this weeks crops and hours from site route
import { hoursNeeded, simulateRoute } from "../src/route.js";
import { RENT, MAX_PLOTS } from "../src/data.js";

// this weeks crops (= hours) from site route (src/route.js). no goal = rent week at 10 h like site with nothing picked. w counts whole week, planted or not. out = main week without coins for 10 crops (rent)
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
    return { w: row?.hours ?? 0, cap, reachable, out: row?.out ?? false };
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
    add({ do: "buyPlots", n: buyPlots });
    add({ do: "buySeeds", n: buySeeds });
    // stuck crops with nothing lent yet, ratticus might cover some plots for free
    if (loans === 0) add({ do: "waitForLoans", n: Math.min(buyPlots, stuck.count) });
    add({ do: "place", n: Math.min(inventory.unplaced + buyPlots, Math.max(0, want - free)) });
    add({ do: "plant", n: want });

    // hour a crop like model. no target = dry ones + ones about to go in
    const hours = w === null ? count((crop) => crop.stage === "dry") + want : w - hoursDone;
    add({ do: "code", n: Math.max(0, Math.ceil(hours * 10) / 10) });
    // this weeks not off for review yet + ones about to be planted
    const unshipped = count((crop) => crop.week === weekKey && (crop.stage === "dry" || crop.stage === "watered"));
    add({ do: "ship", n: unshipped + want });
    return steps;
}
