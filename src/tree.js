// Upgrade trees. `selection` / `owned` / `want` are { id: qty }.
import { CROPS } from "./data.js";

function byId(tree, id) {
    return tree.nodes.find((node) => node.id === id);
}

// add everything the picks require (all of `requires`, recursively)
export function withPrereqs(tree, selection) {
    const result = { ...selection };
    const add = (id) => {
        for (const req of byId(tree, id)?.requires ?? []) {
            if (!result[req]) {
                result[req] = 1;
                add(req);
            }
        }
    };
    for (const id of Object.keys(selection)) {
        if (selection[id] > 0) add(id);
    }
    return result;
}

// every node that needs `id`, directly or further down the tree
export function dependentsOf(tree, id) {
    const found = [];
    const visit = (parent) => {
        for (const node of tree.nodes) {
            if (node.requires.includes(parent) && !found.includes(node.id)) {
                found.push(node.id);
                visit(node.id);
            }
        }
    };
    visit(id);
    return found;
}

// remove a node and everything that needs it
export function unpick(tree, selection, id) {
    const result = { ...selection };
    for (const gone of [id, ...dependentsOf(tree, id)]) {
        delete result[gone];
    }
    return result;
}

// coins for buys number from+1 … qty (cost × count, or those tiers added up)
export function nodeCost(node, qty, from = 0) {
    if (qty <= from) return 0;
    if (node.tiers) {
        return node.tiers.slice(from, qty).reduce((sum, price) => sum + price, 0);
    }
    return node.cost * (qty - from);
}

// price of buy number qty+1, or null when there's no next tier
export function nextPrice(node, qty) {
    if (node.tiers) return node.tiers[qty] ?? null;
    return node.cost;
}

// 1, no limit (Infinity), the tier count, or base + how many `per` are in the selection
export function limitOf(node, selection = {}) {
    if (node.tiers) return node.tiers.length;
    if (node.limit === undefined) return 1;
    if (node.limit === null) return Infinity;
    return node.limit.base + (selection[node.limit.per] ?? 0);
}

// drop anything over its limit (fewer USB cards → fewer Fancy cards)
export function clampToLimits(tree, selection) {
    const result = { ...selection };
    for (const node of tree.nodes) {
        if (result[node.id] > limitOf(node, result)) {
            result[node.id] = limitOf(node, result);
        }
    }
    return result;
}

function withoutZeros(selection) {
    return Object.fromEntries(Object.entries(selection).filter(([, qty]) => qty > 0));
}

// Make own and want consistent: prerequisites added, limits respected, want ≥ own for every node
export function normalize(tree, own, want) {
    const fixedOwn = withoutZeros(clampToLimits(tree, withPrereqs(tree, own)));
    const atLeastOwn = { ...want };
    for (const [id, qty] of Object.entries(fixedOwn)) {
        atLeastOwn[id] = Math.max(atLeastOwn[id] ?? 0, qty);
    }
    const fixedWant = withoutZeros(clampToLimits(tree, withPrereqs(tree, atLeastOwn)));
    return { own: fixedOwn, want: fixedWant };
}

// Σ nodeCost over what's wanted, minus what's already owned (own RAM ×1, want ×3 → 1300 + 2100)
export function goalCost(tree, want, owned = {}) {
    let total = 0;
    for (const node of tree.nodes) {
        total += nodeCost(node, want[node.id] ?? 0, owned[node.id] ?? 0);
    }
    return total;
}

// The order to buy the picks in: one item per node ({ id, name, qty, cost }).
// A node only comes after its prerequisites. Among the ones that are ready:
// the earliest in `first` (a prerequisite counts as early as anything that needs it), then cheapest, then tree order.
export function buyOrder(tree, want, owned = {}, first = []) {
    const items = tree.nodes
        .filter((node) => (want[node.id] ?? 0) > (owned[node.id] ?? 0))
        .map((node) => ({
            id: node.id,
            name: node.name,
            qty: want[node.id] - (owned[node.id] ?? 0),
            cost: nodeCost(node, want[node.id], owned[node.id] ?? 0),
        }));

    const wanted = new Set(items.map((item) => item.id));
    const rank = (id) => {
        const ranks = [id, ...dependentsOf(tree, id).filter((other) => wanted.has(other))]
            .map((other) => first.indexOf(other))
            .filter((index) => index !== -1);
        return ranks.length ? Math.min(...ranks) : first.length;
    };
    const treeIndex = (id) => tree.nodes.findIndex((node) => node.id === id);

    const bought = new Set(Object.keys(owned).filter((id) => owned[id] > 0));
    const order = [];
    let left = items;
    while (left.length) {
        const ready = left.filter((item) => byId(tree, item.id).requires.every((req) => bought.has(req)));
        // only empty if `want` is missing a prerequisite; put the rest in tree order rather than loop forever
        const next = ready.length
            ? ready.sort((a, b) => rank(a.id) - rank(b.id) || a.cost - b.cost || treeIndex(a.id) - treeIndex(b.id))[0]
            : left[0];
        order.push(next);
        bought.add(next.id);
        left = left.filter((item) => item !== next);
    }
    return order;
}

// Nodes in display order: each one under its first prerequisite.
// Returns [{ node, depth, alsoNeeds }], alsoNeeds = the other prerequisites (Magic Keyboard Folio has two).
export function displayOrder(tree) {
    const rows = [];
    const add = (node, depth) => {
        rows.push({ node, depth, alsoNeeds: node.requires.slice(1) });
        for (const child of tree.nodes) {
            if (child.requires[0] === node.id) add(child, depth + 1);
        }
    };
    for (const node of tree.nodes) {
        if (node.requires.length === 0) add(node, 0);
    }
    return rows;
}

// rough "effort" for some coins: each extra hour grows an apple (30m) that needs a seed (5)
export function nodeHours(coins, m) {
    return coins / (CROPS.apple.sell * m - CROPS.apple.buy);
}
