// which userscript parts are on, plus our own section in terra's settings tab
import { MULTIPLIER, CROPS, BONUS_SEEDS } from "../src/data.js";
import { clamp } from "../src/state.js";
import { cssModule, watchPage, keepFromGame, KEYS, numberBox } from "./page.js";
import { loadJSON, saveJSON } from "./store.js";

const KEY = "terra-calc-settings"; // in terra's localStorage

// off by default except reading, card n hud. buy n sell buttons spend coins
export const FEATURES = {
    fill: { name: "Fill in from the game", on: true },
    // key in everyones saved settings, renaming it resets their pick
    panel: { name: "Steps in the This Week card", on: true },
    hud: { name: "Island and goal buttons", on: true },
    seedBadges: { name: "Badges in Heidi's shop", on: false },
    days: { name: "Hour boxes on the calendar", on: true },
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
    const saved = { ...defaults, ...loadJSON(KEY) };
    const typed = Object.fromEntries(Object.keys(defaults.typed).map((key) => [key, cleanCount(saved.typed[key])]));
    return { ...saved, m: cleanM(saved.m), typed };
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
    saveJSON(KEY, settings);
}

// --- our bit of terra's settings tab ---
// right above their help/logout row, same classes as theirs. Solid rebuilds the tab on every switch
const OUR_SECTION = "terra-calc-settings";

// the ones that do something yet, rest of FEATURES are still ideas
const SHOWN = ["fill", "panel", "hud", "seedBadges", "days", "debug"];
// hooked up at page load
const NEEDS_RELOAD = ["fill", "panel", "hud", "seedBadges", "days"];

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

// terra's column stretches its input, in a plain wrap it went chrome's default width n ran into the next one
function inputBox(c, props, value, clean, onChange) {
    const wrap = numberBox({ className: c.input ?? "", ...props }, value, clean, onChange);
    Object.assign(wrap.style, { display: "flex", flexDirection: "column" });
    return wrap;
}

function makeSection(c) {
    const ours = el("div", OUR_SECTION);
    keepFromGame(ours, KEYS);

    const mCol = el("div", `${c.settingsCol} ${c.settingsColQuarter ?? ""}`);
    const range = { min: String(MULTIPLIER.min), max: String(MULTIPLIER.max), step: "0.01", placeholder: "the game's" };
    const m = inputBox(c, range, current.m, cleanM, (n) => {
        current.m = n;
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
    const goal = onGoal.now();
    if (goal) ours.append(goalRow(c, goal));
    ours.append(typedRow(c));
    return ours;
}

// typed coins, plots n seeds, for when a terra update breaks a reader. plots count before ive been on my farm or seen shop too
function typedRow(c) {
    const box = (key, label) => {
        const col = el("div", `${c.settingsCol} ${c.settingsColQuarter ?? ""}`);
        const input = inputBox(c, { min: "0", step: "1" }, current.typed[key], cleanCount, (n) => {
            current.typed[key] = n;
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
    const coins = inputBox(c, { min: "0", step: "1" }, goal.coins, cleanCount, (n) => onGoal.coins(n));
    coinsCol.append(el("div", c.formLabel, "Goal in coins (empty uses your picks)"), coins);

    const row = el("div", c.settingsRow);
    // terra's section puts 1em between its rows, ours is one block
    row.style.marginTop = "1em";
    row.append(pickCol, coinsCol);
    return row;
}
