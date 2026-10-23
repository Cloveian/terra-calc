// Upgrade trees. `selection` / `owned` / `want` are { id: qty }.
import { CROPS } from "./data.js";

export function byId(tree, id) {
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

export function withoutZeros(selection) {
    return Object.fromEntries(Object.entries(selection).filter(([, qty]) => qty > 0));
}

// missing ids count as 0
export function sameSelection(a, b) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((key) => (a[key] ?? 0) === (b[key] ?? 0));
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

// wanted picks as rows to buy, a row per tier for tiered ones (16 GB way sooner than 48)
export function wantedRows(tree, want, owned = {}) {
    const rows = [];
    for (const node of tree.nodes) {
        const have = owned[node.id] ?? 0;
        const qty = (want[node.id] ?? 0) - have;
        if (qty <= 0) continue;
        if (!node.tiers) {
            // one row for all of it (Fancy *4)
            rows.push({ key: node.id, id: node.id, unit: null, name: node.name, qty, cost: nodeCost(node, have + qty, have) });
            continue;
        }
        // unit counts what i own too, so ram_12:2 stays the 2nd stick after the 1st gets bought
        for (let unit = have + 1; unit <= have + qty; unit++) {
            // what i have after that buy ("16 GB")
            const total = node.totals?.[unit];
            const name = total ? `${node.name} ${total}` : `${node.name} ${unit}/${node.tiers.length}`;
            rows.push({ key: `${node.id}:${unit}`, id: node.id, unit, name, qty: 1, cost: node.tiers[unit - 1] });
        }
    }
    return rows;
}

// other is a prerequisite of row (any level up) or a lower tier of the same node
export function waitsOn(tree, row, other) {
    if (row.id === other.id) return row.unit !== null && row.unit > other.unit;
    return dependentsOf(tree, other.id).includes(row.id);
}

// rows from wantedRows in buy order, each after what it waits on
export function buyOrder(tree, want, owned = {}, prio = {}) {
    const rows = wantedRows(tree, want, owned);
    const numberOf = (row) => rowPrio(prio, row) ?? Infinity;
    // as early as anything waiting on it
    const rank = new Map(rows.map((row) => [
        row, Math.min(numberOf(row), ...rows.filter((other) => waitsOn(tree, other, row)).map(numberOf)),
    ]));
    const treeIndex = (id) => tree.nodes.findIndex((node) => node.id === id);
    // a - b breaks on Infinity - Infinity (NaN), sort goes weird
    const byRank = (a, b) => (rank.get(a) === rank.get(b) ? 0 : rank.get(a) < rank.get(b) ? -1 : 1);

    const have = { ...owned };
    const ready = (row) => byId(tree, row.id).requires.every((req) => (have[req] ?? 0) > 0)
        && (row.unit === null || (have[row.id] ?? 0) === row.unit - 1);
    const order = [];
    let left = rows;
    while (left.length) {
        const now = left.filter(ready);
        // only empty if `want` is missing a prerequisite; put the rest in tree order rather than loop forever
        const next = now.length
            ? now.sort((a, b) => byRank(a, b) || a.cost - b.cost || treeIndex(a.id) - treeIndex(b.id))[0]
            : left[0];
        order.push(next);
        have[next.id] = (have[next.id] ?? 0) + next.qty;
        left = left.filter((row) => row !== next);
    }
    return order;
}

// a row's own number or its node's, null for none
export function rowPrio(prio, row) {
    return prio[row.key] ?? prio[row.id] ?? null;
}

// sites arrow order (keys, most wanted first) as prio numbers for buyOrder
export function prioFrom(first) {
    return Object.fromEntries(first.map((key, index) => [key, index + 1]));
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

// Where to draw the tree, from Terra's own positions (root, x, y in data.js).
// Terra's spacing is for small icons, so it's stretched (x by sx, y by sy) until no two cards
// (card.w × card.h px, `gap` apart) overlap. Two cards are fine if they're far enough apart
// either sideways or up/down, so every useful sy is tried, each with the smallest sx that works,
// and the smallest canvas wins.
// Returns { width, height, centres: { root, [id]: { x, y } }, edges: [[id, prerequisite or "root"]] }.
export function treeLayout(tree, card, gap = 16, minScale = 0.6, padding = 8) {
    const points = [{ id: "root", ...tree.root }, ...tree.nodes.map(({ id, x, y }) => ({ id, x, y }))];
    const needX = card.w + gap;
    const needY = card.h + gap;
    const pairs = [];
    for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
            pairs.push({ dx: Math.abs(points[i].x - points[j].x), dy: Math.abs(points[i].y - points[j].y) });
        }
    }
    const rangeX = Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x));
    const rangeY = Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y));

    // each sy that just separates some pair up/down is a candidate
    const candidates = [minScale, ...pairs.filter((p) => p.dy > 0).map((p) => needY / p.dy)]
        .filter((s) => s >= minScale);
    let best = null;
    for (const sy of candidates) {
        let sx = minScale;
        for (const { dx, dy } of pairs) {
            if (dy * sy >= needY) continue; // far enough apart up/down
            sx = dx === 0 ? Infinity : Math.max(sx, needX / dx); // otherwise they need to be apart sideways
        }
        const area = (rangeX * sx + card.w) * (rangeY * sy + card.h);
        if (!best || area < best.area) best = { sx, sy, area };
    }
    const { sx, sy } = best;

    const minX = Math.min(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y));
    const centres = {};
    for (const p of points) {
        centres[p.id] = {
            x: Math.round((p.x - minX) * sx + card.w / 2 + padding),
            y: Math.round((p.y - minY) * sy + card.h / 2 + padding),
        };
    }
    const edges = tree.nodes.flatMap((node) =>
        node.requires.length ? node.requires.map((req) => [node.id, req]) : [[node.id, "root"]]);
    return {
        width: Math.max(...Object.values(centres).map((c) => c.x)) + card.w / 2 + padding,
        height: Math.max(...Object.values(centres).map((c) => c.y)) + card.h / 2 + padding,
        centres,
        edges,
    };
}

// rough "effort" for some coins: each extra hour grows an apple (30m) that needs a seed (5)
export function nodeHours(coins, m) {
    return coins / (CROPS.apple.sell * m - CROPS.apple.buy);
}
