// which userscript parts are on, plus our own section in terra's settings tab
import { MULTIPLIER } from "../src/data.js";
import { cssModule, watchPage } from "./page.js";

const KEY = "terra-calc-settings"; // in terra's localStorage

// mostly off by default (buttons spend coins)
export const FEATURES = {
    fill: { name: "Fill in from the game", on: true },
    // still panel, its the key in everyones saved settings
    panel: { name: "Steps in the This Week card", on: true },
    treeLabels: { name: "\"Affordable in Week N\" on the tree", on: false },
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

// settings changed in place, onChange after every change
export function mountSettings(settings, onChange) {
    if (onSettings) return;
    current = settings;
    onSettings = onChange;
    watchPage(fillSettings)();
}

function fillSettings() {
    const c = cssModule("settingsSection", "logoutBtn");
    const section = c && document.querySelector(`.${c.settingsSection}`);
    // built once per tab, nothing in it comes from the plan
    if (!section || section.querySelector(`:scope > .${OUR_SECTION}`)) return;
    const bottom = c.helpLogoutRow ? section.querySelector(`:scope > .${c.helpLogoutRow}`) : null;
    section.insertBefore(makeSection(c), bottom);
}

function makeSection(c) {
    const el = (tag, cls, text = null) => {
        const node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text !== null) node.textContent = text;
        return node;
    };
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
    return ours;
}
