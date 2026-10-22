// what to do next, inside terra's own This Week card
import { weekName, isPrep } from "../src/week.js";
import { nestSteps } from "./next.js";

// 10 min
const FARM_OLD = 10 * 60000;

// review reasons, worded like game hints (GameCanvas)
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

// ---- the page ----
// terra's "This Week" card (top right, GameCanvas quest list) is Solid DOM, our block goes at the end of its body
const BLOCK = "terra-calc-steps";
const OURS = "terra-calc-card";
const OURS_COLUMN = "terra-calc-column";
const CARD_WATCH = { childList: true, subtree: true };
// their tasks hidden by a data attribute, Solid never touches one it didnt set
const CARD_CSS = `[data-terra-calc] > :not(.${BLOCK}):not([class*="_objectiveCountdown_"]) { display: none }
.${BLOCK} .terra-calc-link { text-decoration: underline; cursor: pointer }
.${BLOCK} .terra-calc-notice { color: #c0392b }`;

let cardObserver = null;
let pickGoal = null;
let lastPlan = null;
let notices = [];
let classes = null; // local name -> real class

// watched cuz the body only exists while the card's open, rebuilt every expand. pickGoal opens terra's tree
export function mountCard(onPickGoal) {
    if (cardObserver) return;
    pickGoal = onPickGoal;
    const style = document.createElement("style");
    style.textContent = CARD_CSS;
    document.head.append(style);
    cardObserver = new MutationObserver(queueFill);
    cardObserver.observe(document.body, CARD_WATCH);
    fill();
}

// red line under plan like "Couldn't read Terra", no dupes
export function showNotice(text) {
    if (notices.includes(text)) return;
    notices = [...notices, text];
    fill();
}

// plan = what main.js works out, null = not enough to go on yet (terra's checklist stays unless there's a notice)
// TODO: hours left this week, progress bar to goal
export function drawCard(plan) {
    lastPlan = plan;
    fill();
}

// quest card class by local name, "quest" -> "_quest_k6rzi_16". k6rzi is new every build. null till game css is in
function questClass(local) {
    if (!classes) {
        const modules = {}; // hash -> { local: class }
        for (const sheet of document.styleSheets) {
            let rules;
            try {
                rules = sheet.cssRules;
            } catch {
                // other origins (fonts) throw on cssRules
                continue;
            }
            for (const rule of rules) {
                for (const [, name, part, hash] of (rule.selectorText ?? "").matchAll(/\.(_([A-Za-z]+)_([a-z0-9]+)_\d+)/g)) {
                    (modules[hash] ??= {})[part] ??= name;
                }
            }
        }
        // _container_ and _task_ are in lots of modules, quest card's has these two
        classes = Object.values(modules).find((names) => names.questInner && names.questTitle) ?? null;
        if (!classes) return null;
    }
    return classes[local] ?? null;
}

// no body when collapsed. told apart by "This Week", all quest cards share classes
function weeklyCard() {
    const title = [...document.querySelectorAll(`.${questClass("questTitle")}`)].find((el) => el.textContent.trim() === "This Week");
    const card = title?.closest(`.${questClass("quest")}`) ?? null;
    return { card, body: card?.querySelector(`.${questClass("questBody")}`) ?? null };
}

// game DOM changes a lot (timers, hud), one fill a frame max
let queued = false;
function queueFill() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
        queued = false;
        fill();
    });
}

function fill() {
    if (!cardObserver || !questClass("quest")) return;
    const card = toDraw(lastPlan);
    // our own drawing would set it off again
    cardObserver.disconnect();
    const { card: theirs, body } = weeklyCard();
    let ours = document.getElementById(OURS);
    // own card only with no weekly one (no objective), its column goes too if it made one
    if (ours && (theirs || !card)) {
        (document.getElementById(OURS_COLUMN) ?? ours).remove();
        ours = null;
    }
    if (body && card) {
        body.setAttribute("data-terra-calc", "");
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
    cardObserver.observe(document.body, CARD_WATCH);
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
    const rows = tasks.map((task, i) => {
        const row = document.createElement("div");
        row.className = `${questClass("task")} ${i === 0 ? questClass("taskCurrent") : ""}`;
        // 1.25em = their checkbox + gap, same as detail line margin
        row.style.paddingLeft = `${task.depth * 1.25}em`;
        const box = document.createElement("div");
        box.className = questClass("taskCheckbox");
        const label = document.createElement("span");
        label.className = questClass("taskLabel");
        label.textContent = task.text;
        row.append(box, label);
        return row;
    });
    const detail = (text, extra = "") => {
        const line = document.createElement("div");
        line.className = `${questClass("objectiveDetail")} ${extra}`;
        line.textContent = text;
        return line;
    };
    const link = detail("pick your goal", "terra-calc-link");
    link.addEventListener("click", () => pickGoal?.());
    block.replaceChildren(
        ...rows,
        ...notices.map((text) => detail(text, "terra-calc-notice")),
        ...details.map((text) => detail(text)),
        link,
    );
}

// coins, plots and m left out, the steps already use them (terraCalc.plan() has em all)
export function cardFor(plan, now = Date.now()) {
    const { loans, farm, stuck, target, steps, goal, inventory, m, mGuessed } = plan;
    const tasks = nestSteps(steps).map((step) => ({ text: STEP_LINES[step.do](step.n, plan), depth: step.depth }));
    // steps need farm, goal doesnt
    if (!farm) tasks.push({ text: "go to your farm so Terra Calc can count your plots", depth: 0 });

    const details = [];
    if (target?.out) details.push("can't afford 10 crops this week, that's rent");
    // stuck = from before this week (all of them if week unkown)
    for (const why of Object.keys(stuck?.why ?? {})) {
        const these = stuck.crops.filter((crop) => (crop.review ?? "review") === why);
        details.push(`${these.length} ${WHY_LINES[why] ?? `stuck (${why})`}${cropKinds(these)}`);
    }
    if (loans > 0) details.push(`${some(loans, "loan plot")} from Ratticus, he takes them back when you harvest the stuck crops`);
    if (goal) details.push(...goalLines(goal, target, inventory.coins, mGuessed ? m : null));
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

// "goal: 2800 coins (Framework 12), 2758 to go" + when next pick n whole thing are affordable (milestones)
function goalLines(goal, target, coins, mGuess = null) {
    // weeks swing a lot with m
    const guess = mGuess === null ? "" : ` (guessing m ${Math.round(mGuess * 100) / 100})`;
    const lines = [`goal: ${some(goal.coins, "coin")}${goal.custom ? "" : ` (${goal.device})`}, ${Math.max(0, Math.ceil(goal.coins - coins))} to go${guess}`];
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
