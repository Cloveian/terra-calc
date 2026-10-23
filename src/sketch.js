// Hand-drawn-looking box outlines: a rounded rectangle whose edge wobbles a little.
// Seeded, so the same box always gets the same wobble. Pure: returns SVG path data.
import { clamp } from "./state.js";

// text → a whole-number seed (FNV-1a hash)
export function seedOf(text) {
    let hash = 2166136261;
    for (const char of String(text)) {
        hash ^= char.codePointAt(0);
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash || 1;
}

// small seeded random number generator, numbers in [0, 1)
export function random(seed) {
    let state = seed % 2147483647 || 1;
    return () => (state = (state * 16807) % 2147483647) / 2147483647;
}

// Point `d` px along the edge of a w × h rounded rectangle (clockwise from the end of the
// top-left corner), with the outward direction there: [x, y, nx, ny].
// radii: [top-left, top-right, bottom-right, bottom-left]
function pointOnEdge(d, w, h, [tl, tr, br, bl]) {
    const corner = (cx, cy, r, start) => [
        (Math.PI * r) / 2,
        (t) => {
            const a = start + t / (r || 1);
            return [cx + r * Math.cos(a), cy + r * Math.sin(a), Math.cos(a), Math.sin(a)];
        },
    ];
    const parts = [
        [w - tl - tr, (t) => [tl + t, 0, 0, -1]],
        corner(w - tr, tr, tr, -Math.PI / 2),
        [h - tr - br, (t) => [w, tr + t, 1, 0]],
        corner(w - br, h - br, br, 0),
        [w - br - bl, (t) => [w - br - t, h, 0, 1]],
        corner(bl, h - bl, bl, Math.PI / 2),
        [h - bl - tl, (t) => [0, h - bl - t, -1, 0]],
        corner(tl, tl, tl, Math.PI),
    ];
    const perimeter = parts.reduce((sum, [length]) => sum + length, 0);
    d = ((d % perimeter) + perimeter) % perimeter;
    for (const [length, at] of parts) {
        if (d <= length) return at(d);
        d -= length;
    }
    return parts[0][1](0);
}

// Where each corner's curve starts, has its middle and ends, as distances along the edge
// (same measuring as pointOnEdge)
function cornerDistances(w, h, [tl, tr, br, bl]) {
    const arc = (r) => (Math.PI * r) / 2;
    const out = [];
    let d = w - tl - tr; // end of the top edge, where the top-right corner starts
    for (const [r, nextEdge] of [[tr, h - tr - br], [br, w - br - bl], [bl, h - bl - tl], [tl, w - tl - tr]]) {
        out.push(d, d + arc(r) / 2, d + arc(r));
        d += arc(r) + nextEdge;
    }
    return out;
}

function perimeterOf(w, h, [tl, tr, br, bl]) {
    const straight = 2 * (w + h) - 2 * (tl + tr + br + bl);
    return straight + (Math.PI / 2) * (tl + tr + br + bl);
}

const MIN_CORNER = 4;

// How far inside a box to draw its outline so none of it gets cut off at the box's edge:
// half the line's thickness, plus how far the wobbly curve can stray outwards
// (measured: up to ~1.6 × the wobble, see the tests).
export function outlineMargin(lineWidth, wobble) {
    return lineWidth / 2 + wobble * 1.6 + 0.3;
}

// SVG path for a w × h box with corner radius r, its edge pushed in or out by up to
// `wobble` px at a point roughly every `every` px, joined with smooth curves. The line runs
// one point past where it started, like a pen closing a loop.
// Each seed also gets its own corner roundness (r ± `cornerJitter`), its own spacing
// (every ± `spacingJitter`) and its own starting point, so boxes next to each other differ.
// The path is closed enough to fill, so a box's background can follow the same wobble.
// x0, y0 move the whole outline (e.g. a little inside a box, for clip-path).
export function wobblyRect(w, h, r, seed, { wobble = 0.8, every = 32, cornerJitter = 0.3, spacingJitter = 0.2, x0 = 0, y0 = 0 } = {}) {
    if (!(w > 0 && h > 0)) return "";
    const rand = random(seed);
    const spread = (n, jitter) => n * (1 + (rand() * 2 - 1) * jitter);
    // at least a little round: a sharp corner makes the curve swing out past it
    const radii = [0, 1, 2, 3].map(() => Math.min(Math.max(spread(r, cornerJitter), MIN_CORNER), w / 2, h / 2));
    const perimeter = perimeterOf(w, h, radii);
    const spacing = perimeter / Math.max(8, Math.round(perimeter / spread(every, spacingJitter)));
    const start = rand() * perimeter;

    // Points on every corner (start, middle, end), so the line follows the corners instead of
    // swinging out past them, plus evenly spaced points along the edges, except where a
    // corner point is already close by.
    const corners = cornerDistances(w, h, radii);
    const gap = (a, b) => {
        const g = Math.abs(a - b) % perimeter;
        return Math.min(g, perimeter - g);
    };
    const along = [...corners];
    for (let d = start; d < start + perimeter - 1e-9; d += spacing) {
        const at = d % perimeter;
        if (corners.every((c) => gap(at, c) > spacing * 0.4)) along.push(at);
    }
    // in drawing order from `start` (where the pen starts and overlaps), without doubles
    const order = (d) => (d - start + perimeter) % perimeter;
    along.sort((a, b) => order(a) - order(b));
    const distances = along.filter((d, i) => i === 0 || order(d) - order(along[i - 1]) > 0.5);

    const points = distances.map((d) => {
        const [x, y, nx, ny] = pointOnEdge(d, w, h, radii);
        const push = (rand() * 2 - 1) * wobble;
        return [x0 + x + nx * push, y0 + y + ny * push];
    });
    const count = points.length;

    // round the loop, plus one more
    return catmullRom((i) => points[(i + count) % count], count + 1);
}

// SVG path from (x1, y1) to (x2, y2) that wobbles sideways by up to `wobble` px, about every
// `every` px, like a line drawn by hand. Both ends stay exactly where they are. Seeded.
export function wobblyLine(x1, y1, x2, y2, seed, { wobble = 1.5, every = 40 } = {}) {
    const length = Math.hypot(x2 - x1, y2 - y1);
    if (length === 0) return `M${tenth(x1)},${tenth(y1)}`;
    const rand = random(seed);
    const [nx, ny] = [-(y2 - y1) / length, (x2 - x1) / length]; // sideways direction
    const steps = Math.max(1, Math.round(length / every));
    const points = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const push = i === 0 || i === steps ? 0 : (rand() * 2 - 1) * wobble;
        points.push([x1 + (x2 - x1) * t + nx * push, y1 + (y2 - y1) * t + ny * push]);
    }

    // the ends repeat for their tangents
    return catmullRom((i) => points[clamp(i, 0, points.length - 1)], points.length - 1);
}

// Catmull-Rom through at(0), at(1)... as `segments` cubic Beziers. at() gets -1 and segments + 1 too, for the end tangents
function catmullRom(at, segments) {
    let d = `M${tenth(at(0)[0])},${tenth(at(0)[1])}`;
    for (let i = 0; i < segments; i++) {
        const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
        const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
        const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        d += ` C${tenth(c1[0])},${tenth(c1[1])} ${tenth(c2[0])},${tenth(c2[1])} ${tenth(p2[0])},${tenth(p2[1])}`;
    }
    return d;
}

// a tenth of a px is plenty, keeps the paths short
function tenth(n) {
    return Math.round(n * 10) / 10;
}
