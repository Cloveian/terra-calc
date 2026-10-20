// userscript entry point
import { REST, IN, TOKEN_KEY } from "./endpoints.js";
import { apiGet, liveBuild } from "./api.js";
import { hookWebSocket, onGameMessage, ROOM } from "./socket.js";
import { loadSettings, saveSettings } from "./settings.js";
import { setDebug, debug } from "./debug.js";
import { mountPanel, drawPanel, showNotice } from "./panel.js";
import {
    treesFrom, ownedFrom, weekFrom, inventoryFrom, multiplyerFrom, farmFrom, stuckFrom, userIdFromToken,
    shopFrom, shopProblems, farmSchemaProblems,
} from "./fill.js";

const FARM_KEY = "terra-calc-farm";

// can stay null: m and plots (panel asks), farm and stuck (only after farm visit)
const OPTIONAL = new Set(["m", "farm", "stuck"]);

// latest from game. farm = last visit to my own farm, saved for reloads in town (seenAt for its age)
const game = {
    deviceUpgrades: null,
    currentWeek: null,
    currency: null,
    inventory: null,
    marketItems: null,
    hours: null,
    shop: null, // shopFrom, last time heidi's shop was open
    farmOwnerId: null, // whose farm this room is (joinComplete)
    roomState: null,
    farmReadable: true, // false = room FarmItem missing fields farmFrom needs
    farm: loadFarm(),
};

const settings = loadSettings();
setDebug(settings.debug);
debug("settings", settings);

// console handle. terraCalc.debug(true) is saved, reload logs socket opening too
window.terraCalc = {
    game,
    settings,
    plan,
    debug(on = true) {
        settings.debug = on;
        saveSettings(settings);
        setDebug(on);
        return on ? "debug logging on, reload to see the socket from the start" : "debug logging off";
    },
};

// hooked at document-start
hookWebSocket();
onGameMessage(IN.currency, (body) => changed("currency", body));
onGameMessage(IN.inventory, (body) => changed("inventory", body));
onGameMessage(IN.marketItems, (body) => changed("marketItems", body));
onGameMessage(IN.hours, (body) => {
    const before = game.hours?.weekKey;
    changed("hours", body);
    // new week = new label, maybe new upgrade prices
    if (settings.fill && before && body?.weekKey && body.weekKey !== before) readRest();
});

onGameMessage(IN.shopStock, (body) => {
    const shop = shopFrom(body);
    if (shop) game.shop = { ...shop, seenAt: Date.now() };
    checkShop();
    drawPanel(plan());
});

// room state and owner come in either order, both try readFarm. new room forgets owner first or friend's farm passes for mine till their joinComplete
onGameMessage(ROOM.joined, ({ decoder }) => {
    game.farmOwnerId = null;
    game.roomState = null;
    // renamed farm fields = made up stages, so this room's farm gets skipped completly
    const missing = farmSchemaProblems(decoder);
    game.farmReadable = missing.length === 0;
    if (!game.farmReadable) {
        debug("farm items look different, missing", missing);
        showNotice(`Terra's farm changed (no ${missing.join(", ")}), so Terra Calc can't read your crops or plots till it catches up.`);
    }
});
onGameMessage(IN.joinComplete, (body) => {
    game.farmOwnerId = body?.farmOwnerId ?? null;
    readFarm();
});
onGameMessage(ROOM.state, ({ state, touched }) => {
    game.roomState = state;
    if (farmTouched(state, touched)) readFarm();
});
onGameMessage(ROOM.broken, () => {
    game.roomState = null;
});

document.addEventListener("DOMContentLoaded", start);

async function start() {
    if (settings.panel) mountPanel();
    if (!settings.fill) return drawPanel(null);
    await readRest();
    if (settings.debug) {
        liveBuild().then((build) => debug("live build", build), (err) => debug("no live build", err));
    }
}

// REST bits, at start + on new week
// TODO: after upgrade buys too, game uses fetch we dont see. maybe when coins drop?
async function readRest() {
    try {
        changed("deviceUpgrades", await apiGet(REST.deviceUpgrades));
        changed("currentWeek", await apiGet(REST.currentWeek));
    } catch (err) {
        console.warn("[terra-calc]", err);
        showNotice(`Couldn't read Terra (${err.message}), type the numbers in for now.`);
    }
}

// most patches = players walking, true only on farm item changes
function farmTouched(state, touched) {
    const items = state.farmItems;
    return items instanceof Map && (touched.has(items) || [...items.values()].some((item) => touched.has(item)));
}

// plan rerun every change, same src/ as site. panel only gets plan
function changed(key, body) {
    game[key] = body;
    drawPanel(plan());
}

function myId() {
    return userIdFromToken(localStorage.getItem(TOKEN_KEY));
}

// my farm out of this room, kept and saved only if its really mine
function readFarm() {
    if (!game.farmReadable) return;
    const farm = farmFrom(game.roomState, game.farmOwnerId, myId());
    if (!farm) return;
    game.farm = { ...farm, seenAt: Date.now() };
    saveFarm(game.farm);
    debug("farm", { plots: farm.plots, empty: farm.empty, stuck: stuckFrom(farm, game.hours?.weekKey) });
    checkShop();
    drawPanel(plan());
}

// shop prices vs model, again on every new plot count. notice for apples only, off plot price just as likley old farm so logged only
function checkShop() {
    const problems = shopProblems(game.shop, game.farm?.plots ?? null);
    if (problems.length > 0) debug("shop doesn't match the plan", problems);
    for (const { kind, text } of problems) {
        if(kind === "apple") showNotice(`Terra's prices changed: ${text}. The plan's off till Terra Calc catches up.`);
    }
}

// farm or shop, whichever seen last. shop only knows under 19
function plotsNow() {
    const { farm, shop } = game;
    if (shop?.plots != null && !(farm?.seenAt > shop.seenAt)) return shop.plots;
    return farm?.plots ?? null;
}

// saved with owner id, other acounts on this browser get nothing
function loadFarm() {
    try {
        const saved = JSON.parse(localStorage.getItem(FARM_KEY) ?? "null");
        return saved && saved.userId === myId() ? saved.farm : null;
    } catch {
        return null;
    }
}

function saveFarm(farm) {
    try {
        localStorage.setItem(FARM_KEY, JSON.stringify({ userId: myId(), farm }));
    } catch {
        // reread next farm visit
    }
}

// fill.js output only for now. todo: fill.js state + my goal (saved like site link) -> hoursNeeded + milestones (src/route.js) + goalCost (src/tree.js). reward-estimate water = hours done this week
function plan() {
    const inventory = inventoryFrom(game.currency, game.inventory);
    const parts = {
        trees: treesFrom(game.deviceUpgrades),
        owned: ownedFrom(game.deviceUpgrades),
        t: weekFrom(game.currentWeek),
        inventory: inventory && { ...inventory, plots: plotsNow() },
        m: multiplyerFrom(game.marketItems),
        farm: game.farm,
        stuck: game.farm && stuckFrom(game.farm, game.hours?.weekKey),
    };
    const missing = Object.keys(parts).filter((key) => parts[key] === null);
    debug("plan", missing.length > 0 ? `missing ${missing.join(", ")}` : "has everything", parts);
    if (missing.some((key) => !OPTIONAL.has(key))) return null;
    return parts;
}
