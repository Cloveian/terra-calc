// day hours off the hours log, a typical day per weekday n the week shape, n the wait-for-a-better-seed odds
import { weekDay, DAY_MS } from "../src/week.js";
import { perHour } from "../src/farm.js";
import { EVEN_WEEK } from "../src/route.js";
import { idsOn } from "./daylog.js";

// a weekday needs this many clean days before it gets a typical number
export const MIN_SAMPLES = 3;
// n the shop log this many days before its odds say anything
export const MIN_SHOP_DAYS = 14;

// [{ day, h, lumped }], lumped = days before it werent logged so their hours landed here too
export function dayHours(log) {
    const days = Object.keys(log).sort();
    return days.map((day, i) => {
        const prev = days[i - 1];
        const same = prev !== undefined && log[prev].weekKey === log[day].weekKey;
        const h = (log[day].seconds - (same ? log[prev].seconds : 0)) / 3600;
        // fine = the day right before is logged, or its monday n the week starts at 0
        const lumped = same ? Date.parse(day) - Date.parse(prev) > DAY_MS : weekDay(day) !== 0;
        return { day, h, lumped };
    });
}

// days from my first coded day, in or after the week i first shipped once i have (firstShipped). before terra it was all 0s n every median came out 0
export function sinceStart(days, shippedWeek = null) {
    const after = days.filter((d) => shippedWeek === null || d.day >= shippedWeek).sort((a, b) => a.day.localeCompare(b.day));
    const first = after.findIndex((d) => d.h > 0);
    return first < 0 ? [] : after.slice(first);
}

// median clean h per weekday, [mon ... sun], null till MIN_SAMPLES of them
export function typicalDays(days) {
    const byDay = Array.from({ length: 7 }, () => []);
    for (const { day, h, lumped } of days) {
        if (!lumped) byDay[weekDay(day)].push(h);
    }
    return byDay.map((hs) => (hs.length < MIN_SAMPLES ? null : median(hs)));
}

// typicalDays -> share of my week per weekday, adds to 1. no number yet = average of the known ones, even split if none known or all 0
export function weekShape(typical) {
    const known = typical.filter((h) => h !== null);
    const knownSum = known.reduce((sum, h) => sum + h, 0);
    if (knownSum <= 0) return EVEN_WEEK;
    const average = knownSum / known.length;
    const filled = typical.map((h) => h ?? average);
    const total = filled.reduce((sum, h) => sum + h, 0);
    return filled.map((h) => h / total);
}

function median(xs) {
    const sorted = [...xs].sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// best seed by water on one logged day, old id-only days off table. null on a day heidi had nothing
function bestOn(seeds, table, m) {
    let best = null;
    for (const seed of seeds) {
        const crop = seed.id ? seed : table[seed];
        if (crop?.water && (best === null || perHour(crop, m) > perHour(best, m))) best = crop;
    }
    return best;
}

// the made-up 1 water crop weeks after this one plant: every logged day's best seed, its buy n sell per water averaged
// a day with nothing counts as 0. under MIN_SHOP_DAYS just the last day that had something, null if none did
// a 2 water seed only takes 1 plot, as 1 water crops it asks for a few too many plots, so it comes out a bit careful
export function typicalCrop(shopLog, table, m) {
    const days = Object.keys(shopLog).sort().map((day) => bestOn(shopLog[day], table, m));
    if (days.length < MIN_SHOP_DAYS) {
        const last = days.filter(Boolean).at(-1);
        return last ? { buy: last.buy / last.water, sell: last.sell / last.water, water: 1 } : null;
    }
    const perWater = (key) => days.reduce((sum, crop) => sum + (crop ? crop[key] / crop.water : 0), 0) / days.length;
    return { buy: perWater("buy"), sell: perWater("sell"), water: 1 };
}

// share of logged shop days each seed was in, { eggplant: 0.4, apple: 0.9 }
export function seedOdds(shopLog) {
    const days = Object.values(shopLog);
    const counts = {};
    for (const seeds of days) {
        for (const id of idsOn(seeds)) counts[id] = (counts[id] ?? 0) + 1;
    }
    return Object.fromEntries(Object.entries(counts).map(([id, n]) => [id, n / days.length]));
}

// what a water's worth with n shop days still to come, [V_0 ... V_days], V_0 = 0 cuz water past sunday's shop goes unplanted
// V_n = E[max(best seed in that day's shop, V_(n-1))], each seed in on its own with its odds. house-selling problem, worked back from sunday
// values = perHour (farm.js) per seed, apples too. buy today's seed for water i'm sure of if its value >= V_(days left after today)
export function waitTable(values, odds, days = 6) {
    // best first: a seed only matters on a day nothing above it showed up
    const ids = Object.keys(values).filter((id) => odds[id] > 0).sort((a, b) => values[b] - values[a]);
    const table = [0];
    for (let n = 1; n <= days; n++) {
        const floor = table[n - 1];
        let worth = 0;
        let none = 1; // chance none of the ones so far are in
        for (const id of ids) {
            if (values[id] <= floor) break;
            worth += none * odds[id] * values[id];
            none *= 1 - odds[id];
        }
        table.push(worth + none * floor);
    }
    return table;
}

// { best: today's best seed, top: the one worth waiting for, odds: its share of days }, or null
// only with something in the shop today, MIN_SHOP_DAYS of log, n when waiting actually wins. daysLeft = shop days after today this week
export function waitFor(shopLog, today, crops, m, daysLeft) {
    const here = today.filter((id) => crops[id]);
    if (here.length === 0 || daysLeft < 1 || Object.keys(shopLog).length < MIN_SHOP_DAYS) return null;
    const value = (id) => perHour(crops[id], m);
    const odds = seedOdds(shopLog);
    const values = Object.fromEntries(Object.keys(odds).filter((id) => crops[id]).map((id) => [id, value(id)]));
    const best = here.reduce((a, b) => (value(b) > value(a) ? b : a));
    if (value(best) >= waitTable(values, odds, daysLeft)[daysLeft]) return null;
    const top = Object.keys(values).reduce((a, b) => (values[b] > values[a] ? b : a));
    return { best, top, odds: odds[top] };
}
