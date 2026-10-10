import { test } from "node:test";
import assert from "node:assert/strict";
import { zoomAt, clampView, fitView, ZOOM } from "../src/view.js";

const close = (a, b) => Math.abs(a - b) < 1e-9;

test("zoomAt keeps the point under the mouse still", () => {
    const view = { scale: 1, x: 50, y: 20 };
    const [px, py] = [300, 200];
    // the tree point under the mouse, before and after
    const under = (v) => [(px - v.x) / v.scale, (py - v.y) / v.scale];
    const zoomed = zoomAt(view, 1.5, px, py);
    assert.equal(zoomed.scale, 1.5);
    const [a, b] = [under(view), under(zoomed)];
    assert.ok(close(a[0], b[0]) && close(a[1], b[1]));
});

test("zoomAt stops at the limits", () => {
    assert.equal(zoomAt({ scale: 2, x: 0, y: 0 }, 10, 0, 0).scale, ZOOM.max);
    assert.equal(zoomAt({ scale: 0.5, x: 0, y: 0 }, 0.01, 0, 0).scale, ZOOM.min);
    // at a limit, zooming further doesn't move anything
    assert.deepEqual(zoomAt({ scale: ZOOM.max, x: 10, y: 20 }, 2, 300, 300), { scale: ZOOM.max, x: 10, y: 20 });
});

test("clampView keeps part of the tree in view", () => {
    const canvas = { w: 1000, h: 1200 };
    const viewport = { w: 800, h: 600 };
    const far = clampView({ scale: 1, x: 5000, y: -9000 }, canvas, viewport);
    assert.equal(far.x, 800 - 80); // only 80 px of the tree's left edge still showing
    assert.equal(far.y, 80 - 1200); // only 80 px of its bottom
    const fine = { scale: 1, x: -100, y: -300 };
    assert.deepEqual(clampView(fine, canvas, viewport), fine);
});

test("fitView: small trees fit and are centred, never zoomed in past 1:1", () => {
    const view = fitView({ w: 494, h: 500 }, { w: 1100, h: 700 });
    assert.equal(view.scale, 1);
    assert.equal(view.x, (1100 - 494) / 2);
    assert.equal(view.y, (700 - 500) / 2);
});

test("fitView: big trees shrink to fit, but not below the smallest readable size", () => {
    const fits = fitView({ w: 1058, h: 1271 }, { w: 1100, h: 760 });
    assert.ok(close(fits.scale, 760 / 1271));
    const phone = fitView({ w: 1058, h: 1271 }, { w: 340, h: 600 });
    assert.equal(phone.scale, 0.5);
    // too tall at 0.5: the bottom (the device) is what's in view
    assert.equal(phone.y, 600 - 1271 * 0.5);
});
