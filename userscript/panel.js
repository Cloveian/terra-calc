// what to do next panel in terra's page
import { weekName } from "../src/week.js";

// stages n review reasons, worded like game hints (cropStage-*.js, GameCanvas)
const STAGE_LINES = {
    ready: "ready to harvest",
    dry: "need water",
    watered: "watered, ship this week's project for them to grow",
    withered: "withered, clear them",
};
const WHY_LINES = {
    review: "waiting on last week's review",
    changes: "waiting on you, a reviewer asked for changes, reship last week's project",
    short: "need more approved hours, devlog and reship last week's project",
    rejected: "won't grow, last week's ship was rejected",
};

let root = null;
let noticeBox = null;
let planBox = null;

// screen corner for now, maybe terra menu tab later. just enough style to read over canvas
export function mountPanel() {
    if (root) return;
    root = document.createElement("div");
    root.id = "terra-calc-panel";
    root.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:99999;max-width:340px;padding:8px 12px;"
        + "background:#fffbe8;color:#222;border:2px solid #6a9a3a;border-radius:8px;font:14px/1.4 sans-serif";
    noticeBox = document.createElement("div");
    planBox = document.createElement("div");
    planBox.textContent = "Terra Calc";
    root.append(noticeBox, planBox);
    document.body.append(root);
}

// notices above plan, no dupes
export function showNotice(text) {
    if (!root || [...noticeBox.children].some((line) => line.textContent === text)) return;
    const line = document.createElement("p");
    line.textContent = text;
    noticeBox.append(line);
}

// plan from main.js, null if not enough to go on
// TODO: still just what it read, no plan yet. needs goal for this weeks line ("buy 5 plots + 25 apple seeds, code 35 h"), hours left n goal progress bar. also game vs typed numbers
export function drawPanel(plan) {
    if (!root) return;
    const title = document.createElement("b");
    title.textContent = plan ? "Terra Calc" : "Terra Calc (waiting for the game)";
    const lines = (plan ? linesFor(plan) : []).map((text) => {
        const line = document.createElement("div");
        line.textContent = text;
        return line;
    });
    planBox.replaceChildren(title, ...lines);
}

// words, one string per line
export function linesFor(plan, now = Date.now()) {
    const { t, inventory, m, farm, stuck } = plan;
    const lines = [weekName(t)];
    lines.push(`${some(Math.floor(inventory.coins), "coin")}, ${some(inventory.seeds, "apple seed")}, ${some(inventory.baseSeeds, "free seed")}`);
    lines.push(inventory.plots === null ? "plots: go to your farm or open Heidi's shop" : some(inventory.plots, "plot"));
    lines.push(m === null ? "multiplier: open the market with crops to sell" : `multiplier ${Math.round(m * 100) / 100}`);
    if(!farm) return lines;

    if (farm.empty > 0) lines.push(some(farm.empty, "empty plot"));
    const counts = {};
    for (const crop of farm.crops) counts[crop.stage] = (counts[crop.stage] ?? 0) + 1;
    for (const [stage, text] of Object.entries(STAGE_LINES)) {
        if (counts[stage]) lines.push(`${counts[stage]} ${text}`);
    }
    // stuck = from before this week (all of them if week unkown), rest of review is this weeks n just waiting
    for (const [why, n] of Object.entries(stuck?.why ?? {})) lines.push(`${n} ${WHY_LINES[why] ?? `stuck (${why})`}`);
    const waiting = (counts.review ?? 0) - (stuck?.count ?? 0);
    if (waiting > 0) lines.push(`${waiting} waiting on this week's review`);
    if (farm.seenAt) lines.push(`(farm as of ${ago(now - farm.seenAt)})`);
    return lines;
}

function some(n, word) {
    return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function ago(ms) {
    const minutes = Math.round(ms / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    return `${Math.round(minutes / 60)} h ago`;
}

// TODO: site-style inputs for whatever fill.js gave null
// maybe reuse terra's css (fonts, panel look)
