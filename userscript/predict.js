// day hours off the hours log, a typical day per weekday n the week shape, n the wait-for-a-better-seed odds
import { weekDay, DAY_MS } from "../src/week.js";
import { perHour } from "./shop.js";
import { EVEN_WEEK } from "../src/route.js";

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

// median clean h per weekday, [mon ... sun], null till MIN_SAMPLES of them
export function typicalDays(days) {
    const byDay = Array.from({ length: 7 }, () => []);
    for (const { day, h, lumped } of days) {
        if (!lumped) byDay[weekDay(day)].push(h);
    }
    return byDay.map((hs) => (hs.length < MIN_SAMPLES ? null : median(hs)));
}

// typicalDays -> share of my week per weekday, adds to 1. even till every weekday has a number, or if they're all 0
export function weekShape(typical) {
    const total = typical.reduce((sum, h) => sum + (h ?? 0), 0);
    if (typical.includes(null) || total <= 0) return EVEN_WEEK;
    return typical.map((h) => h / total);
}

function median(xs) {
    const sorted = [...xs].sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// share of logged shop days each seed was in, { eggplant: 0.4, apple: 0.9 }
export function seedOdds(shopLog) {
    const days = Object.values(shopLog);
    const counts = {};
    for (const seeds of days) {
        for (const id of seeds) counts[id] = (counts[id] ?? 0) + 1;
    }
    return Object.fromEntries(Object.entries(counts).map(([id, n]) => [id, n / days.length]));
}

// what a water's worth with n shop days still to come, [V_0 ... V_days], V_0 = apple
// V_n = E[max(best seed in that day's shop, V_(n-1))], each seed in on its own with its odds. house-selling problem, worked back from sunday
// values = perHour (shop.js) per seed. buy today's seed for water i'm sure of if its value >= V_(days left after today)
// todo: apples arent always there either, sunday without them is worth less
export function waitTable(values, odds, apple, days = 6) {
    const ids = Object.keys(values).filter((id) => odds[id] > 0);
    const table = [apple];
    for (let n = 1; n <= days; n++) {
        let worth = 0;
        // every mix of whos in the shop, 2^ids (2 bonus seeds = 4)
        for (let mask = 0; mask < 1 << ids.length; mask++) {
            let p = 1;
            let best = apple;
            ids.forEach((id, i) => {
                const there = (mask >> i) & 1;
                p *= there ? odds[id] : 1 - odds[id];
                if (there) best = Math.max(best, values[id]);
            });
            worth += p * Math.max(best, table[n - 1]);
        }
        table.push(worth);
    }
    return table;
}

// { best: today's bonus seed, top: the one worth waiting for, odds: its share of days }, or null
// only on days heidi has a bonus seed, with MIN_SHOP_DAYS of log, n when waiting actually wins. daysLeft = shop days after today this week
export function waitFor(shopLog, today, crops, m, daysLeft) {
    const bonus = today.filter((id) => crops[id]);
    if (bonus.length === 0 || daysLeft < 1 || Object.keys(shopLog).length < MIN_SHOP_DAYS) return null;
    const value = (id) => perHour(crops[id], m);
    const odds = seedOdds(shopLog);
    // apple is the floor already (V_0)
    const values = Object.fromEntries(Object.keys(odds).filter((id) => crops[id] && id !== "apple").map((id) => [id, value(id)]));
    const best = bonus.reduce((a, b) => (value(b) > value(a) ? b : a));
    const wait = waitTable(values, odds, value("apple"), daysLeft)[daysLeft];
    if (Math.max(value(best), value("apple")) >= wait) return null;
    const top = Object.keys(values).reduce((a, b) => (values[b] > values[a] ? b : a));
    return { best, top, odds: odds[top] };
}
