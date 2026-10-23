// which userscript parts are on, plus our own section in terra's settings tab
import { MULTIPLIER } from "../src/data.js";
import { cssModule, watchPage } from "./page.js";

const KEY = "terra-calc-settings"; // in terra's localStorage

// mostly off by default (buttons spend coins)
export const FEATURES = {
    fill: { name: "Fill in from the game", on: true },
    // still panel, its the key in everyones saved settings
    panel: { name: "Steps in the This Week card", on: true },
    seedBadges: { name: "Profit per hour on shop seeds", on: false },
    buttons: { name: "Buy and sell buttons", on: false },
    debug: { name: "Log everything to the console", on: false },
};

// m = my own multiplier, null = the games
export function loadSettings() {
    const defaults = { ...Object.fromEntries(Object.entries(FEATURES).map(([id, f]) => [id, f.on])), m: null };
    try {
        const saved = { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
        return { ...saved, m: cleanM(saved.m) };
    } catch {
        return defaults; // bad json or no storage
    }
}

// box or storage value kept in MULTIPLIER range, null = the games
function cleanM(value) {
    if (value === "" || value === null) return null;
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(MULTIPLIER.max, Math.max(MULTIPLIER.min, n)) : null;
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
const SHOWN = ["fill", "panel", "debug"];
// hooked up at page load
const NEEDS_RELOAD = ["fill", "panel"];

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
    return ours;
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
        const n = Math.round(Number(coins.value));
        const cleaned = coins.value === "" || !Number.isFinite(n) ? null : Math.max(0, n);
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
