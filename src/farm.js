// One week of farming. Model: research/how-terra-works.md#10-the-calculators-model
import {
    MAX_PLOTS, FREE_PLOTS, PLOT_PRICE_MAX, BASE_SEEDS, RENT, RENT_PAY, CROPS,
} from "./data.js";

// coins to go from n plots to w plots: sum of min(p - 9, 10) for p = n … w-1
export function plotCost(w, n) {
    let cost = 0;
    for (let p = n; p < w; p++) {
        cost += Math.min(p - FREE_PLOTS + 1, PLOT_PRICE_MAX);
    }
    return cost;
}

// apples needed for w hours (the first 10 crops are the free carrots)
function applesFor(w) {
    return Math.max(0, w - BASE_SEEDS);
}

// coins spent to use w hours: apple seeds you don't have yet + new plots
export function weekCost(w, n, a) {
    const k = applesFor(w);
    return CROPS.apple.buy * Math.max(0, k - a) + plotCost(w, n);
}

// biggest w ≤ 45 you can afford with B coins
export function wMax(B, n, a) {
    for (let w = MAX_PLOTS; w > 0; w--) {
        if (weekCost(w, n, a) <= B) return w;
    }
    return 0;
}

// coins from selling a week's crops
export function weekSales(w, m, prep) {
    const k = applesFor(w);
    const carrots = prep ? CROPS.carrot.sell * Math.min(w, BASE_SEEDS) : RENT_PAY; // rent pays 20 for all 10
    return m * (carrots + CROPS.apple.sell * k);
}

// state = { coins, plots, seeds }. Expects w ≤ wMax(state).
// Returns the state for next week, or null if a main week has under 10 h (out).
export function simulateWeek(state, w, m, prep) {
    if (!prep && w < RENT) return null;
    return {
        coins: state.coins - weekCost(w, state.plots, state.seeds) + weekSales(w, m, prep),
        plots: Math.max(state.plots, w),
        seeds: 0, // apple seeds expire at the end of the week
    };
}
