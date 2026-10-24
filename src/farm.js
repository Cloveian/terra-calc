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

// bought seeds needed for w hours (the first 10 crops are the free base seeds)
function boughtFor(w) {
    return Math.max(0, w - BASE_SEEDS);
}

// coins spent to use w hours: seeds you don't have yet + new plots. crop = any 1 water seed, apples or the typical shop day in the userscript
export function weekCost(w, n, a, crop = CROPS.apple) {
    const k = boughtFor(w);
    return crop.buy * Math.max(0, k - a) + plotCost(w, n);
}

// biggest w <= 45 you can afford with B coins
export function wMax(B, n, a, crop = CROPS.apple) {
    for (let w = MAX_PLOTS; w > 0; w--) {
        if (weekCost(w, n, a, crop) <= B) return w;
    }
    return 0;
}

// coins from the 10 base crops of a w hour week, carrots in prep, the rent after
export function baseSales(w, m, prep) {
    const base = prep ? CROPS.carrot.sell * Math.min(w, BASE_SEEDS) : RENT_PAY; // rent pays 20 for all 10
    return m * base;
}

// coins from selling a week's crops
export function weekSales(w, m, prep, crop = CROPS.apple) {
    const k = boughtFor(w);
    // m once over the lot, m * a + m * b is off in the last digit for m like 1.1
    return m * (baseSales(w, 1, prep) + crop.sell * k);
}

// coins per hour of water, sold at m minus seed price. plots not in it
export function perHour({ buy, sell, water }, m) {
    return (m * sell - buy) / water;
}

// best seeds for k extra hours past the 10 free crops, from seedIds. onHand ones are free, table = the game's prices when the userscript knows them
export function bestMix(k, coins, plots, onHand, seedIds, m, table = CROPS) {
    // seedIds = buyable today, seeds already in the bag get planted either way
    const buyable = new Set(seedIds);
    const held = Object.keys(onHand).filter((id) => onHand[id] > 0 && table[id]);
    // best a water out of whats buyable fills whatever's left at the end (apple most days, cabbage on a bad one). none buyable = no filler
    let filler = null;
    for (const id of seedIds) {
        if (table[id] && (filler === null || perHour(table[id], m) > perHour(table[filler], m))) filler = id;
    }
    const rest = [...new Set([...seedIds, ...held])].filter((id) => id !== filler && table[id]);
    const fill = filler ? table[filler] : null;
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
        // filler: as many as still fit, every seed so far is profit even on a 10 coin plot (cabbage 20 - 2 - 10)
        let x = fill ? Math.min(Math.floor((k - water) / fill.water), MAX_PLOTS - BASE_SEEDS - extra) : 0;
        const total = (a) => cost + (fill ? seedCost(filler, a) : 0) + plotCost(BASE_SEEDS + extra + a, plots);
        while (x >= 0 && total(x) > coins) x--;
        if (x < 0) return;
        const crops = BASE_SEEDS + extra + x;
        const fillSales = fill ? fill.sell * x : 0;
        const value = m * (sales + fillSales) - total(x);
        if (value > bestValue || (value === bestValue && crops < best.crops)) {
            const c = fill ? { ...counts, [filler]: x } : { ...counts };
            for (const id in c) if (c[id] === 0) delete c[id];
            // sales before m
            best = { counts: c, crops, water: water + (fill ? fill.water * x : 0), cost: total(x), sales: sales + fillSales };
            bestValue = value;
        }
    }

    go(0, 0, 0, 0, 0);
    return best;
}

// mix counts as words, biggest first, "14 apple + 10 eggplant". null when its just apples
// nameOf for seeds that aren't in CROPS (the userscript has todays shop)
export function mixWords(mix, nameOf = (id) => CROPS[id].name ?? id) {
    const counts = Object.entries(mix ?? {}).filter(([, n]) => n > 0);
    if (!counts.some(([id]) => id !== "apple")) return null;
    return counts
        .sort((a, b) => b[1] - a[1])
        .map(([id, n]) => `${n} ${nameOf(id).toLowerCase()}`)
        .join(" + ");
}
