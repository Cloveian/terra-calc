// buying with my hours not certain, newsvendor with my past weeks as the demand

// steps from stepsFrom, rest from restOfWeeks, codedToday = h already in today (rest has those in too)
// bought seeds get water after everything planted or in the bag, best sale per water first. a skipped one doesnt push the ones behind it later
// null with no history or nothing to buy
export function buyRisk(steps, table, m, rest, codedToday) {
    const buys = steps.filter((step) => step.do === "buySeeds");
    if (rest.length === 0 || buys.length === 0) return null;
    const perWater = (id) => table[id].sell / table[id].water;
    const seeds = buys.flatMap(({ seed, n }) => Array(n).fill(seed)).sort((a, b) => perWater(b) - perWater(a));
    const code = steps.find((step) => step.do === "code")?.n ?? 0;
    const boughtWater = seeds.reduce((sum, id) => sum + table[id].water, 0);
    // h to code before the first bought seed gets any, under 0 when the pool covers some of them
    let need = code - boughtWater;
    const weeks = (h) => rest.filter((r) => r >= codedToday + Math.max(0, h)).length;
    let kept = 0;
    const skip = {};
    for (const id of seeds) {
        const h = need + table[id].water;
        // break-even chance, apple 17% eggplant 20% bok choy 27% at m 1
        if (weeks(h) / rest.length > table[id].buy / (m * table[id].sell)) {
            need = h;
            kept++;
        } else {
            // need didnt move, so the rest of that seed get the same h n the same weeks
            skip[id] ??= { n: 0, weeks: weeks(h) };
            skip[id].n++;
        }
    }
    return { h: Math.max(0, Math.ceil(need * 10) / 10), weeks: weeks(need), of: rest.length, kept, skip };
}
