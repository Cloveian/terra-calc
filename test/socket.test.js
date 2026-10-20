import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeFrame } from "../userscript/socket.js";

// hand built frames like colyseus sends, real captured ones decode the same
const text = (s) => [...new TextEncoder().encode(s)];
const frame = (bytes) => Uint8Array.from(bytes).buffer;

test("a message with a payload", () => {
    const data = frame([13, 0xaf, ...text("player.currency"), 0x81, 0xa5, ...text("coins"), 0x04]);
    assert.deepEqual(decodeFrame(data), { type: "player.currency", payload: { coins: 4 } });
});

test("a message with no payload", () => {
    assert.deepEqual(decodeFrame(frame([13, 0xa4, ...text("ping")])), { type: "ping", payload: undefined });
});

test("takes a Uint8Array too, what the game sends", () => {
    const bytes = Uint8Array.from([0xff, 13, 0xa4, ...text("move"), 0x80]).subarray(1);
    assert.deepEqual(decodeFrame(bytes), { type: "move", payload: {} });
});

test("number types come through as numbers", () => {
    assert.deepEqual(decodeFrame(frame([13, 0x07, 0xc3])), { type: 7, payload: true });
});

test("anything else -> null", () => {
    assert.equal(decodeFrame(frame([15, 0x01, 0x02])), null); // a state patch
    assert.equal(decodeFrame(frame([])), null);
    assert.equal(decodeFrame(frame([13, 0xa5, 0x61])), null); // cut off
    assert.equal(decodeFrame("hi"), null);
});
