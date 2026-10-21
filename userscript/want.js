// want bits under each card on terra's own device tree
import { limitOf, unpick, normalize, dependentsOf } from "../src/tree.js";
import { weekName } from "../src/week.js";

const BIT = "terra-calc-want";
const WATCH = { childList: true, subtree: true };

// one node's tag, null on limit-1 stuff i already own (terra's badge covers it)
// milestone = its row from milestones(), if wanted
export function wantBit(tree, own, want, id, milestone = null) {
    const node = tree.nodes.find((n) => n.id === id);
    if (!node) return null;
    const limit = limitOf(node, want);
    const count = want[id] ?? 0;
    const owned = own[id] ?? 0;
    if (limit === 1 && owned >= 1) return null;
    // only wanted cuz somthing further up needs it
    const needed = count > owned && dependentsOf(tree, id).some((other) => (want[other] ?? 0) > (own[other] ?? 0));
    return {
        stepper: limit !== 1,
        text: limit === 1 ? (count > 0 ? "wanted" : "want") : `want ${count}`,
        canAdd: count < limit,
        canRemove: count > owned,
        needed,
        when: milestone && (milestone.now ? "can buy now" : milestone.week === null ? "doesn't fit" : weekName(milestone.week)),
    };
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

let observer = null;
let last = null; // last drawWantBits state, for cards that show up later
let onPick = null;

// pick = pickWant(device, id, delta) in main.js
export function mountWantBits(pick) {
    if (observer) return;
    onPick = pick;
    observer = new MutationObserver(() => {
        if (document.querySelector("[data-node=root]")) fillBits();
    });
    observer.observe(document.body, WATCH);
}

export function drawWantBits(state) {
    last = state;
    fillBits();
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
    const rows = new Map((onGoal ? last.milestones : []).map((row) => [row.id, row]));
    // unwatched while drawing, our own tags set it off n it redrew forver
    observer?.disconnect();
    for (const card of cards) {
        const bit = wantBit(tree, own, want, card.dataset.node, rows.get(card.dataset.node));
        let tag = card.querySelector(`:scope > .${BIT}`);
        if (!bit) {
            tag?.remove();
            continue;
        }
        if (!tag) tag = makeTag(card);
        drawTag(tag, bit, device);
    }
    observer?.observe(document.body, WATCH);
}

// hung under card, resizing it would move tree lines (they go to its middle)
function makeTag(card) {
    const tag = document.createElement("div");
    tag.className = BIT;
    tag.style.cssText = "position:absolute;top:100%;left:50%;transform:translateX(-50%);margin-top:4px;"
        + "display:flex;gap:4px;align-items:center;white-space:nowrap;padding:1px 6px;border-radius:6px;"
        + "background:#fffbe8;color:#222;border:1px solid #6a9a3a;font:12px/1.4 sans-serif;z-index:2";
    // game opens its buy popup on any click in a node n pans on pointerdown
    for (const type of ["pointerdown", "mousedown", "touchstart", "click", "dblclick"]) {
        tag.addEventListener(type, (event) => event.stopPropagation());
    }
    card.append(tag);
    return tag;
}

function drawTag(tag, bit, device) {
    const id = tag.parentElement.dataset.node;
    const parts = [];
    const button = (text, delta, enabled) => {
        const b = document.createElement("button");
        b.textContent = text;
        b.disabled = !enabled;
        b.style.cssText = "font:inherit;padding:0 4px;cursor:pointer";
        b.addEventListener("click", () => onPick?.(device, id, delta));
        return b;
    };
    if (bit.stepper) {
        parts.push(button("-", -1, bit.canRemove), text(bit.text), button("+", 1, bit.canAdd));
    } else {
        parts.push(bit.canRemove ? button(bit.text, -1, true) : button(bit.text, 1, bit.canAdd));
    }
    if (bit.needed) parts.push(text("needed", "opacity:.6"));
    if (bit.when) parts.push(text(bit.when, "opacity:.8"));
    tag.replaceChildren(...parts);
}

function text(words, style = "") {
    const span = document.createElement("span");
    span.textContent = words;
    span.style.cssText = style;
    return span;
}
