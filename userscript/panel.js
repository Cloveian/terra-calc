// what to do next panel in terra's page
import { weekName, isPrep } from "../src/week.js";

// stages n review reasons, worded like game hints (cropStage-*.js, GameCanvas)
const STAGE_LINES = {
    ready: "ready to harvest",
    dry: "need water",
    watered: "watered, ship this week's project for them to grow",
    withered: "withered, clear them",
};
const WHY_LINES = {
    review: "waiting on last week's review",
    changes: "waiting on you, a reviewer asked for changes",
    short: "need more approved hours",
    rejected: "won't grow, last week's ship was rejected",
};

// next.js steps, n = whatever that step counts. plan for ones needing more words
const STEP_LINES = {
    clear: (n) => `clear ${n} withered`,
    harvest: (n) => `harvest ${n}`,
    reship: (n) => `reship last week's project, ${n} waiting on changes`,
    devlog: (n) => `devlog and reship last week's project, ${n} short on hours`,
    buyPlots: (n) => `buy ${some(n, "plot")} from Heidi`,
    buySeeds: (n) => `buy ${some(n, "apple seed")} from Heidi`,
    waitForLoans: (n) => `(or wait, if last week's review isn't back by wednesday Ratticus lends up to ${n})`,
    place: (n) => `place ${some(n, "plot")}`,
    plantBase: (n, plan) => `plant ${some(n, baseSeedName(plan.inventory, plan.t))}`,
    plantApples: (n) => `plant ${some(n, "apple seed")}`,
    code: (n) => `code ${n} h`,
    ship: (n) => `ship this week's project so the ${n} grow`,
};

let root = null;
let noticeBox = null;
let planBox = null;

// screen corner for now, maybe terra menu tab later. just enough style to read over canvas. pickGoal opens terra's tree
export function mountPanel(pickGoal) {
    if (root) return;
    root = document.createElement("div");
    root.id = "terra-calc-panel";
    root.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:99999;max-width:340px;padding:8px 12px;"
        + "background:#fffbe8;color:#222;border:2px solid #6a9a3a;border-radius:8px;font:14px/1.4 sans-serif";
    noticeBox = document.createElement("div");
    planBox = document.createElement("div");
    planBox.textContent = "Terra Calc";
    const goalButton = document.createElement("button");
    goalButton.textContent = "pick your goal";
    goalButton.style.cssText = "margin-top:6px;font:inherit;cursor:pointer";
    goalButton.addEventListener("click", () => pickGoal());
    root.append(noticeBox, planBox, goalButton);
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
// TODO: hours left n goal progress bar, site presets + coin box for goal. also game vs typed numbers
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
    const { t, inventory, m, mGuessed, loans, farm, stuck } = plan;
    const lines = [weekName(t)];
    lines.push(`${some(Math.floor(inventory.coins), "coin")}, ${some(inventory.seeds, "apple seed")}, ${baseSeedsLine(inventory, t)}`);
    lines.push(inventory.plots === null ? "plots: go to your farm or open Heidi's shop" : some(inventory.plots, "plot"));
    if (loans > 0) lines.push(`${some(loans, "loan plot")} to place, Ratticus takes them back when you harvest the stuck crops`);
    const bagged = inventory.unplaced - loans;
    if (bagged > 0) lines.push(`${some(bagged, "plot")} in your bag to place`);
    lines.push(`multiplier ${Math.round(m * 100) / 100}${mGuessed ? ", a guess till a review comes back" : ""}`);
    // goal + this weeks crops work without farm, steps just come out empty
    if (!farm) return [...lines, ...nextLines(plan)];

    if (farm.empty > 0) lines.push(some(farm.empty, "empty plot"));
    const line = (crops, text) => crops.length > 0 && lines.push(`${crops.length} ${text}${cropKinds(crops)}`);
    for (const [stage, text] of Object.entries(STAGE_LINES)) line(farm.crops.filter((crop) => crop.stage === stage), text);
    // stuck = from before this week (all of them if week unkown), rest of review is this weeks n just waiting
    const stuckCrops = new Set(stuck.crops);
    for (const why of Object.keys(stuck.why)) {
        line(stuck.crops.filter((crop) => (crop.review ?? "review") === why), WHY_LINES[why] ?? `stuck (${why})`);
    }
    line(farm.crops.filter((crop) => crop.stage === "review" && !stuckCrops.has(crop)), "waiting on this week's review");
    if (farm.seenAt) lines.push(`(farm as of ${ago(now - farm.seenAt)})`);
    lines.push(...nextLines(plan));
    return lines;
}

// goal, this weeks target + steps, after farm lines
function nextLines(plan) {
    const { target, steps, goal, inventory } = plan;
    const lines = goal ? goalLines(goal, target, inventory.coins) : [];
    if (target?.out) lines.push("can't afford 10 crops this week, that's rent");
    else if (target) lines.push(`this week: ${some(target.w, "crop")}${target.reachable === null ? " (rent, no goal yet)" : ""}`);
    if (steps.length > 0) lines.push("next:");
    for (const step of steps) lines.push(STEP_LINES[step.do](step.n, plan));
    return lines;
}

// free seeds by name, a count per kind
function baseSeedsLine(inventory, t) {
    const kinds = Object.entries(inventory.baseKinds);
    if(kinds.length === 0) return some(0, baseSeedName(inventory, t));
    return kinds.map(([kind, n]) => some(n, `${kind} seed`)).join(", ");
}

// free seed name, "carrot or strawberry" if both. none left = named by week, carrots in prep
function baseSeedName({ baseKinds }, t) {
    const kinds = Object.keys(baseKinds);
    if (kinds.length === 0) return isPrep(t) ? "carrot seed" : "strawberry seed";
    return `${kinds.join(" or ")} seed`;
}

// "goal: 2800 coins (Framework 12), 2758 to go" + when next pick n whole thing are affordable (milestones)
function goalLines(goal, target, coins) {
    const lines = [`goal: ${some(goal.coins, "coin")}${goal.custom ? "" : ` (${goal.device})`}, ${Math.max(0, Math.ceil(goal.coins - coins))} to go`];
    if (target?.reachable === false) {
        lines.push(`can't get all of it even at 45 h, best is ${Math.floor(target.route.at(-1).endCoins)} coins`);
    }
    const picks = goal.milestones;
    const next = picks.find((pick) => !pick.now);
    if (picks.length > 0 && !next) lines.push("you can buy all of it now");
    if (next) lines.push(`next pick: ${pickName(next)} ${when(next)}`);
    if (next && next !== picks.at(-1)) lines.push(`all of it ${when(picks.at(-1))}`);
    return lines;
}

function pickName({ name, qty }) {
    return qty > 1 ? `${qty} ${name}` : name;
}

function when({ week }) {
    return week === null ? "doesn't fit" : `in ${weekName(week)}`;
}

// crop kinds with counts, bare name if only one kind. game name, seed id without one
function cropKinds(crops) {
    const counts = new Map();
    for (const crop of crops) {
        const name = (crop.name || crop.seed).toLowerCase();
        counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    if (counts.size === 1) return ` (${[...counts.keys()][0]})`;
    return ` (${[...counts].map(([name, n]) => `${n} ${name}`).join(", ")})`;
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
