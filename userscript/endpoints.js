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
    hours: "hours.update",
    joinComplete: "joinComplete", // { farmOwnerId, tutorialStep }, farmOwnerId null off farms
};

// sent on game socket
export const OUT = {
    requestCurrency: "currency.request",
    requestInventory: "inventory.request",
    buy: "shop.purchase", // { stockEntryId, requestId, expectedPriceCoins } one entry per send
    requestMarket: "market.request",
    sell: "npc.sellCrops", // { npcId, nodeId, selections: [{ itemId, quantity }] }
};

// response shapes, fields fill.js and main.js read + some unread yet (shop.stock, hours goal, number, rentRequired). type name, ? = can be missing or null, [spec] list, { } object, opt(...) optional list or object. other fields come and go, terra adds stuff constantly
const OPTIONAL_SPEC = Symbol("optional");
const opt = (spec) => ({ [OPTIONAL_SPEC]: spec });

const SHAPES = {
    [REST.deviceUpgrades]: {
        devices: [{
            id: "string",
            title: "string",
            root: { x: "number", y: "number" },
            nodes: [{
                id: "string",
                title: "string",
                price: "number",
                requires: opt(["string"]),
                maxPurchases: "number?",
                dynamicMaxPurchases: opt({ baseNodeId: "string", plus: "number" }),
                tiers: opt([{ price: "number", description: "string?" }]),
                x: "number",
                y: "number",
            }],
        }],
        mainDevice: "string",
        owned: "object",
    },
    [REST.currentWeek]: { number: "number", label: "string", rentRequired: "boolean", endDate: "string?" },
    [IN.currency]: { coins: "number" },
    [IN.inventory]: {
        usableWeeks: ["number"],
        items: [{ itemId: "string", type: "string", subtype: "string?", quantity: "number", weekNumber: "number?" }],
    },
    [IN.marketItems]: { items: [{ unitPriceCoins: "number", baseUnitCoins: "number" }] },
    [IN.shopStock]: { status: "string", entries: [{ id: "string", category: "string", itemId: "string?", priceCoins: "number" }] },
    [IN.hours]: { weekKey: "string", goalSeconds: "number", week: { creditedSeconds: "number" } },
    [IN.joinComplete]: { farmOwnerId: "string?" },
};

// changed response flags like "devices[0].nodes[3].price: expected number, got string", 5 max so a renamed field isnt one line per inventory item
export const CHECKS = Object.fromEntries(
    Object.entries(SHAPES).map(([key, spec]) => [key, (body) => problemsIn(body, spec, "").slice(0, 5)]),
);

function problemsIn(value, spec, path) {
    const at = path || "body";
    if (typeof spec === "string") {
        const type = spec.replace("?", "");
        if (value === undefined || value === null) return spec.endsWith("?") ? [] : [`${at}: missing`];
        const got = Array.isArray(value) ? "array" : typeof value;
        return got === type ? [] : [`${at}: expected ${type}, got ${got}`];
    }
    if (spec[OPTIONAL_SPEC]) return value === undefined || value === null ? [] : problemsIn(value, spec[OPTIONAL_SPEC], path);
    if (value === undefined || value === null) return [`${at}: missing`];
    if (Array.isArray(spec)) {
        if (!Array.isArray(value)) return [`${at}: expected a list`];
        return value.flatMap((item, i) => problemsIn(item, spec[0], `${path}[${i}]`));
    }
    if (value === null || typeof value !== "object" || Array.isArray(value)) return [`${at}: expected an object`];
    return Object.entries(spec).flatMap(([key, sub]) => problemsIn(value[key], sub, path ? `${path}.${key}` : key));
}
