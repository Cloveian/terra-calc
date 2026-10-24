// The page: keeps the state, draws it, turns clicks into state changes. Box outlines, tree dragging and the column divider are in outline.js, treeview.js and columns.js.
import { TREES, PRESETS, PICK_WARNINGS, MAX_PLOTS, PRICES_AS_OF, CROPS, RENT, BONUS_SEEDS } from "./data.js";
import { easternDay, weekIndex, weekName, LAST_WEEK } from "./week.js";
import { simulateRoute, hoursNeeded, milestones, allGiven, weekHours } from "./route.js";
import { mixWords } from "./farm.js";
import {
    goalCost, nextPrice, nodeHours, unpick, dependentsOf, normalize, buyOrder, displayOrder, treeLayout,
    waitsOn, prioFrom, sameSelection, byId,
} from "./tree.js";
import { clean, toHash, canAdd, formatHours, BONUS_KEYS } from "./state.js";
import { wobblyLine, seedOf } from "./sketch.js";
import { SVG, SKETCH_BRANCHES, drawOutline, sketchAll, sketch, redrawOutlines } from "./outline.js";
import { mountDivider } from "./columns.js";
import { showTree, refitTree, mountTreeView } from "./treeview.js";

const TODAY = easternDay(new Date());

// size of one upgrade card in the tree, in px (style.css uses the same numbers)
const CARD = { w: 168, h: 150 };

// inputs read through clean(), like the hash
const FORM_FIELDS = ["coins", "plots", "seeds", ...BONUS_KEYS, "date", "m", "cap", "goal"];

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
let pickNote = ""; // what the picker just did on its own ("Also removed ...")
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

// coins can be decimals when m != 1: round for display, mark with ≈
function coins(n) {
    const rounded = Math.round(n);
    return Math.abs(n - rounded) < 1e-9 ? String(rounded) : `≈${rounded}`;
}

function tree() {
    return TREES[state.device];
}

function nameOf(id) {
    return byId(tree(), id).name;
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

    // things that dropped on their own (fewer USB cards -> fewer Fancy cards)
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

// RAM/SSD: what your picks come to ("32 GB"); the next step is in the price line under it
function total(node, wanted) {
    const line = el("span", el("b", node.totals[wanted]));
    line.className = "tree-total";
    return line;
}

// The tree laid out like Terra's: a card per upgrade, lines to its prerequisites.
// Cards are added in parent -> child order so Tab moves through them sensibly.
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

    showTree(state.device);
}

// [header, cell, icon (optional)]. cell gives the text, or fills the td itself
const COLUMNS = [
    ["Week", (row) => weekName(row.week), "calendar"],
    ["Start coins", (row) => coins(row.startCoins)],
    ["Plots", (row) => row.plots, "dirt-plot"],
    ["Can use (h)", (row) => row.wMax], // the most hours you can afford seeds and plots for
    ["Planned (h)", fillHours, "water-drop"],
    ["New plots", (row) => row.newPlots],
    ["Spent", (row) => coins(row.spent)],
    ["Sold", (row) => coins(row.sold)],
    ["End coins", (row) => coins(row.endCoins), "coin"],
];

function fillCell(td, cell, row) {
    const text = cell(row, td);
    if (text !== undefined && td.textContent !== String(text)) td.textContent = text;
    return td;
}

// box for the hours i'll give that week, blank = whatever the plan needs (faded in the box)
function fillHours(row, td) {
    let box = td.querySelector("input");
    if (!box) {
        box = el("input");
        Object.assign(box, { type: "number", min: 0, max: MAX_PLOTS, className: "week-hours" });
        td.replaceChildren(box, el("span"));
    }
    box.dataset.week = row.week;
    box.id = `week-hours-${row.week}`; // update() puts focus back by id
    box.setAttribute("aria-label", `Hours in ${weekName(row.week)}`);
    box.placeholder = row.hours;
    const set = state.hours[row.week];
    if (document.activeElement !== box) box.value = set ?? "";
    // set more than the coins can plant -> what it actually plans
    td.lastChild.textContent = row.out ? " under 10 h: out" : set !== undefined && row.hours < set ? ` (${row.hours})` : "";
}

function drawTable(route) {
    const table = $("route");
    // first weeks seeds go above the table, in a cell they made it scroll sideways
    const mix = mixWords(route[0]?.mix);
    $("mix-note").hidden = !mix;
    $("mix-note").textContent = mix ? `${weekName(route[0].week)} plants ${mix}, then it's apples only (Heidi's bonus seeds change every day).` : "";
    if (route.length === 0) {
        table.replaceChildren();
        return;
    }
    // same number of weeks as last time: just change the numbers, so the rows (and their
    // hand-drawn bands) stay as they are
    const body = table.tBodies[0];
    if (body && body.rows.length === route.length) {
        route.forEach((row, i) => COLUMNS.forEach(([, cell], j) => fillCell(body.rows[i].cells[j], cell, row)));
        return;
    }
    const head = el("tr", ...COLUMNS.map(([name, , iconName]) => (iconName ? el("th", icon(iconName), " ", name) : el("th", name))));
    const rows = route.map((row) => el("tr", ...COLUMNS.map(([, cell]) => fillCell(el("td"), cell, row))));
    table.replaceChildren(el("thead", head), el("tbody", ...rows));
    sketchAll([head, ...rows.filter((_, i) => i % 2 === 1)], (row) => `route:${row.rowIndex}`, true);
}

// The buy order, grouped by when you can afford each pick: a heading per week ("after Week 2"), the picks for that week indented under it ([name ×qty | cost, running total | priority arrows]), each name pushed in further by how deep it is in the upgrade tree, so you can see what needs what.
// pace: "17 h/week", "your hours"...
// mine: a week box from this week on is set
function drawMilestones(route, pace, mine) {
    const box = $("milestones-box");
    box.hidden = state.goal !== null || route.length === 0;
    if (box.hidden) return;

    const items = milestones(route, buyOrder(tree(), state.want, state.own, prioFrom(state.first)));
    box.hidden = items.length === 0;
    const keys = items.map((item) => item.key);
    const depth = Object.fromEntries(displayOrder(tree()).map((row) => [row.node.id, row.depth]));
    // swap with the neighbour; the whole order is saved, so it stays like that
    const move = (index, step) => {
        const order = [...keys];
        [order[index], order[index + step]] = [order[index + step], order[index]];
        state = { ...state, first: order };
        update();
    };

    const groups = [];
    const missed = mine ? "not with your hours" : "not by Week 12";
    items.forEach((item, index) => {
        const when = item.now ? "now" : item.week === null ? missed : `after ${weekName(item.week)}`;
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
        sooner.id = `sooner-${item.key}`;
        sooner.className = "secondary outline";
        sooner.disabled = index === 0 || waitsOn(tree(), item, items[index - 1]); // can't go before what it needs
        sooner.title = index === 0 ? "Already first"
            : sooner.disabled ? `Needs ${items[index - 1].name} first` : `Buy ${item.name} sooner`;
        const later = button(icon("select-arrow"), () => move(index, 1), `Buy ${item.name} later`);
        later.id = `later-${item.key}`;
        later.className = "secondary outline";
        later.disabled = index === items.length - 1 || waitsOn(tree(), items[index + 1], item); // or after what needs it
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

    const head = el("li", el("span"), el("span", "cost (so far)"), el("span", "priority")); // the arrows' tooltips say "Buy ... sooner / later"
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
    $("milestones-note").textContent = `Bought in this order at ${pace}, each one indented under what it needs first.`
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
    const nameFor = new Map(names.map((name) => [name.dataset.node, name]));
    const children = new Map(); // parent's name -> its picks' names
    for (const name of names) {
        const parent = nameFor.get(byId(tree(), name.dataset.node)?.requires[0]); // the one it's drawn under in the tree
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

// what a plan without my week boxes would need, for when they come up short
function flatWords(inventory, t, goal, thisWeek) {
    const flat = hoursNeeded(inventory, t, goal, state.m, RENT, thisWeek);
    return flat ? `A flat ${flat.cap} h/week would get there.` : `Even ${MAX_PLOTS} h every week wouldn't.`;
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
        drawMilestones([], "");
        return;
    }

    const goal = state.goal ?? total;
    const inventory = { coins: state.coins, plots: state.plots, seeds: state.seeds };
    // bonus seeds, first week only (route.js)
    const thisWeek = { seeds: state.shop, onHand: Object.fromEntries(BONUS_SEEDS.map((id) => [id, state[CROPS[id].key]])) };
    let route;
    let cap = state.cap;
    // weeks i set in the table, only the ones still to come count
    const coming = Object.entries(state.hours).filter(([week]) => week >= t);
    const given = Object.fromEntries(coming.map(([week, h]) => [week, { fixed: h, open: 0 }])); // a week box = all 7 days set
    const givenCount = Object.keys(given).length;
    const onBlanks = givenCount > 0 ? " on the weeks you left blank" : "";
    if (goal > 0) {
        const result = hoursNeeded(inventory, t, goal, state.m, RENT, thisWeek, given);
        if (result?.cap === null) {
            // every week set, nothing to work out
            route = result.route;
            cap = null;
            summary.dataset.tone = "positive";
            summary.replaceChildren(
                "Your hours get there: you end with ", el("strong", `${coins(route.at(-1).endCoins)} coins`),
                ` (${result.totalHours} h ${weeksSpan(route)}), the goal is ${coins(goal)}. `, face("reachable"),
            );
        } else if (result) {
            route = result.route;
            cap = result.cap;
            summary.dataset.tone = "positive";
            summary.replaceChildren(
                "You need ", el("strong", `${result.cap} h/week`), onBlanks,
                ` ${weeksSpan(route)} (${route.length} weeks, ${result.totalHours} h) to reach ${coins(goal)} coins. `,
                face("reachable"),
            );
        } else if (allGiven(t, given)) {
            cap = null;
            route = simulateRoute(inventory, t, MAX_PLOTS, state.m, thisWeek, given);
            const end = route.at(-1).endCoins;
            summary.dataset.tone = "error";
            summary.replaceChildren(
                el("strong", "Not with your hours."), ` You end with ${coins(end)} coins, ${coins(goal - end)} short. ${flatWords(inventory, t, goal, thisWeek)} `,
                face("unreachable"),
            );
        } else {
            cap = MAX_PLOTS;
            route = simulateRoute(inventory, t, cap, state.m, thisWeek, given);
            // with weeks set it might just be those weeks
            const flat = givenCount > 0 ? `${flatWords(inventory, t, goal, thisWeek)} ` : "";
            summary.dataset.tone = "error";
            summary.replaceChildren(
                el("strong", "Not reachable."),
                ` The best you can get is ${coins(route.at(-1).endCoins)} coins, at ${MAX_PLOTS} h/week${onBlanks} ${weeksSpan(route)}. ${flat}`,
                face("unreachable"),
            );
        }
    } else {
        route = simulateRoute(inventory, t, state.cap, state.m, thisWeek, given);
        summary.dataset.tone = "info";
        summary.replaceChildren(
            `At ${state.cap} h/week${onBlanks} ${weeksSpan(route)} you end with `,
            el("strong", `${coins(route.at(-1).endCoins)} coins`), ". ", face("rich"),
        );
    }

    // the warning box is orange, except "not started yet", which is just info
    warning.dataset.tone = t < 0 ? "info" : "warning";
    if (t < 0) {
        warning.replaceChildren("Terra hasn't started yet, so this plans from Prep 1. ", face("notStarted"));
    } else if (route.at(-1).out) {
        // only a week i set can go under 10
        warning.replaceChildren(`${weekName(route.at(-1).week)} is under 10 h, that's no rent for Ratticus, so the plan stops there. `, face("warning"));
    } else if (weekHours(given[route[0].week], cap) > route[0].wMax) {
        warning.replaceChildren(
            `This week you can only use ${route[0].wMax} h: you can't afford seeds and plots for more, so extra hours would be wasted water. `, face("warning"),
        );
    }

    // hours/week only counts with no goal
    const capUsed = goal === 0;
    $("cap").disabled = !capUsed;
    $("cap").closest(".number-wrap")?.querySelectorAll("button").forEach((b) => { b.disabled = !capUsed; });
    const pace = cap === null ? "your hours" : `${cap} h/week${givenCount > 0 ? " (yours on the weeks you set)" : ""}`;
    drawMilestones(goal > 0 ? route : [], pace, givenCount > 0);
    drawTable(route);
    redrawOutlines(); // message boxes may have changed colour or text
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
    for (const id of BONUS_SEEDS) $(`shop-${id}`).checked = state.shop.includes(id);
}

// state -> raw strings, so form edits go through clean() just like the hash
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
        const step = parseFloat(input.step) || 1; // "any" -> 1
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
// seed box after the apple one + shop tick (shop-<id>) per bonus seed, has to be in ahead of addNumberButtons
$("seeds").closest("label").after(...BONUS_SEEDS.map((id) => {
    const box = el("input");
    box.id = CROPS[id].key;
    box.type = "number";
    box.min = 0;
    return el("label", icon("apple-seed"), ` ${CROPS[id].name} seeds `, box);
}));
$("shop-ticks").append(...BONUS_SEEDS.map((id) => {
    const tick = el("input");
    tick.id = `shop-${id}`;
    tick.type = "checkbox";
    return el("label", tick, ` ${CROPS[id].name} in Heidi's shop today`);
}));
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
mountTreeView();
// handwritten font lands after the first draw and is narrower, outlines redrawn on changes (pills, buttons, tree) stayed sized for the wider fallback
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

mountDivider(refitTree);

// the buy order list changes size with the page: its tree lines go with the names
new ResizeObserver(() => drawMilestoneLines()).observe($("milestones"));

// input boxes too (not checkboxes): a tighter, thinner wobble, set in style.css
for (const input of document.querySelectorAll("input:not([type=checkbox]), select")) {
    sketch(input, input.id, true);
}
// the shop ticks in Inventory, wobbly like the tree's checkboxes
sketchAll(document.querySelectorAll("form input[type=checkbox]"), (box) => box.id, true);
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
    // a box in the week table: blank takes the week back off my list
    if (event.target.classList.contains("week-hours")) {
        const hours = { ...state.hours, [event.target.dataset.week]: event.target.value };
        if (event.target.value === "") delete hours[event.target.dataset.week];
        state = clean({ ...rawOf(state), hours: formatHours(hours) }, TODAY).state;
        update();
        return;
    }
    const shopTick = BONUS_SEEDS.some((id) => event.target.id === `shop-${id}`);
    if (!FORM_FIELDS.includes(event.target.id) && !shopTick) return;
    const form = Object.fromEntries(FORM_FIELDS.map((key) => [key, $(key).value]));
    form.shop = BONUS_SEEDS.filter((id) => $(`shop-${id}`).checked).join(",");
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
        refitTree();
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
