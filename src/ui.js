// The only module that touches the page: keeps the state, draws it, turns clicks into state changes.
import { TREES, PRESETS, PICK_WARNINGS, MAX_PLOTS, PRICES_AS_OF } from "./data.js";
import { easternDay, weekIndex, weekName, LAST_WEEK } from "./week.js";
import { simulateRoute, hoursNeeded, milestones } from "./route.js";
import {
    goalCost, nextPrice, nodeHours, unpick, dependentsOf, normalize, buyOrder, displayOrder,
} from "./tree.js";
import { clean, toHash, canAdd } from "./state.js";

const TODAY = easternDay(new Date());

// inputs read through clean(), like the hash
const FORM_FIELDS = ["coins", "plots", "seeds", "date", "m", "cap", "goal"];

// kaomoji for the result messages (found with `emoticond search`)
const FACES = {
    reachable: "ヽ(≧▽≦)ノ♪",
    unreachable: "(｡•́︿•̀｡)",
    rich: "(ﾉ$∀$)ﾉ*:･ﾟ✧",
    warning: "(•﹏•;)",
    notStarted: "(￣o￣) zzZZzzZZ",
    over: "🎉(੭˃ᴗ˂)੭🎉",
};

let state;
let pickNote = ""; // what the picker just did on its own ("Also removed …")

const $ = (id) => document.getElementById(id);

function el(tag, ...children) {
    const node = document.createElement(tag);
    node.append(...children);
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

function applyPreset(preset) {
    state = { ...state, want: normalize(tree(), state.own, preset).want };
    pickNote = "";
    update();
}

function buyFirst(id) {
    state = { ...state, first: [id, ...state.first.filter((other) => other !== id)] };
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

    const presets = Object.entries(PRESETS[state.device] ?? {}).map(([name, preset]) => {
        const node = button(name, () => applyPreset(preset));
        node.setAttribute("aria-pressed", sameSelection(state.want, normalize(tree(), state.own, preset).want));
        return node;
    });
    presets.push(button("Clear", () => applyPreset({})));
    $("presets").replaceChildren(...presets);

    $("pick-note").textContent = pickNote.trim();
    const warnings = PICK_WARNINGS
        .filter((w) => w.device === state.device && w.when.every((id) => state.want[id] > 0))
        .map((w) => w.text);
    $("pick-warning").textContent = warnings.join(" ");
}

// checkbox for nodes you can only have one of, − n + for the rest
function control(kind, node) {
    const selection = state[kind];
    const qty = selection[node.id] ?? 0;
    const floor = kind === "want" ? (state.own[node.id] ?? 0) : 0; // want can't go below own
    const verb = kind === "own" ? "Own" : "Want";

    if (!node.tiers && node.limit === undefined) {
        const box = el("input");
        box.type = "checkbox";
        box.id = `${kind}-${node.id}`;
        box.checked = qty > 0;
        box.disabled = floor > 0;
        box.setAttribute("aria-label", `${verb} ${node.name}`);
        box.addEventListener("change", () => setQty(kind, node.id, box.checked ? 1 : 0));
        return el("td", box);
    }

    const minus = button("−", () => setQty(kind, node.id, qty - 1), `${verb} one fewer ${node.name}`);
    minus.id = `${kind}-${node.id}-minus`;
    minus.disabled = qty <= floor;
    const plus = button("+", () => setQty(kind, node.id, qty + 1), `${verb} one more ${node.name}`);
    plus.id = `${kind}-${node.id}-plus`;
    plus.disabled = !canAdd(tree(), selection, node.id);
    const count = el("output", String(qty));
    const cell = el("td", minus, count, plus);
    cell.className = "stepper";
    return cell;
}

function drawTree() {
    $("picker").disabled = state.goal !== null; // a typed goal greys out the tree
    const head = el("tr", ...["Upgrade", "Next price", "Effort", "Own", "Want"].map((name) => el("th", name)));
    const rows = displayOrder(tree()).map(({ node, depth, alsoNeeds }) => {
        const price = nextPrice(node, state.want[node.id] ?? 0);
        const name = el("td", node.name);
        name.style.paddingLeft = `${0.5 + depth * 1.5}em`;
        if (alsoNeeds.length) {
            const hint = el("small", ` (also needs ${alsoNeeds.map(nameOf).join(", ")})`);
            name.append(hint);
        }
        return el("tr",
            name,
            el("td", price === null ? "maxed" : String(price)),
            el("td", price === null ? "" : `≈${Math.round(nodeHours(price, state.m))} h`),
            control("own", node),
            control("want", node),
        );
    });
    $("tree").replaceChildren(el("thead", head), el("tbody", ...rows));
}

const COLUMNS = [
    ["Week", (row) => weekName(row.week)],
    ["Start coins", (row) => coins(row.startCoins)],
    ["Plots", (row) => row.plots],
    ["Max hours", (row) => row.wMax],
    ["Hours", (row) => (row.out ? `${row.hours} (out)` : row.hours)],
    ["New plots", (row) => row.newPlots],
    ["Spent", (row) => coins(row.spent)],
    ["Sold", (row) => coins(row.sold)],
    ["End coins", (row) => coins(row.endCoins)],
];

function drawTable(route) {
    const table = $("route");
    if (route.length === 0) {
        table.replaceChildren();
        return;
    }
    const head = el("tr", ...COLUMNS.map(([name]) => el("th", name)));
    const rows = route.map((row) => el("tr", ...COLUMNS.map(([, cell]) => el("td", String(cell(row))))));
    table.replaceChildren(el("thead", head), el("tbody", ...rows));
}

function drawMilestones(route) {
    const box = $("milestones-box");
    box.hidden = state.goal !== null || route.length === 0;
    if (box.hidden) return;

    const items = milestones(route, buyOrder(tree(), state.want, state.own, state.first));
    box.hidden = items.length === 0;
    const rows = items.map((item, index) => {
        const when = item.now ? "now" : item.week === null ? "not by Week 12" : `after ${weekName(item.week)}`;
        const ok = item.now || item.week !== null;
        const qty = item.qty > 1 ? ` ×${item.qty}` : "";
        const li = el("li", `${ok ? "✅" : "❌"} ${item.name}${qty}: ${coins(item.cost)} (running total ${coins(item.total)}), ${when} `);
        if (index > 0) {
            const first = button("first", () => buyFirst(item.id), `Buy ${item.name} first`);
            first.id = `first-${item.id}`;
            li.append(first);
        }
        return li;
    });
    $("milestones").replaceChildren(...rows);
    $("reset-order").hidden = state.first.length === 0;
}

function render() {
    drawDevicePicker();
    drawTree();
    $("use-picks").hidden = state.goal === null;

    const summary = $("summary");
    const warning = $("warning");
    warning.replaceChildren();

    const total = goalCost(tree(), state.want, state.own);
    $("goal-total").replaceChildren(
        ...(state.goal === null && total > 0 ? ["Your picks cost ", el("strong", `${coins(total)} coins`), " (on top of what you own)."] : []),
    );

    const t = weekIndex(state.date);
    if (t > LAST_WEEK) {
        summary.replaceChildren("Terra's over! ", face("over"));
        drawTable([]);
        drawMilestones([]);
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
            summary.replaceChildren(
                "You need ", el("strong", `${result.cap} h/week`),
                ` (${result.totalHours} h total) to reach ${coins(goal)} coins. `, face("reachable"),
            );
        } else {
            cap = MAX_PLOTS;
            route = simulateRoute(inventory, t, cap, state.m);
            summary.replaceChildren(
                el("strong", "Not reachable."),
                ` The best you can get is ${coins(route.at(-1).endCoins)} coins at ${MAX_PLOTS} h/week. `, face("unreachable"),
            );
        }
    } else {
        route = simulateRoute(inventory, t, state.cap, state.m);
        summary.replaceChildren(
            `At ${state.cap} h/week you end Week 12 with `,
            el("strong", `${coins(route.at(-1).endCoins)} coins`), ". ", face("rich"),
        );
    }

    if (t < 0) {
        warning.replaceChildren("Terra hasn't started yet, so this plans from Prep 1. ", face("notStarted"));
    } else if (cap > route[0].wMax) {
        warning.replaceChildren(
            `This week you can only use ${route[0].wMax} h: you can't afford seeds and plots for more, so extra hours would be wasted water. `, face("warning"),
        );
    }

    drawMilestones(goal > 0 ? route : []);
    drawTable(route);
}

// Redraw everything from `state`, keeping keyboard focus on the same control
function update() {
    const focused = document.activeElement?.id;
    history.replaceState(null, "", "#" + toHash(state, TODAY));
    render();
    if (focused) $(focused)?.focus();
}

function fillForm() {
    for (const key of FORM_FIELDS) {
        $(key).value = key === "goal" ? (state.goal ?? "") : state[key];
    }
}

// state → raw strings, so form edits go through clean() just like the hash
function rawOf(s) {
    return Object.fromEntries(new URLSearchParams(toHash(s, TODAY)));
}

function showErrors(problems) {
    $("error-list").replaceChildren(...problems.map((problem) => el("li", problem)));
    $("errors").hidden = false;
}

// ---- start ---------------------------------------------------------------

$("prices-as-of").textContent = PRICES_AS_OF;

const loaded = clean(Object.fromEntries(new URLSearchParams(location.hash.slice(1))), TODAY);
state = loaded.state;
if (loaded.problems.length) showErrors(loaded.problems);
fillForm();
update();

$("form").addEventListener("input", (event) => {
    if (!FORM_FIELDS.includes(event.target.id)) return;
    const form = Object.fromEntries(FORM_FIELDS.map((key) => [key, $(key).value]));
    // problems are ignored here: half-typed numbers are normal while typing
    state = clean({ ...rawOf(state), ...form }, TODAY).state;
    update();
});
$("form").addEventListener("submit", (event) => event.preventDefault()); // Enter shouldn't reload the page
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
