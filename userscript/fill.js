// game messages into terra calc shapes. null = couldnt tell
import { PREP_WEEKS } from "../src/data.js";
import { withoutZeros } from "../src/tree.js";

// GET /device-upgrades -> trees like TREES
// totals[0] (none bought) not in response so null, site fills it from data.js
// TODO: real tiered nodes titled per tier ("+8GB RAM") so name has the amount in it
export function treesFrom(deviceUpgrades) {
    if (!Array.isArray(deviceUpgrades?.devices)) return null;
    const trees = {};
    for (const d of deviceUpgrades.devices) {
        trees[d.id] = { device: d.title, root: d.root, nodes: d.nodes.map(nodeFrom) };
    }
    return trees;
}

function nodeFrom(n) {
    const node = { id: n.id, name: n.title };
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

// coins, plots and seeds from player.currency + inventory.sync
// TODO: plots and seeds need item type/subtype values from a capture with inventory open. items with weekNumber outside usableWeeks are expired, skip them (game hides them too)
export function inventoryFrom(currency, inventory) {
    return null;
}

// unit prices rounded, biggest base price (apples) least off
export function multiplyerFrom(marketItems) {
    const priced = (marketItems?.items ?? []).filter((item) => item.baseUnitCoins > 0);
    if (priced.length === 0) return null;
    const best = priced.reduce((a, b) => (b.baseUnitCoins > a.baseUnitCoins ? b : a));
    return best.unitPriceCoins / best.baseUnitCoins;
}

// TODO: seedsFrom(shopStock) from bonus_seeds entries once data.js has SEEDS, plus plot prices from dirt_plots entries with a warning if they dont match plotCost
