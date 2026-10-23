// which userscript parts are on, plus our own section in terra's settings tab
import { MULTIPLIER, CROPS, BONUS_SEEDS } from "../src/data.js";
import { clamp } from "../src/state.js";
import { cssModule, watchPage } from "./page.js";

const KEY = "terra-calc-settings"; // in terra's localStorage

// off by default except reading, card n hud. buy n sell buttons spend coins
export const FEATURES = {
    fill: { name: "Fill in from the game", on: true },
    // still panel, its the key in everyones saved settings
    panel: { name: "Steps in the This Week card", on: true },
    hud: { name: "Buttons under the map", on: true },
    seedBadges: { name: "Badges in Heidi's shop", on: false },
    buttons: { name: "Buy and sell buttons", on: false },
    debug: { name: "Log everything to the console", on: false },
};

// m = my own multiplier, null = the games.
// typed: numbers i typed in, each only used whn the games cant be read. seeds is apples, bonus ones by seed id (bokchoy)
export function loadSettings() {
    const defaults = {
        ...Object.fromEntries(Object.entries(FEATURES).map(([id, f]) => [id, f.on])),
        m: null,
        typed: { coins: null, plots: null, seeds: null, ...Object.fromEntries(BONUS_SEEDS.map((id) => [id, null])) },
    };
    try {
        const saved = { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
        const typed = Object.fromEntries(Object.keys(defaults.typed).map((key) => [key, cleanCount(saved.typed?.[key])]));
        return { ...saved, m: cleanM(saved.m), typed };
    } catch {
        return defaults; // bad json or no storage
    }
}

// box or storage count, whole and 0 or more, null = not typed
function cleanCount(value) {
    if (value === "" || value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
}

// box or storage value kept in MULTIPLIER range, null = the games
function cleanM(value) {
    const n = value === "" || value === null ? null : Number(value);
    return n === null || !Number.isFinite(n) ? null : clamp(n, MULTIPLIER.min, MULTIPLIER.max);
}

export function saveSettings(settings) {
    try {
        localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
        // back to defaults next load
    }
}

// --- our bit of terra's settings tab ---
// right above their help/logout row, same classes as theirs. Solid rebuilds the tab on every switch
const OUR_SECTION = "terra-calc-settings";

// the ones that do something yet, rest of FEATURES are still ideas
const SHOWN = ["fill", "panel", "hud", "seedBadges", "debug"];
// hooked up at page load
const NEEDS_RELOAD = ["fill", "panel", "hud", "seedBadges"];

let onSettings = null;
let current = null;
let onGoal = null;

// settings changed in place, onChange after every change. goal = goalHooks from main.js
export function mountSettings(settings, onChange, goal) {
    if (onSettings) return;
    current = settings;
    onSettings = onChange;
    onGoal = goal;
    watchPage(fillSettings)();
}

function fillSettings() {
    const c = cssModule("settingsSection", "logoutBtn");
    const section = c && document.querySelector(`.${c.settingsSection}`);
    // built once per tab, goal row shows the goal as of when it opened
    // built once per tab, nothing in it comes from the plan
    if (!section || section.querySelector(`:scope > .${OUR_SECTION}`)) return;
    const bottom = c.helpLogoutRow ? section.querySelector(`:scope > .${c.helpLogoutRow}`) : null;
    section.insertBefore(makeSection(c), bottom);
}

function el(tag, cls, text = null) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== null) node.textContent = text;
    return node;
}

function makeSection(c) {
    const ours = el("div", OUR_SECTION);
    // game opens build mode off keys on the page
    for (const type of ["keydown", "keyup", "keypress"]) {
        ours.addEventListener(type, (event) => event.stopPropagation());
    }

    const mCol = el("div", `${c.settingsCol} ${c.settingsColQuarter ?? ""}`);
    const m = el("input", c.input);
    m.type = "number";
    m.min = String(MULTIPLIER.min);
    m.max = String(MULTIPLIER.max);
    m.step = "0.01";
    m.placeholder = "the game's";
    m.value = current.m ?? "";
    m.addEventListener("change", () => {
        current.m = cleanM(m.value);
        m.value = current.m ?? "";
        onSettings(current);
    });
    mCol.append(el("div", c.formLabel, "Multiplier (empty is the game's)"), m);

    const togglesCol = el("div", c.settingsCol);
    for (const id of SHOWN) {
        const label = el("label", c.checkboxItem);
        const box = el("input");
        box.type = "checkbox";
        box.checked = current[id];
        box.addEventListener("change", () => {
            current[id] = box.checked;
            onSettings(current);
        });
        label.append(box, `${FEATURES[id].name}${NEEDS_RELOAD.includes(id) ? " (after a reload)" : ""}`);
        togglesCol.append(label);
    }

    const row = el("div", c.settingsRow);
    row.append(mCol, togglesCol);
    ours.append(el("div", c.sectionTitle, "Terra Calc"), row);
    const goal = onGoal?.now();
    if (goal) ours.append(goalRow(c, goal));
    ours.append(typedRow(c));
    return ours;
}

// typed coins, plots n seeds, for when a terra update breaks a reader. plots count before ive been on my farm or seen shop too
function typedRow(c) {
    const box = (key, label) => {
        const col = el("div", `${c.settingsCol} ${c.settingsColQuarter ?? ""}`);
        const input = el("input", c.input);
        input.type = "number";
        input.min = "0";
        input.step = "1";
        input.value = current.typed[key] ?? "";
        input.addEventListener("change", () => {
            current.typed[key] = cleanCount(input.value);
            input.value = current.typed[key] ?? "";
            onSettings(current);
        });
        col.append(el("div", c.formLabel, label), input);
        return col;
    };
    const wrap = el("div");
    wrap.style.marginTop = "1em";
    // two rows, settingsRow doesnt wrap n five boxes ran off teh side
    const row = el("div", c.settingsRow);
    row.append(box("coins", "Coins"), box("plots", "Plots"));
    // TODO: "in Heidi's shop today" ticks from site, for when shop cant be read
    const seeds = el("div", c.settingsRow);
    seeds.style.marginTop = "0.5em";
    seeds.append(box("seeds", "Apple seeds"), ...BONUS_SEEDS.map((id) => box(id, `${CROPS[id].name} seeds`)));
    wrap.append(el("div", c.formLabel, "For when the game can't be read"), row, seeds);
    return wrap;
}

// preset for the goal device, or a goal in coins
function goalRow(c, goal) {
    // whole column, "Max 13 (no USB card)" doesnt fit a quarter one like the multiplier box
    const pickCol = el("div", c.settingsCol);
    const select = el("select", c.select);
    const option = (value, text) => {
        const o = el("option", null, text);
        o.value = value;
        return o;
    };
    // picks match no preset, so they're my own
    if (!goal.picked) select.append(option("", goal.empty ? "Nothing picked yet" : "Your picks on the tree"));
    select.append(...goal.presets.map((name) => option(name, name)));
    select.value = goal.picked ?? "";
    select.addEventListener("change", () => {
        if (!select.value) return;
        onGoal.preset(select.value);
        // preset ends a coin goal, and the picks are that preset now
        coins.value = "";
        select.querySelector('option[value=""]')?.remove();
    });
    const selectRow = el("div", c.settingsSelectRow);
    selectRow.append(select);
    pickCol.append(el("div", c.formLabel, "Goal"), selectRow);

    const coinsCol = el("div", `${c.settingsCol} ${c.settingsColQuarter ?? ""}`);
    const coins = el("input", c.input);
    coins.type = "number";
    coins.min = "0";
    coins.step = "1";
    coins.value = goal.coins ?? "";
    coins.addEventListener("change", () => {
        const cleaned = cleanCount(coins.value);
        coins.value = cleaned ?? "";
        onGoal.coins(cleaned);
    });
    coinsCol.append(el("div", c.formLabel, "Goal in coins (empty uses your picks)"), coins);

    const row = el("div", c.settingsRow);
    // terra's section puts 1em between its rows, ours is one block
    row.style.marginTop = "1em";
    row.append(pickCol, coinsCol);
    return row;
}
