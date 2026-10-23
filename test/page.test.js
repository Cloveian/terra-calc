import { test } from "node:test";
import assert from "node:assert/strict";
import { numberBox, ourBit } from "../userscript/page.js";

// just enough page for numberBox and ourBit, no real DOM in node
const fakeNode = () => {
    const listeners = {};
    return {
        listeners,
        addEventListener: (type, fn) => (listeners[type] ??= []).push(fn),
        append() {},
    };
};
globalThis.document = { createElement: fakeNode, head: fakeNode(), body: fakeNode(), styleSheets: [] };
globalThis.MutationObserver = class { observe() {} disconnect() {} takeRecords() { return []; } };

test("numberBox: the cleaned number goes back in the box and to onChange", () => {
    const got = [];
    const box = numberBox({ min: "0", placeholder: "the game's" }, null, (text) => (text === "" ? null : Math.round(Number(text))), (n) => got.push(n));
    assert.equal(box.type, "number");
    assert.equal(box.placeholder, "the game's");
    assert.equal(box.value, "");
    box.value = "4.6";
    box.listeners.change[0]();
    box.value = "";
    box.listeners.change[0]();
    assert.deepEqual(got, [5, null]);
    assert.equal(box.value, "");
});

test("ourBit: draws before mount are kept, mount only once, fill gets the newest state", () => {
    const filled = [];
    const bit = ourBit((state) => filled.push(state));
    bit.draw("early");
    assert.deepEqual(filled, []);
    assert.equal(bit.mount("css"), true);
    assert.equal(bit.mount("css"), false);
    bit.redraw();
    bit.draw("later");
    assert.deepEqual(filled, ["early", "later"]);
});
