// Wobbly box outlines, the page half. The maths is in sketch.js
import { wobblyRect, seedOf, outlineMargin } from "./sketch.js";

export const SVG = "http://www.w3.org/2000/svg";

// how hand-drawn the boxes look: how far (px) the edge wanders, and how often it changes direction
// (boxes can override these in CSS with --sketch-wobble and --sketch-every, e.g. inputs are tighter)
const SKETCH = { wobble: 0.8, every: 32 };

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

// One box's outline, an SVG made for its exact size, either inside it or as its background (above).
// Set per box in CSS: --sketch-color, --sketch-width, --sketch-opacity,
// --sketch-dash, --sketch-fill, --sketch-wobble, --sketch-every, --sketch-over.
export function drawOutline(box) {
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
        const svg = `<svg xmlns="${SVG}" width="${w}" height="${h}">${paths}</svg>`;
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

// hand-drawn outlines, key(box) picks the wobble so a box always gets the same one
// all marked first, drawn after. one marked after the browser styled it faded its straight border out in a flash
// `watch` redraws on resize, for boxes that change size with the page
export function sketchAll(boxes, key, watch = false) {
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

export function sketch(box, key, watch = false) {
    sketchAll([box], () => key, watch);
}

export function redrawOutlines() {
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
