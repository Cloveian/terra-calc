// what to do next, inside terra's own This Week card
import { weekName, isPrep, DAY_MS, LAST_WEEK } from "../src/week.js";
import { CROPS, BASE_KINDS, MAX_PLOTS } from "../src/data.js";
import { mixWords, mixIds, perHour } from "../src/farm.js";
import { nestSteps } from "./next.js";
import { cssModule, ourBit, keepFromGame, POINTER } from "./page.js";
import { loadJSON, saveJSON } from "./store.js";
import { canHelp, openHelp } from "./help.js";
import { texIcon, num, perHourTex, PER_HOUR_TEX } from "./tip.js";

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
    checkShop: (n, plan) => (plan.shopSeen ? "check Heidi's shop" : "open Heidi's shop once, Terra Calc doesn't know her seeds yet"),
    buySeeds: (n, plan, now, step) => `buy ${some(n, seedName(step.seed, plan))}`,
    buyLater: (n) => `buy ${some(n, "more seed")} on Sunday`,
    waitForLoans: (n, plan, now, step) => {
        const wait = `wait for up to ${some(n, "loan plot")} on Wednesday, if still in review`;
        return step.or ? `(or ${wait})` : wait;
    },
    full: (n, plan) => `${some(n, "crop")} won't fit${plan.stuck?.count ? " till last week's clear" : ""}, ${MAX_PLOTS} plots is the most`,
    place: (n) => `place ${some(n, "plot")}`,
    plantBase: (n, plan, now, step) => `plant ${some(n, baseSeedName(plan.inventory, plan.t))}${deadline(plan.inventory.seedsDie, now, step)}`,
    plant: (n, plan, now, step) => `plant ${some(n, seedName(step.seed, plan))}${deadline(plan.inventory.seedsDie, now, step)}`,
    claim: (n, plan, now, step) => `devlog ${n}h${deadline(plan.weekEnds, now, step)}`,
    code: (n, plan, now, step) => `code ${n}h${step.done ? "" : pace(n, plan, now)}`,
    ship: (n, plan, now, step) => `ship this week's project${deadline(plan.weekEnds, now, step)}`,
};

// hover maths, the general one over my numbers (tip.js)
const WAIT_TEX = "\\text{wait}_n = p_{\\text{back}} \\, \\mathbb{E}[\\max(v, \\text{wait}_{n-1})] + (1 - p_{\\text{back}}) \\, \\text{wait}_{n-1}, \\quad \\text{wait}_0 = 0";
const RISK_TEX = "\\text{buy if } p \\, m \\, \\text{sell} - \\text{buy} > p \\cdot \\text{wait} \\cdot \\text{water} \\quad (0 \\text{ at } p = 1)";
const LUCK_TEX = "\\text{the plan's h/week, every week after this one on one seed at } v = \\frac{m \\cdot \\text{sell} - \\text{buy}}{\\text{water}}";
const PICK_TEX = "\\text{first week with } c_{\\text{end of week}} \\ge \\text{the picks up to it}";
const CODE_TEX = "h = \\text{water owed} - \\text{pool} - h_{\\text{not devlogged}}";

// ---- the page ----
// terra's "This Week" card (top right, GameCanvas quest list) is Solid DOM, our block goes at the end of its body
const BLOCK = "terra-calc-steps";
const OURS = "terra-calc-card";
const OURS_COLUMN = "terra-calc-column";
// their tasks hidden by a data attribute, Solid never touches one it didnt set
const CARD_CSS = `[data-terra-calc] > :not(.${BLOCK}):not([class*="_objectiveCountdown_"]) { display: none }
.${BLOCK} .terra-calc-link { text-decoration: underline; cursor: pointer }
.${BLOCK} .terra-calc-notice { color: #c0392b }
.${BLOCK} .terra-calc-pick { padding-left: 1em }
/* terra's own progress bar colors, thinner */
.${BLOCK} .terra-calc-bar { display: flex; height: 0.5em; margin-block: 0.25em; background: #efb367; border: 2px solid #93582c; border-radius: 0.7em; overflow: hidden }
.${BLOCK} .terra-calc-bar > * { background: #c7793c }
.${BLOCK} .terra-calc-bar > :last-child { opacity: 0.45 }
.${BLOCK} .terra-calc-foot { display: flex; justify-content: space-between; align-items: center }
/* cream n brown like the tree tags, grows on hover like terra's buttons */
.${BLOCK} .terra-calc-help { all: unset; box-sizing: border-box; width: 1.5em; height: 1.5em; border-radius: 50%; background: #f9e6ce; border: 2px solid #93582c; color: #93582c; font: 700 .9em/1 var(--game-font, "Pleasurize", cursive); display: grid; place-items: center; cursor: pointer; transition: transform .15s }
.${BLOCK} .terra-calc-help:hover { transform: scale(1.1) }`;

const cardBit = ourBit(fill);
let notices = [];
const folded = savedFlag("terra-calc-folded"); // ours folded away
const showPicks = savedFlag("terra-calc-show-picks"); // every pick listed under the goal
const helpSeen = savedFlag("terra-calc-help-seen"); // help book opened by itself once

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

// every notice starting with start, the farm one ends in a list of whats missing
export function clearNotice(start) {
    const left = notices.filter((n) => !n.startsWith(start));
    if (left.length === notices.length) return;
    notices = left;
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
        if (folded.on) body.removeAttribute("data-terra-calc");
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

    // steps have to be on screen, a collapsed card waits
    if (card && (body || !theirs) && !folded.on && !helpSeen.on && canHelp()) {
        helpSeen.set(true);
        openHelp();
    }
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
    if (folded.on) {
        block.replaceChildren(link("show Terra Calc", () => folded.set(false)));
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
        if (task.tex) label.append(texIcon(task.tex));
        row.append(box, label);
        return row;
    });
    const drawDetail = (item) => {
        if (typeof item === "string") return [detail(item)];
        if (item.tex) {
            const line = detail(item.text);
            line.append(texIcon(item.tex));
            return [line];
        }
        if (item.bar) return [drawBar(detail(""), item.bar)];
        if (!showPicks.on) return [link("show more", () => showPicks.set(true))];
        return [...item.picks.map((text) => detail(text, "terra-calc-pick")), link("show less", () => showPicks.set(false))];
    };
    block.replaceChildren(
        ...rows,
        ...notices.map((text) => detail(text, "terra-calc-notice")),
        ...details.flatMap(drawDetail),
        drawFoot(link("hide Terra Calc", () => folded.set(true))),
    );
}

// hide link left, help ? bottom right. no tome classes = no ?
function drawFoot(hide) {
    const foot = document.createElement("div");
    foot.className = "terra-calc-foot";
    foot.append(hide);
    if (canHelp()) {
        const help = document.createElement("button");
        help.className = "terra-calc-help";
        help.textContent = "?";
        help.title = "How to use Terra Calc";
        help.setAttribute("aria-label", help.title);
        help.addEventListener("click", openHelp);
        foot.append(help);
    }
    return foot;
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

// on / off kept per broswer
function savedFlag(key) {
    let on = loadJSON(key) === 1;
    return {
        get on() {
            return on;
        },
        set(value) {
            on = value;
            saveJSON(key, value ? 1 : 0);
            cardBit.redraw();
        },
    };
}

// coins, plots and m left out, the steps already use them (terraCalc.plan().parts has em all). one detail can be the goal bar, one the picks behind show more, n maths lines n the code task carry tex for tip.js
export function cardFor(plan, now = Date.now()) {
    const { loans, farm, stuck, target, steps, goal, inventory } = plan;
    // ticked ones still count for the indent, list doesnt jump around
    const tasks = nestSteps(steps).map((step) => ({
        text: STEP_LINES[step.do](step.n, plan, now, step),
        depth: step.depth,
        done: step.done ?? false,
        // a ticked one only has n
        ...(step.do === "code" && step.owed !== undefined && { tex: codeTex(step) }),
    }));
    // the steps need the farm to count from, the goal doesn't
    if (!farm) tasks.push({ text: "go to your island", depth: 0, done: false });

    const details = [];
    const recap = recapLine(plan.lastWeek, plan.weekEnds, now);
    if (recap) details.push(recap);
    if (target?.out) details.push("can't make rent this week");
    // nothing for apples only, the steps already say that
    const mix = mixWords(target?.mix, (id) => cropName(id, plan.crops));
    if (mix) {
        const each = mixIds(target.mix).map((id) => perHourTex(cropName(id, plan.crops), cropOf(id, plan.crops), plan.m));
        details.push({ text: `today's best: ${mix}`, tex: [PER_HOUR_TEX, ...each] });
    }
    if (plan.wait) {
        const { best, top, odds } = plan.wait;
        const v = perHour(cropOf(best, plan.crops), plan.m);
        details.push({
            text: `waiting beats today's ${cropName(best, plan.crops)}, ${cropName(top, plan.crops)}'s in ${Math.round(odds * 100)}% of days`,
            tex: [WAIT_TEX, `\\text{wait}_{${plan.held.days}} = ${num(plan.held.v)} > v_{\\text{${cropName(best, plan.crops)}}} = ${num(v)}`],
        });
    }
    if (plan.risk) details.push(...riskLines(plan.risk, plan));
    // stuck ones are from before this week (or all of them if the week's unknown)
    const stuckCrops = stuck?.crops ?? [];
    for (const why of Object.keys(stuck?.why ?? {})) {
        const these = stuck.crops.filter((crop) => (crop.review ?? "review") === why);
        details.push(`${these.length} ${WHY_LINES[why] ?? `stuck (${why})`}${cropKinds(these)}`);
    }
    if (loans > 0) details.push(`${some(loans, "loan plot")} from Ratticus`);
    // refund is in route start coins too, like selling
    if (goal) details.push(...goalLines(goal, target, inventory.coins + goal.refund, plan.selling.coins, plan.crops));
    // only once its old enough to throw the steps off
    if (farm?.seenAt && now - farm.seenAt >= FARM_OLD) details.push(`(farm as of ${ago(now - farm.seenAt)})`);
    return { tasks, details };
}

// step says it in tenths rounded up
function codeTex({ n, owed, pool, unclaimed }) {
    const h = owed - pool - unclaimed;
    const close = num(h) === String(n) ? "" : ` \\approx ${n}`;
    return [CODE_TEX, `h = ${num(owed)} - ${num(pool)} - ${num(unclaimed)} = ${num(h)}${close}`];
}

// "all 10 seeds to buy get watered at 26h more (2 of your last 4 weeks)", then one line per skipped seed
function riskLines({ h, weeks, of, kept, skip }, plan) {
    const skipped = Object.entries(skip);
    const lines = [];
    if (kept > 0) {
        const which = skipped.length ? "the other" : kept === 1 ? "the" : "all";
        lines.push({
            text: `${which} ${some(kept, "seed")} to buy ${kept === 1 ? "gets" : "get"} watered at ${h}h more (${weeks} of your last ${of} weeks)`,
            tex: [RISK_TEX, `p = P(\\text{rest of week} \\ge ${num(h)}) = \\frac{${weeks}}{${of}}`],
        });
    }
    for (const [id, { n, weeks: got, wait }] of skipped) {
        const { buy, sell, water } = cropOf(id, plan.crops);
        const p = `\\frac{${got}}{${of}}`;
        const now = `${p} \\cdot ${num(plan.m)} \\cdot ${sell} - ${buy} = ${num((got / of) * plan.m * sell - buy)}`;
        const later = wait ? `${p} \\cdot ${num(plan.held.v)} \\cdot ${water} = ${num((got / of) * plan.held.v * water)}` : "0";
        lines.push({
            text: `buy ${some(n, seedName(id, plan))} fewer${wait ? " and wait" : ""}, they'd only get watered in ${got} of your last ${of} weeks`,
            tex: [RISK_TEX, `${now} \\le ${later}`],
        });
    }
    return lines;
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

// name off the known seeds (shop log, data.js), then the id
function cropName(id, crops) {
    return (crops[id]?.name ?? CROPS[id]?.name ?? id).toLowerCase();
}

// buy, sell n water off the same places as cropName
function cropOf(id, crops) {
    return crops[id] ?? CROPS[id];
}

// "goal: 2800 coins (Framework 12), 2758 to go" + when next pick n whole thing are affordable (milestones)
// selling = coins unsold crops bring, already in route so "now" can mean after selling
function goalLines(goal, target, coins, selling, crops) {
    const device = goal.custom ? "" : ` (${goal.device})`;
    const toGo = Math.max(0, Math.ceil(goal.coins - coins - selling));
    const later = selling > 0 && coins < goal.coins ? " after selling" : "";
    const lines = [`goal: ${some(goal.coins, "coin")}${device}, ${toGo} to go${later}`];
    if (goal.refund > 0) lines.push(`counting ${some(goal.refund, "coin")} back from switching off the ${goal.from}`);
    if (goal.coins > 0) lines.push({ bar: { coins, selling, goal: goal.coins } });
    if (target?.reachable === false) {
        lines.push(`out of reach, max ${Math.floor(target.route.at(-1).endCoins)} coins`);
        if (target.flat) lines.push(`not on your days, a flat ${target.flat} h/week would do it`);
    }
    const picks = goal.milestones;
    const next = picks.find((pick) => !pick.now);
    if (picks.length > 0 && !next) lines.push(`all affordable ${coins >= picks.at(-1).total ? "now" : "after selling"}`);
    const route = target?.route ?? [];
    if (next) lines.push(withPickTex(`next pick: ${pickName(next)} ${when(next)}`, next, route));
    if (next && next !== picks.at(-1)) lines.push(withPickTex(`all of it ${when(picks.at(-1))}`, picks.at(-1), route));
    // all of it now is the same at any h/week
    if (goal.usual && next) lines.push(projectionWords(`at your usual ${goal.usual.h} h/week:`, goal.usual));
    if (goal.luck && next) lines.push(...luckLines(goal.luck, picks, route.find((row) => row.out)?.week ?? null, crops));
    // every pick behind a show more, drawBlock does the link
    // 2 = next pick n all of it already
    if (picks.length > 2) lines.push({ picks: picks.map((pick) => `${pickName(pick)} ${pick.now ? "now" : when(pick)}`) });
    return lines;
}

// a pick lands the first week the route ends with its running total, c_{Week 3} = 600 < 750 <= 812 = c_{Week 4}. plain text off the route
function withPickTex(text, pick, route) {
    const at = route.findIndex((row) => row.week === pick.week);
    if (at < 0) return text;
    const coins = (row) => `c_{\\text{${weekName(row.week)}}}`;
    // num, rounding to whole coins made 749.6 < 750 read 750 < 750
    const before = at > 0 ? `${coins(route[at - 1])} = ${num(route[at - 1].endCoins)} < ` : "";
    return { text, tex: [PICK_TEX, `${before}${num(pick.total)} \\le ${num(route[at].endCoins)} = ${coins(route[at])}`] };
}

// projection() from next.js as words, "at your usual 24 h/week: 3 of 5 picks by Week 12"
function projectionWords(start, { fit, of, week, outFrom }) {
    if (outFrom !== null) return `${start} rent runs out in ${weekName(outFrom)}`;
    if (fit === of) return `${start} all of it after ${weekName(week)}`;
    return `${start} ${fit} of ${of} picks by ${weekName(LAST_WEEK)}`;
}

// vs the plan's own picks, only the side that changes something
function luckLines({ bad, good, typical }, picks, outFrom, crops) {
    const fitting = picks.filter((pick) => pick.now || pick.week !== null);
    const plan = { fit: fitting.length, week: fitting.at(-1)?.week ?? null, outFrom };
    // paying rent longer wins, then more picks, then sooner
    const beats = (a, b) => {
        if (a.outFrom !== null || b.outFrom !== null) return b.outFrom !== null && (a.outFrom === null || a.outFrom > b.outFrom);
        return a.fit > b.fit || (a.fit === b.fit && a.week !== null && b.week !== null && a.week < b.week);
    };
    // tip = that seed's coins a water vs the plan's typical day
    // "if Heidi only had apple seeds: 3 of 5 picks by Week 12"
    const line = (p, how) => {
        const name = cropName(p.seed, crops);
        // empty log days count as 0, typical can end up under her worst seed
        const side = p.v < typical ? "<" : p.v > typical ? ">" : "=";
        return { text: projectionWords(`if Heidi ${how} had ${name} seeds:`, p), tex: [LUCK_TEX, `v_{\\text{${name}}} = ${num(p.v)} ${side} ${num(typical)} = v_{\\text{typical day}}`] };
    };
    const lines = [];
    if (beats(plan, bad)) lines.push(line(bad, "only"));
    if (beats(good, plan)) lines.push(line(good, "always"));
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
    return week === null ? "doesn't fit" : `after ${weekName(week)}`;
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

// h a day till weekEnds (current-week endDate, sunday night US eastern). under a day just whats left. whats left of what i typed for today wins
function pace(n, { weekEnds, todayLeft }, now) {
    if (!weekEnds || weekEnds <= now) return "";
    const left = weekEnds - now;
    if (left < DAY_MS) return ` (${hoursLeft(left)} left in week)`;
    if (todayLeft != null) {
        const h = Math.round(Math.min(todayLeft, n) * 10) / 10;
        return h > 0 ? ` (${h}h left today)` : " (today's done)";
    }
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
