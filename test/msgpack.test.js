import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeMsgpack, encodeMsgpack } from "../userscript/msgpack.js";

// bytes hand worked from msgpack spec
const text = (s) => [...new TextEncoder().encode(s)];
const decode = (bytes, offset) => decodeMsgpack(Uint8Array.from(bytes), offset).value;

test("fixints, nil, true, false", () => {
    assert.equal(decode([0x05]), 5);
    assert.equal(decode([0x7f]), 127);
    assert.equal(decode([0xff]), -1);
    assert.equal(decode([0xe0]), -32);
    assert.equal(decode([0xc0]), null);
    assert.equal(decode([0xc2]), false);
    assert.equal(decode([0xc3]), true);
});

test("sized ints", () => {
    assert.equal(decode([0xcc, 0xc8]), 200);
    assert.equal(decode([0xcd, 0x01, 0x2c]), 300);
    assert.equal(decode([0xce, 0x00, 0x01, 0x00, 0x00]), 65536);
    assert.equal(decode([0xcf, 0, 0, 0, 0x01, 0, 0, 0, 0]), 2 ** 32);
    assert.equal(decode([0xd0, 0x9c]), -100);
    assert.equal(decode([0xd1, 0xfe, 0xd4]), -300);
    assert.equal(decode([0xd2, 0xff, 0xff, 0xff, 0xff]), -1);
    assert.equal(decode([0xd3, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xfe]), -2);
});

test("floats", () => {
    assert.equal(decode([0xca, 0x3f, 0xc0, 0x00, 0x00]), 1.5);
    assert.equal(decode([0xcb, 0x3f, 0xf3, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33]), 1.2);
});

test("strings, including multi-byte ones", () => {
    assert.equal(decode([0xa2, ...text("hi")]), "hi");
    assert.equal(decode([0xa0]), "");
    assert.equal(decode([0xa2, 0xc3, 0xa9]), "é");
    const long = "x".repeat(40);
    assert.equal(decode([0xd9, 40, ...text(long)]), long);
    assert.equal(decode([0xda, 0x00, 40, ...text(long)]), long);
});

test("bin and ext", () => {
    assert.deepEqual(decode([0xc4, 0x02, 0xab, 0xcd]), Uint8Array.from([0xab, 0xcd]));
    assert.deepEqual(decode([0xd4, 0x05, 0x09]), { type: 5, data: Uint8Array.from([0x09]) });
    assert.deepEqual(decode([0xc7, 0x02, 0xff, 0x01, 0x02]), { type: -1, data: Uint8Array.from([0x01, 0x02]) });
});

test("arrays and maps, nested", () => {
    assert.deepEqual(decode([0x92, 0x01, 0xa1, ...text("a")]), [1, "a"]);
    assert.deepEqual(decode([0xdc, 0x00, 0x02, 0xc3, 0xc0]), [true, null]);
    const bytes = [0x82, 0xa5, ...text("coins"), 0x04, 0xa5, ...text("items"), 0x91, 0x81, 0xa8, ...text("quantity"), 0x0c];
    assert.deepEqual(decode(bytes), { coins: 4, items: [{ quantity: 12 }] });
});

test("end, for reading values back to back from an offset", () => {
    // protocol byte + type + payload, colyseus frame layout
    const bytes = Uint8Array.from([13, 0xaf, ...text("player.currency"), 0x81, 0xa5, ...text("coins"), 0x04]);
    const type = decodeMsgpack(bytes, 1);
    assert.equal(type.value, "player.currency");
    const payload = decodeMsgpack(bytes, type.end);
    assert.deepEqual(payload.value, { coins: 4 });
    assert.equal(payload.end, bytes.length);
});

test("works on a view into a bigger buffer", () => {
    const buffer = Uint8Array.from([0xaa, 0xaa, 0xcd, 0x01, 0x2c]);
    assert.equal(decodeMsgpack(buffer.subarray(2)).value, 300);
});

test("short or broken input throws", () => {
    assert.throws(() => decode([0xcd, 0x01]), /ran out of bytes/);
    assert.throws(() => decode([0xa5, ...text("hi")]), /ran out of bytes/);
    assert.throws(() => decode([0x92, 0x01]), /ran out of bytes/);
    assert.throws(() => decode([]), /ran out of bytes/);
    assert.throws(() => decode([0xc1]), /isn't a type/);
});

test("encoding strings and small objects", () => {
    assert.deepEqual(encodeMsgpack("hi"), [0xa2, ...text("hi")]);
    assert.deepEqual(encodeMsgpack({ a: "b" }), [0x81, 0xa1, ...text("a"), 0xa1, ...text("b")]);
    // what the hub button hands the game
    assert.equal(decode(encodeMsgpack("friend.joinRoom")), "friend.joinRoom");
    const hub = { levelId: "town-square" };
    assert.deepEqual(decode(encodeMsgpack(hub)), hub);
    assert.equal(decode(encodeMsgpack("bok choy ✿")), "bok choy ✿");
    assert.throws(() => encodeMsgpack(3), /can't encode/);
    assert.throws(() => encodeMsgpack("x".repeat(32)), /can't encode/);
});
