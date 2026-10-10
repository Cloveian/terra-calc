// Page state and URL hash.
// state = { coins, plots, seeds, date, m, cap, goal, device, own, want, first }
//   goal: null = use the tree picks, a number = custom goal typed by hand
//   own / want: { id: qty }, first: ids to buy first (milestone order)
import { TREES, FREE_PLOTS, MAX_PLOTS, RENT, MULTIPLIER, STARTING_COINS } from "./data.js";
import { normalize, limitOf } from "./tree.js";

export const DEFAULT_DEVICE = "framework_12";

export const HASH_KEYS = ["coins", "plots", "seeds", "date", "m", "cap", "goal", "device", "own", "want", "first"];

export function defaults(today) {
    return {
        coins: STARTING_COINS, plots: FREE_PLOTS, seeds: 0, date: today, m: 1, cap: RENT,
        goal: null, device: DEFAULT_DEVICE, own: {}, want: {}, first: [],
    };
}

function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
}

// A number from raw[key], or the fallback. Anything that had to be fixed goes in `problems`.
function number(raw, key, fallback, problems, fix) {
    if (!(key in raw)) return fallback;
    const text = String(raw[key]).trim();
    const n = Number(text);
    // Number("") is 0, so blank needs its own check
    if (text === "" || !Number.isFinite(n)) {
        problems.push(`${key}: "${raw[key]}" isn't a number, used ${fallback}`);
        return fallback;
    }
    const fixed = fix(n);
    if (fixed !== n) problems.push(`${key}: ${n} is out of range, used ${fixed}`);
    return fixed;
}

// "ram_12:3,ssd_12:2" → { ram_12: 3, ssd_12: 2 }. A bare id means 1.
function parseSelection(text, tree, label, problems) {
    const selection = {};
    for (const part of text.split(",")) {
        if (part === "") continue;
        const [id, qtyText = "1", extra] = part.split(":");
        const qty = Number(qtyText);
        if (!tree.nodes.some((node) => node.id === id)) {
            problems.push(`${label}: there's no upgrade called "${id}"`);
        } else if (extra !== undefined || qtyText === "" || !Number.isInteger(qty) || qty < 0) {
            problems.push(`${label}: "${part}" isn't an amount`);
        } else {
            selection[id] = qty;
        }
    }
    return selection;
}

export function formatSelection(selection) {
    return Object.entries(selection)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => `${id}:${qty}`)
        .join(",");
}

// anything normalize had to cut down (over the limit) is a problem; added prerequisites aren't
function reportClamps(tree, label, before, after, problems) {
    for (const [id, qty] of Object.entries(before)) {
        if ((after[id] ?? 0) < qty) {
            const node = tree.nodes.find((n) => n.id === id);
            problems.push(`${label}: ${qty} × ${node.name} is over the limit, used ${after[id] ?? 0}`);
        }
    }
}

// Raw strings (from the hash or the form) → { state, problems }. Missing keys get defaults quietly.
export function clean(raw, today) {
    const d = defaults(today);
    const problems = [];

    let device = d.device;
    if ("device" in raw) {
        if (raw.device in TREES) device = raw.device;
        else problems.push(`device: there's no device called "${raw.device}", used ${TREES[d.device].device}`);
    }
    const tree = TREES[device];

    let date = d.date;
    if ("date" in raw) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw.date) && !Number.isNaN(Date.parse(raw.date))) date = raw.date;
        else problems.push(`date: "${raw.date}" isn't a date, used today`);
    }

    let goal = null;
    if ("goal" in raw && String(raw.goal).trim() !== "") {
        goal = number(raw, "goal", 0, problems, (n) => Math.max(0, n));
    }

    const ownRaw = parseSelection(raw.own ?? "", tree, "own", problems);
    const wantRaw = parseSelection(raw.want ?? "", tree, "want", problems);
    const { own, want } = normalize(tree, ownRaw, wantRaw);
    reportClamps(tree, "own", ownRaw, own, problems);
    reportClamps(tree, "want", wantRaw, want, problems);

    const first = [];
    for (const id of (raw.first ?? "").split(",")) {
        if (id === "") continue;
        if (tree.nodes.some((node) => node.id === id)) first.push(id);
        else problems.push(`first: there's no upgrade called "${id}"`);
    }

    const state = {
        coins: number(raw, "coins", d.coins, problems, (n) => Math.max(0, n)),
        plots: number(raw, "plots", d.plots, problems, (n) => clamp(Math.round(n), FREE_PLOTS, MAX_PLOTS)),
        seeds: number(raw, "seeds", d.seeds, problems, (n) => Math.max(0, Math.round(n))),
        date,
        m: number(raw, "m", d.m, problems, (n) => clamp(n, MULTIPLIER.min, MULTIPLIER.max)),
        cap: number(raw, "cap", d.cap, problems, (n) => clamp(Math.round(n), RENT, MAX_PLOTS)),
        goal,
        device,
        own,
        want,
        first,
    };
    return { state, problems };
}

// state → "coins=4&plots=13&…". Leaves out today's date (so shared links don't get stuck on an old week)
// and anything empty.
export function toHash(state, today) {
    const params = new URLSearchParams();
    for (const key of ["coins", "plots", "seeds", "m", "cap"]) params.set(key, state[key]);
    if (state.date !== today) params.set("date", state.date);
    if (state.goal !== null) params.set("goal", state.goal);
    params.set("device", state.device);
    for (const key of ["own", "want"]) {
        const text = formatSelection(state[key]);
        if (text) params.set(key, text);
    }
    if (state.first.length) params.set("first", state.first.join(","));
    // URLSearchParams escapes ":" and ","; they're safe in a hash, so keep them readable
    return params.toString().replaceAll("%3A", ":").replaceAll("%2C", ",");
}

// Is the + button allowed? (used by the UI, here so it's tested)
export function canAdd(tree, selection, id) {
    const node = tree.nodes.find((n) => n.id === id);
    return (selection[id] ?? 0) < limitOf(node, selection);
}
