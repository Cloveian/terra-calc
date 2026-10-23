import { test } from "node:test";
import assert from "node:assert/strict";
import { seedOf, random, wobblyRect, outlineMargin, wobblyLine } from "../src/sketch.js";

// all the numbers in a path, as [x, y] pairs
const points = (d) => {
    const nums = d.match(/-?\d+(\.\d+)?/g).map(Number);
    const pairs = [];
    for (let i = 0; i < nums.length; i += 2) pairs.push([nums[i], nums[i + 1]]);
    return pairs;
};

test("seedOf is stable and spreads out", () => {
    assert.equal(seedOf("cpu_12"), seedOf("cpu_12"));
    assert.notEqual(seedOf("cpu_12"), seedOf("cpu_i5_1334u"));
    assert.ok(seedOf("") > 0);
});

test("random is seeded and stays in [0, 1)", () => {
    const a = random(42);
    const b = random(42);
    for (let i = 0; i < 100; i++) {
        const n = a();
        assert.equal(n, b());
        assert.ok(n >= 0 && n < 1);
    }
});

test("wobblyRect: same seed, same outline; different seed, different outline", () => {
    assert.equal(wobblyRect(168, 150, 12, 7), wobblyRect(168, 150, 12, 7));
    assert.notEqual(wobblyRect(168, 150, 12, 7), wobblyRect(168, 150, 12, 8));
});

// the points the line passes through: the start, then the end point of each curve
// (each "C" has two control points first, which steer the curve and can sit further out)
const throughPoints = (d) => {
    const all = points(d);
    return [all[0], ...all.slice(1).filter((_, i) => i % 3 === 2)];
};

test("wobblyRect: the line stays within the box, give or take the wobble", () => {
    for (const [w, h, r] of [[168, 150, 12], [1100, 140, 12], [300, 40, 8], [30, 30, 50]]) {
        for (const [x, y] of throughPoints(wobblyRect(w, h, r, 3, { wobble: 0.8 }))) {
            assert.ok(x >= -0.9 && x <= w + 0.9 && y >= -0.9 && y <= h + 0.9, `${w}x${h}: ${x},${y}`);
        }
    }
});

test("wobblyRect: no wobble means the line goes exactly along the rounded edge", () => {
    const [w, h, r] = [100, 60, 10];
    for (const [x, y] of throughPoints(wobblyRect(w, h, r, 1, { wobble: 0, cornerJitter: 0 }))) {
        // in a corner: on the corner's circle; otherwise: on a straight edge
        const cx = x < r ? r : x > w - r ? w - r : null;
        const cy = y < r ? r : y > h - r ? h - r : null;
        const onEdge = cx !== null && cy !== null
            ? Math.abs(Math.hypot(x - cx, y - cy) - r) < 0.15
            : x <= 0.05 || x >= w - 0.05 || y <= 0.05 || y >= h - 0.05;
        assert.ok(onEdge, `${x},${y}`);
    }
});

// every point along the drawn curves (not just the points it passes through)
function curvePoints(d) {
    const n = d.match(/-?\d+(\.\d+)?/g).map(Number);
    const out = [];
    let [x0, y0] = [n[0], n[1]];
    for (let i = 2; i + 5 < n.length; i += 6) {
        const [x1, y1, x2, y2, x3, y3] = n.slice(i, i + 6);
        for (let t = 0; t <= 1; t += 0.05) {
            const u = 1 - t;
            out.push([
                u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
                u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
            ]);
        }
        [x0, y0] = [x3, y3];
    }
    return out;
}

test("outlineMargin: the drawn line never reaches the box's edge (nothing gets cut off)", () => {
    const wobble = 0.8;
    const lineWidth = 2.5;
    const margin = outlineMargin(lineWidth, wobble);
    for (const [W, H, r] of [[168, 150, 12], [1100, 140, 12], [300, 40, 8], [360, 1200, 12], [60, 30, 8], [100, 60, 0]]) {
        // the line is drawn on a box `margin` smaller on every side, like outline.js does
        const [w, h] = [W - 2 * margin, H - 2 * margin];
        for (let seed = 1; seed <= 150; seed++) {
            for (const [x, y] of curvePoints(wobblyRect(w, h, r, seed * 7919, { wobble }))) {
                const [px, py] = [x + margin, y + margin];
                const reach = lineWidth / 2; // the line's thickness sticks out half each side
                assert.ok(px - reach >= 0 && py - reach >= 0 && px + reach <= W && py + reach <= H,
                    `${W}x${H} seed ${seed}: ${px.toFixed(2)},${py.toFixed(2)}`);
            }
        }
    }
});

test("wobblyRect: more wobbles on bigger boxes, none for empty ones", () => {
    const curves = (d) => (d.match(/C/g) ?? []).length;
    assert.ok(curves(wobblyRect(1000, 200, 12, 1)) > curves(wobblyRect(168, 150, 12, 1)));
    assert.equal(wobblyRect(0, 100, 12, 1), "");
    assert.equal(wobblyRect(100, -5, 12, 1), "");
});

test("wobblyRect: same-size boxes look different (start point, spacing, corners vary per seed)", () => {
    const outlines = ["cpu_12", "cpu_i5_1334u", "cpu_core5_320", "ram_12", "ssd_12", "stylus_12"]
        .map((id) => wobblyRect(168, 150, 12, seedOf(`framework_12:${id}`)));
    const starts = new Set(outlines.map((d) => d.slice(0, d.indexOf(" C"))));
    const curveCounts = new Set(outlines.map((d) => (d.match(/C/g) ?? []).length));
    assert.equal(starts.size, outlines.length); // every line starts somewhere else
    assert.ok(curveCounts.size >= 2); // and they don't all wobble at the same rate
});

test("wobblyLine: starts and ends exactly at the given points", () => {
    const d = wobblyLine(10, 20, 410, 320, 5);
    const all = points(d);
    assert.deepEqual(all[0], [10, 20]);
    assert.deepEqual(all.at(-1), [410, 320]);
});

test("wobblyLine: stays close to the straight line, and is seeded", () => {
    const [x1, y1, x2, y2] = [0, 0, 600, 200];
    const length = Math.hypot(x2 - x1, y2 - y1);
    // distance of a point from the straight line between the ends
    const off = ([x, y]) => Math.abs((x2 - x1) * (y1 - y) - (x1 - x) * (y2 - y1)) / length;
    for (let seed = 1; seed <= 50; seed++) {
        for (const p of curvePoints(wobblyLine(x1, y1, x2, y2, seed * 31, { wobble: 1.5 }))) {
            assert.ok(off(p) <= 1.5 * 1.6, `seed ${seed}: ${off(p).toFixed(2)} px off`);
        }
    }
    assert.equal(wobblyLine(0, 0, 300, 0, 9), wobblyLine(0, 0, 300, 0, 9));
    assert.notEqual(wobblyLine(0, 0, 300, 0, 9), wobblyLine(0, 0, 300, 0, 10));
});

test("wobblyLine: short or zero-length lines still work", () => {
    assert.match(wobblyLine(5, 5, 8, 9, 1), /^M5,5 C.* 8,9$/);
    assert.equal(wobblyLine(5, 5, 5, 5, 1), "M5,5");
});

test("wobblyRect: x0 / y0 move the whole outline", () => {
    const plain = points(wobblyRect(100, 60, 8, 4));
    const moved = points(wobblyRect(100, 60, 8, 4, { x0: 3, y0: 5 }));
    assert.equal(moved.length, plain.length);
    moved.forEach(([x, y], i) => {
        assert.ok(Math.abs(x - plain[i][0] - 3) < 0.11 && Math.abs(y - plain[i][1] - 5) < 0.11);
    });
});
