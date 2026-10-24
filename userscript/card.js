// what to do next, inside terra's own This Week card
import { weekName, isPrep, DAY_MS } from "../src/week.js";
import { CROPS, BASE_KINDS } from "../src/data.js";
import { mixWords } from "../src/farm.js";
import { nestSteps } from "./next.js";
import { cssModule, ourBit, keepFromGame, POINTER } from "./page.js";
import { loadJSON, saveJSON } from "./store.js";

// 10 min
const FARM_OLD = 10 * 60000;
// 2 days
const DEADLINE_SOON = 2 * 86400000;
// "last week" line stays 2 days into a week
const RECAP_FOR = 2 * 86400000;

// why crops are stuck, "12 in review (apple)"
const WHY_LINES = {
    review: "in review",
    changes: "need changes",
    short: "short on hours",
    rejected: "rejected",
};

// next.js steps, n = whatever that step counts. plan for ones needing more words, step for its seed n done
const STEP_LINES = {
    clear: (n) => `clear ${n} withered`,
    harvest: (n) => `harvest ${n}`,
    sell: (n, plan, now, step) => `sell ${some(n, "crop")}${step.coins > 0 ? ` (~${some(step.coins, "coin")})` : ""}`,
    reship: () => "reship last week's project",
    devlog: () => "devlog and reship last week's project",
    buyPlots: (n) => `buy ${some(n, "plot")}`,
    checkShop: () => "check Heidi's shop",
    buySeeds: (n, plan, now, step) => `buy ${some(n, seedName(step.seed, plan))}`,
    waitForLoans: (n) => `(or wait for up to ${some(n, "loan plot")} on Wednesday, if still in review)`,
    place: (n) => `place ${some(n, "plot")}`,
    plantBase: (n, plan, now, step) => `plant ${some(n, baseSeedName(plan.inventory, plan.t))}${deadline(plan.inventory.seedsDie, now, step)}`,
    plant: (n, plan, now, step) => `plant ${some(n, seedName(step.seed, plan))}${deadline(plan.inventory.seedsDie, now, step)}`,
    claim: (n, plan, now, step) => `devlog ${n}h${deadline(plan.weekEnds, now, step)}`,
    code: (n, plan, now, step) => `code ${n}h${step.done ? "" : pace(n, plan, now)}`,
    ship: (n, plan, now, step) => `ship this week's project${deadline(plan.weekEnds, now, step)}`,
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

const cardBit = ourBit(fill);
let notices = [];

// watched cuz the body only exists while the card's open, rebuilt every expand
export function mountCard() {
    if (cardBit.mount(CARD_CSS)) cardBit.redraw();
}

// red line under plan like "Can't read Terra", no dupes
export function showNotice(text) {
    if (notices.includes(text)) return;
    notices = [...notices, text];
    cardBit.redraw();
}

// plan = what main.js works out, or null when there isn't enough to go on yet (then Terra's own
// checklist stays, unless there's a notice to show)
export function drawCard(plan) {
    cardBit.draw(plan);
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

function fill(plan) {
    if (!questClass("quest")) return;
    const card = toDraw(plan);
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
    keepFromGame(block, POINTER);
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
    line.title = `${some(Math.floor(coins), "coin")}${selling > 0 ? ` + ~${selling} after selling` : ""}, of ${goal}`;
    line.append(part(coins), part(Math.max(0, Math.min(selling, goal - coins))));
    return line;
}

// ours folded away, kept per broswer
const FOLD_KEY = "terra-calc-folded";
let folded = loadJSON(FOLD_KEY) === 1;

function setFolded(on) {
    folded = on;
    saveJSON(FOLD_KEY, on ? 1 : 0);
    cardBit.redraw();
}

// coins, plots and m left out, the steps already use them (terraCalc.plan().parts has em all). one detail can be the goal bar
export function cardFor(plan, now = Date.now()) {
    const { loans, farm, stuck, target, steps, goal, inventory } = plan;
    // ticked ones still count for the indent, list doesnt jump around
    const tasks = nestSteps(steps).map((step) => ({
        text: STEP_LINES[step.do](step.n, plan, now, step),
        depth: step.depth,
        done: step.done ?? false,
    }));
    // the steps need the farm to count from, the goal doesn't
    if (!farm) tasks.push({ text: "go to your island", depth: 0, done: false });

    const details = [];
    const recap = recapLine(plan.lastWeek, plan.weekEnds, now);
    if (recap) details.push(recap);
    if (target?.out) details.push("can't make rent this week");
    // nothing for apples only, the steps already say that
    const mix = mixWords(target?.mix, (id) => cropName(id, plan.crops));
    if (mix) details.push(`today's best: ${mix}`);
    if (plan.wait) {
        const { best, top, odds } = plan.wait;
        details.push(`waiting beats today's ${cropName(best, plan.crops)}, ${cropName(top, plan.crops)}'s in ${Math.round(odds * 100)}% of days`);
    }
    // stuck ones are from before this week (or all of them if the week's unknown)
    const stuckCrops = stuck?.crops ?? [];
    for (const why of Object.keys(stuck?.why ?? {})) {
        const these = stuck.crops.filter((crop) => (crop.review ?? "review") === why);
        details.push(`${these.length} ${WHY_LINES[why] ?? `stuck (${why})`}${cropKinds(these)}`);
    }
    if (loans > 0) details.push(`${some(loans, "loan plot")} from Ratticus`);
    if (goal) details.push(...goalLines(goal, target, inventory.coins, plan.selling.coins));
    // only once its old enough to throw the steps off
    if (farm?.seenAt && now - farm.seenAt >= FARM_OLD) details.push(`(farm as of ${ago(now - farm.seenAt)})`);
    return { tasks, details };
}

// free seed name, "carrot or strawberry" if both. none left = named by week, carrots in prep
function baseSeedName({ baseKinds }, t) {
    const kinds = Object.keys(baseKinds);
    if (kinds.length === 0) return `${isPrep(t) ? BASE_KINDS.prep : BASE_KINDS.main} seed`;
    return `${kinds.join(" or ")} seed`;
}

function seedName(id, plan) {
    return `${cropName(id, plan.crops)} seed`;
}

// todays shop name if its selling it, then CROPS, then the id (apples have no name)
function cropName(id, crops) {
    return (crops[id]?.name ?? CROPS[id]?.name ?? id).toLowerCase();
}

// "goal: 2800 coins (Framework 12), 2758 to go" + when next pick n whole thing are affordable (milestones)
// selling = coins unsold crops bring, already in route so "now" can mean after selling
function goalLines(goal, target, coins, selling = 0) {
    const device = goal.custom ? "" : ` (${goal.device})`;
    const toGo = Math.max(0, Math.ceil(goal.coins - coins - selling));
    const later = selling > 0 && coins < goal.coins ? " after selling" : "";
    const lines = [`goal: ${some(goal.coins, "coin")}${device}, ${toGo} to go${later}`];
    if (goal.coins > 0) lines.push({ bar: { coins, selling, goal: goal.coins } });
    if (target?.reachable === false) {
        lines.push(`out of reach, max ${Math.floor(target.route.at(-1).endCoins)} coins`);
        if (target.flat) lines.push(`not on my days, a flat ${target.flat} h/week would do it`);
    }
    const picks = goal.milestones;
    const next = picks.find((pick) => !pick.now);
    if (picks.length > 0 && !next) lines.push(`all affordable ${coins >= picks.at(-1).total ? "now" : "after selling"}`);
    if (next) lines.push(`next pick: ${pickName(next)} ${when(next)}`);
    if (next && next !== picks.at(-1)) lines.push(`all of it ${when(picks.at(-1))}`);
    return lines;
}

// "last week: 31.2h+ (plan 40h)", the + cuz hackatime keeps counting with terra closed
function recapLine(last, weekEnds, now) {
    if(!last?.seenAt || !weekEnds || now >= weekEnds - 7 * DAY_MS + RECAP_FOR) return null;
    // down, 19.96 isnt "20h+"
    const coded = Math.floor(last.coded * 10) / 10;
    return `last week: ${coded}h+${last.w === null ? "" : ` (plan ${last.w}h)`}`;
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

// " (1d 4h left)" once until (ms) is under DEADLINE_SOON away. ticked steps and no until get nothing
function deadline(until, now, step) {
    const left = (until ?? Infinity) - now;
    if (step.done || !(left > 0 && left < DEADLINE_SOON)) return "";
    return ` (${hoursLeft(left)} left)`;
}

// h a day till weekEnds (current-week endDate, sunday night US eastern). under a day just whats left. what i typed for today wins
function pace(n, { weekEnds, todayHours }, now) {
    if (!weekEnds || weekEnds <= now) return "";
    const left = weekEnds - now;
    if (left < DAY_MS) return ` (${hoursLeft(left)} left in week)`;
    if (todayHours != null) return ` (${Math.min(todayHours, n)}h today)`;
    return ` (${Math.round((n / (left / DAY_MS)) * 10) / 10}h/d)`;
}

// rounded down, "1d 4h" / "5h" / "<1h"
function hoursLeft(ms) {
    const hours = Math.floor((24 * ms) / DAY_MS);
    const days = Math.floor(hours / 24);
    if (hours < 1) return "<1h";
    if (days === 0) return `${hours}h`;
    return `${days}d${hours % 24 ? ` ${hours % 24}h` : ""}`;
}

function some(n, word) {
    return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function ago(ms) {
    const minutes = Math.round(ms / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    return `${Math.round(minutes / 60)}h ago`;
}
