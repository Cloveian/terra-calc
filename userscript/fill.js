// game messages into terra calc shapes. null = couldnt tell
import { PREP_WEEKS, FREE_PLOTS, PLOT_PRICE_MAX, CROPS } from "../src/data.js";
import { withoutZeros } from "../src/tree.js";
import { plotCost, perHour } from "../src/farm.js";
import { easternDay } from "../src/week.js";

export const APPLE_SEED = "apple_seed"; // terra's item ids
const DIRT_PLOT = "dirt_plot";

// "eggplant_seed" -> "eggplant", ids like CROPS and the mix
export function seedId(itemId) {
    return itemId.replace(/_seed$/, "");
}

// "Eggplant Seeds" -> "Eggplant"
export function withoutSeeds(name) {
    return name.replace(/\s+Seeds?$/, "");
}

// GET /device-upgrades -> trees like TREES
// totals[0] (none bought) not in response so null, site fills it from data.js
// tiered nodes titled like their first tier ("+8GB RAM"), amount cut off -> "RAM"
export function treesFrom(deviceUpgrades) {
    if (!Array.isArray(deviceUpgrades?.devices)) return null;
    const trees = {};
    for (const d of deviceUpgrades.devices) {
        trees[d.id] = { device: d.title, root: d.root, nodes: d.nodes.map(nodeFrom) };
    }
    return trees;
}

function nodeFrom(n) {
    const node = { id: n.id, name: n.tiers?.length ? n.title.replace(/^\+\S+\s+/, "") : n.title };
    if (n.tiers?.length) {
        node.tiers = n.tiers.map((tier) => tier.price);
        const totals = n.tiers.map((tier) => totalIn(tier.description));
        if (totals.every((total) => total !== null)) node.totals = [null, ...totals];
    } else {
        node.cost = n.price;
    }
    node.requires = n.requires ?? [];
    // TODO numeric maxPurchases (none seen yet, limitOf has nowhere to put it)
    if (n.maxPurchases === null) node.limit = null;
    if (n.dynamicMaxPurchases) node.limit = { base: n.dynamicMaxPurchases.plus, per: n.dynamicMaxPurchases.baseNodeId };
    node.x = n.x;
    node.y = n.y;
    return node;
}

// "... (16GB total)" -> "16 GB" spaced like data.js
function totalIn(description) {
    const match = /\(([^()]+?)\s*total\)\s*$/.exec(description ?? "");
    return match ? match[1].replace(/(\d)\s*([A-Za-z])/, "$1 $2") : null;
}

// owned part of GET /device-upgrades for state.js
// todo: check owned skips refunded ones (purchases list)
export function ownedFrom(deviceUpgrades) {
    if (typeof deviceUpgrades?.mainDevice !== "string" || !deviceUpgrades.owned) return null;
    return { device: deviceUpgrades.mainDevice, own: withoutZeros(deviceUpgrades.owned) };
}

// GET /ysws/current-week -> t (0-2 prep, 3-14 main like week.js). by label, `number` past prep 2 unchecked
export function weekFrom(currentWeek) {
    const match = /^(Prep )?Week (\d+)$/.exec(currentWeek?.label ?? "");
    if (!match) return null;
    const n = Number(match[2]);
    return match[1] ? n - 1 : PREP_WEEKS + n - 1;
}

// GET /ysws/week-track -> "2026-10-19", eastern day the first week i shipped in starts. null till ive shipped
export function firstShipped(weekTrack) {
    const shipped = (weekTrack?.rows ?? []).filter((row) => row.shipped);
    const first = soonest(shipped.map((row) => Date.parse(row.startsAt)).filter(Number.isFinite));
    return first === null ? null : easternDay(new Date(first));
}

// coins, water and still plantable seeds from player.currency + inventory.sync. seeds = apple seeds (what model plans with, always bought), baseSeeds = free ones from ratticus, baseKinds = same by seed
export function inventoryFrom(currency, inventory) {
    if (typeof currency?.coins !== "number" || !Array.isArray(inventory?.items)) return null;
    // game expiry rule, counts while weekNumber is in usableWeeks
    const weeks = new Set(inventory.usableWeeks ?? []);
    const usable = inventory.items.filter((item) => weeks.has(item.weekNumber));
    const sum = (items) => items.reduce((total, item) => total + item.quantity, 0);
    // subtype "base", carrots in prep and strawberries from week 1. model assumes 10, steps need real count
    const base = usable.filter((item) => item.type === "seed" && item.subtype === "base");
    const bySeed = (items) => {
        const counts = {};
        for (const item of items) {
            const kind = seedId(item.itemId);
            counts[kind] = (counts[kind] ?? 0) + item.quantity;
        }
        return counts;
    };
    return {
        coins: currency.coins,
        // placed ones, only in farm room state. main.js fills it from farmFrom after farm visit or shopFrom before (under 19 plots)
        plots: null,
        // dirt plots in bag, bought but not placed yet or ratticus's loan ones (look the same). no week on them, all items counted
        unplaced: sum(inventory.items.filter((item) => item.itemId === DIRT_PLOT)),
        seeds: sum(usable.filter((item) => item.itemId === APPLE_SEED)),
        baseSeeds: sum(base),
        // per kind for card, prep 3 carrots still usuable in week 1 so can be both
        baseKinds: bySeed(base),
        // every other seed, { eggplant: 4 }. bought ones look like apple seeds with their own itemId
        bonus: bySeed(usable.filter((item) => item.type === "seed" && item.subtype !== "base" && item.itemId !== APPLE_SEED)),
        // water pool, devlogged hours minus what ive watered with. coded but not devlogged hours arent in it
        water: currency.water ?? 0,
        // ms, soonest seeds die if not planted n waterd by then (monday night US eastern). null with no seeds
        seedsDie: soonest(usable.filter((item) => item.type === "seed").map((item) => Date.parse(item.usableUntil))),
    };
}

function soonest(times) {
    return times.length > 0 ? Math.min(...times) : null;
}

// room state (schema.js) -> my farm, null off farm or on freinds farm. owner from joinComplete, me from userIdFromToken. plots and crops both farmItems, crops point at plotId
// todo: placed ratticus loan plots count as mine here till i see if a placed one looks dihfrent
export function farmFrom(state, farmOwnerId, myId) {
    if (!(state?.farmItems instanceof Map) || !farmOwnerId || farmOwnerId !== myId) return null;
    const items = [...state.farmItems.values()];
    const plots = items.filter((item) => !item.isCrop);
    const crops = items.filter((item) => item.isCrop);
    const used = new Set(crops.map((crop) => crop.plotId));
    return {
        plots: plots.length,
        empty: plots.filter((plot) => !used.has(plot.id)).length,
        crops: crops.map((crop) => ({
            seed: crop.itemId,
            id: seedId(crop.itemId),
            name: crop.name,
            // water still needed, all goes on in one go (eggplant takes 2)
            water: crop.fedAt ? 0 : Math.max(0, crop.waterRequired - crop.waterApplied),
            stage: stageOf(crop),
            // why its waiting, "review", "changes", "short" or "rejected"
            review: crop.reviewState || null,
            week: crop.plantWeek,
        })),
    };
}

// every FarmItem field farmFrom + stageOf read. renamed one looks unset, stages n plot counts go wrong silenty. room handshake checked first
const FARM_FIELDS = [
    "id", "itemId", "name", "isCrop", "plotId", "fedAt", "shippedAt", "grownAt", "witheredAt", "reviewState", "plantWeek",
    "waterRequired", "waterApplied",
];

// the FarmItem fields missing from the room's schema. [] when they're all there, when the room has no
// farmItems, or with no decoder (schema.js, null when the join had no handshake)
export function farmSchemaProblems(decoder) {
    const farmItems = decoder?.rootFields.find((field) => field.name === "farmItems");
    if(!farmItems) return [];
    const names = new Set(decoder.fieldsOf(farmItems.ref).map((field) => field.name));
    return FARM_FIELDS.filter((name) => !names.has(name));
}

// same order as game hints (cropStage-*.js)
function stageOf(crop) {
    if (crop.witheredAt > 0) return "withered";
    if (crop.grownAt > 0) return "ready";
    if (!crop.fedAt) return "dry";
    if (crop.shippedAt > 0) return "review";
    return "watered";
}

// crops still waiting on a review from before weekKey (from hours.update, like "2026-W43"), counted up by
// why ({ review: 2, changes: 1 }) and with the crops themselves so the card can say what they are.
// no weekKey and every crop in review counts. week keys compare fine as strings, the number's always two digits
export function stuckFrom(farm, weekKey) {
    const stuck = farm.crops.filter((crop) => crop.stage === "review" && (!weekKey || crop.week < weekKey));
    const why = {};
    for (const crop of stuck) why[crop.review ?? "review"] = (why[crop.review ?? "review"] ?? 0) + 1;
    return { count: stuck.length, why, crops: stuck };
}

// ratticus's loan plots among unplaced ones. one lent per stuck crop, plain dirt plot in bag (no subtype, plotLoan.request on join gets no answer). unplaced >= stuck = that many are loans, fewer = cant tell so 0
export function loansFrom(inventory, stuck) {
    const count = stuck?.count ?? 0;
    return count > 0 && inventory?.unplaced >= count ? count : 0;
}

// auth token = JWT, userId in middle part = me for farmOwnerId
export function userIdFromToken(token) {
    const middle = typeof token === "string" ? token.split(".")[1] : null;
    if (!middle) return null;
    try {
        return JSON.parse(atob(middle.replace(/-/g, "+").replace(/_/g, "/"))).userId ?? null;
    } catch {
        return null;
    }
}

// unit prices rounded, biggest base price (apples) least off
export function multiplyerFrom(marketItems) {
    const priced = (marketItems?.items ?? []).filter((item) => item.baseUnitCoins > 0);
    if (priced.length === 0) return null;
    const best = priced.reduce((a, b) => (b.baseUnitCoins > a.baseUnitCoins ? b : a));
    return best.unitPriceCoins / best.baseUnitCoins;
}

// what i could sell right now, null till market's been open. rent ones are in locked
export function forSaleFrom(marketItems) {
    if (!marketItems) return null;
    const items = marketItems.items ?? [];
    return {
        crops: items.reduce((total, item) => total + item.quantity, 0),
        coins: items.reduce((total, item) => total + item.quantity * item.unitPriceCoins, 0),
    };
}

// shop.stock, null when heidi's shop is closed. next plot costs min(plots - 9, 10) so under 10 = exact plot count, 10 = 19+
export function shopFrom(shopStock) {
    if (shopStock?.status !== "available" || !Array.isArray(shopStock.entries)) return null;
    const price = (itemId) => shopStock.entries.find((entry) => entry.itemId === itemId)?.priceCoins ?? null;
    const plotPrice = price(DIRT_PLOT);
    return {
        plotPrice,
        plots: plotPrice !== null && plotPrice < PLOT_PRICE_MAX ? plotPrice + FREE_PLOTS - 1 : null,
    };
}

// next plot price vs the formula n seeds past the worst n best a water in data.js, as words, [] when it all fits
// a plot mismatch can also just mean plots is old (bought some since the farm was seen, or not placed yet), can't tell which
export function shopProblems(shop, plots) {
    const problems = [];
    if (shop?.plotPrice != null && plots != null) {
        const expected = plotCost(plots + 1, plots);
        if (shop.plotPrice !== expected) problems.push(`the next plot costs ${shop.plotPrice}, the plan thinks ${expected} at ${plots} plots`);
    }
    // apple 25 to eggplant 30 at m 1
    const known = Object.values(CROPS).filter((crop) => crop.buy != null).map((crop) => perHour(crop, 1));
    const low = Math.min(...known);
    const high = Math.max(...known);
    for (const seed of shop?.seeds ?? []) {
        const v = perHour(seed, 1);
        if (v < low || v > high) problems.push(`${seed.name} is ${Math.round(v * 10) / 10} a water at m 1, data.js has ${low} to ${high}`);
    }
    return problems;
}

// todays seeds from shop.stock, apples too when they're in, [] when closed. entries without cropValue and waterNeeded left out
export function seedsFrom(shopStock) {
    if (shopStock?.status !== "available" || !Array.isArray(shopStock.entries)) return [];
    return shopStock.entries
        .filter((entry) => entry.category === "bonus_seeds" && entry.itemId
            && typeof entry.cropValue === "number" && typeof entry.waterNeeded === "number")
        .map((entry) => ({
            id: seedId(entry.itemId),
            name: withoutSeeds(entry.name ?? entry.itemId),
            buy: entry.priceCoins,
            sell: entry.cropValue,
            water: entry.waterNeeded,
        }));
}
