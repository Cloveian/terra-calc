// userscript entry point
import { REST, IN, KNOWN_BUILD } from "./endpoints.js";
import { apiGet, liveBuild } from "./api.js";
import { hookWebSocket, onGameMessage } from "./socket.js";
import { loadSettings } from "./settings.js";
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
        if ((await liveBuild()) !== KNOWN_BUILD) {
            showNotice("Terra has updated since Terra Calc was last checked, so some numbers might be off.");
        }
    } catch {
        // no version.json, skip
    }
}

// plan rerun every change, same src/ as site. panel only gets plan
function changed(key, body) {
    game[key] = body;
    drawPanel(plan());
}

// fill.js output only for now. todo: fill.js state + my goal (saved like site link) -> hoursNeeded + milestones (src/route.js) + goalCost (src/tree.js). reward-estimate water = hours done this week
function plan() {
    const trees = treesFrom(game.deviceUpgrades);
    const owned = ownedFrom(game.deviceUpgrades);
    const t = weekFrom(game.currentWeek);
    const inventory = inventoryFrom(game.currency, game.inventory);
    const m = multiplyerFrom(game.marketItems);
    if (!trees || !owned || t === null || !inventory) return null;
    return { trees, owned, t, inventory, m };
}
