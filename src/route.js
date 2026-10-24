// Multi-week plans: from week t to Week 12
import { MAX_PLOTS, RENT, BASE_SEEDS, CROPS } from "./data.js";
import { weekCost, weekSales, baseSales, wMax, bestMix } from "./farm.js";
import { LAST_WEEK, isPrep } from "./week.js";

// coins compare with a little slack, since m makes them decimals
const EPS = 1e-9;

// Play every week from t to Week 12 with w = min(cap, wMax). Before Terra (t < 0) plans from Prep 1.
// A row with `out: true` means a main week came out under 10 h, and the route stops there.
// thisWeek (bonus seeds in the shop, onHand, the game's crops table) plans the first week with bestMix, apples only after
// given = { week: { fixed, open } }, hours of the days i set + how many are still open
export function simulateRoute(state, t, cap, m, thisWeek = null, given = {}) {
    const rows = [];
    for (let week = Math.max(t, 0); week <= LAST_WEEK; week++) {
        const prep = isPrep(week);
        const max = wMax(state.coins, state.plots, state.seeds);
        const want = weekHours(given[week], cap);
        // hours = water, crops = what takes plots, only dihfrent with a mix
        let hours, crops, spent, sold, mix;
        let canUse = max;
        if (thisWeek && rows.length === 0) {
            mix = bestMix(Math.max(0, want - BASE_SEEDS), state.coins, state.plots,
                { apple: state.seeds, ...thisWeek.onHand }, ["apple", ...thisWeek.seeds], m,
                { ...CROPS, ...thisWeek.crops });
            hours = Math.min(want, BASE_SEEDS) + mix.water;
            crops = mix.crops;
            spent = mix.cost;
            sold = m * (baseSales(hours, 1, prep) + mix.sales); // m once, same as weekSales
            // wMax is apples only, a mix can use more. short of the week's hours = coins ran out right there, else its at least that
            canUse = hours < want ? hours : Math.max(max, hours);
        } else {
            hours = crops = Math.min(want, max);
            spent = weekCost(hours, state.plots, state.seeds);
            sold = weekSales(hours, m, prep);
        }
        const row = {
            week,
            startCoins: state.coins,
            plots: state.plots,
            wMax: canUse,
            hours,
            newPlots: Math.max(0, crops - state.plots),
            spent,
            sold,
        };
        if (mix) row.mix = mix.counts;
        if (!prep && hours < RENT) {
            rows.push({ ...row, sold: 0, endCoins: state.coins, out: true });
            break;
        }
        // apple and bonus seeds all expire at the end of the week
        state = { coins: state.coins - spent + sold, plots: Math.max(state.plots, crops), seeds: 0 };
        rows.push({ ...row, endCoins: state.coins });
    }
    return rows;
}

// When each item (from buyOrder) becomes affordable, buying them in order.
// Adds `total` (running cost), `now` (current coins already cover it) and
// `week` (first week that ends with enough coins, null if none does).
export function milestones(route, items) {
    let total = 0;
    return items.map((item) => {
        total += item.cost;
        const now = route.length > 0 && route[0].startCoins >= total - EPS;
        const row = route.find((r) => !r.out && r.endCoins >= total - EPS);
        return { ...item, total, now, week: now ? null : (row?.week ?? null) };
    });
}

// open days at cap / 7, a week missing from given is all 7 open. rounded cuz the route plants whole crops
export function weekHours(days, cap) {
    if (!days) return cap;
    return Math.round(days.fixed + (days.open * cap) / 7);
}

// every day from t to Week 12 set
export function allGiven(t, given) {
    for (let week = Math.max(t, 0); week <= LAST_WEEK; week++) {
        if (!given[week] || given[week].open > 0) return false;
    }
    return true;
}

// Lowest flat h/week cap that ends with at least goalCoins, or null if 45 h isn't enough.
// `from` skips caps already known too low (a smaller goal needed that much)
// the cap only goes on open days. none open = one run, and cap comes back null
export function hoursNeeded(state, t, goalCoins, m, from = RENT, thisWeek = null, given = {}) {
    const blank = !allGiven(t, given);
    for (let cap = from; cap <= (blank ? MAX_PLOTS : from); cap++) {
        const route = simulateRoute(state, t, cap, m, thisWeek, given);
        const last = route[route.length - 1];
        if (last?.out) continue;
        const endCoins = last ? last.endCoins : state.coins;
        if (endCoins >= goalCoins - EPS) {
            const totalHours = route.reduce((sum, row) => sum + row.hours, 0);
            return { cap: blank ? cap : null, totalHours, route };
        }
    }
    return null;
}
