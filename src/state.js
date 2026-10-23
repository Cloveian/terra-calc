// Page state and URL hash.
// state = { coins, plots, seeds, bok, egg, shop, date, m, cap, goal, device, own, want, first }
//   goal: null = use the tree picks, a number = custom goal typed by hand
//   own / want: { id: qty }, first: ids (or id:n for one tier) to buy first (milestone order)
//   bok / egg: bok choy and eggplant seeds on hand, shop: bonus seed ids in heidi's shop today
import { TREES, CROPS, FREE_PLOTS, MAX_PLOTS, RENT, MULTIPLIER, STARTING_COINS } from "./data.js";
import { normalize, limitOf, byId } from "./tree.js";

export const DEFAULT_DEVICE = "framework_12";

// what each value is called on the page, for the "something in that link was off" list
const LABELS = {
    coins: "Coins", plots: "Dirt plots", seeds: "Apple seeds", bok: "Bok Choy seeds", egg: "Eggplant seeds",
    shop: "Heidi's shop", date: "Date", m: "Multiplier",
    cap: "Hours/week", goal: "Goal", device: "Device", own: "Own", want: "Want", first: "Buy order",
};

export const HASH_KEYS = ["coins", "plots", "seeds", "bok", "egg", "shop", "date", "m", "cap", "goal", "device", "own", "want", "first"];

export function defaults(today) {
    return {
        coins: STARTING_COINS, plots: FREE_PLOTS, seeds: 0, bok: 0, egg: 0, shop: [], date: today, m: 1, cap: RENT,
        goal: null, device: DEFAULT_DEVICE, own: {}, want: {}, first: [],
    };
}

export function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
}

// A number from raw[key], or the fallback. Anything that had to be fixed goes in `problems`.
function number(raw, key, fallback, problems, fix) {
    if (!(key in raw)) return fallback;
    const text = String(raw[key]).trim();
    const n = Number(text);
    // Number("") is 0, so blank needs its own check
    if (text === "" || !Number.isFinite(n)) {
        problems.push(`${LABELS[key]}: "${raw[key]}" isn't a number, used ${fallback}`);
        return fallback;
    }
    const fixed = fix(n);
    if (fixed !== n) problems.push(`${LABELS[key]}: ${n} is out of range, used ${fixed}`);
    return fixed;
}

// "ram_12:3,ssd_12:2" → { ram_12: 3, ssd_12: 2 }. A bare id means 1.
function parseSelection(text, tree, label, problems) {
    const selection = {};
    for (const part of text.split(",")) {
        if (part === "") continue;
        const [id, qtyText = "1", extra] = part.split(":");
        const qty = Number(qtyText);
        if (!byId(tree, id)) {
            problems.push(`${LABELS[label]}: there's no upgrade called "${id}"`);
        } else if (extra !== undefined || qtyText === "" || !Number.isInteger(qty) || qty < 0) {
            problems.push(`${LABELS[label]}: "${part}" isn't an amount`);
        } else {
            selection[id] = qty;
        }
    }
    return selection;
}

// what's wrong with a buyOrder row key (node id, or id:n for one tier), null if fine
export function rowKeyProblem(tree, key) {
    const [id, unit, extra] = key.split(":");
    const node = byId(tree, id);
    if (!node) return `there's no upgrade called "${id}"`;
    if (unit === undefined) return null;
    if (!node.tiers) return `${node.name} doesn't come in tiers ("${key}")`;
    if (extra === undefined && /^\d+$/.test(unit) && unit >= 1 && unit <= node.tiers.length) return null;
    return `"${key}" isn't one of ${node.name}'s ${node.tiers.length} tiers`;
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
            problems.push(`${LABELS[label]}: ${qty} × ${byId(tree, id).name} is over the limit, used ${after[id] ?? 0}`);
        }
    }
}

// Raw strings (from the hash or the form) → { state, problems }. Missing keys get defaults quietly.
// userscript passes live trees (/device-upgrades), site gets data.js TREES
export function clean(raw, today, trees = TREES) {
    const d = defaults(today);
    const problems = [];

    let device = d.device;
    if ("device" in raw) {
        if (raw.device in trees) device = raw.device;
        else problems.push(`${LABELS.device}: there's no device called "${raw.device}", used ${trees[d.device]?.device ?? d.device}`);
    }
    const tree = trees[device];

    let date = d.date;
    if ("date" in raw) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw.date) && !Number.isNaN(Date.parse(raw.date))) date = raw.date;
        else problems.push(`${LABELS.date}: "${raw.date}" isn't a date, used today`);
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
    for (const key of (raw.first ?? "").split(",")) {
        if (key === "") continue;
        const problem = rowKeyProblem(tree, key);
        if (problem) problems.push(`${LABELS.first}: ${problem}`);
        else first.push(key);
    }

    // bonus seeds in the shop today, each one once
    const shop = [];
    for (const id of (raw.shop ?? "").split(",")) {
        if (id === "" || shop.includes(id)) continue;
        if (CROPS[id]?.bonus) shop.push(id);
        else problems.push(`${LABELS.shop}: there's no bonus seed called "${id}"`);
    }

    const seedCount = (n) => Math.max(0, Math.round(n));
    const state = {
        coins: number(raw, "coins", d.coins, problems, (n) => Math.max(0, n)),
        plots: number(raw, "plots", d.plots, problems, (n) => clamp(Math.round(n), FREE_PLOTS, MAX_PLOTS)),
        seeds: number(raw, "seeds", d.seeds, problems, seedCount),
        bok: number(raw, "bok", d.bok, problems, seedCount),
        egg: number(raw, "egg", d.egg, problems, seedCount),
        shop,
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
    // bok / egg left out at 0, most links never have any
    for (const key of ["bok", "egg"]) if (state[key] > 0) params.set(key, state[key]);
    if (state.shop.length) params.set("shop", state.shop.join(","));
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
    return (selection[id] ?? 0) < limitOf(byId(tree, id), selection);
}
