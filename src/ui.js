// The only module that touches the page: keeps the state, draws it, turns clicks into state changes.
import { TREES, PRESETS, PICK_WARNINGS, MAX_PLOTS, PRICES_AS_OF } from "./data.js";
import { easternDay, weekIndex, weekName, LAST_WEEK } from "./week.js";
import { simulateRoute, hoursNeeded, milestones } from "./route.js";
import {
    goalCost, nextPrice, nodeHours, unpick, dependentsOf, normalize, buyOrder, displayOrder, treeLayout,
} from "./tree.js";
import { clean, toHash, canAdd } from "./state.js";
import { wobblyRect, wobblyLine, seedOf, outlineMargin } from "./sketch.js";
import { zoomAt, clampView, fitView } from "./view.js";

const TODAY = easternDay(new Date());

// size of one upgrade card in the tree, in px (style.css uses the same numbers)
const CARD = { w: 168, h: 150 };
const SVG = "http://www.w3.org/2000/svg";

// inputs read through clean(), like the hash
const FORM_FIELDS = ["coins", "plots", "seeds", "date", "m", "cap", "goal"];

// kaomoji for the result messages (found with `emoticond search`)
const FACES = {
    reachable: "ヽ(≧▽≦)ノ♪",
    unreachable: "(｡•́︿•̀｡)",
    rich: "(ﾉ$∀$)ﾉ*:･ﾟ✧",
    warning: "(•﹏•;)",
    notStarted: "(￣o￣) zzZZzzZZ",
    over: "(੭˃ᴗ˂)੭",
};

// which hand-drawn icon (assets/icons) each upgrade and device gets
const NODE_ICONS = {
    stylus_12: "upgrade-stylus", expansion_card_12: "upgrade-usb-card", fancy_expansion_card_12: "upgrade-usb-card",
    framework_12_diy: "upgrade-diy-kit", ram_12: "upgrade-ram", ssd_12: "upgrade-ssd",
    cpu_12: "upgrade-cpu-core3", cpu_i5_1334u: "upgrade-cpu-i5", cpu_core5_320: "upgrade-cpu-core5", cpu_ryzen_ai7_350: "upgrade-cpu-ryzen",
    framework_13_upgrade: "device-framework", display_2k8_12: "upgrade-display",
    apple_pencil: "upgrade-pencil", apple_pencil_pro: "upgrade-pencil",
    ipad_air_11: "device-ipad", ipad_air_13: "device-ipad", ipad_pro_11: "device-ipad",
    smart_folio: "upgrade-folio-cover", magic_keyboard_folio: "upgrade-keyboard",
    galaxy_tab_s11: "device-galaxy", galaxy_tab_s10_plus: "device-galaxy",
    smart_book_cover: "upgrade-folio-cover", book_cover_keyboard: "upgrade-keyboard",
};
const DEVICE_ICONS = { framework_12: "device-framework", ipad_mini: "device-ipad", galaxy_tab_s10_fe: "device-galaxy" };

let state;
let pickNote = ""; // what the picker just did on its own ("Also removed …")
let lastPreset = null; // the preset button pressed last, to pick between presets that come out the same

const $ = (id) => document.getElementById(id);

function el(tag, ...children) {
    const node = document.createElement(tag);
    node.append(...children);
    return node;
}

// a hand-drawn icon: style.css has an .icon-<name> class per file in assets/icons
function icon(name, className = "icon") {
    const node = el("span");
    node.className = `${className} icon-${name}`;
    node.setAttribute("aria-hidden", "true"); // decoration: the text next to it says the same
    return node;
}

function button(text, onClick, label) {
    const node = el("button", text);
    node.type = "button";
    node.addEventListener("click", onClick);
    if (label) node.setAttribute("aria-label", label);
    return node;
}

// nowrap so a face never breaks across two lines
function face(name) {
    const node = el("span", FACES[name]);
    node.className = "face";
    return node;
}

// coins can be decimals when m ≠ 1: round for display, mark with ≈
function coins(n) {
    const rounded = Math.round(n);
    return Math.abs(n - rounded) < 1e-9 ? String(rounded) : `≈${rounded}`;
}

function tree() {
    return TREES[state.device];
}

function nameOf(id) {
    return tree().nodes.find((node) => node.id === id).name;
}

// ---- state changes -------------------------------------------------------

// Set how many of a node are owned or wanted, then make everything consistent again
function setQty(kind, id, qty) {
    let selection = { ...state[kind] };
    pickNote = "";
    if (qty <= 0) {
        const removed = dependentsOf(tree(), id).filter((other) => selection[other] > 0);
        selection = unpick(tree(), selection, id);
        if (removed.length) {
            pickNote = `Also removed ${removed.map(nameOf).join(", ")} from ${kind === "own" ? "Own" : "Want"}, since they need ${nameOf(id)}.`;
        }
    } else {
        selection[id] = qty;
    }
    const before = { own: state.own, want: state.want };
    const { own, want } = normalize(tree(), kind === "own" ? selection : state.own, kind === "want" ? selection : state.want);

    // things that dropped on their own (fewer USB cards → fewer Fancy cards)
    for (const [which, after] of [["own", own], ["want", want]]) {
        for (const [other, was] of Object.entries(before[which])) {
            if (other !== id && (after[other] ?? 0) < was && after[other] > 0) {
                pickNote += ` ${nameOf(other)} dropped to ${after[other]} (over its limit).`;
            }
        }
    }
    state = { ...state, own, want };
    update();
}

function setDevice(device) {
    state = { ...state, device, own: {}, want: {}, first: [] };
    pickNote = "Picks cleared. (Switching device in Terra refunds everything bought for the old one.)";
    update();
}

function applyPreset(preset, name = null) {
    state = { ...state, want: normalize(tree(), state.own, preset).want };
    lastPreset = name;
    pickNote = "";
    update();
}

// ---- drawing -------------------------------------------------------------

function sameSelection(a, b) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((key) => (a[key] ?? 0) === (b[key] ?? 0));
}

function drawDevicePicker() {
    const select = $("device");
    if (select.options.length === 0) {
        for (const [id, t] of Object.entries(TREES)) select.append(new Option(t.device, id));
    }
    select.value = state.device;
    $("device-icon").className = `icon icon-${DEVICE_ICONS[state.device]}`;

    // Presets that match the picks. Two can come out the same (owning a USB card makes "Max 13" and
    // "Max 13, no extra USB" equal, since want can't go below own): then only one is shown pressed,
    // the one clicked last if it's one of them
    const entries = Object.entries(PRESETS[state.device] ?? {});
    const matching = entries
        .filter(([, preset]) => sameSelection(state.want, normalize(tree(), state.own, preset).want))
        .map(([name]) => name);
    const pressedName = matching.includes(lastPreset) ? lastPreset : matching[0];
    const presets = entries.map(([name, preset]) => {
        const node = button(name, () => applyPreset(preset, name));
        const pressed = name === pressedName;
        node.setAttribute("aria-pressed", pressed);
        if (!pressed) node.className = "outline"; // the matching preset is the filled one
        return node;
    });
    const clear = button("Clear", () => applyPreset({}));
    clear.className = "secondary outline preset-clear";
    presets.push(clear);
    const label = el("span", "Quick picks:");
    label.className = "presets-label";
    $("presets").replaceChildren(label, ...presets);
    sketchAll(presets, (b) => `preset:${b.textContent}`);

    $("pick-note").textContent = pickNote.trim();
    const warnings = PICK_WARNINGS
        .filter((w) => w.device === state.device && w.when.every((id) => state.want[id] > 0))
        .map((w) => w.text);
    $("pick-warning").textContent = warnings.join(" ");
}

// checkbox for nodes you can only have one of, − n + for the rest
function control(kind, node) {
    const word = el("span", kind);
    word.className = "control-word";
    const selection = state[kind];
    const qty = selection[node.id] ?? 0;
    const floor = kind === "want" ? (state.own[node.id] ?? 0) : 0; // want can't go below own
    const verb = kind === "own" ? "Own" : "Want";

    if (!node.tiers && node.limit === undefined) {
        // already owned: it's in your picks anyway, so say that instead of showing a locked checkbox
        if (floor > 0) {
            const owned = el("span", icon("check"), " owned");
            owned.className = "control-word owned-note";
            return owned;
        }
        const box = el("input");
        box.type = "checkbox";
        box.id = `${kind}-${node.id}`;
        box.checked = qty > 0;
        box.disabled = floor > 0;
        box.setAttribute("aria-label", `${verb} ${node.name}`);
        box.addEventListener("change", () => setQty(kind, node.id, box.checked ? 1 : 0));
        return el("label", box, word);
    }

    const minus = button(icon("minus"), () => setQty(kind, node.id, qty - 1), `${verb} one fewer ${node.name}`);
    minus.id = `${kind}-${node.id}-minus`;
    minus.disabled = qty <= floor;
    const plus = button(icon("plus"), () => setQty(kind, node.id, qty + 1), `${verb} one more ${node.name}`);
    plus.id = `${kind}-${node.id}-plus`;
    plus.disabled = !canAdd(tree(), selection, node.id);
    if (plus.disabled) plus.title = limitHint(node); // why you can't add more
    const count = el("output", String(qty));
    const stepper = el("span", word, minus, count, plus);
    stepper.className = "stepper";
    return stepper;
}

// why a + button is greyed out
function limitHint(node) {
    if (node.tiers) return `All ${node.tiers.length} are picked`;
    if (node.limit) return `Up to ${node.limit.base}, plus one per ${nameOf(node.limit.per)}`;
    return "Only one of these";
}

// The tree laid out like Terra's: a card per upgrade, lines to its prerequisites.
// Cards are added in parent → child order so Tab moves through them sensibly.
function drawTree() {
    $("picker").disabled = state.goal !== null; // a typed goal greys out the tree
    const layout = treeLayout(tree(), CARD);
    const canvas = $("tree");
    canvas.style.width = `${layout.width}px`;
    canvas.style.height = `${layout.height}px`;

    const wanted = (id) => id === "root" || state.want[id] > 0;
    const lines = document.createElementNS(SVG, "svg");
    lines.setAttribute("width", layout.width);
    lines.setAttribute("height", layout.height);
    lines.setAttribute("aria-hidden", "true");
    lines.classList.add("tree-lines");
    // hand-drawn branches: each one wobbles its own way, the same every time
    for (const [from, to] of layout.edges) {
        const line = document.createElementNS(SVG, "path");
        const a = layout.centres[from];
        const b = layout.centres[to];
        line.setAttribute("d", wobblyLine(a.x, a.y, b.x, b.y, seedOf(`${state.device}:${from}-${to}`), SKETCH_BRANCHES));
        if (wanted(from) && wanted(to)) line.classList.add("wanted");
        lines.append(line);
    }

    const place = (card, id) => {
        card.style.left = `${layout.centres[id].x - CARD.w / 2}px`;
        card.style.top = `${layout.centres[id].y - CARD.h / 2}px`;
        return card;
    };

    const root = el("div", icon(DEVICE_ICONS[state.device], "tree-icon"), el("strong", tree().device), el("small", "your device"));
    root.className = "tree-card tree-root";
    root.dataset.node = "root";

    const cards = displayOrder(tree()).map(({ node }) => {
        const wanted = state.want[node.id] ?? 0;
        const price = nextPrice(node, wanted);
        // "750 coins", or "next: 1300 coins" when the price goes up with each buy
        // (RAM / SSD say what the next one gets you: "next: 48 GB · 2100 coins")
        const nextTotal = node.totals?.[wanted + 1];
        const cost = price === null
            ? `all ${node.tiers.length} picked`
            : `${node.tiers ? "next: " : ""}${nextTotal ? `${nextTotal} · ` : ""}${price} coins · ≈${Math.round(nodeHours(price, state.m))} h`;
        const card = el("div",
            el("strong", node.name),
            ...(node.totals ? [total(node, wanted)] : []),
            el("small", cost),
            icon(NODE_ICONS[node.id] ?? "upgrade-diy-kit", "tree-icon"),
            el("div", control("own", node), control("want", node)),
        );
        card.className = "tree-card";
        card.dataset.node = node.id;
        card.lastChild.className = "tree-controls";
        if (state.want[node.id] > 0) card.classList.add("wanted");
        if (state.own[node.id] > 0) card.classList.add("owned");
        return place(card, node.id);
    });

    canvas.replaceChildren(lines, place(root, "root"), ...cards);
    sketchAll(
        [root, ...cards, ...canvas.querySelectorAll("input[type=checkbox], button")],
        (box) => `${state.device}:${box.dataset.node ?? box.id ?? "root"}`,
    );

    // a new device (or the first draw) starts fitted; otherwise keep where you'd zoomed to
    if (viewDevice !== state.device) {
        viewDevice = state.device;
        viewMoved = false;
        setView(fitTree());
    } else {
        setView(view);
    }
}

// [header, cell, icon (optional)]
const COLUMNS = [
    ["Week", (row) => weekName(row.week), "calendar"],
    ["Start coins", (row) => coins(row.startCoins)],
    ["Plots", (row) => row.plots, "dirt-plot"],
    ["Can use (h)", (row) => row.wMax], // the most hours you can afford seeds and plots for
    ["Planned (h)", (row) => (row.out ? `${row.hours} (under 10 h: out)` : row.hours), "water-drop"],
    ["New plots", (row) => row.newPlots],
    ["Spent", (row) => coins(row.spent)],
    ["Sold", (row) => coins(row.sold)],
    ["End coins", (row) => coins(row.endCoins), "coin"],
];

function drawTable(route) {
    const table = $("route");
    if (route.length === 0) {
        table.replaceChildren();
        return;
    }
    // same number of weeks as last time: just change the numbers, so the rows (and their
    // hand-drawn bands) stay as they are
    const body = table.tBodies[0];
    if (body && body.rows.length === route.length) {
        route.forEach((row, i) => COLUMNS.forEach(([, cell], j) => {
            const td = body.rows[i].cells[j];
            const text = String(cell(row));
            if (td.textContent !== text) td.textContent = text;
        }));
        return;
    }
    const head = el("tr", ...COLUMNS.map(([name, , iconName]) => (iconName ? el("th", icon(iconName), " ", name) : el("th", name))));
    const rows = route.map((row) => el("tr", ...COLUMNS.map(([, cell]) => el("td", String(cell(row))))));
    table.replaceChildren(el("thead", head), el("tbody", ...rows));
    sketchAll([head, ...rows.filter((_, i) => i % 2 === 1)], (row) => `route:${row.rowIndex}`, true);
}

// The buy order, grouped by when you can afford each pick: a heading per week ("after Week 2"),
// the picks for that week indented under it ([name ×qty | cost, running total | priority arrows]),
// each name pushed in further by how deep it is in the upgrade tree, so you can see what needs what.
function drawMilestones(route, cap) {
    const box = $("milestones-box");
    box.hidden = state.goal !== null || route.length === 0;
    if (box.hidden) return;

    const items = milestones(route, buyOrder(tree(), state.want, state.own, state.first));
    box.hidden = items.length === 0;
    const ids = items.map((item) => item.id);
    const depth = Object.fromEntries(displayOrder(tree()).map((row) => [row.node.id, row.depth]));
    // does `id` need `other` first (directly or further up the tree)?
    const needs = (id, other) => dependentsOf(tree(), other).includes(id);
    // swap with the neighbour; the whole order is saved, so it stays like that
    const move = (index, step) => {
        const order = [...ids];
        [order[index], order[index + step]] = [order[index + step], order[index]];
        state = { ...state, first: order };
        update();
    };

    const groups = [];
    items.forEach((item, index) => {
        const when = item.now ? "now" : item.week === null ? "not by Week 12" : `after ${weekName(item.week)}`;
        let group = groups.at(-1);
        if (group?.when !== when) {
            group = { when, ok: item.now || item.week !== null, rows: [] };
            groups.push(group);
        }
        const qty = item.qty > 1 ? ` ×${item.qty}` : "";
        // "400 coins for all 4 (500 so far)": what this pick costs, and everything up to it
        const forAll = item.qty > 1 ? ` for all ${item.qty}` : "";
        const cost = el("span", `${coins(item.cost)} coins${forAll} (${coins(item.total)} so far)`);
        cost.className = "milestone-cost";
        const sooner = button(icon("select-arrow-up"), () => move(index, -1), `Buy ${item.name} sooner`);
        sooner.id = `sooner-${item.id}`;
        sooner.className = "secondary outline";
        sooner.disabled = index === 0 || needs(item.id, ids[index - 1]); // can't go before what it needs
        sooner.title = index === 0 ? "Already first"
            : sooner.disabled ? `Needs ${items[index - 1].name} first` : `Buy ${item.name} sooner`;
        const later = button(icon("select-arrow"), () => move(index, 1), `Buy ${item.name} later`);
        later.id = `later-${item.id}`;
        later.className = "secondary outline";
        later.disabled = index === items.length - 1 || needs(ids[index + 1], item.id); // or after what needs it
        later.title = index === items.length - 1 ? "Already last"
            : later.disabled ? `${items[index + 1].name} needs this first` : `Buy ${item.name} later`;
        const arrows = el("span", sooner, later);
        arrows.className = "priority";
        const name = el("span", `${item.name}${qty}`);
        name.dataset.node = item.id; // for the tree lines
        const row = el("li", name, cost, arrows);
        row.style.setProperty("--depth", depth[item.id] ?? 0); // the tree indent (style.css)
        group.rows.push(row);
    });

    const head = el("li", el("span"), el("span", "cost (so far)"), el("span", "priority")); // the arrows' tooltips say "Buy … sooner / later"
    head.className = "milestone-head";
    head.setAttribute("aria-hidden", "true");
    $("milestones").replaceChildren(head, ...groups.map((group) => {
        const badge = el("span", group.when);
        badge.className = "badge";
        badge.dataset.tone = group.ok ? "positive" : "error";
        const list = el("ol", ...group.rows);
        list.className = "milestone-items";
        return el("li", badge, list);
    }));
    sketchAll($("milestones").querySelectorAll(".badge, button"), (b) => b.id || `badge:${b.textContent}`);
    drawMilestoneLines();
    $("reset-order").hidden = state.first.length === 0;
    $("milestones-note").textContent = `Bought in this order at ${cap} h/week, each one indented under what it needs first.`
        + " Use the arrows to buy something sooner or later.";
}

// Thin wobbly grey lines joining each pick to the one it needs (its parent in the upgrade tree),
// like a file tree: a line down the gap just left of the parent's name, with a short branch into
// each of its picks. In the gap, it can't cross names at the parent's level or above. Drawn from
// where the names ended up on the page, so again whenever the list changes size.
const MILESTONE_LINES = { wobble: 0.6, every: 16 };

function drawMilestoneLines() {
    const list = $("milestones");
    list.querySelector(":scope > .milestone-lines")?.remove();
    const names = [...list.querySelectorAll("[data-node]")];
    if (names.length === 0 || !list.offsetWidth) return;

    const origin = list.getBoundingClientRect();
    // where a name's text starts (after its tree indent), and its middle, from the list's top-left
    const textStart = (name) => name.getBoundingClientRect().left - origin.left + parseFloat(getComputedStyle(name).paddingLeft);
    const middle = (name) => {
        const box = name.getBoundingClientRect();
        return box.top - origin.top + box.height / 2;
    };
    const byId = new Map(names.map((name) => [name.dataset.node, name]));
    const children = new Map(); // parent's name → its picks' names
    for (const name of names) {
        const node = tree().nodes.find((n) => n.id === name.dataset.node);
        const parent = byId.get(node?.requires[0]); // the one it's drawn under in the tree
        if (parent) children.set(parent, [...(children.get(parent) ?? []), name]);
    }

    const lines = document.createElementNS(SVG, "svg");
    lines.classList.add("milestone-lines");
    lines.setAttribute("aria-hidden", "true");
    for (const [parent, kids] of children) {
        const seed = seedOf(`line:${parent.dataset.node}`);
        const start = textStart(parent);
        const x = start - 8; // the gap just left of the parent's name
        const top = middle(parent);
        const bottom = Math.max(...kids.map(middle));
        const parts = [
            wobblyLine(start - 3, top, x, top, seed, MILESTONE_LINES), // out of the parent
            wobblyLine(x, top, x, bottom, seed + 1, MILESTONE_LINES), // down past its picks
            ...kids.map((kid, i) => wobblyLine(x, middle(kid), textStart(kid) - 5, middle(kid), seed + 2 + i, MILESTONE_LINES)),
        ];
        const path = document.createElementNS(SVG, "path");
        path.setAttribute("d", parts.join(" "));
        lines.append(path);
    }
    list.append(lines);
}

// "from Prep 2 to Week 12": which weeks a plan covers (prep weeks included)
function weeksSpan(route) {
    return `from ${weekName(route[0].week)} to Week 12`;
}

function render() {
    drawDevicePicker();
    drawTree();
    $("use-picks").hidden = state.goal === null;

    const summary = $("summary");
    const warning = $("warning");
    warning.replaceChildren();

    const total = goalCost(tree(), state.want, state.own);
    showPicksGoal(total);
    if (state.goal === null && total > 0) {
        $("goal-total").replaceChildren(icon("coin"), " Your picks cost ", el("strong", `${coins(total)} coins`), " (on top of what you own).");
    } else if (state.goal === null) {
        // nothing picked yet: the real question needs picks
        $("goal-total").replaceChildren("Pick the upgrades you want in the Goal panel (or press a quick pick), and this turns into the hours a week you need.");
    } else {
        $("goal-total").replaceChildren();
    }

    const t = weekIndex(state.date);
    if (t > LAST_WEEK) {
        summary.dataset.tone = "info";
        summary.replaceChildren("Terra's over! ", face("over"));
        drawTable([]);
        drawMilestones([], 0);
        return;
    }

    const goal = state.goal ?? total;
    const inventory = { coins: state.coins, plots: state.plots, seeds: state.seeds };
    let route;
    let cap = state.cap;
    if (goal > 0) {
        const result = hoursNeeded(inventory, t, goal, state.m);
        if (result) {
            route = result.route;
            cap = result.cap;
            summary.dataset.tone = "positive";
            summary.replaceChildren(
                "You need ", el("strong", `${result.cap} h/week`),
                ` ${weeksSpan(route)} (${route.length} weeks, ${result.totalHours} h) to reach ${coins(goal)} coins. `,
                face("reachable"),
            );
        } else {
            cap = MAX_PLOTS;
            route = simulateRoute(inventory, t, cap, state.m);
            summary.dataset.tone = "error";
            summary.replaceChildren(
                el("strong", "Not reachable."),
                ` The best you can get is ${coins(route.at(-1).endCoins)} coins, at ${MAX_PLOTS} h/week ${weeksSpan(route)}. `,
                face("unreachable"),
            );
        }
    } else {
        route = simulateRoute(inventory, t, state.cap, state.m);
        summary.dataset.tone = "info";
        summary.replaceChildren(
            `At ${state.cap} h/week ${weeksSpan(route)} you end with `,
            el("strong", `${coins(route.at(-1).endCoins)} coins`), ". ", face("rich"),
        );
    }

    // the warning box is orange, except "not started yet", which is just info
    warning.dataset.tone = t < 0 ? "info" : "warning";
    if (t < 0) {
        warning.replaceChildren("Terra hasn't started yet, so this plans from Prep 1. ", face("notStarted"));
    } else if (cap > route[0].wMax) {
        warning.replaceChildren(
            `This week you can only use ${route[0].wMax} h: you can't afford seeds and plots for more, so extra hours would be wasted water. `, face("warning"),
        );
    }

    // 8: the hours/week box only counts when there's no goal: grey it out otherwise
    const capUsed = goal === 0;
    $("cap").disabled = !capUsed;
    $("cap").closest(".number-wrap")?.querySelectorAll("button").forEach((b) => { b.disabled = !capUsed; });
    drawMilestones(goal > 0 ? route : [], cap);
    drawTable(route);
    redrawOutlines(); // message boxes may have changed colour or text
}

// ---- tree zoom and pan (the maths is in src/view.js) ------------------------

let view = { scale: 1, x: 0, y: 0 };
let viewDevice = null; // which device `view` belongs to
let viewMoved = false; // you've panned or zoomed since it was last fitted (then it isn't re-fitted for you)

function viewportSize() {
    return { w: $("tree-view").clientWidth, h: $("tree-view").clientHeight };
}

function treeSize() {
    return { w: parseFloat($("tree").style.width), h: parseFloat($("tree").style.height) };
}

// fitted to the window; if it's too wide for that, centred on the device card
function fitTree() {
    const root = $("tree").querySelector(".tree-root");
    const focusX = root ? root.offsetLeft + root.offsetWidth / 2 : undefined;
    return fitView(treeSize(), viewportSize(), undefined, focusX);
}

function setView(next) {
    view = clampView(next, treeSize(), viewportSize());
    $("tree").style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
}

// zoom around the middle of the window (the buttons)
function zoomBy(factor) {
    viewMoved = true;
    const { w, h } = viewportSize();
    setView(zoomAt(view, factor, w / 2, h / 2));
}

// ---- hand-drawn box outlines (the maths is in src/sketch.js) ---------------

// how hand-drawn the boxes look: how far (px) the edge wanders, and how often it changes direction
// (boxes can override these in CSS with --sketch-wobble and --sketch-every, e.g. inputs are tighter)
const SKETCH = { wobble: 0.8, every: 32 };
// the tree's branches are longer and thicker, so they wobble a bit more to show it
const SKETCH_BRANCHES = { wobble: 1.5, every: 40 };

// Two ways a box gets drawn (style.css has the settings for each kind of box):
// - filled (panels, cards, messages, inputs, table rows): the SVG paints the box's colour inside
//   a wobbly line, and the box's own background goes transparent
// - clipped (buttons, pills, checkboxes, the tree window): the box keeps its own colours, so hover,
//   pressed and checked still work, but is cut to the wobbly shape; the SVG only adds the line
const CLIPPED = "button, .badge, input[type=checkbox], .tree-view, .tree-frame";

// Most boxes get their drawing as an SVG inside them: it shows up in the same frame. These can't hold
// anything inside, so they get it as a background image instead (images appear a frame later, which
// is why the others don't use them: redrawn boxes would flash empty for a moment)
const AS_BACKGROUND = "input, select, tr";

const watchedBoxes = new Set();
const resizeWatcher = new ResizeObserver((entries) => entries.forEach((entry) => drawOutline(entry.target)));

// The outline is a background image (an SVG made for the box's exact size), so the box's
// contents aren't touched. Set per box in CSS: --sketch-color, --sketch-width, --sketch-opacity,
// --sketch-dash, --sketch-fill, --sketch-wobble, --sketch-every, --sketch-over.
function drawOutline(box) {
    const w = box.offsetWidth;
    const h = box.offsetHeight;
    if (!w || !h) return; // hidden: drawn when it appears (the resize watcher sees that)
    const css = getComputedStyle(box);
    const prop = (name) => css.getPropertyValue(name).trim();
    const clipped = box.classList.contains("sketch-clip");
    const width = parseFloat(prop("--sketch-width")) || 2;
    const radius = parseFloat(css.borderTopLeftRadius) || 0;
    const shape = {
        wobble: parseFloat(prop("--sketch-wobble")) || SKETCH.wobble,
        every: parseFloat(prop("--sketch-every")) || SKETCH.every,
    };
    // filled: the line sits a little inside the box, so none of it gets cut off at the edge;
    // clipped: the box is cut along the line's middle, so the line is drawn twice as thick
    // and its outer half is cut away with the rest
    const margin = outlineMargin(clipped ? 0 : width, shape.wobble);
    const lineWidth = clipped ? width * 2 : width;
    const d = wobblyRect(w - 2 * margin, h - 2 * margin, Math.max(0, radius - margin),
        seedOf(box.dataset.sketch), { ...shape, x0: margin, y0: margin });
    const dash = prop("--sketch-dash") ? `stroke-dasharray: ${prop("--sketch-dash")};` : "";
    // colours go in style="", so CSS colours like color-mix() work in the background image too
    const paths = `<path d="${d}" style="fill: ${clipped ? "none" : prop("--sketch-fill") || "none"}; stroke: none"/>`
        + `<path d="${d}" style="fill: none; stroke: ${prop("--sketch-color") || "gray"};`
        + ` stroke-opacity: ${prop("--sketch-opacity") || 1}; stroke-width: ${lineWidth};`
        + ` stroke-linecap: round; stroke-linejoin: round; ${dash}"/>`;
    if (box.matches(AS_BACKGROUND)) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${paths}</svg>`;
        const layers = [`url("data:image/svg+xml,${encodeURIComponent(svg)}")`];
        const over = prop("--sketch-over"); // drawn on top of the outline, e.g. a checkbox's tick
        if (over) layers.unshift(over);
        // "important": Pico hides date inputs' backgrounds in Firefox with background-image: none !important
        box.style.setProperty("background-image", layers.join(", "), "important");
    } else {
        // an SVG inside the box, behind its contents (style.css: .sketch-art)
        let art = box.querySelector(":scope > .sketch-art");
        if (!art) {
            art = document.createElementNS(SVG, "svg");
            art.classList.add("sketch-art");
            art.setAttribute("aria-hidden", "true");
            box.prepend(art);
        }
        // exactly the box's full size (its border is invisible but still takes space, so start on
        // top of it), never stretched or shrunk to fit
        art.setAttribute("width", w);
        art.setAttribute("height", h);
        art.setAttribute("viewBox", `0 0 ${w} ${h}`);
        art.setAttribute("preserveAspectRatio", "none");
        art.style.left = `-${css.borderLeftWidth}`;
        art.style.top = `-${css.borderTopWidth}`;
        if (art.innerHTML !== paths) art.innerHTML = paths;
    }
    if (clipped) box.style.clipPath = `path("${d}")`;
}

// RAM/SSD: what your picks come to ("32 GB"); the next step is in the price line under it
function total(node, wanted) {
    const line = el("span", el("b", node.totals[wanted]));
    line.className = "tree-total";
    return line;
}

// Give boxes hand-drawn outlines. key(box) picks each one's wobble, so the same box always looks
// the same. All of them are marked first and drawn after: a box marked after the browser has
// already styled it would fade its normal straight border out (that was the flash on every click).
// `watch`: redraw when it changes size (for boxes that change size with the page).
function sketchAll(boxes, key, watch = false) {
    boxes = [...boxes];
    for (const box of boxes) {
        box.dataset.sketch = key(box);
        box.classList.add("sketched");
        if (box.matches(CLIPPED)) box.classList.add("sketch-clip");
    }
    for (const box of boxes) {
        drawOutline(box);
        if (watch && !watchedBoxes.has(box)) {
            watchedBoxes.add(box);
            resizeWatcher.observe(box);
        }
    }
}

function sketch(box, key, watch = false) {
    sketchAll([box], () => key, watch);
}

function redrawOutlines() {
    for (const box of watchedBoxes) {
        if (box.isConnected) {
            drawOutline(box);
        } else {
            // replaced (table rows are rebuilt): stop watching the old one
            resizeWatcher.unobserve(box);
            watchedBoxes.delete(box);
        }
    }
}

// Redraw everything from `state`, keeping keyboard focus on the same control
function update() {
    const focused = document.activeElement?.id;
    history.replaceState(null, "", "#" + toHash(state, TODAY));
    render();
    if (focused) $(focused)?.focus({ preventScroll: true }); // put focus back without scrolling the page
}

function fillForm() {
    for (const key of FORM_FIELDS) {
        if (key !== "goal") $(key).value = state[key];
        else if (state.goal !== null) $(key).value = state.goal; // the picks' total is filled in by render()
    }
}

// state → raw strings, so form edits go through clean() just like the hash
function rawOf(s) {
    return Object.fromEntries(new URLSearchParams(toHash(s, TODAY)));
}

// The goal box: your own goal if you typed one, otherwise your picks' total, shown muted
// (left alone while you're typing in it)
function showPicksGoal(total) {
    const box = $("goal");
    box.classList.toggle("from-picks", state.goal === null);
    if (state.goal === null && document.activeElement !== box) box.value = total > 0 ? total : "";
}

// The date box: your calendar drawing instead of the browser's icon. Firefox doesn't let pages
// restyle its icon, so this button sits on top of it and opens the browser's own date picker.
function addDateButton(input) {
    const pick = button(icon("date-input"), () => {
        try {
            input.showPicker();
        } catch {
            input.focus(); // older browsers: at least put you in the box
        }
    }, "Pick a date");
    pick.id = "date-picker";
    pick.tabIndex = -1; // from the keyboard, the box itself opens the picker
    pick.className = "date-button";
    const wrap = el("span");
    wrap.className = "date-wrap";
    input.replaceWith(wrap);
    wrap.append(input, pick);
}

// Number boxes: our own up/down buttons (your dropdown arrow) instead of the browser's spinners.
// They follow the box's step, min and max; holding one repeats. Left out of Tab, since the arrow
// keys in the box do the same.
function addNumberButtons(input) {
    const label = input.closest("label")?.textContent.trim() || input.id; // e.g. "Coins", for screen readers
    const nudge = (direction) => {
        const step = parseFloat(input.step) || 1; // "any" → 1
        const decimals = (String(step).split(".")[1] ?? "").length;
        let value = (parseFloat(input.value) || 0) + direction * step;
        if (input.min !== "") value = Math.max(value, parseFloat(input.min));
        if (input.max !== "") value = Math.min(value, parseFloat(input.max));
        input.value = value.toFixed(decimals);
        input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const arrow = (direction, iconName, text) => {
        const b = button(icon(iconName), () => {}, `${text} ${label}`);
        b.tabIndex = -1;
        let timer;
        const stop = () => clearTimeout(timer);
        b.addEventListener("pointerdown", (event) => {
            event.preventDefault(); // leave focus where it is (it's put back without scrolling, see update())
            nudge(direction);
            const again = (delay) => { timer = setTimeout(() => { nudge(direction); again(70); }, delay); };
            again(400);
        });
        for (const type of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(type, stop);
        return b;
    };
    const buttons = el("span", arrow(1, "select-arrow-up", "More"), arrow(-1, "select-arrow", "Less"));
    buttons.className = "number-buttons";
    const wrap = el("span");
    wrap.className = "number-wrap";
    input.replaceWith(wrap);
    wrap.append(input, buttons);
}

// ---- light / dark ----------------------------------------------------------
// Follows the system unless the toggle at the bottom picked one (saved in localStorage, and
// applied by a little script in index.html's <head> before anything is drawn).

const systemDark = matchMedia("(prefers-color-scheme: dark)");

function currentTheme() {
    return document.documentElement.dataset.theme ?? (systemDark.matches ? "dark" : "light");
}

// the toggle says what it switches to
function drawThemeToggle() {
    const toggle = $("theme-toggle");
    toggle.textContent = currentTheme() === "dark" ? "Light mode" : "Dark mode";
    if (toggle.classList.contains("sketched")) drawOutline(toggle); // the text change removed its drawing
}

function showErrors(problems) {
    $("error-list").replaceChildren(...problems.map((problem) => el("li", problem)));
    $("errors").hidden = false;
}

// ---- start ---------------------------------------------------------------

$("prices-as-of").textContent = new Date(`${PRICES_AS_OF}T00:00:00Z`)
    .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }); // "9 Oct 2026"
document.querySelectorAll("input[type=number]").forEach(addNumberButtons);
addDateButton($("date"));

// boxes that stay on the page: panels, the upgrades area, the preset strip, message boxes, the route table
sketchAll(
    document.querySelectorAll(".intro, .footnotes, .panel, .buttons, .message, .view-box"),
    (box) => box.id || box.querySelector(":scope > legend, :scope > header")?.textContent || box.className,
    true,
);
// the tree window is cut to a wobbly shape (so cards get cut off along the wobble), and a frame on
// top draws its line, so cards panned to the edge go under the line, not over it. Same key = same shape.
sketchAll(document.querySelectorAll(".tree-view, .tree-frame"), () => "tree-view", true);
// buttons that stay on the page (zoom, reset order, ok, use my picks, light/dark)
drawThemeToggle();
sketchAll(document.querySelectorAll("main button, footer button"), (b) => b.id, true);
// tree: drag to pan, zoom with the buttons, scrolling or a pinch on touch screens. In the split view
// (two columns) the Goal panel doesn't scroll, so plain scrolling zooms; in one column it scrolls the
// page, so it takes ctrl + scroll (a trackpad pinch sends that too). Same query as in style.css.
const splitView = matchMedia("(min-width: 1200px) and (min-height: 700px)");
const treeView = $("tree-view");
treeView.addEventListener("wheel", (event) => {
    if (!event.ctrlKey && !splitView.matches) return;
    event.preventDefault(); // zoom the tree, not the whole page
    viewMoved = true;
    const box = treeView.getBoundingClientRect();
    const px = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? box.height : 1; // lines/pages → px
    setView(zoomAt(view, Math.exp(-event.deltaY * px * 0.002), event.clientX - box.left, event.clientY - box.top));
}, { passive: false });

const pointers = new Map(); // pointers pressed on the tree: id → { x, y }
treeView.addEventListener("pointerdown", (event) => {
    if (event.target.closest("input, button, label, select")) return; // let the controls work
    treeView.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    treeView.classList.add("dragging");
});
treeView.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    const before = [...pointers.values()];
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const now = [...pointers.values()];
    if (now.length === 1) {
        viewMoved = true;
        setView({ ...view, x: view.x + now[0].x - before[0].x, y: view.y + now[0].y - before[0].y });
    } else if (now.length === 2) {
        // pinch: zoom by how much the fingers spread, around their middle, and follow the middle
        const middle = ([a, b]) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        const spread = ([a, b]) => Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const box = treeView.getBoundingClientRect();
        const [m0, m1] = [middle(before), middle(now)];
        const zoomed = zoomAt(view, spread(now) / spread(before), m1.x - box.left, m1.y - box.top);
        setView({ ...zoomed, x: zoomed.x + m1.x - m0.x, y: zoomed.y + m1.y - m0.y });
    }
});
for (const type of ["pointerup", "pointercancel"]) {
    treeView.addEventListener(type, (event) => {
        pointers.delete(event.pointerId);
        if (pointers.size === 0) treeView.classList.remove("dragging");
    });
}

// Tab onto a card that's out of view: move the tree so it's in view
treeView.addEventListener("focusin", (event) => {
    const box = treeView.getBoundingClientRect();
    const target = event.target.getBoundingClientRect();
    const pad = 24;
    let { x, y } = view;
    if (target.left < box.left + pad) x += box.left + pad - target.left;
    else if (target.right > box.right - pad) x -= target.right - (box.right - pad);
    if (target.top < box.top + pad) y += box.top + pad - target.top;
    else if (target.bottom > box.bottom - pad) y -= target.bottom - (box.bottom - pad);
    setView({ ...view, x, y });
});

$("zoom-in").addEventListener("click", () => zoomBy(1.25));
$("zoom-out").addEventListener("click", () => zoomBy(1 / 1.25));
$("zoom-fit").addEventListener("click", () => setView(fitTree()));
// The handwritten font usually arrives after the first draw, and text gets narrower with it.
// Boxes that are redrawn on changes (pills, buttons, the tree) would keep outlines made for the
// wider fallback font (the pills' fill no longer filled their outline), so draw everything again.
document.fonts.ready.then(() => update());

// the link holds your numbers: copy it to share or keep them
$("copy-link").addEventListener("click", async () => {
    const copy = $("copy-link");
    try {
        await navigator.clipboard.writeText(location.href);
        copy.textContent = "Copied!";
    } catch {
        copy.textContent = "Copy it from the address bar";
    }
    setTimeout(() => {
        copy.textContent = "Copy link";
        drawOutline(copy); // the text change removed its drawing
    }, 2000);
    drawOutline(copy);
});

// ---- resizing the columns (wide screens) -----------------------------------
// Drag the divider (or focus it and use the arrow keys) to give the left column more or less of the
// page; double-click to go back to the default. Your width is remembered in this browser.

const divider = $("column-divider");
const SPLIT = { min: 30, max: 70, step: 2, normal: 44.4 }; // the left column, % of the page

function currentSplit() {
    return parseFloat(document.querySelector(".page").style.getPropertyValue("--split")) || SPLIT.normal;
}

function setSplit(percent, save = true) {
    const split = Math.min(SPLIT.max, Math.max(SPLIT.min, percent));
    document.querySelector(".page").style.setProperty("--split", split);
    divider.setAttribute("aria-valuenow", Math.round(split));
    if (save) {
        try {
            localStorage.setItem("split", split);
        } catch {
            // storage blocked: the width just lasts until the page is closed
        }
    }
}

// the line: wobbly like the tree's branches, as tall as the divider
function drawDivider() {
    const h = divider.offsetHeight;
    if (!h) return;
    const x = divider.offsetWidth / 2;
    const lines = document.createElementNS(SVG, "svg");
    lines.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(SVG, "path");
    path.setAttribute("d", wobblyLine(x, 8, x, h - 8, seedOf("column-divider"), SKETCH_BRANCHES));
    lines.append(path);
    divider.replaceChildren(lines);
}

// after a resize the tree window is a new size: fit the tree again, unless you've moved it yourself
function afterResize() {
    if (!viewMoved) setView(fitTree());
}

divider.addEventListener("pointerdown", (event) => {
    divider.setPointerCapture(event.pointerId);
    document.body.classList.add("resizing");
});
divider.addEventListener("pointermove", (event) => {
    if (!divider.hasPointerCapture(event.pointerId)) return;
    const page = document.querySelector(".page").getBoundingClientRect();
    setSplit(((event.clientX - page.left) / page.width) * 100, false);
});
divider.addEventListener("lostpointercapture", () => {
    document.body.classList.remove("resizing");
    setSplit(currentSplit()); // save where you let go
    afterResize();
});
divider.addEventListener("keydown", (event) => {
    const step = { ArrowLeft: -SPLIT.step, ArrowRight: SPLIT.step }[event.key];
    if (!step) return;
    event.preventDefault();
    setSplit(currentSplit() + step);
    afterResize();
});
divider.addEventListener("dblclick", () => {
    document.querySelector(".page").style.removeProperty("--split");
    divider.setAttribute("aria-valuenow", Math.round(SPLIT.normal));
    try {
        localStorage.removeItem("split");
    } catch {
        // nothing saved to remove
    }
    afterResize();
});
new ResizeObserver(drawDivider).observe(divider);
try {
    const saved = parseFloat(localStorage.getItem("split"));
    setSplit(Number.isFinite(saved) ? saved : SPLIT.normal, false);
} catch {
    setSplit(SPLIT.normal, false);
}

// the buy order list changes size with the page: its tree lines go with the names
new ResizeObserver(() => drawMilestoneLines()).observe($("milestones"));
// the window changes size with the page (fonts loading, text wrapping, the hint opening): fit the
// tree again, or if you've moved it yourself, just keep it in view
new ResizeObserver(() => (viewMoved ? setView(view) : afterResize())).observe(treeView);

// input boxes too (not checkboxes): a tighter, thinner wobble, set in style.css
for (const input of document.querySelectorAll("input:not([type=checkbox]), select")) {
    sketch(input, input.id, true);
}
// focusing an input changes its outline (thicker, accent colour), so draw it again;
// next frame, so the browser has already updated what's focused
for (const type of ["focusin", "focusout"]) {
    document.addEventListener(type, (event) => {
        if (event.target.classList?.contains("sketched")) requestAnimationFrame(() => drawOutline(event.target));
    });
}
// the outline colours come from the theme, so redraw when the system switches light/dark
systemDark.addEventListener("change", () => {
    drawThemeToggle();
    update();
});
$("theme-toggle").addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    const system = systemDark.matches ? "dark" : "light";
    // picking what the system uses anyway: just follow the system again from now on
    if (next === system) delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
    try {
        if (next === system) localStorage.removeItem("theme");
        else localStorage.setItem("theme", next);
    } catch {
        // storage blocked (private window): the choice just lasts until the page is closed
    }
    drawThemeToggle();
    update(); // the hand-drawn outlines have their colours baked in: draw them again
});

const loaded = clean(Object.fromEntries(new URLSearchParams(location.hash.slice(1))), TODAY);
state = loaded.state;
if (loaded.problems.length) showErrors(loaded.problems);
fillForm();
update();

document.addEventListener("input", (event) => {
    if (!FORM_FIELDS.includes(event.target.id)) return;
    const form = Object.fromEntries(FORM_FIELDS.map((key) => [key, $(key).value]));
    // the goal box shows the picks' total unless you typed your own: only read it when it's
    // what you're editing, or editing anything else would turn that total into a custom goal
    if (event.target.id !== "goal") form.goal = state.goal ?? "";
    // problems are ignored here: half-typed numbers are normal while typing
    state = clean({ ...rawOf(state), ...form }, TODAY).state;
    update();
});
$("form").addEventListener("submit", (event) => event.preventDefault()); // Enter shouldn't reload the page
// The first scroll (the page, or the left column on wide screens) shrinks the logo into the
// top-left corner, for good: it gives the plan and the tree more room. On wide screens the tree
// window gets taller, so the tree is fitted again (unless you've moved it yourself).
const pageLeft = document.querySelector(".page-left");
function onFirstScroll() {
    if (scrollY <= 0 && pageLeft.scrollTop <= 0) return;
    document.body.classList.add("scrolled");
    removeEventListener("scroll", onFirstScroll);
    pageLeft.removeEventListener("scroll", onFirstScroll);
    setTimeout(() => {
        if (!viewMoved) setView(fitTree());
    }, 300); // after the header has finished shrinking (style.css)
}
addEventListener("scroll", onFirstScroll, { passive: true });
pageLeft.addEventListener("scroll", onFirstScroll, { passive: true });
onFirstScroll(); // a reload can start part-way down the page

// Two columns: the header only needs the left column's width, so the Goal panel moves up beside it
// and gets the whole height. CSS needs the header's height and the left column's width for that.
const header = document.querySelector("body > header");
new ResizeObserver(() => {
    const root = document.documentElement.style;
    root.setProperty("--header-h", `${header.offsetHeight}px`);
    root.setProperty("--left-w", `${pageLeft.offsetWidth}px`);
}).observe(header);
new ResizeObserver(() => {
    document.documentElement.style.setProperty("--left-w", `${pageLeft.offsetWidth}px`);
}).observe(pageLeft);

// switching between one and two columns changes the tree window's size a lot: fit the tree again
splitView.addEventListener("change", () => setView(fitTree()));
$("goal").addEventListener("blur", () => showPicksGoal(goalCost(tree(), state.want, state.own)));
$("device").addEventListener("change", (event) => setDevice(event.target.value));
$("use-picks").addEventListener("click", () => {
    state = { ...state, goal: null };
    fillForm();
    update();
});
$("reset-order").addEventListener("click", () => {
    state = { ...state, first: [] };
    update();
});
$("errors-ok").addEventListener("click", () => {
    $("errors").hidden = true;
});
