// next steps: farm chores now + this weeks crops and hours from site route
import { hoursNeeded, simulateRoute, milestones, EVEN_WEEK } from "../src/route.js";
import { RENT, MAX_PLOTS, BASE_SEEDS, BASE_KINDS, CROPS } from "../src/data.js";
import { isWeekAfter, weekIndex, weekDay } from "../src/week.js";

// this weeks crops (= hours) from site route (src/route.js). goal in coins, none = rent week at 10 h like site with nothing picked. w counts whole week, planted or not. out = main week without coins for 10 crops (rent). route for milestones, mix = first weeks seeds with thisWeek
// given = my days (daysGiven), cap comes back null when every day set n the goal fits
// flat = h/week a plan without my days would need when my days dont make it, null otherwise (or not even 45 does)
export function weekTarget(state, t, goal, m, thisWeek = null, given = {}) {
    let cap = RENT;
    let route;
    let reachable = null;
    let flat = null;
    if (goal > 0) {
        const result = hoursNeeded(state, t, goal, m, RENT, thisWeek, given);
        reachable = result !== null;
        cap = result ? result.cap : MAX_PLOTS;
        route = result?.route ?? simulateRoute(state, t, cap, m, thisWeek, given);
        if (!reachable && Object.keys(given).length > 0) flat = hoursNeeded(state, t, goal, m, RENT, thisWeek)?.cap ?? null;
    } else {
        route = simulateRoute(state, t, cap, m, thisWeek, given);
    }
    const row = route[0];
    return { w: row?.hours ?? 0, cap, reachable, flat, out: row?.out ?? false, route, mix: row?.mix ?? null };
}

// the same plan at my usual h/week (typicalDays added up), how many goal items (goalItems) it gets n by when
// week = last one it needed, outFrom = first week rent didnt get paid, null if it always did
export function projection(state, t, items, m, thisWeek, given, usualWeek) {
    if (usualWeek === null || items.length === 0) return null;
    const h = Math.min(Math.round(usualWeek), MAX_PLOTS);
    const route = simulateRoute(state, t, h, m, thisWeek, given);
    const fit = milestones(route, items).filter((pick) => pick.now || pick.week !== null);
    return {
        h,
        fit: fit.length,
        of: items.length,
        week: fit.at(-1)?.week ?? null,
        outFrom: route.find((row) => row.out)?.week ?? null,
    };
}

// h/week from now to have each milestone row (n everything above it) by Week 12, null past 45 h. totals only go up so each search starts at the last cap, ~36 route runs for the whole list
export function rowHours(state, t, rows, m, thisWeek = null, given = {}) {
    let from = RENT;
    return rows.map((row) => {
        const result = hoursNeeded(state, t, row.total, m, from, thisWeek, given);
        from = result?.cap ?? MAX_PLOTS + 1;
        return { ...row, hours: result?.cap ?? null };
    });
}

// days i typed ({ "2026-10-26": 4 }) -> route.js given, by week index. typed days before today dont count, those are done
// this week only goes by days if i typed one in it: then the gone days are what i coded (codedBefore, h) and the untyped days left are open
// shape = share of the week per weekday (weekShape), open = 7 * the shares left
export function daysGiven(days, today, codedBefore, shape = EVEN_WEEK) {
    const t = weekIndex(today);
    const weeks = {};
    for (const [day, h] of Object.entries(days)) {
        if (day < today) continue;
        const week = weekIndex(day);
        weeks[week] ??= { fixed: week === t ? codedBefore : 0, typed: new Set() };
        weeks[week].fixed += h;
        weeks[week].typed.add(weekDay(day));
    }
    const given = {};
    for (const [week, { fixed, typed }] of Object.entries(weeks)) {
        // summed up, 7 minus the typed shares leaves float crumbs n allGiven wants exactly 0
        let open = 0;
        for (let d = Number(week) === t ? weekDay(today) : 0; d < 7; d++) {
            if (!typed.has(d)) open += 7 * shape[d];
        }
        given[week] = { fixed, open };
    }
    return given;
}

// this weeks crops so far by seed, { strawberry: 10, eggplant: 3 }
export function plantedThisWeek(farm, weekKey) {
    const counts = {};
    for (const crop of farm?.crops ?? []) {
        if (crop.week === weekKey) counts[crop.id] = (counts[crop.id] ?? 0) + 1;
    }
    return counts;
}

// route state from mid-week. planted apples are paid for, counted back as seeds or route buys them agian n comes out low. coins + plots already have this weeks spending
// selling = toSell coins, unsold crops good as coins for the plan
export function routeState(inventory, plots, farm, weekKey, selling = 0) {
    return { coins: inventory.coins + selling, plots, seeds: inventory.seeds + (plantedThisWeek(farm, weekKey).apple ?? 0) };
}

// this weeks record, change put in. new weekKey starts over, old one kept as last
export function noteWeek(saved, weekKey, change) {
    if (saved?.weekKey === weekKey) return { ...saved, ...change };
    // only the week right before, two back isnt "last week"
    const last = saved && isWeekAfter(saved.weekKey, weekKey) ? { coded: saved.coded, seenAt: saved.seenAt, w: saved.w } : null;
    // coded = h credited as of seenAt (ms), w = h the plan wanted
    return { weekKey, coded: 0, seenAt: null, w: null, ...change, last };
}

// seed ids of ready crops, ["apple", "apple", "eggplant"]
export function readyIds(farm) {
    return (farm?.crops ?? []).filter((crop) => crop.stage === "ready").map((crop) => crop.id);
}

// crops grown n not sold yet. market (forSaleFrom, null till its open) + ready ones and harvested ones market doesnt know yet
export function toSell(ready, forSale, m, inventory, table = CROPS) {
    // free seed crops are rent, they go to market locked (in prep they sell, so its low then)
    const sells = ready.filter((id) => !isBase(id, inventory));
    return {
        crops: (forSale?.crops ?? 0) + sells.length,
        // m * sell rounded down, game rounds n nobody knows which way
        coins: (forSale?.coins ?? 0) + sells.reduce((total, id) => total + Math.floor(m * (table[id]?.sell ?? 0)), 0),
    };
}

// free seed ids, a crop on the farm doesnt say if it was one
const BASE_IDS = new Set(Object.values(BASE_KINDS));

function isBase(id, inventory) {
    return BASE_IDS.has(id) || id in inventory.baseKinds;
}

// bonus seeds the mix counts as mine already, in my bag or planted this week (paid for, like the apples in routeState)
export function bonusOnHand(inventory, farm, weekKey) {
    const counts = { ...inventory.bonus };
    for (const [id, n] of Object.entries(plantedThisWeek(farm, weekKey))) {
        if (id !== "apple" && !isBase(id, inventory)) counts[id] = (counts[id] ?? 0) + n;
    }
    return counts;
}

// steps in the order i'd do them, n in crops, plots, seeds or hours. buy and plant ones carry their seed, sell its coins
// needs the farm to count spots from (card says go look). w = this weeks h from route, null = no target, then it plants whats in the bag
export function stepsFrom({
    farm, inventory, stuck, loans, weekKey, unclaimed = 0, w, mix = null, table = CROPS, shopToday = true, selling = { crops: 0, coins: 0 },
}) {
    if (!farm || !inventory) return [];
    const steps = [];
    const add = (step) => step.n > 0 && steps.push(step);
    const count = (keep) => farm.crops.filter(keep).length;

    const withered = count((crop) => crop.stage === "withered");
    const ready = count((crop) => crop.stage === "ready");
    add({ do: "clear", n: withered });
    add({ do: "harvest", n: ready });
    // toSell, ready ones still on farm too. route has these coins already
    add({ do: "sell", n: selling.crops, coins: selling.coins });
    add({ do: "reship", n: stuck.why.changes ?? 0 });
    add({ do: "devlog", n: stuck.why.short ?? 0 });

    // free once dead + ready ones are gone. harvesting last weeks pays a loan plot back (one per harvest i think), frees nothing
    const repaid = Math.min(loans, count((crop) => crop.stage === "ready" && crop.week < weekKey));
    const free = farm.empty + withered + ready - repaid;

    // still to plant this week, by seed. mix = route seeds past the free 10, planted ones included so they come off
    const planted = plantedThisWeek(farm, weekKey);
    const plantedBase = Object.entries(planted)
        .filter(([id]) => isBase(id, inventory))
        .reduce((total, [, n]) => total + n, 0);
    const bag = { apple: inventory.seeds, ...inventory.bonus };
    const wanted = w === null ? bag : (mix ?? { apple: Math.max(0, w - BASE_SEEDS) });
    const toPlant = Object.fromEntries(Object.entries(wanted)
        .map(([id, n]) => [id, w === null ? n : Math.max(0, n - (planted[id] ?? 0))]));
    // free seeds first, model counts first 10 crops as free ones (rent in main weeks)
    const base = w === null
        ? inventory.baseSeeds
        : Math.min(inventory.baseSeeds, Math.max(0, Math.min(BASE_SEEDS, w) - plantedBase));
    const going = base + Object.values(toPlant).reduce((total, n) => total + n, 0);
    const needPlots = Math.max(0, going - free - inventory.unplaced);
    // MAX_PLOTS goes by owned ones, ratticus's loans dont count
    const owned = farm.plots + inventory.unplaced - loans;
    const buyPlots = Math.min(needPlots, Math.max(0, MAX_PLOTS - owned));
    // stuck crops with nothing lent yet, ratticus might cover some plots for free
    const lent = loans === 0 ? Math.min(needPlots, stuck.count) : 0;
    const full = Math.max(0, needPlots - buyPlots - lent);
    // mix only knows todays bonus seeds once the shop has been open today. not with no target or only free ones left to plant
    if (!shopToday && w !== null && going > base) add({ do: "checkShop", n: 1 });
    // seeds first, place n the "or wait" go right under buyPlots in nestSteps
    for (const [id, n] of Object.entries(toPlant)) add({ do: "buySeeds", seed: id, n: Math.max(0, n - (bag[id] ?? 0)) });
    add({ do: "buyPlots", n: buyPlots });
    // or = theres a buy step its the other way to. at 45 loans are the only room left
    add({ do: "waitForLoans", n: lent, or: buyPlots > 0 });
    add({ do: "full", n: full });
    add({ do: "place", n: Math.min(inventory.unplaced + buyPlots, Math.max(0, going - free)) });
    add({ do: "plantBase", n: base });
    for (const [id, n] of Object.entries(toPlant)) add({ do: "plant", seed: id, n });

    // water still owed, planted ones not watered yet + ones going in at table water each ({ ...CROPS, ...todays shop })
    const weekCrops = farm.crops.filter((crop) => crop.week === weekKey);
    const owed = weekCrops.reduce((total, crop) => total + crop.water, 0)
        + base + Object.entries(toPlant).reduce((total, [id, n]) => total + n * (table[id]?.water ?? 1), 0);
    // pool covers some, unclaimed (coded, not devlogged yet) turns into water on devlog
    const short = owed - inventory.water;
    const tenths = (h) => Math.max(0, Math.ceil(h * 10) / 10);
    // a devlog claims all of it, so the step says all of it even past whats short
    add({ do: "claim", n: short > 0 ? tenths(unclaimed) : 0 });
    add({ do: "code", n: tenths(short - unclaimed) });
    // this weeks not off for review yet + ones about to be planted
    const unshipped = count((crop) => crop.week === weekKey && (crop.stage === "dry" || crop.stage === "watered"));
    add({ do: "ship", n: unshipped + going });
    return steps;
}

// week checklist with done ones ticked, like terra's own. saved = list as it first came out, null at first
export function tickSteps(saved, steps, weekKey, w) {
    // new target (w) starts over, steps that stopped being needed would show done
    const list = saved?.weekKey === weekKey && saved.w === w ? [...saved.steps] : [];
    const same = (a) => (b) => stepKey(a) === stepKey(b);
    steps.forEach((step, i) => {
        if (list.some(same(step))) return;
        // new ones go after the one before, always in the list by now
        const at = i === 0 ? 0 : list.findIndex(same(steps[i - 1])) + 1;
        const kept = step.seed ? { do: step.do, seed: step.seed, n: step.n } : { do: step.do, n: step.n };
        // a ticked "(or wait ...)" still says or
        if ("or" in step) kept.or = step.or;
        list.splice(at, 0, kept);
    });
    return {
        saved: { weekKey, w, steps: list },
        steps: list.map((kept) => {
            // gone from stepsFrom = done, keeps its starting count
            const now = steps.find(same(kept));
            return now ? { ...now, done: false } : { ...kept, done: true };
        }),
    };
}

// checklist name, "buySeeds:eggplant" on per seed ones
function stepKey(step) {
    return step.seed ? `${step.do}:${step.seed}` : step.do;
}

// what each step waits on, like tree node requires. clear + harvest free plots for planting, the "or wait" is the other way to get plots
const STEP_NEEDS = {
    place: ["buyPlots"],
    waitForLoans: ["buyPlots"],
    plantBase: ["place", "clear", "harvest"],
    plant: ["place", "buySeeds", "clear", "harvest"],
    sell: ["harvest"],
    buySeeds: ["checkShop", "sell"],
    buyPlots: ["sell"],
    ship: ["code"],
};

// depth for checklist indent, one past the deepest step it waits on thats still on the list, ticked ones too. per seed steps wait on the same seed (eggplants on eggplants). order kept like sites milestone list, works cuz stepsFrom puts every step after its needs (a need further down never counts)
export function nestSteps(steps) {
    const depth = {};
    return steps.map((step) => {
        const under = (STEP_NEEDS[step.do] ?? [])
            .map((need) => (`${need}:${step.seed}` in depth ? `${need}:${step.seed}` : need))
            .filter((key) => key in depth)
            .map((key) => depth[key] + 1);
        depth[stepKey(step)] = Math.max(0, ...under);
        return { ...step, depth: depth[stepKey(step)] };
    });
}
