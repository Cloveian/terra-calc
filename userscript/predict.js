// day hours off the hours log, a typical day per weekday n the week shape, n the wait-for-a-better-seed odds
import { weekDay, weekIndex, DAY_MS } from "../src/week.js";
import { perHour } from "../src/farm.js";
import { EVEN_WEEK } from "../src/route.js";
import { idsOn } from "./daylog.js";

// a weekday needs this many clean days before it gets a typical number
export const MIN_SAMPLES = 3;
// n the shop log this many days before its odds say anything
export const MIN_SHOP_DAYS = 14;
// past weeks before "3 of my last 4 weeks" means anything
export const MIN_WEEKS = 3;
// chance im on terra on a given day till the hours log knows
const BACK_GUESS = 0.9;
// hackatime h in a week before its credited share counts, under it one short session swings it
const MIN_SHARE_H = 2;

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

// hackatime days scaled down to what terra credited that week. AI time counts a third there n projects not on terra dont count at all
export function creditedDays(days, hoursLog, today) {
    const last = new Map();
    for (const day of Object.keys(hoursLog).sort()) {
        if (day < today) last.set(weekIndex(day), day);
    }
    const share = new Map();
    let credited = 0;
    let coded = 0;
    for (const [week, to] of last) {
        // credited as of my last logged day / hackatime through it
        const h = days.filter((d) => weekIndex(d.day) === week && d.day <= to).reduce((sum, d) => sum + d.h, 0);
        if (h < MIN_SHARE_H) continue;
        const c = hoursLog[to].seconds / 3600;
        share.set(week, Math.min(1, c / h)); // over 1 is just timing
        credited += c;
        coded += h;
    }
    // weeks i never logged get all logged weeks together, 1 with none
    const all = coded > 0 ? Math.min(1, credited / coded) : 1;
    return days.map((d) => ({ ...d, h: d.h * (share.get(weekIndex(d.day)) ?? all) }));
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

// each past week's h from today's weekday through sunday, [] till MIN_WEEKS of them. for "would i code x more this week"
// a lumped day in there puts the week out, its hours could be from before
export function restOfWeeks(days, today) {
    const from = weekDay(today);
    const sums = new Map();
    const out = new Set();
    // every week from the first one in days, nothing logged from today's weekday on (or at all) is a 0. careful side for buying
    const first = days.length ? Math.min(...days.map((d) => weekIndex(d.day))) : weekIndex(today);
    for (let week = first; week < weekIndex(today); week++) sums.set(week, 0);
    for (const { day, h, lumped } of days) {
        const week = weekIndex(day);
        if (week >= weekIndex(today) || weekDay(day) < from) continue;
        if (lumped) out.add(week);
        sums.set(week, sums.get(week) + h);
    }
    const rest = [...sums].filter(([week]) => !out.has(week)).map(([, h]) => h);
    return rest.length < MIN_WEEKS ? [] : rest;
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

function oneWater({ buy, sell, water }) {
    return { buy: buy / water, sell: sell / water, water: 1 };
}

// the made-up 1 water crop weeks after this one plant: every logged day's best seed, its buy n sell per water averaged
// a day with nothing counts as 0. under MIN_SHOP_DAYS just the last day that had something, null if none did
// a 2 water seed only takes 1 plot, as 1 water crops it asks for a few too many plots, so it comes out a bit careful
export function typicalCrop(shopLog, table, m) {
    const days = Object.keys(shopLog).sort().map((day) => bestOn(shopLog[day], table, m));
    if (days.length < MIN_SHOP_DAYS) {
        const last = days.filter(Boolean).at(-1);
        return last ? oneWater(last) : null;
    }
    const perWater = (key) => days.reduce((sum, crop) => sum + (crop ? crop[key] / crop.water : 0), 0) / days.length;
    return { buy: perWater("buy"), sell: perWater("sell"), water: 1 };
}

// worst n best seed heidi might have by water, as made-up 1 water crops. free seeds (no buy) arent hers
export function seedRange(table, m) {
    const seeds = Object.entries(table).filter(([, crop]) => crop.buy != null && crop.water).sort(([, a], [, b]) => perHour(a, m) - perHour(b, m));
    if (seeds.length === 0) return null;
    const pick = ([id, crop]) => ({ id, crop: oneWater(crop) });
    return { low: pick(seeds[0]), high: pick(seeds.at(-1)) };
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
// back = chance im on terra any one day (dayOdds)
export function waitTable(values, odds, days = 6, back = 1) {
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
        table.push(back * (worth + none * floor) + (1 - back) * floor); // a day im not on is just V_(n-1) again
    }
    return table;
}

// share of days terra was open off the hours log (a day = an hours.update seen), BACK_GUESS till it spans a week
export function dayOdds(hoursLog, today) {
    const days = Object.keys(hoursLog).filter((day) => day <= today).sort();
    if (days.length === 0) return BACK_GUESS;
    const span = Math.round((Date.parse(today) - Date.parse(days[0])) / DAY_MS) + 1;
    return span < 7 ? BACK_GUESS : days.length / span;
}

// { best: today's best seed, top: the one worth waiting for, odds: its share of days }, or null
// only with something in the shop today n when waiting actually wins. wait from waitWorth
export function waitFor(shopLog, today, crops, m, wait) {
    const here = today.filter((id) => crops[id]);
    if (here.length === 0 || wait === 0) return null;
    const value = (id) => perHour(crops[id], m);
    const best = here.reduce((a, b) => (value(b) > value(a) ? b : a));
    if (value(best) >= wait) return null;
    const odds = seedOdds(shopLog);
    const top = Object.keys(odds).filter((id) => crops[id]).reduce((a, b) => (value(b) > value(a) ? b : a));
    return { best, top, odds: odds[top] };
}

// worth of a water held for a better seed later this week, V_daysLeft. 0 under MIN_SHOP_DAYS of log or on sunday
// daysLeft = shop days after today this week, back from dayOdds
export function waitWorth(shopLog, crops, m, daysLeft, back = 1) {
    if (daysLeft < 1 || Object.keys(shopLog).length < MIN_SHOP_DAYS) return 0;
    const odds = seedOdds(shopLog);
    const values = Object.fromEntries(Object.keys(odds).filter((id) => crops[id]).map((id) => [id, perHour(crops[id], m)]));
    return waitTable(values, odds, daysLeft, back)[daysLeft];
}
