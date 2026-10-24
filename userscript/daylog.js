// per terra day log of heidi's seeds n how far into the weeks hours i was
// raw on purpose, the day predictions n the better-seed odds get worked out from these

// ~2 months, a few KB
export const KEEP_DAYS = 60;

// "2026-10-23" day keys sort as strings, oldest go first
function trim(log) {
    const days = Object.keys(log).sort();
    if (days.length <= KEEP_DAYS) return log;
    return Object.fromEntries(days.slice(-KEEP_DAYS).map((day) => [day, log[day]]));
}

// { "2026-10-24": [{ id: "cabbage", name, buy, sell, water }] }, seedsFrom rows by id. an empty list is a day heidi had none
// older days are just ids, ["apple", "eggplant"]
export function logShop(log, dateKey, seeds) {
    if (!dateKey) return log;
    const rows = seeds.map(({ id, name, buy, sell, water }) => ({ id, name, buy, sell, water }));
    return trim({ ...log, [dateKey]: rows.sort((a, b) => a.id.localeCompare(b.id)) });
}

// a logged day's seed ids, old id-only days too
export function idsOn(seeds) {
    return seeds.map((seed) => seed.id ?? seed);
}

// every seed the log has numbers for, { cabbage: { name, buy, sell, water } }, newest day wins
export function knownSeeds(log) {
    const known = {};
    for (const day of Object.keys(log).sort()) {
        for (const seed of log[day]) {
            if (seed.id) known[seed.id] = { name: seed.name, buy: seed.buy, sell: seed.sell, water: seed.water };
        }
    }
    return known;
}

// { "2026-10-23": { weekKey: "2026-W43", seconds: 105000 } }, the last hours.update seen that day
// a days work = its seconds - the day before (same week), days terra wasnt open lump into the next one seen
export function logHours(log, day, weekKey, seconds) {
    return trim({ ...log, [day]: { weekKey, seconds } });
}

// h of weekKey coded before today, the latest day before it thats in the log. 0 if theres none (monday, or terra wasnt open)
export function codedBefore(log, today, weekKey) {
    let seconds = 0;
    for (const [day, entry] of Object.entries(log)) {
        if (day < today && entry.weekKey === weekKey) seconds = Math.max(seconds, entry.seconds);
    }
    return seconds / 3600;
}
