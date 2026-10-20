// userscript entry point
import { REST, IN, KNOWN_BUILD } from "./endpoints.js";
import { apiGet, liveBuild } from "./api.js";
import { hookWebSocket, onGameMessage } from "./socket.js";
import { loadSettings, saveSettings } from "./settings.js";
import { setDebug, debug } from "./debug.js";
import { mountPanel, drawPanel, showNotice } from "./panel.js";
import { treesFrom, ownedFrom, weekFrom, inventoryFrom, multiplyerFrom } from "./fill.js";

// latest from game
const game = {
    deviceUpgrades: null,
    currentWeek: null,
    currency: null,
    inventory: null,
    marketItems: null,
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
    try {
        const build = await liveBuild();
        debug("live build", build, build === KNOWN_BUILD ? "(known)" : `(last checked against ${KNOWN_BUILD})`);
        if (build !== KNOWN_BUILD) {
            showNotice("Terra has updated since Terra Calc was last checked, so some numbers might be off.");
        }
    } catch (err) {
        debug("no live build", err); // no version.json, skip
    }
}

// plan rerun every change, same src/ as site. panel only gets plan
function changed(key, body) {
    game[key] = body;
    drawPanel(plan());
}

// fill.js output only for now. todo: fill.js state + my goal (saved like site link) -> hoursNeeded + milestones (src/route.js) + goalCost (src/tree.js). reward-estimate water = hours done this week
function plan() {
    const parts = {
        trees: treesFrom(game.deviceUpgrades),
        owned: ownedFrom(game.deviceUpgrades),
        t: weekFrom(game.currentWeek),
        inventory: inventoryFrom(game.currency, game.inventory),
        m: multiplyerFrom(game.marketItems), // can stay null (panel asks for it)
    };
    const missing = Object.keys(parts).filter((key) => parts[key] === null);
    debug("plan", missing.length > 0 ? `missing ${missing.join(", ")}` : "has everything", parts);
    if (missing.some((key) => key !== "m")) return null;
    return parts;
}
