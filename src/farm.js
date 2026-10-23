// One week of farming. Model: research/how-terra-works.md#10-the-calculators-model
import {
    MAX_PLOTS, FREE_PLOTS, PLOT_PRICE_MAX, BASE_SEEDS, RENT_PAY, CROPS,
} from "./data.js";

// coins to go from n plots to w plots: sum of min(p - 9, 10) for p = n ... w-1
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

// biggest w <= 45 you can afford with B coins
export function wMax(B, n, a) {
    for (let w = MAX_PLOTS; w > 0; w--) {
        if (weekCost(w, n, a) <= B) return w;
    }
    return 0;
}

// coins from the 10 base crops of a w hour week, carrots in prep, the rent after
export function baseSales(w, m, prep) {
    const carrots = prep ? CROPS.carrot.sell * Math.min(w, BASE_SEEDS) : RENT_PAY; // rent pays 20 for all 10
    return m * carrots;
}

// coins from selling a week's crops
export function weekSales(w, m, prep) {
    const k = applesFor(w);
    // m once over the lot, m * a + m * b is off in the last digit for m like 1.1
    return m * (baseSales(w, 1, prep) + CROPS.apple.sell * k);
}

// best seeds for k extra hours past the 10 free crops, from seedIds (always has apple). onHand ones are free, table = the game's prices when the userscript knows them
export function bestMix(k, coins, plots, onHand, seedIds, m, table = CROPS) {
    // seedIds = buyable today, seeds already in the bag get planted either way
    const buyable = new Set(seedIds);
    const held = Object.keys(onHand).filter((id) => onHand[id] > 0 && table[id]);
    const rest = [...new Set([...seedIds, ...held])].filter((id) => id !== "apple"); // apples fill whatever's left at the end
    const counts = {};
    let best = null;
    let bestValue = -Infinity;

    const seedCost = (id, x) => table[id].buy * Math.max(0, x - (onHand[id] ?? 0));

    // brute force, exact with 2 water seeds, plot prices and the budget all at once, and only a few hundred tries
    function go(i, water, extra, cost, sales) {
        if (i < rest.length) {
            const id = rest[i];
            const crop = table[id];
            // not in the shop today = only whats in the bag
            const limit = buyable.has(id) ? Infinity : onHand[id];
            for (let x = 0; x <= limit && water + crop.water * x <= k && BASE_SEEDS + extra + x <= MAX_PLOTS; x++) {
                // seeds and plots only get dearer with x, so once its over budget its over
                if (cost + seedCost(id, x) + plotCost(BASE_SEEDS + extra + x, plots) > coins) break;
                counts[id] = x;
                go(i + 1, water + crop.water * x, extra + x, cost + seedCost(id, x), sales + crop.sell * x);
            }
            delete counts[id];
            return;
        }
        // apples: as many as still fit, an apple is profit even on a 10 coin plot
        let x = Math.min(k - water, MAX_PLOTS - BASE_SEEDS - extra);
        const total = (a) => cost + seedCost("apple", a) + plotCost(BASE_SEEDS + extra + a, plots);
        while (x >= 0 && total(x) > coins) x--;
        if (x < 0) return;
        const crops = BASE_SEEDS + extra + x;
        const value = m * (sales + table.apple.sell * x) - total(x);
        if (value > bestValue || (value === bestValue && crops < best.crops)) {
            const c = { ...counts, apple: x };
            for (const id in c) if (c[id] === 0) delete c[id];
            // sales before m
            best = { counts: c, crops, water: water + x, cost: total(x), sales: sales + table.apple.sell * x };
            bestValue = value;
        }
    }

    go(0, 0, 0, 0, 0);
    return best;
}
