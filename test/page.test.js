import { test } from "node:test";
import assert from "node:assert/strict";
import { numberBox, ourBit } from "../userscript/page.js";

// just enough page for numberBox and ourBit, no real DOM in node
const fakeNode = () => {
    const listeners = {};
    return {
        listeners,
        children: [],
        isConnected: true,
        addEventListener: (type, fn) => (listeners[type] ??= []).push(fn),
        dispatchEvent: (event) => listeners[event.type]?.forEach((fn) => fn(event)),
        focus() {},
        append(...nodes) {
            this.children.push(...nodes);
            this.firstChild ??= nodes[0];
        },
    };
};
globalThis.document = { createElement: fakeNode, head: fakeNode(), body: fakeNode(), styleSheets: [] };
globalThis.MutationObserver = class { observe() {} disconnect() {} takeRecords() { return []; } };

test("numberBox: the cleaned number goes back in the box and to onChange", () => {
    const got = [];
    const box = numberBox({ min: "0", placeholder: "the game's" }, null, (text) => (text === "" ? null : Math.round(Number(text))), (n) => got.push(n)).firstChild;
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

test("numberBox arrows: held repeats till let go, n stops for good once a redraw took the box", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const wait = (ms) => { for (let i = 0; i < ms / 10; i++) t.mock.timers.tick(10); }; // one tick doesnt run timers it set itself
    const got = [];
    const [box, arrows] = numberBox({ min: "0", max: "", step: "1" }, 2, Number, (n) => got.push(n)).children;
    const [more] = arrows.children;
    const down = () => more.listeners.pointerdown[0]({ preventDefault() {} });
    down();
    wait(400 + 70);
    more.listeners.pointerup[0]();
    wait(1000);
    assert.deepEqual(got, [3, 4, 5]);
    // two fingers on it, one pointerup has to stop both
    down();
    down();
    more.listeners.pointerup[0]();
    wait(1000);
    assert.deepEqual(got, [3, 4, 5, 6, 7]);
    down();
    box.isConnected = false;
    wait(1000);
    box.isConnected = true;
    wait(1000);
    assert.deepEqual(got, [3, 4, 5, 6, 7, 8]);
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
