// Multi-week plans: from week t to Week 12
import { MAX_PLOTS, RENT } from "./data.js";
import { weekCost, weekSales, wMax, simulateWeek } from "./farm.js";
import { LAST_WEEK, isPrep } from "./week.js";

// coins compare with a little slack, since m makes them decimals
const EPS = 1e-9;

// Play every week from t to Week 12 with w = min(cap, wMax). Before Terra (t < 0) plans from Prep 1.
// A row with `out: true` means a main week came out under 10 h, and the route stops there.
export function simulateRoute(state, t, cap, m) {
    const rows = [];
    for (let week = Math.max(t, 0); week <= LAST_WEEK; week++) {
        const prep = isPrep(week);
        const max = wMax(state.coins, state.plots, state.seeds);
        const w = Math.min(cap, max);
        const next = simulateWeek(state, w, m, prep);
        const row = {
            week,
            startCoins: state.coins,
            plots: state.plots,
            wMax: max,
            hours: w,
            newPlots: Math.max(0, w - state.plots),
            spent: weekCost(w, state.plots, state.seeds),
            sold: weekSales(w, m, prep),
        };
        if (next === null) {
            rows.push({ ...row, sold: 0, endCoins: state.coins, out: true });
            break;
        }
        rows.push({ ...row, endCoins: next.coins });
        state = next;
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

// Lowest flat h/week cap that ends with at least goalCoins, or null if 45 h isn't enough.
export function hoursNeeded(state, t, goalCoins, m) {
    for (let cap = RENT; cap <= MAX_PLOTS; cap++) {
        const route = simulateRoute(state, t, cap, m);
        const last = route[route.length - 1];
        if (last?.out) continue;
        const endCoins = last ? last.endCoins : state.coins;
        if (endCoins >= goalCoins - EPS) {
            const totalHours = route.reduce((sum, row) => sum + row.hours, 0);
            return { cap, totalHours, route };
        }
    }
    return null;
}
