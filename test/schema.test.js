import { test } from "node:test";
import assert from "node:assert/strict";
import { decoderFromJoin } from "../userscript/schema.js";

// tiny test-only encoder, little endian like colyseus. the decoder passed real HAR captures, these are the cases one by one
function num(n) {
    if (Number.isInteger(n) && n >= 0 && n < 0x80) return [n];
    if (Number.isInteger(n) && n < 0 && n >= -32) return [0x100 + n];
    if (Number.isInteger(n) && n >= 0 && n <= 0xffff) return [0xcd, n & 0xff, n >> 8];
    const bytes = new Uint8Array(8);
    new DataView(bytes.buffer).setFloat64(0, n, true);
    return [0xcb, ...bytes];
}
function str(s) {
    const bytes = [...new TextEncoder().encode(s)];
    return bytes.length < 32 ? [0xa0 | bytes.length, ...bytes] : [0xd9, bytes.length, ...bytes];
}
const SWITCH = (refId) => [0xff, ...num(refId)];
const ADD = 0x80;

// types: [{ id, extendsId?, fields: [[name, type, referencedType?]] }] -> handshake bytes, same as colyseus Reflection encodes
function handshake(types, rootType) {
    let next = 1;
    const out = [ADD | 0, ...num(next), ADD | 1, ...num(rootType)];
    const typesRef = next++;
    const typeRefs = types.map(() => next++);
    out.push(...SWITCH(typesRef), ...typeRefs.flatMap((ref, i) => [ADD, ...num(i), ...num(ref)]));
    types.forEach((type, i) => {
        const fieldsRef = next++;
        out.push(...SWITCH(typeRefs[i]), ADD | 0, ...num(type.id));
        if (type.extendsId !== undefined) out.push(ADD | 1, ...num(type.extendsId));
        out.push(ADD | 2, ...num(fieldsRef));
        const fieldRefs = type.fields.map(() => next++);
        out.push(...SWITCH(fieldsRef), ...fieldRefs.flatMap((ref, j) => [ADD, ...num(j), ...num(ref)]));
        type.fields.forEach(([name, kind, referencedType], j) => {
            out.push(...SWITCH(fieldRefs[j]), ADD | 0, ...str(name), ADD | 1, ...str(kind));
            if (referencedType !== undefined) out.push(ADD | 2, ...num(referencedType));
        });
    });
    return out;
}

function join(types, rootType, { length = true } = {}) {
    const body = handshake(types, rootType);
    const text = (s) => [s.length, ...new TextEncoder().encode(s)]; // length byte then text (JOIN_ROOM style)
    return Uint8Array.from([10, ...text("tok"), ...text("schema"), ...(length ? num(body.length) : []), ...body]);
}

const apply = (decoder, ...ops) => decoder.apply(Uint8Array.from(ops.flat()));

// farm shaped like terra's: root { levelId, farmItems: map<Item>, tags: array:string, list: array<Item> }, Item { id, n, ok, w: uint16 }, Crop extends Item { stage }
const TYPES = [
    { id: 0, fields: [["levelId", "string"], ["farmItems", "map", 1], ["tags", "array:string"], ["list", "array", 1]] },
    { id: 1, fields: [["id", "string"], ["n", "number"], ["ok", "boolean"], ["w", "uint16"]] },
    { id: 2, extendsId: 1, fields: [["stage", "string"]] },
];

test("the handshake gives the types, with parents' fields first", () => {
    const decoder = decoderFromJoin(join(TYPES, 0));
    assert.deepEqual(decoder.types.get(1).fields.map((f) => f.name), ["id", "n", "ok", "w"]);
    assert.deepEqual(decoder.fieldsOf(2).map((f) => f.name), ["id", "n", "ok", "w", "stage"]);
    assert.equal(decoder.types.get(0).fields[1].ref, 1);
});

test("the handshake without a length in front still reads", () => {
    const decoder = decoderFromJoin(join(TYPES, 0, { length: false }));
    assert.deepEqual(decoder.fieldsOf(2).map((f) => f.name), ["id", "n", "ok", "w", "stage"]);
});

test("not a join, or no handshake -> null", () => {
    assert.equal(decoderFromJoin(Uint8Array.from([13, 0x00])), null);
    assert.equal(decoderFromJoin(Uint8Array.from([10, 0, 6, ...new TextEncoder().encode("schema")])), null);
    assert.equal(decoderFromJoin(Uint8Array.from([10, 0, 4, ...new TextEncoder().encode("none"), 0x80])), null);
});

// root levelId, farmItems -> ref 1 with two items (refs 2, 3) filled in
function fullState(decoder) {
    return apply(decoder,
        [ADD | 0, ...str("farm-island"), ADD | 1, ...num(1)],
        SWITCH(1), [ADD, ...num(0), ...str("a"), ...num(2)], [ADD, ...num(1), ...str("b"), ...num(3)],
        SWITCH(2), [ADD | 0, ...str("plot-1"), ADD | 1, ...num(1791506915755), ADD | 2, 1, ADD | 3, 0x34, 0x12],
        SWITCH(3), [ADD | 0, ...str("plot-2"), ADD | 1, ...num(-3), ADD | 2, 0],
    );
}

test("a full state: strings, numbers (float64 too), booleans, raw uint16, a map of schemas", () => {
    const decoder = decoderFromJoin(join(TYPES, 0));
    fullState(decoder);
    const root = decoder.root;
    assert.equal(root.levelId, "farm-island");
    assert.ok(root.farmItems instanceof Map);
    assert.deepEqual([...root.farmItems.keys()], ["a", "b"]);
    assert.deepEqual(root.farmItems.get("a"), { id: "plot-1", n: 1791506915755, ok: true, w: 0x1234 });
    assert.deepEqual(root.farmItems.get("b"), { id: "plot-2", n: -3, ok: false });
});

test("fields for a ref can come in more than one block", () => {
    const decoder = decoderFromJoin(join(TYPES, 0));
    fullState(decoder);
    apply(decoder, SWITCH(3), [ADD | 3, 0x01, 0x00], SWITCH(0), [ADD | 0, ...str("town-square")], SWITCH(3), [ADD | 1, ...num(5)]);
    assert.deepEqual(decoder.root.farmItems.get("b"), { id: "plot-2", n: 5, ok: false, w: 1 });
    assert.equal(decoder.root.levelId, "town-square");
});

test("patches: replace, delete a field, delete and clear a map by index", () => {
    const decoder = decoderFromJoin(join(TYPES, 0));
    fullState(decoder);
    apply(decoder, SWITCH(2), [0x00 | 1, ...num(7), 0x40 | 3]);
    assert.deepEqual(decoder.root.farmItems.get("a"), { id: "plot-1", n: 7, ok: true });
    apply(decoder, SWITCH(1), [0x40, ...num(0)]); // DELETE index 0, key from the ADD
    assert.deepEqual([...decoder.root.farmItems.keys()], ["b"]);
    apply(decoder, SWITCH(1), [10]);
    assert.equal(decoder.root.farmItems.size, 0);
});

test("a map entry added again reuses its index for the key", () => {
    const decoder = decoderFromJoin(join(TYPES, 0));
    fullState(decoder);
    apply(decoder, SWITCH(1), [0x40, ...num(1)], [ADD, ...num(1), ...str("c"), ...num(4)], SWITCH(4), [ADD | 0, ...str("plot-3")]);
    assert.deepEqual([...decoder.root.farmItems.keys()], ["a", "c"]);
    assert.equal(decoder.root.farmItems.get("c").id, "plot-3");
});

test("a subclass child comes with its type id first", () => {
    const decoder = decoderFromJoin(join(TYPES, 0));
    fullState(decoder);
    apply(decoder, SWITCH(1), [ADD, ...num(2), ...str("crop"), ...num(5), 0xd5, ...num(2)], SWITCH(5), [ADD | 0, ...str("c-1"), ADD | 4, ...str("review")]);
    assert.deepEqual(decoder.root.farmItems.get("crop"), { id: "c-1", stage: "review" });
});

test("arrays: primitives, schemas, delete closes the gap, clear, reverse, by refId", () => {
    const decoder = decoderFromJoin(join(TYPES, 0));
    apply(decoder, [ADD | 2, ...num(1), ADD | 3, ...num(2)], SWITCH(1), [ADD, 0, ...str("x"), ADD, 1, ...str("y"), ADD, 2, ...str("z")]);
    const tags = decoder.root.tags;
    assert.deepEqual(tags, ["x", "y", "z"]);
    apply(decoder, SWITCH(1), [0x40, 1]);
    assert.equal(decoder.root.tags, tags, "same array as before");
    assert.deepEqual(tags, ["x", "z"]);
    apply(decoder, SWITCH(1), [15]);
    assert.deepEqual(tags, ["z", "x"]);
    apply(decoder, SWITCH(1), [10]);
    assert.deepEqual(tags, []);
    apply(decoder, SWITCH(2), [ADD, 0, ...num(3), ADD, 1, ...num(4)], SWITCH(3), [ADD | 0, ...str("p")], SWITCH(4), [ADD | 0, ...str("q")]);
    assert.deepEqual(decoder.root.list.map((item) => item.id), ["p", "q"]);
    apply(decoder, SWITCH(2), [33, ...num(3)]); // DELETE_BY_REFID
    assert.deepEqual(decoder.root.list.map((item) => item.id), ["q"]);
    apply(decoder, SWITCH(2), [129, ...num(4), ...num(4)]); // ADD_BY_REFID, already there so stays put
    assert.deepEqual(decoder.root.list.map((item) => item.id), ["q"]);
});

test("apply says what it touched, the map for adds, the item for its own fields", () => {
    const decoder = decoderFromJoin(join(TYPES, 0));
    fullState(decoder);
    const farm = decoder.root.farmItems;
    const touched = apply(decoder, SWITCH(3), [0x00 | 1, ...num(9)]);
    assert.ok(touched.has(farm.get("b")));
    assert.ok(!touched.has(farm));
    assert.ok(!touched.has(decoder.root));
    assert.ok(apply(decoder, SWITCH(1), [0x40, ...num(0)]).has(farm));
});

test("things it doesn't know throw", () => {
    const decoder = decoderFromJoin(join(TYPES, 0));
    assert.throws(() => apply(decoder, SWITCH(42)), /no ref 42/);
    assert.throws(() => apply(decoder, [ADD | 9, 0]), /no field 9/);
    assert.throws(() => apply(decoder, [ADD | 0, 0x07]), /isn't a string/);
    assert.throws(() => apply(decoder, [ADD | 0]), /ran out of bytes/);
    fullState(decoder);
    assert.throws(() => apply(decoder, SWITCH(1), [160, 0]), /map op 160/);
    assert.throws(() => apply(decoder, [ADD | 3, ...num(9)], SWITCH(9), [96, 0]), /array op 96/);
});
