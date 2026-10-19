// which userscript parts are on

const KEY = "terra-calc-settings"; // in terra's localStorage

// mostly off by default (buttons spend coins)
export const FEATURES = {
    fill: { name: "Fill in from the game", on: true },
    panel: { name: "What to do next panel", on: true },
    treeLabels: { name: "\"Affordable in Week N\" on the tree", on: false },
    seedBadges: { name: "Profit per hour on shop seeds", on: false },
    buttons: { name: "Buy and sell buttons", on: false },
};

export function loadSettings() {
    const on = Object.fromEntries(Object.entries(FEATURES).map(([id, f]) => [id, f.on]));
    try {
        return { ...on, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
    } catch {
        return on; // bad json or no storage
    }
}

export function saveSettings(settings) {
    try {
        localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
        // back to defaults next load
    }
}

// TODO: settings popup opened from panel probably
