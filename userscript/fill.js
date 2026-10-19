// game messages into terra calc shapes. null = couldnt tell

// GET /device-upgrades -> { [deviceId]: tree } in TREES shape:
//   title -> name, price/tiers -> cost or tiers: [price...], tier "(16GB total)" -> totals,
//   maxPurchases null -> limit null, dynamicMaxPurchases { baseNodeId, plus } -> limit { base: plus, per: baseNodeId },
//   no requires -> [], x/y + device root copied
// TODO totals need both "16GB" and "16 GB" (fixture has spaced one)
// totals[0] (none bought) missing from response, maybe in device description
export function treesFrom(deviceUpgrades) {
    return null;
}

// GET /device-upgrades -> { device, own } for state.js (own = `owned` as is)
// todo: check owned skips refunded ones (purchases list)
export function ownedFrom(deviceUpgrades) {
    return null;
}

// GET /ysws/current-week -> t (0-2 prep, 3-14 main like week.js). prep 2 was number 7 so t = number - 6 if numbered in order. week 1 unchecked
export function weekFrom(currentWeek) {
    return null;
}

// coins, plots and seeds from player.currency + inventory.sync
// TODO: plots and seeds need item type/subtype values from a capture with inventory open. items with weekNumber outside usableWeeks are expired, skip them (game hides them too)
export function inventoryFrom(currency, inventory) {
    return null;
}

// this weeks multiplier off market.items (unitPriceCoins / baseUnitCoins), null if nothing to read. apple only for now (two crops can round dihfrent)
export function multiplyerFrom(marketItems) {
    return null;
}

// TODO: seedsFrom(shopStock) from bonus_seeds entries once data.js has SEEDS, plus plot prices from dirt_plots entries with a warning if they dont match plotCost
