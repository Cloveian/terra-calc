// game messages into terra calc shapes. null = couldnt tell
import { PREP_WEEKS, FREE_PLOTS, PLOT_PRICE_MAX, CROPS } from "../src/data.js";
import { withoutZeros } from "../src/tree.js";
import { plotCost } from "../src/farm.js";

const APPLE_SEED = "apple_seed"; // terra's item ids
const DIRT_PLOT = "dirt_plot";

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

// coins and still plantable seeds from player.currency + inventory.sync. seeds = apple seeds (what model plans with), baseSeeds = free ones from ratticus
export function inventoryFrom(currency, inventory) {
    if (typeof currency?.coins !== "number" || !Array.isArray(inventory?.items)) return null;
    // game expiry rule, counts while weekNumber is in usableWeeks
    const weeks = new Set(inventory.usableWeeks ?? []);
    const usable = inventory.items.filter((item) => weeks.has(item.weekNumber));
    const count = (keep) => usable.filter(keep).reduce((sum, item) => sum + item.quantity, 0);
    return {
        coins: currency.coins,
        // only in farm room state. main.js fills it from farmFrom after farm visit or shopFrom before (under 19 plots)
        plots: null,
        seeds: count((item) => item.itemId === APPLE_SEED),
        // subtype "base", carrots in prep and strawberries from week 1. model assumes 10, steps need real count
        baseSeeds: count((item) => item.type === "seed" && item.subtype === "base"),
    };
}

// room state (schema.js) -> my farm, null off farm or on freinds farm. owner from joinComplete, me from userIdFromToken. plots and crops both farmItems, crops point at plotId
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
            name: crop.name,
            stage: stageOf(crop),
            review: crop.reviewState || null,
            week: crop.plantWeek,
        })),
    };
}

// every FarmItem field farmFrom + stageOf read. renamed one looks unset, stages n plot counts go wrong silenty. room handshake checked first
const FARM_FIELDS = ["id", "itemId", "name", "isCrop", "plotId", "fedAt", "shippedAt", "grownAt", "witheredAt", "reviewState", "plantWeek"];

// FarmItem fields missing from room handshake. no farmItems or no decoder (join without handshake) = nothing to flag
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

// crops stuck in review from before weekKey (hours.update, like "2026-W43"), all of them without one. week keys compare fine as strings, always 2 digit weeks
export function stuckFrom(farm, weekKey) {
    const stuck = (farm?.crops ?? []).filter((crop) => crop.stage === "review" && (!weekKey || crop.week < weekKey));
    const why = {};
    for (const crop of stuck) why[crop.review ?? "review"] = (why[crop.review ?? "review"] ?? 0) + 1;
    return { count: stuck.length, why };
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

// shop.stock, null when heidi's shop is closed. next plot costs min(plots - 9, 10) so under 10 = exact plot count, 10 = 19+
export function shopFrom(shopStock) {
    if (shopStock?.status !== "available" || !Array.isArray(shopStock.entries)) return null;
    const price = (itemId) => shopStock.entries.find((entry) => entry.itemId === itemId)?.priceCoins ?? null;
    const plotPrice = price(DIRT_PLOT);
    return {
        applePrice: price(APPLE_SEED),
        plotPrice,
        plots: plotPrice !== null && plotPrice < PLOT_PRICE_MAX ? plotPrice + FREE_PLOTS - 1 : null,
    };
}

// shop vs model mismatchs. terra price change = plan wrong till data.js catches up. plot one might just be old plot count (bought since farm visit or not placed yet), cant tell wich
export function shopProblems(shop, plots) {
    const problems = [];
    if (shop?.applePrice != null && shop.applePrice !== CROPS.apple.buy) {
        problems.push({ kind: "apple", text: `apple seeds cost ${shop.applePrice} now, the plan thinks ${CROPS.apple.buy}` });
    }
    if (shop?.plotPrice != null && plots != null) {
        const expected = plotCost(plots + 1, plots);
        if (shop.plotPrice !== expected) {
            problems.push({ kind: "plot", text: `the next plot costs ${shop.plotPrice}, the plan thinks ${expected} at ${plots} plots` });
        }
    }
    return problems;
}

// TODO: seedsFrom(shopStock) from bonus_seeds once data.js has SEEDS
