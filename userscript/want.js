// want bits under each card on terra's own device tree
import { limitOf, unpick, normalize, dependentsOf, wantedRows, rowPrio } from "../src/tree.js";
import { weekName } from "../src/week.js";
import { watchPage } from "./page.js";

const BIT = "terra-calc-want";
// terra's own tree look, cream n brown with a hard shadow and dark buttons. in em so it zooms with the node's text
// hung under card, resizing it would move tree lines (they go to its middle)
const WANT_CSS = `.${BIT} { position: absolute; top: 100%; left: 50%; transform: translateX(-50%); margin-top: .35em; z-index: 2;
  display: flex; flex-direction: column; align-items: center; gap: .2em; white-space: nowrap; padding: .2em .5em;
  background: #f9e6ce; color: #462114; border: 2px solid #93582c; border-radius: .8em; box-shadow: 0 2px #46211459;
  font: 700 .7em/1.3 var(--game-font, "Pleasurize", cursive) }
.${BIT} > div { display: flex; gap: .3em; align-items: center }
.${BIT} button { font: inherit; color: #f4ca95; background: #733b11; border: 2px solid #462114; border-radius: .6em; padding: 0 .45em; cursor: pointer }
.${BIT} button:hover:not(:disabled) { background: #974d16 }
.${BIT} button.light { color: #5c3310; background: #f0b870; border-color: #93582c }
.${BIT} button.light:hover:not(:disabled) { background: #edaa54 }
.${BIT} button:disabled { opacity: .55; cursor: not-allowed }
.${BIT} input { font: inherit; width: 3em; color: #5c3310; background: #fff; border: 1px solid #93582c; border-radius: 1em; padding: 0 .4em }
.${BIT} .quiet { opacity: .65; font-weight: 400 }`;

// one node's tag, null on limit-1 stuff i already own (terra's badge covers it)
// milestones = plan rows by key (milestones() + rowHours), empty till there's a plan
export function wantBit(tree, own, want, id, milestones = new Map(), prio = {}) {
    const node = tree.nodes.find((n) => n.id === id);
    if (!node) return null;
    const limit = limitOf(node, want);
    const count = want[id] ?? 0;
    const owned = own[id] ?? 0;
    if (limit === 1 && owned >= 1) return null;
    // only wanted cuz somthing further up needs it
    const needed = count > owned && dependentsOf(tree, id).some((other) => (want[other] ?? 0) > (own[other] ?? 0));
    // a priority box per buyOrder row, one per tier on tiered nodes
    const rows = wantedRows(tree, want, own).filter((row) => row.id === id).map((row) => ({
        key: row.key,
        label: row.unit === null ? null : row.name,
        prio: rowPrio(prio, row),
        when: whenFor(milestones.get(row.key)),
    }));
    return {
        stepper: limit !== 1,
        text: limit === 1 ? (count > 0 ? "wanted" : "want") : `want ${count}`,
        canAdd: count < limit,
        canRemove: count > owned,
        needed,
        rows,
    };
}

// "Week 4, 22 h/wk", or null with no plan yet
function whenFor(milestone) {
    if (!milestone) return null;
    if (milestone.now) return "can buy now";
    if (milestone.week === null) return "doesn't fit";
    if (milestone.hours === null) return weekName(milestone.week);
    return `${weekName(milestone.week)}, ${milestone.hours} h/wk`;
}

// + or - on one node like site tree, prereqs tag along n dependents go with it
export function changeWant(tree, own, want, id, delta) {
    const node = tree.nodes.find((n) => n.id === id);
    const next = (want[id] ?? 0) + delta;
    if (!node || next < (own[id] ?? 0) || next > limitOf(node, want)) return { want, removed: [] };
    const picked = next === 0 ? unpick(tree, want, id) : { ...want, [id]: next };
    const fixed = normalize(tree, own, picked).want;
    // dependents + fancy cards cut when USB goes down
    const removed = Object.keys(want).filter((other) => other !== id && (fixed[other] ?? 0) < want[other]);
    return { want: fixed, removed };
}

// same event as upgrade thing on the map (GameCanvas)
export function openTree() {
    window.dispatchEvent(new CustomEvent("open_device_upgrades"));
}

let redrawBits = null; // from watchPage
let last = null; // last drawWantBits state, for cards that show up later
let onPick = null;
let onPrio = null;

// pick = pickWant(device, id, delta), setPrio = pickPrio(device, rowKey, n) in main.js
export function mountWantBits(pick, setPrio) {
    if (redrawBits) return;
    onPick = pick;
    onPrio = setPrio;
    const style = document.createElement("style");
    style.textContent = WANT_CSS;
    document.head.append(style);
    redrawBits = watchPage(fillBits);
}

export function drawWantBits(state) {
    last = state;
    redrawBits?.();
}

// guessed off node ids, nothing else on page says which device
function shownDevice(trees, cards) {
    const ids = new Set(cards.map((card) => card.dataset.node));
    return Object.keys(trees).find((device) => trees[device].nodes.some((node) => ids.has(node.id))) ?? null;
}

function fillBits() {
    if (!last?.trees) return;
    // class names are css modules, new every build (_node_zskb9_255). data-node stays
    const cards = [...document.querySelectorAll("[data-node]")].filter((card) => card.dataset.node !== "root");
    const device = shownDevice(last.trees, cards);
    if (!device) return;
    const tree = last.trees[device];
    // goal on other device = nothing wanted on this one yet
    const onGoal = last.goal?.device === device;
    const own = onGoal ? last.goal.own : device === last.owned?.device ? last.owned.own : {};
    const want = onGoal ? last.goal.want : own;
    const rows = new Map((onGoal ? last.milestones : []).map((row) => [row.key, row]));
    const prio = onGoal ? last.goal.prio : {};
    for (const card of cards) {
        const bit = wantBit(tree, own, want, card.dataset.node, rows, prio);
        let tag = card.querySelector(`:scope > .${BIT}`);
        // typing in this one, a redraw would throw the box away. only the box tho, a clicked + has focus too and still redraws
        if (tag?.querySelector("input:focus")) continue;
        if (!bit) {
            tag?.remove();
            continue;
        }
        if (!tag) tag = makeTag(card);
        drawTag(tag, bit, device);
    }
}

function makeTag(card) {
    const tag = document.createElement("div");
    tag.className = BIT;
    // game opens its buy popup on any click in a node n pans on pointerdown
    for (const type of ["pointerdown", "mousedown", "touchstart", "click", "dblclick"]) {
        tag.addEventListener(type, (event) => event.stopPropagation());
    }
    // catches up once out of the box. not on its own + tho, redrawing on that mousedown swapped the button out n the click never landed
    tag.addEventListener("focusout", (event) => {
        if (!tag.contains(event.relatedTarget)) redrawBits?.();
    });
    card.append(tag);
    return tag;
}

function drawTag(tag, bit, device) {
    const id = tag.parentElement.dataset.node;
    const parts = [];
    const button = (text, delta, enabled, light = false) => {
        const b = document.createElement("button");
        b.textContent = text;
        b.disabled = !enabled;
        if (light) b.className = "light";
        b.addEventListener("click", () => onPick?.(device, id, delta));
        return b;
    };
    if (bit.stepper) {
        parts.push(button("-", -1, bit.canRemove), text(bit.text), button("+", 1, bit.canAdd));
    } else {
        // light one = not wanted yet
        parts.push(bit.canRemove ? button(bit.text, -1, true) : button(bit.text, 1, bit.canAdd, true));
    }
    if (bit.needed) parts.push(text("needed", "quiet"));
    // want controls, then a line per box
    tag.replaceChildren(line(parts), ...bit.rows.map((row) => line([
        ...(row.label ? [text(row.label)] : []),
        prioBox(row, device),
        ...(row.when ? [text(row.when, "quiet")] : []),
    ])));
}

function line(parts) {
    const div = document.createElement("div");
    div.append(...parts);
    return div;
}

// 1 = want most, empty = no number. saved on change (enter or clicking off)
function prioBox(row, device) {
    const box = document.createElement("input");
    box.type = "number";
    box.min = "1";
    box.step = "any";
    box.placeholder = "#";
    box.title = "priority, 1 is what you want most";
    box.value = row.prio ?? "";
    // game walks you around n opens build mode off keys on the page
    for (const type of ["keydown", "keyup", "keypress"]) {
        box.addEventListener(type, (event) => event.stopPropagation());
    }
    box.addEventListener("change", () => {
        const n = box.value === "" ? null : Number(box.value);
        onPrio?.(device, row.key, Number.isFinite(n) ? n : null);
    });
    return box;
}

function text(words, cls = "") {
    const span = document.createElement("span");
    span.textContent = words;
    span.className = cls;
    return span;
}
