// userscript entry point
import { REST, IN, TOKEN_KEY } from "./endpoints.js";
import { apiGet, liveBuild } from "./api.js";
import { hookWebSocket, onGameMessage, ROOM } from "./socket.js";
import { loadSettings, saveSettings, mountSettings } from "./settings.js";
import { loadJSON, saveJSON } from "./store.js";
import { setDebug, debug } from "./debug.js";
import { mountCard, drawCard, showNotice } from "./card.js";
import {
    treesFrom, ownedFrom, weekFrom, inventoryFrom, multiplyerFrom, farmFrom, stuckFrom, userIdFromToken,
    shopFrom, shopProblems, farmSchemaProblems, loansFrom, seedsFrom, forSaleFrom,
} from "./fill.js";
import { weekTarget, stepsFrom, routeState, rowHours, tickSteps, bonusOnHand, readyIds, toSell, noteWeek, daysGiven, projection } from "./next.js";
import { cleanGoal, goalCoins, goalItems } from "./goal.js";
import { mountWantBits, drawWantBits, changeWant, openTree } from "./want.js";
import { mountShopBadges, drawShopBadges } from "./shop.js";
import { mountHud, drawHud } from "./hud.js";
import { logShop, logHours, codedBefore } from "./daylog.js";
import { mountDayBoxes, drawDayBoxes } from "./calendar.js";
import { milestones } from "../src/route.js";
import { easternDay, weekIndex, weekDay, LAST_WEEK, DAY_MS } from "../src/week.js";
import { waitFor, dayHours, typicalDays, weekShape } from "./predict.js";
import { fetchDays, statusWords, BACK_DAYS, FETCH_EVERY_MS } from "./hackatime.js";
import { RENT, CROPS, PRESETS, BASE_SEEDS, BONUS_SEEDS } from "../src/data.js";
import { byId, sameSelection } from "../src/tree.js";

const FARM_KEY = "terra-calc-farm";
const SHOP_KEY = "terra-calc-shop";
const GOAL_KEY = "terra-calc-goal";
const STEPS_KEY = "terra-calc-week-steps";
const WEEK_KEY = "terra-calc-week";
const SHOP_LOG_KEY = "terra-calc-shop-log";
const HOURS_LOG_KEY = "terra-calc-hours-log";
const DAYS_KEY = "terra-calc-days";
// own entries, settings get dumped to the debug log n the key cant be in there
const HACKATIME_KEY = "terra-calc-hackatime-key";
const HACKATIME_DAYS_KEY = "terra-calc-hackatime-days";

// plan parts that can stay null. the card would ask for plots (they sit in inventory), farm and
// stuck are only there once you've been on your farm, target needs the plot count too, goal's
// null till you pick one, weekEnds is just extra words on a few steps and the last week line, trees
// and owned only matter for a goal, and lastWeek needs you to have been here last week. todayHours only if i typed today, wait only when waiting beats todays bonus seed
const OPTIONAL = new Set(["farm", "stuck", "target", "goal", "weekEnds", "todayHours", "wait", "trees", "owned", "lastWeek"]);

// guess till a reviewed crop is in the market, m comes from project review
const M_GUESS = 1.1;
// 30 s from page open, then typed numbers count
const TYPED_AFTER = 30000;

// latest from game. farm = last visit to my own farm, saved for reloads in town (seenAt for its age)
const game = {
    deviceUpgrades: null,
    currentWeek: null,
    currency: null,
    inventory: null,
    marketItems: null,
    sold: false, // sold since marketItems came, its crops are gone (m off it still good)
    harvested: [], // ready ones harvested since marketItems, in market but not its list yet
    hours: null,
    shop: loadMine(SHOP_KEY), // shopFrom + seedsFrom, last time heidi's shop was open
    farmOwnerId: null, // whose farm this room is (joinComplete)
    roomState: null,
    farmReadable: true, // false = room FarmItem missing fields farmFrom needs
    farm: loadMine(FARM_KEY),
};

// cleaned against live trees every plan(), null = rent week
let savedGoal = loadMine(GOAL_KEY);
let savedSteps = loadMine(STEPS_KEY); // week checklist as it first came out, for the ticks
let weekNote = loadMine(WEEK_KEY); // from noteWeek, next week says how this one went
let shopLog = loadMine(SHOP_LOG_KEY) ?? {};
let hoursLog = loadMine(HOURS_LOG_KEY) ?? {};
let savedDays = loadMine(DAYS_KEY) ?? {}; // { "2026-10-26": 4 }, hours i said i'd give, typed in the calendar boxes
let hackatimeKey = loadMine(HACKATIME_KEY); // not on window.terraCalc either
let hackatime = loadMine(HACKATIME_DAYS_KEY); // { fetchedAt, days: { "2026-10-20": 3.2 } } or { fetchedAt, error }

function noteThisWeek(weekKey, change) {
    weekNote = saveChanged(WEEK_KEY, weekNote, noteWeek(weekNote, weekKey, change));
}

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
    // terraCalc.day("2026-10-26", 4), null clears it. Eastern days
    day(day, h) {
        if (h == null) delete savedDays[day];
        else savedDays[day] = h;
        saveMine(DAYS_KEY, savedDays);
        draw();
        return savedDays;
    },
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
onGameMessage(IN.marketItems, (body) => {
    game.sold = false;
    game.harvested = [];
    changed("marketItems", body);
});
onGameMessage(IN.saleResult, () => {
    game.sold = true;
    game.harvested = [];
    draw();
});
onGameMessage(IN.hours, (body) => {
    const before = game.hours?.weekKey;
    noteThisWeek(body.weekKey, { coded: body.week.creditedSeconds / 3600, seenAt: Date.now() });
    hoursLog = saveChanged(HOURS_LOG_KEY, hoursLog, logHours(hoursLog, easternDay(new Date()), body.weekKey, body.week.creditedSeconds));
    changed("hours", body);
    // new week = new label, maybe new upgrade prices
    if (settings.fill && before && body.weekKey !== before) readRest();
});

onGameMessage(IN.shopStock, (body) => {
    const shop = shopFrom(body);
    if (shop) {
        game.shop = { ...shop, seeds: seedsFrom(body), dateKey: body.dateKey ?? null, seenAt: Date.now() };
        // saved like the farm, for reloads
        saveMine(SHOP_KEY, game.shop);
        shopLog = saveChanged(SHOP_LOG_KEY, shopLog, logShop(shopLog, game.shop.dateKey, game.shop.seeds));
    }
    checkShopPrices();
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
        showNotice(`Can't read your farm (no ${missing.join(", ")})`);
    }
});
onGameMessage(IN.joinComplete, (body) => {
    game.farmOwnerId = body.farmOwnerId ?? null;
    readFarm();
    // readFarm only draws on my own farm, leaving it flips the island / hub button too
    draw();
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
    }, goalHooks, hackatimeHooks);
    if (settings.panel) mountCard();
    if (settings.hud) mountHud(openTree);
    if (!settings.fill) return drawCard(null);
    mountWantBits(pickWant, pickPrio);
    if (settings.seedBadges) mountShopBadges();
    if (settings.days) mountDayBoxes(window.terraCalc.day);
    // typed numbers need a redraw, nothing else does one if the game sends nothing
    setTimeout(draw, TYPED_AFTER);
    syncHackatime();
    setInterval(syncHackatime, FETCH_EVERY_MS);
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
        showNotice(`Can't read Terra, goal's off (${err.message})`);
    }
}

function draw() {
    const { parts, tags, badges, days, problems, keep } = plan();
    if (keep) keepWeek(keep);
    for (const problem of problems) showNotice(`Your goal changed: ${problem}`);
    drawCard(parts);
    drawHud(onOwnFarm());
    drawWantBits(tags);
    drawShopBadges({ ...badges, toBuy: seedsToBuy(parts) });
    drawDayBoxes(days);
}

// the card's own buy steps, { eggplant: 12 }, so the shop says the same. null with no farm or target
function seedsToBuy(parts) {
    if (!parts?.farm || !parts.target) return null;
    const buying = parts.steps.filter((step) => step.do === "buySeeds" && !step.done);
    return Object.fromEntries(buying.map((step) => [step.seed, step.n]));
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
    const current = currentGoal();
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

// goal cleaned against live trees, null till they're in
function currentGoal(saved = savedGoal) {
    return cleanGoal(saved, treesFrom(game.deviceUpgrades), ownedFrom(game.deviceUpgrades));
}

// for the goal row in our settings. a preset replaces the want, like site quick picks
const goalHooks = {
    now() {
        const current = currentGoal();
        if (!current) return null;
        const { device, want, goal } = current.goal;
        const presets = PRESETS[device] ?? {};
        // preset cleaned same way, so prereqs and owned line up with the picks
        const wantOf = (name) => currentGoal({ device, want: presets[name] }).goal.want;
        return {
            presets: Object.keys(presets),
            picked: Object.keys(presets).find((name) => sameSelection(wantOf(name), want)) ?? null,
            coins: goal,
            // nothing wanted past what i own and no coins, its the rent week
            empty: goalCoins(current.goal, treesFrom(game.deviceUpgrades), current.own) === null,
        };
    },
    preset(name) {
        const current = currentGoal();
        if (current) setGoal({ ...current.goal, want: PRESETS[current.goal.device][name], goal: null });
    },
    coins(n) {
        const current = currentGoal();
        if (current) setGoal({ ...current.goal, goal: n });
    },
};

// the key box in settings
const hackatimeHooks = {
    key: () => hackatimeKey,
    status: () => statusWords(hackatime),
    async set(key) {
        hackatimeKey = key || null;
        hackatime = null;
        saveMine(HACKATIME_KEY, hackatimeKey);
        saveMine(HACKATIME_DAYS_KEY, null);
        if (hackatimeKey) await syncHackatime();
        else draw();
    },
};

// at most once an hour, reloads included. errors are kept that long too, a new key clears them
async function syncHackatime() {
    if (!hackatimeKey || (hackatime && Date.now() - hackatime.fetchedAt < FETCH_EVERY_MS)) return;
    const end = easternDay(new Date());
    const start = easternDay(new Date(Date.now() - BACK_DAYS * DAY_MS));
    try {
        hackatime = { fetchedAt: Date.now(), days: await fetchDays(hackatimeKey, start, end) };
    } catch (err) {
        hackatime = { fetchedAt: Date.now(), error: err.message };
    }
    saveMine(HACKATIME_DAYS_KEY, hackatime);
    debug("hackatime", hackatime.error ?? `${Object.keys(hackatime.days).length} days`);
    draw();
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

function onOwnFarm() {
    return game.farmOwnerId !== null && game.farmOwnerId === myId();
}

// readyIds from last farm read. this session only, saved farm could be from befor i sold somewhere else
let readyBefore = null;

function count(list, id) {
    return list.filter((x) => x === id).length;
}

// my farm out of this room, kept and saved only if its really mine
function readFarm() {
    if (!game.farmReadable) return;
    const farm = farmFrom(game.roomState, game.farmOwnerId, myId());
    if (!farm) return;
    // ready ones gone since last read got harvested, no other way off the farm
    const ready = readyIds(farm);
    if (readyBefore) {
        for (const id of new Set(readyBefore)) {
            const gone = count(readyBefore, id) - count(ready, id);
            for (let i = 0; i < gone; i++) game.harvested.push(id);
        }
    }
    readyBefore = ready;
    game.farm = { ...farm, seenAt: Date.now() };
    saveMine(FARM_KEY, game.farm);
    debug("farm", { plots: farm.plots, empty: farm.empty, stuck: stuckFrom(farm, game.hours?.weekKey) });
    checkShopPrices();
    draw();
}

// shop prices vs model, again on every new plot count. notice for apples only, off plot price just as likley old farm so logged only
function checkShopPrices() {
    const problems = shopProblems(game.shop, game.farm?.plots ?? null);
    if (problems.length > 0) debug("shop doesn't match the plan", problems);
    for (const { kind, text } of problems) {
        if(kind === "apple") showNotice(`Prices changed, the plan's off: ${text}`);
    }
}

// farm or shop, whichever seen last. shop only knows under 19
function plotsNow() {
    const { farm, shop } = game;
    if (shop?.plots != null && !(farm?.seenAt > shop.seenAt)) return shop.plots;
    return farm?.plots ?? null;
}

// steps with done ones ticked off (tickSteps). saved = the list to keep, null for nothing to keep
function weekSteps(steps, w) {
    const weekKey = game.hours?.weekKey;
    // no farm (no steps) or no week key would look like everything got done
    // w null while messages still come in after a reload, ticking then threw the saved list away
    if (!game.farm || !weekKey || w === null) return { steps, saved: null };
    return tickSteps(savedSteps, steps, weekKey, w);
}

// ticks n week note plan() handed back, saved here so terraCalc.plan() writes nothing
function keepWeek({ weekKey, w, saved, ended }) {
    // past week end the plan is next weeks already, weekKey stays old untill hours.update
    if (!ended) noteThisWeek(weekKey, { w });
    savedSteps = saveChanged(STEPS_KEY, savedSteps, saved);
}

// farm, goal n week steps, saved with owner id. other acounts on this browser get nothing
function loadMine(key) {
    const saved = loadJSON(key);
    return saved?.userId === myId() ? saved.value : null;
}

function saveMine(key, value) {
    saveJSON(key, { userId: myId(), value });
}

// saveMine, skipped when nothing changed
function saveChanged(key, before, after) {
    if (JSON.stringify(after) !== JSON.stringify(before)) saveMine(key, after);
    return after;
}

// my typed numbers shaped like inventoryFrom output, free seeds the usual 10
function typedInventory(typed) {
    if (typed.coins === null) return null;
    return {
        coins: typed.coins, plots: null, unplaced: 0, seeds: typed.seeds ?? 0, baseSeeds: BASE_SEEDS, baseKinds: {},
        bonus: Object.fromEntries(BONUS_SEEDS.map((id)=>[id, typed[id] ?? 0])),
        water: 0, seedsDie: null,
    };
}

// game coins n bag, or what i typed when those cant be read
function inventoryNow() {
    const read = inventoryFrom(game.currency, game.inventory);
    // came in n unreadable (broken reader), or nothing for TYPED_AFTER (broken hook). sooner its just loading n old typed coins flashed up in the card
    const waited = (game.currency && game.inventory) || performance.now() >= TYPED_AFTER;
    return read ?? (waited ? typedInventory(settings.typed) : null);
}

// heidi's seeds, todays only (dateKey is the US eastern day like easternDay), none till the shop's been open
function shopNow() {
    const today = game.shop?.dateKey === easternDay(new Date());
    const seeds = today ? game.shop.seeds : [];
    // by id, { eggplant: { name, buy, sell, water } }
    const crops = Object.fromEntries(seeds.map(({ id, ...crop }) => [id, crop]));
    return {
        today,
        seeds,
        crops,
        table: { ...CROPS, ...crops },
        // any days sell price does, a ready crop can be from an older shop
        sellTable: { ...CROPS, ...Object.fromEntries((game.shop?.seeds ?? []).map(({ id, sell }) => [id, { sell }])) },
    };
}

// grown n not sold, market list + ready ones since
function sellingNow(inventory, m, sellTable) {
    const forSale = game.sold ? null : forSaleFrom(game.marketItems);
    return toSell([...readyIds(game.farm), ...game.harvested], forSale, m, inventory, sellTable);
}

// what card, want tags n shop badges need, fill.js reads + saved goal. draw() keeps n draws it
function plan() {
    const inventory = inventoryNow();
    // yours beats the game's, it's for "what if i get 1.3" planning
    const mRead = settings.m ?? multiplyerFrom(game.marketItems);
    const m = mRead ?? M_GUESS;
    const stuck = game.farm && stuckFrom(game.farm, game.hours?.weekKey);
    const loans = loansFrom(inventory, stuck);
    // owned plots = placed + bag - ratticus's loans
    // todo: shop count might alredy include bag ones, needs a shop look with plots in my bag
    const placed = plotsNow();
    const plots = inventory && (placed !== null ? placed + inventory.unplaced - loans : settings.typed.plots);
    // off todays date like the site when current-week cant be read, null outside terra
    const dateWeek = weekIndex(new Date());
    const t = weekFrom(game.currentWeek) ?? (dateWeek >= 0 && dateWeek <= LAST_WEEK ? dateWeek : null);
    const trees = treesFrom(game.deviceUpgrades);
    const owned = ownedFrom(game.deviceUpgrades);
    // own is per goal device, maybe not my main one
    const cleaned = cleanGoal(savedGoal, trees, owned);
    const picked = cleaned?.goal ?? null;
    const coinsGoal = cleaned && goalCoins(picked, trees, cleaned.own);
    const shop = shopNow();
    const selling = inventory && sellingNow(inventory, m, shop.sellTable);
    const start = t !== null && plots !== null
        ? routeState(inventory, plots, game.farm, game.hours?.weekKey, selling.coins)
        : null;
    // bonus seeds for this weeks mix, the shops + mine (bag or planted)
    const thisWeek = inventory && {
        seeds: shop.seeds.map((seed) => seed.id),
        onHand: bonusOnHand(inventory, game.farm, game.hours?.weekKey),
        crops: shop.crops,
    };
    const today = easternDay(new Date());
    // how my weeks go, off hackatime with a key or my hours log. today's not done yet
    const history = hackatime?.days
        ? Object.entries(hackatime.days).map(([day, h]) => ({ day, h, lumped: false }))
        : dayHours(hoursLog);
    const past = history.filter((d) => d.day < today);
    const typical = typicalDays(past);
    const shape = weekShape(typical);
    // hackatime counts AI time full, so off a key its a bit over terra's
    const usualWeek = typical.includes(null) ? null : typical.reduce((sum, h) => sum + h, 0);
    const given = daysGiven(savedDays, today, codedBefore(hoursLog, today, game.hours?.weekKey), shape);
    const target = start && weekTarget(start, t, coinsGoal, m, thisWeek, given);
    let rows = [];
    let usual = null;
    if (cleaned && target) {
        const items = goalItems(picked, trees, cleaned.own);
        rows = rowHours(start, t, milestones(target.route, items), m, thisWeek, given);
        usual = projection(start, t, items, m, thisWeek, given, usualWeek);
    }
    const tags = {
        trees, owned, milestones: rows,
        goal: cleaned && { device: picked.device, want: picked.want, own: cleaned.own, prio: picked.prio },
    };
    // apples aren't in shop.seeds, they're always there
    const badges = { m, seeds: [{ id: "apple", name: "Apple", ...CROPS.apple }, ...shop.seeds] };
    const weekEnds = Date.parse(game.currentWeek?.endDate ?? "") || null;
    const w = target?.w ?? null;
    const ticked = weekSteps(stepsFrom({
        farm: game.farm,
        inventory,
        stuck,
        loans,
        weekKey: game.hours?.weekKey,
        // coded but not devlogged, it's not water till it is
        unclaimed: (game.hours?.unclaimed?.creditedSeconds ?? 0) / 3600,
        w,
        mix: target?.mix ?? null,
        table: shop.table,
        shopToday: shop.today,
        selling,
    }), w);
    const parts = {
        trees,
        owned,
        t,
        inventory: inventory && { ...inventory, plots },
        // grown n not sold yet
        selling,
        m,
        mGuessed: mRead === null,
        // ms, for the h a day on the code step and when last week ended
        weekEnds,
        todayHours: savedDays[today] ?? null, // typed in the calendar, the code step says it over the even h a day
        // the week before, null if it wasnt seen
        lastWeek: weekNote && weekNote.weekKey === game.hours?.weekKey ? weekNote.last : null,
        loans,
        farm: game.farm,
        stuck,
        target,
        // today's bonus seeds, for their names
        crops: shop.crops,
        // buy today's bonus seed or wait for a better one, shop days left after today, sunday's the last
        wait: waitFor(shopLog, shop.seeds.map((seed) => seed.id), shop.table, m, 6 - weekDay(today)),
        // for card goal lines, null = rent week
        goal: coinsGoal === null ? null : {
            device: trees[picked.device].device,
            coins: coinsGoal,
            custom: picked.goal !== null,
            milestones: rows,
            usual, // null till every weekday has a typical
        },
        steps: ticked.steps,
    };
    const missing = Object.keys(parts).filter((key) => parts[key] === null);
    debug("plan", missing.length > 0 ? `missing ${missing.join(", ")}` : "has everything", parts);
    const enough = !missing.some((key) => !OPTIONAL.has(key));
    const ended = weekEnds !== null && Date.now() > weekEnds;
    const keep = ticked.saved && { weekKey: game.hours.weekKey, w, saved: ticked.saved, ended };
    const days = {
        days: savedDays,
        perDay: target?.cap ? shape.map((share) => share * target.cap) : null,
        // lumped ones have gone days in them too, under 0 = terra took credit back. blank beats wrong
        codedOn: Object.fromEntries(past.filter((d) => !d.lumped && d.h >= 0).map((d) => [d.day, d.h])),
    };
    return { parts: enough ? parts : null, tags, badges, days, problems: cleaned?.problems ?? [], keep };
}
