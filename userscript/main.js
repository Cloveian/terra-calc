// userscript entry point
import { REST, IN, TOKEN_KEY } from "./endpoints.js";
import { apiGet, liveBuild } from "./api.js";
import { hookWebSocket, onGameMessage, ROOM } from "./socket.js";
import { loadSettings, saveSettings } from "./settings.js";
import { setDebug, debug } from "./debug.js";
import { mountPanel, drawPanel, showNotice } from "./panel.js";
import {
    treesFrom, ownedFrom, weekFrom, inventoryFrom, multiplyerFrom, farmFrom, stuckFrom, userIdFromToken,
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
    farmOwnerId: null, // whose farm this room is (joinComplete)
    roomState: null,
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
onGameMessage(IN.hours, (body) => changed("hours", body));

// room state and owner come in either order, both try readFarm. new room forgets owner first or friend's farm passes for mine till their joinComplete
onGameMessage(ROOM.joined, () => {
    game.farmOwnerId = null;
    game.roomState = null;
});
onGameMessage(IN.joinComplete, (body) => {
    game.farmOwnerId = body?.farmOwnerId ?? null;
    readFarm();
});
onGameMessage(ROOM.state, ({ state, touched }) => {
    game.roomState = state;
    // most patches = players walking, reread only on farm item changes
    const items = state.farmItems;
    if (items instanceof Map && (touched.has(items) || [...items.values()].some((item) => touched.has(item)))) readFarm();
});
onGameMessage(ROOM.broken, () => {
    game.roomState = null;
});

document.addEventListener("DOMContentLoaded", start);

async function start() {
    if (settings.panel) mountPanel();
    if (!settings.fill) return drawPanel(null);
    // TODO: refetch on new week + after upgrade buy
    try {
        changed("deviceUpgrades", await apiGet(REST.deviceUpgrades));
        changed("currentWeek", await apiGet(REST.currentWeek));
    } catch (err) {
        console.warn("[terra-calc]", err);
        showNotice(`Couldn't read Terra (${err.message}), type the numbers in for now.`);
    }
    if (settings.debug) {
        liveBuild().then((build) => debug("live build", build), (err) => debug("no live build", err));
    }
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
    const farm = farmFrom(game.roomState, game.farmOwnerId, myId());
    if (!farm) return;
    game.farm = { ...farm, seenAt: Date.now() };
    saveFarm(game.farm);
    debug("farm", { plots: farm.plots, empty: farm.empty, stuck: stuckFrom(farm, game.hours?.weekKey) });
    drawPanel(plan());
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
        inventory: inventory && { ...inventory, plots: game.farm?.plots ?? null },
        m: multiplyerFrom(game.marketItems),
        farm: game.farm,
        stuck: game.farm && stuckFrom(game.farm, game.hours?.weekKey),
    };
    const missing = Object.keys(parts).filter((key) => parts[key] === null);
    debug("plan", missing.length > 0 ? `missing ${missing.join(", ")}` : "has everything", parts);
    if (missing.some((key) => !OPTIONAL.has(key))) return null;
    return parts;
}
