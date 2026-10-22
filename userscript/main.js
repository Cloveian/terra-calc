// userscript entry point
import { REST, IN, TOKEN_KEY } from "./endpoints.js";
import { apiGet, liveBuild } from "./api.js";
import { hookWebSocket, onGameMessage, ROOM } from "./socket.js";
import { loadSettings, saveSettings, mountSettings } from "./settings.js";
import { setDebug, debug } from "./debug.js";
import { mountCard, drawCard, showNotice } from "./card.js";
import {
    treesFrom, ownedFrom, weekFrom, inventoryFrom, multiplyerFrom, farmFrom, stuckFrom, userIdFromToken,
    shopFrom, shopProblems, farmSchemaProblems, loansFrom,
} from "./fill.js";
import { weekTarget, stepsFrom, routeState, rowHours, tickSteps } from "./next.js";
import { cleanGoal, goalCoins, goalItems } from "./goal.js";
import { mountWantBits, drawWantBits, changeWant, openTree } from "./want.js";
import { milestones } from "../src/route.js";
import { byId } from "../src/tree.js";

const FARM_KEY = "terra-calc-farm";
const GOAL_KEY = "terra-calc-goal";
const STEPS_KEY = "terra-calc-week-steps";

// can stay null: plots (card asks), farm and stuck (only after farm visit), target (needs plots), goal (till i pick one)
const OPTIONAL = new Set(["farm", "stuck", "target", "goal"]);

// guess till a reviewed crop is in the market, m comes from project review
const M_GUESS = 1.1;

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
    farm: loadMine(FARM_KEY),
};

// cleaned against live trees every plan(), null = rent week
let savedGoal = loadMine(GOAL_KEY);
let treeBits = null; // set in plan(), for drawWantBits
let savedSteps = loadMine(STEPS_KEY); // week checklist as it first came out, for the ticks

const settings = loadSettings();
setDebug(settings.debug);
debug("settings", settings);

// console handle. terraCalc.debug(true) is saved, reload logs socket opening too
window.terraCalc = {
    game,
    settings,
    plan,
    // terraCalc.goal({ want: { ram_12: 2 } }) or ({ goal: 5000 }), null clears. prio like { "ram_12:2": 1 }
    goal: setGoal,
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
    draw();
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
    // before the fill check, its where i'd turn fill back on
    mountSettings(settings, () => {
        saveSettings(settings);
        setDebug(settings.debug);
        draw();
    });
    if (settings.panel) mountCard(openTree);
    if (!settings.fill) return drawCard(null);
    mountWantBits(pickWant, pickPrio);
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

function draw() {
    drawCard(plan());
    drawWantBits(treeBits);
}

// + or - from terra's tree. picking on another device moves the goal there. taking out what other picks need asks first (DIY takes the whole Framework 13 path)
function pickWant(device, id, delta) {
    const trees = treesFrom(game.deviceUpgrades);
    const owned = ownedFrom(game.deviceUpgrades);
    let current = cleanGoal(savedGoal, trees, owned);
    if (!current || !(device in trees)) return;
    if (device !== current.goal.device) {
        const picked = goalCoins(current.goal, trees, current.own) !== null;
        const ask = `Switch your goal to ${trees[device].device}? That clears what you wanted on ${trees[current.goal.device].device}.`;
        if (picked && !window.confirm(ask)) return;
        current = cleanGoal({ device }, trees, owned);
    }
    const tree = trees[device];
    const { want, removed } = changeWant(tree, current.own, current.goal.want, id, delta);
    debug("picked", { device, id, delta, removed });
    if (removed.length > 0) {
        // gone entirely or only dropped (Fancy cards when USB goes down)
        const name = (nodeId) => byId(tree, nodeId).name;
        const gone = removed.filter((other) => !(want[other] > 0)).map(name);
        const dropped = removed.filter((other) => want[other] > 0).map((other) => `${name(other)} to ${want[other]}`);
        const what = [...(gone.length ? [`takes out ${gone.join(", ")}`] : []), ...(dropped.length ? [`drops ${dropped.join(", ")}`] : [])];
        const doing = want[id] > 0 ? `One less ${name(id)}` : `Taking out ${name(id)}`;
        if (!window.confirm(`${doing} ${what.join(" and ")} too. Go ahead?`)) return;
    }
    setGoal({ ...current.goal, want, goal: null }); // any pick ends a custom coin goal, like site
}

// number from a priority box, null = emptied. boxes only show on goal device, anything else is a stale tree
function pickPrio(device, key, n) {
    const current = cleanGoal(savedGoal, treesFrom(game.deviceUpgrades), ownedFrom(game.deviceUpgrades));
    if (!current || device !== current.goal.device) return;
    const prio = { ...current.goal.prio };
    if (n === null) delete prio[key];
    else prio[key] = n;
    debug("priority", { key, n });
    setGoal({ ...current.goal, prio });
}

// unchecked here, junk turns into problems in plan()
function setGoal(goal) {
    savedGoal = goal && { device: goal.device ?? game.deviceUpgrades?.mainDevice, ...goal };
    saveMine(GOAL_KEY, savedGoal);
    debug("goal", savedGoal);
    draw();
    return savedGoal;
}

// most patches = players walking, true only on farm item changes
function farmTouched(state, touched) {
    const items = state.farmItems;
    return items instanceof Map && (touched.has(items) || [...items.values()].some((item) => touched.has(item)));
}

// plan rerun every change, same src/ as site. card only gets plan
// plan rerun every change, same src/ as site. panel only gets plan
function changed(key, body) {
    game[key] = body;
    draw();
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
    saveMine(FARM_KEY, game.farm);
    debug("farm", { plots: farm.plots, empty: farm.empty, stuck: stuckFrom(farm, game.hours?.weekKey) });
    checkShop();
    draw();
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

// steps with done ones ticked off (tickSteps), saved so a reload keeps the ticks
function weekSteps(steps, w) {
    const weekKey = game.hours?.weekKey;
    // no farm (no steps) or no week key would look like everything got done
    // w null while messages still come in after a reload, ticking then threw the saved list away
    if (!game.farm || !weekKey || w === null) return steps;
    const ticked = tickSteps(savedSteps, steps, weekKey, w);
    if (JSON.stringify(ticked.saved) !== JSON.stringify(savedSteps)) {
        savedSteps = ticked.saved;
        saveMine(STEPS_KEY, savedSteps);
    }
    return ticked.steps;
}

// farm, goal n week steps, saved with owner id. other acounts on this browser get nothing
function loadMine(key) {
    try {
        const saved = JSON.parse(localStorage.getItem(key) ?? "null");
        return saved && saved.userId === myId() ? saved.value : null;
    } catch {
        return null;
    }
}

function saveMine(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify({ userId: myId(), value }));
    } catch {
        // farm gets reread next visit, goal is just gone after reload tho
    }
}

// everthing card needs, fill.js reads + saved goal
// todo: reward-estimate water = hours done this week
function plan() {
    const inventory = inventoryFrom(game.currency, game.inventory);
    // mine beats the games, for "what if i get 1.3" planning
    const mRead = settings.m ?? multiplyerFrom(game.marketItems);
    const m = mRead ?? M_GUESS;
    const stuck = game.farm && stuckFrom(game.farm, game.hours?.weekKey);
    const loans = loansFrom(inventory, stuck);
    // owned plots = placed + bag - ratticus's loans
    // todo: shop count might alredy include bag ones, needs a shop look with plots in my bag
    const placed = plotsNow();
    const plots = inventory && placed !== null ? placed + inventory.unplaced - loans : null;
    const t = weekFrom(game.currentWeek);
    const trees = treesFrom(game.deviceUpgrades);
    const owned = ownedFrom(game.deviceUpgrades);
    // own is per goal device, maybe not my main one
    const goal = cleanGoal(savedGoal, trees, owned);
    const coinsGoal = goal && goalCoins(goal.goal, trees, goal.own);
    const start = t !== null && plots !== null ? routeState(inventory, plots, game.farm, game.hours?.weekKey) : null;
    const target = start && weekTarget(start, t, coinsGoal, m);
    for (const problem of goal?.problems ?? []) showNotice(`Your goal changed: ${problem}`);
    const rows = goal && target
        ? rowHours(start, t, milestones(target.route, goalItems(goal.goal, trees, goal.own)), m)
        : [];
    // set even if plan comes back null, can pick before farm loads
    treeBits = {
        trees, owned, milestones: rows,
        goal: goal && { device: goal.goal.device, want: goal.goal.want, own: goal.own, prio: goal.goal.prio },
    };
    const parts = {
        trees,
        owned,
        t,
        inventory: inventory && { ...inventory, plots },
        m,
        mGuessed: mRead === null,
        loans,
        farm: game.farm,
        stuck,
        target,
        // for card goal lines, null = rent week
        goal: coinsGoal === null ? null : {
            device: trees[goal.goal.device].device,
            coins: coinsGoal,
            custom: goal.goal.goal !== null,
            milestones: rows,
        },
        steps: weekSteps(stepsFrom({
            farm: game.farm,
            inventory,
            stuck,
            loans,
            weekKey: game.hours?.weekKey,
            hoursDone: (game.hours?.week.creditedSeconds ?? 0) / 3600,
            w: target?.w ?? null,
        }), target?.w ?? null),
    };
    const missing = Object.keys(parts).filter((key) => parts[key] === null);
    debug("plan", missing.length > 0 ? `missing ${missing.join(", ")}` : "has everything", parts);
    if (missing.some((key) => !OPTIONAL.has(key))) return null;
    return parts;
}
