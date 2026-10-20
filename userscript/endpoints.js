// all URLs and message names

export const API_BASE = "https://api.terra.hackclub.com";
export const VERSION_URL = "https://terra.hackclub.com/version.json";
export const GAME_HOST = "game.terra.hackclub.com";
export const TOKEN_KEY = "terra_auth_token"; // in localStorage

export const REST = {
    deviceUpgrades: "/device-upgrades",
    buyUpgrade: "/device-upgrades/purchase", // POST { nodeId }
    currentWeek: "/ysws/current-week",
    projects: "/ysws/projects",
    rewardEstimate: (id) => `/ysws/projects/${id}/reward-estimate`,
};

// websocket messages
export const IN = {
    currency: "player.currency",
    inventory: "inventory.sync",
    shopStock: "shop.stock",
    purchaseResult: "shop.purchaseResult",
    marketItems: "market.items",
    saleResult: "market.saleResult",
};

// sent on game socket
export const OUT = {
    requestCurrency: "currency.request",
    requestInventory: "inventory.request",
    buy: "shop.purchase", // { stockEntryId, requestId, expectedPriceCoins } one entry per send
    requestMarket: "market.request",
    sell: "npc.sellCrops", // { npcId, nodeId, selections: [{ itemId, quantity }] }
};

// changed response flags
// TODO: check every field fill.js reads
export const CHECKS = {
    [REST.deviceUpgrades]: (body) => missing(body, ["devices", "owned", "coins"]),
    [REST.currentWeek]: (body) => missing(body, ["number", "label", "rentRequired"]),
    [IN.currency]: (body) => missing(body, ["coins"]),
    [IN.inventory]: (body) => missing(body, ["items", "usableWeeks"]),
    [IN.marketItems]: (body) => missing(body, ["items"]),
    // todo: shop.stock once a capture shows real entries
};

function missing(body, keys) {
    if (body === null || typeof body !== "object") return ["not an object"];
    return keys.filter((k) => !(k in body)).map((k) => `no ${k}`);
}
