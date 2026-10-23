// Zoom and pan for the upgrade tree. Pure maths; the page parts are in ui.js.
// view = { scale, x, y }: the tree is drawn with its top-left corner at (x, y), scaled by `scale`.
// Sizes are { w, h } in px.
import { clamp } from "./state.js";

export const ZOOM = { min: 0.35, max: 2.5 };

// Zoom by `factor`, keeping the point (px, py) in the viewport still (where the mouse is)
export function zoomAt(view, factor, px, py) {
    const scale = clamp(view.scale * factor, ZOOM.min, ZOOM.max);
    const k = scale / view.scale;
    return { scale, x: px - (px - view.x) * k, y: py - (py - view.y) * k };
}

// Don't let the tree be dragged away: at least `keep` px of it stays inside the viewport
export function clampView(view, canvas, viewport, keep = 80) {
    const w = canvas.w * view.scale;
    const h = canvas.h * view.scale;
    return {
        ...view,
        x: clamp(view.x, Math.min(keep, w) - w, viewport.w - Math.min(keep, w)),
        y: clamp(view.y, Math.min(keep, h) - h, viewport.h - Math.min(keep, h)),
    };
}

// Starting view: as big as fits (never above 1:1, never below `smallest`, so cards stay readable),
// centred sideways; if it's taller than the viewport, the bottom (the device) is the part in view.
// If it's wider than the viewport, the point `focusX` (in tree px, e.g. the device card) is centred.
export function fitView(canvas, viewport, smallest = 0.5, focusX = canvas.w / 2) {
    const fit = Math.min(1, viewport.w / canvas.w, viewport.h / canvas.h);
    const scale = Math.max(Math.min(smallest, 1), fit);
    const w = canvas.w * scale;
    const h = canvas.h * scale;
    return {
        scale,
        x: w <= viewport.w ? (viewport.w - w) / 2 : viewport.w / 2 - focusX * scale,
        y: h <= viewport.h ? (viewport.h - h) / 2 : viewport.h - h,
    };
}
