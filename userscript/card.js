// what to do next, inside terra's own This Week card
import { weekName, isPrep } from "../src/week.js";
import { CROPS } from "../src/data.js";
import { nestSteps } from "./next.js";
import { cssModule, watchPage } from "./page.js";

// 10 min
const FARM_OLD = 10 * 60000;
// 2 days
const DEADLINE_SOON = 2 * 86400000;
// "last week" line stays 2 days into a week
const RECAP_FOR = 2 * 86400000;

// review reasons, worded like game hints (GameCanvas)
const WHY_LINES = {
    review: "waiting on last week's review",
    changes: "waiting on you, a reviewer asked for changes",
    short: "need more approved hours",
    rejected: "won't grow, last week's ship was rejected",
};

// next.js steps, n = whatever that step counts. plan for ones needing more words, step for its seed n done
const STEP_LINES = {
    clear: (n) => `clear ${n} withered`,
    harvest: (n) => `harvest ${n}`,
    sell: (n, plan, now, step) => `sell ${some(n, "crop")} at the market${step.coins > 0 ? ` for about ${some(step.coins, "coin")}` : ""}`,
    reship: (n) => `reship last week's project, ${n} waiting on changes`,
    devlog: (n) => `devlog and reship last week's project, ${n} short on hours`,
    buyPlots: (n) => `buy ${some(n, "plot")} from Heidi`,
    checkShop: () => "check what Heidi has today, the seeds change every day",
    buySeeds: (n, plan, now, step) => `buy ${some(n, seedName(step.seed, plan))} from Heidi`,
    waitForLoans: (n) => `(or wait, if last week's review isn't back by wednesday Ratticus lends up to ${n})`,
    place: (n) => `place ${some(n, "plot")}`,
    plantBase: (n, plan, now, step) => `plant ${some(n, baseSeedName(plan.inventory, plan.t))}${deadline(plan, now, step)}`,
    plant: (n, plan, now, step) => `plant ${some(n, seedName(step.seed, plan))}${deadline(plan, now, step)}`,
    claim: (n) => `devlog so the ${n} h since your last one count${n === 1 ? "s" : ""} as water`,
    // ticked one keeps its saved n, pace would be off
    code: (n, plan, now, step) => `code ${n} h${step.done ? "" : pace(n, plan.weekEnds, now)}`,
    ship: (n) => `ship this week's project so the ${n} grow`,
};

// ---- the page ----
// terra's "This Week" card (top right, GameCanvas quest list) is Solid DOM, our block goes at the end of its body
const BLOCK = "terra-calc-steps";
const OURS = "terra-calc-card";
const OURS_COLUMN = "terra-calc-column";
// their tasks hidden by a data attribute, Solid never touches one it didnt set
const CARD_CSS = `[data-terra-calc] > :not(.${BLOCK}):not([class*="_objectiveCountdown_"]) { display: none }
.${BLOCK} .terra-calc-link { text-decoration: underline; cursor: pointer }
.${BLOCK} .terra-calc-notice { color: #c0392b }
/* terra's own progress bar colors, thinner */
.${BLOCK} .terra-calc-bar { display: flex; height: 0.5em; margin-block: 0.25em; background: #efb367; border: 2px solid #93582c; border-radius: 0.7em; overflow: hidden }
.${BLOCK} .terra-calc-bar > * { background: #c7793c }
.${BLOCK} .terra-calc-bar > :last-child { opacity: 0.45 }`;

let redrawCard = null; // from watchPage
let lastPlan = null;
let notices = [];

// watched cuz the body only exists while the card's open, rebuilt every expand
export function mountCard() {
    if (redrawCard) return;
    const style = document.createElement("style");
    style.textContent = CARD_CSS;
    document.head.append(style);
    redrawCard = watchPage(fill);
    redrawCard();
}

// red line under plan like "Couldn't read Terra", no dupes
export function showNotice(text) {
    if (notices.includes(text)) return;
    notices = [...notices, text];
    redrawCard?.();
}

// plan = what main.js works out, or null when there isn't enough to go on yet (then Terra's own
// checklist stays, unless there's a notice to show)
export function drawCard(plan) {
    lastPlan = plan;
    redrawCard?.();
}

// quest card class by local name, "quest" -> "_quest_k6rzi_16". null till game css is in
function questClass(local) {
    return cssModule("questInner", "questTitle")?.[local] ?? null;
}

// no body when collapsed. told apart by "This Week", all quest cards share classes
function weeklyCard() {
    const title = [...document.querySelectorAll(`.${questClass("questTitle")}`)].find((el) => el.textContent.trim() === "This Week");
    const card = title?.closest(`.${questClass("quest")}`) ?? null;
    return { card, body: card?.querySelector(`.${questClass("questBody")}`) ?? null };
}

function fill() {
    if (!questClass("quest")) return;
    const card = toDraw(lastPlan);
    const { card: theirs, body } = weeklyCard();
    let ours = document.getElementById(OURS);
    // own card only with no weekly one (no objective), its column goes too if it made one
    if (ours && (theirs || !card)) {
        (document.getElementById(OURS_COLUMN) ?? ours).remove();
        ours = null;
    }
    if (body && card) {
        if (folded) body.removeAttribute("data-terra-calc");
        else body.setAttribute("data-terra-calc", "");
        const block = body.querySelector(`:scope > .${BLOCK}`) ?? body.appendChild(makeBlock());
        drawBlock(block, card);
    } else if (body) {
        // nothing to say, terra's checklist comes back
        body.removeAttribute("data-terra-calc");
        body.querySelector(`:scope > .${BLOCK}`)?.remove();
    } else if (!theirs && card) {
        ours ??= makeOwnCard();
        drawBlock(ours.querySelector(`.${BLOCK}`), card);
    }
    // theirs collapsed = nothing to do, our block went with their body
}

function toDraw(plan) {
    if (!plan && notices.length === 0) return null;
    return plan ? cardFor(plan) : { tasks: [], details: [] };
}

function makeBlock() {
    const block = document.createElement("div");
    block.className = BLOCK;
    // clicks would bubble up to game handlers
    for (const type of ["pointerdown", "mousedown", "touchstart", "click"]) {
        block.addEventListener(type, (event) => event.stopPropagation());
    }
    return block;
}

// same classes as theirs so it looks the same. top of their column (other quests) or a column of its own
function makeOwnCard() {
    const el = (local, tag = "div") => {
        const node = document.createElement(tag);
        node.className = questClass(local);
        return node;
    };
    const card = el("quest");
    card.id = OURS;
    const inner = el("questInner");
    const header = el("questHeader");
    const title = el("questTitle", "span");
    title.textContent = "Terra Calc";
    const body = el("questBody");
    header.append(title);
    body.append(makeBlock());
    inner.append(header, body);
    card.append(inner);
    const column = document.querySelector(`.${questClass("container")}`);
    if (column) {
        column.prepend(card);
    } else {
        const container = el("container");
        container.id = OURS_COLUMN;
        container.append(card);
        document.body.append(container);
    }
    return card;
}

function drawBlock(block, { tasks, details }) {
    const detail = (text, extra = "") => {
        const line = document.createElement("div");
        line.className = `${questClass("objectiveDetail")} ${extra}`;
        line.textContent = text;
        return line;
    };
    const link = (text, go) => {
        const line = detail(text, "terra-calc-link");
        line.addEventListener("click", go);
        return line;
    };
    // folded = just the show link, fill takes our attribute off so terra's checklist shows
    if (folded) {
        block.replaceChildren(link("show Terra Calc", () => setFolded(false)));
        return;
    }
    const current = tasks.find((task) => !task.done);
    const rows = tasks.map((task) => {
        const row = document.createElement("div");
        row.className = `${questClass("task")} ${task === current ? questClass("taskCurrent") : ""}`;
        // 1.25em = their checkbox + gap, same as detail line margin
        row.style.paddingLeft = `${task.depth * 1.25}em`;
        const box = document.createElement("div");
        box.className = `${questClass("taskCheckbox")} ${task.done ? questClass("taskCheckboxDone") : ""}`;
        const label = document.createElement("span");
        label.className = `${questClass("taskLabel")} ${task.done ? questClass("taskLabelDone") : ""}`;
        label.textContent = task.text;
        row.append(box, label);
        return row;
    });
    block.replaceChildren(
        ...rows,
        ...notices.map((text) => detail(text, "terra-calc-notice")),
        ...details.map((item) => (typeof item === "string" ? detail(item) : drawBar(detail(""), item.bar))),
        link("hide Terra Calc", () => setFolded(true)),
    );
}

// goal bar in a detail line, my coins solid n crops waitng to sell faded after
function drawBar(line, { coins, selling, goal }) {
    const part = (n) => {
        const div = document.createElement("div");
        div.style.width = `${Math.min(100, (100 * n) / goal)}%`;
        return div;
    };
    line.classList.add("terra-calc-bar");
    line.title = `${some(Math.floor(coins), "coin")}${selling > 0 ? ` + about ${selling} once you sell your crops` : ""}, out of ${goal}`;
    line.append(part(coins), part(Math.max(0, Math.min(selling, goal - coins))));
    return line;
}

// ours folded away, kept per broswer
const FOLD_KEY = "terra-calc-folded";
let folded = (() => {
    try {
        return localStorage.getItem(FOLD_KEY) === "1";
    } catch {
        return false;
    }
})();

function setFolded(on) {
    folded = on;
    try {
        localStorage.setItem(FOLD_KEY, on ? "1" : "0");
    } catch {
        // not saved, it unfolds again next load
    }
    redrawCard?.();
}

// coins, plots and m left out, the steps already use them (terraCalc.plan() has em all). one detail can be the goal bar
export function cardFor(plan, now = Date.now()) {
    const { loans, farm, stuck, target, steps, goal, inventory } = plan;
    // ticked ones still count for the indent, list doesnt jump around
    const tasks = nestSteps(steps).map((step) => ({
        text: STEP_LINES[step.do](step.n, plan, now, step),
        depth: step.depth,
        done: step.done ?? false,
    }));
    // the steps need the farm to count from, the goal doesn't
    if (!farm) tasks.push({ text: "go to your island so Terra Calc can count your plots", depth: 0, done: false });

    const details = [];
    const recap = recapLine(plan.lastWeek, plan.weekEnds, now);
    if (recap) details.push(recap);
    if (target?.out) details.push("can't afford 10 crops this week, that's rent");
    const mix = mixLine(target?.mix, plan.crops);
    if (mix) details.push(mix);
    // stuck = from before this week (all of them if week unkown)
    for (const why of Object.keys(stuck?.why ?? {})) {
        const these = stuck.crops.filter((crop) => (crop.review ?? "review") === why);
        details.push(`${these.length} ${WHY_LINES[why] ?? `stuck (${why})`}${cropKinds(these)}`);
    }
    if (loans > 0) details.push(`${some(loans, "loan plot")} from Ratticus, he takes them back when you harvest the stuck crops`);
    if (goal) details.push(...goalLines(goal, target, inventory.coins, plan.selling?.coins ?? 0));
    // only once its old enough to throw the steps off
    if (farm?.seenAt && now - farm.seenAt >= FARM_OLD) details.push(`(farm as of ${ago(now - farm.seenAt)})`);
    return { tasks, details };
}

// free seed name, "carrot or strawberry" if both. none left = named by week, carrots in prep
function baseSeedName({ baseKinds }, t) {
    const kinds = Object.keys(baseKinds);
    if (kinds.length === 0) return isPrep(t) ? "carrot seed" : "strawberry seed";
    return `${kinds.join(" or ")} seed`;
}

// "eggplant seed"
function seedName(id, plan) {
    return `${cropName(id, plan.crops)} seed`;
}

// "bok choy", todays shop name if its there, then CROPS, then the id (apples have no name)
function cropName(id, crops) {
    return (crops?.[id]?.name ?? CROPS[id]?.name ?? id).toLowerCase();
}

// "goal: 2800 coins (Framework 12), 2758 to go" + when next pick n whole thing are affordable (milestones)
// selling = coins unsold crops bring, already in route so "now" can mean after selling
function goalLines(goal, target, coins, selling = 0) {
    const later = selling > 0 && coins < goal.coins ? " once you sell your crops" : "";
    const lines = [`goal: ${some(goal.coins, "coin")}${goal.custom ? "" : ` (${goal.device})`}, ${Math.max(0, Math.ceil(goal.coins - coins - selling))} to go${later}`];
    if (goal.coins > 0) lines.push({ bar: { coins, selling, goal: goal.coins } });
    if (target?.reachable === false) {
        lines.push(`can't get all of it even at 45 h, best is ${Math.floor(target.route.at(-1).endCoins)} coins`);
    }
    const picks = goal.milestones;
    const next = picks.find((pick) => !pick.now);
    if (picks.length > 0 && !next) lines.push(`you can buy all of it ${coins >= picks.at(-1).total ? "now" : "once you sell your crops"}`);
    if (next) lines.push(`next pick: ${pickName(next)} ${when(next)}`);
    if (next && next !== picks.at(-1)) lines.push(`all of it ${when(picks.at(-1))}`);
    return lines;
}

// first weeks mix, biggest first. null for apples only, the steps say that already
function mixLine(mix, crops) {
    const counts = Object.entries(mix ?? {}).filter(([, n]) => n > 0);
    if (!counts.some(([id]) => id !== "apple")) return null;
    const seeds = counts.sort((a, b) => b[1] - a[1]).map(([id, n]) => `${n} ${cropName(id, crops)}`);
    return `today's best: ${seeds.join(" + ")}`;
}

// "last week: coded at least 31.2 h, the plan wanted 40 h" for RECAP_FOR into a week
function recapLine(last, weekEnds, now) {
    if(!last?.seenAt || !weekEnds || now >= weekEnds - 7 * 86400000 + RECAP_FOR) return null;
    // down, 19.96 isnt "at least 20 h"
    const coded = Math.floor(last.coded * 10) / 10;
    // at least cuz its as of when terra calc last saw that week, hackatime keeps crediting with terra closed
    return `last week: coded at least ${coded} h${last.w === null ? "" : `, the plan wanted ${last.w} h`}`;
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

// " (5 h left to plant and water them)" inside DEADLINE_SOON, ticked steps get nothing
function deadline(plan, now, step) {
    const left = (plan.inventory.seedsDie ?? Infinity) - now;
    if (step.done || !(left > 0 && left < DEADLINE_SOON)) return "";
    const hours = Math.floor(left / 3600000);
    const days = Math.floor(hours / 24);
    const when = hours < 1 ? "under an hour"
        : days === 0 ? `${hours} h`
            : `${some(days, "day")}${hours % 24 ? ` ${hours % 24} h` : ""}`;
    return ` (${when} left to plant and water ${step.n === 1 ? "it" : "them"})`;
}

// " (3 days left, about 9.4 h a day)". weekEnds from current-week endDate, sunday night US eastern
function pace(n, weekEnds, now) {
    if (!weekEnds || weekEnds <= now) return "";
    const days = (weekEnds - now) / 86400000;
    if (days < 1 / 24) return " (under an hour left in the week)";
    if (days < 1) return ` (${Math.floor(days * 24)} h left in the week)`;
    return ` (${some(Math.floor(days), "day")} left, about ${Math.round((n / days) * 10) / 10} h a day)`;
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
