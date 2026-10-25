// msgpack for game websocket frames (decoder is the whole spec, its small)

const utf8 = new TextDecoder();
const utf8out = new TextEncoder();

// end included for reading on, colyseus frames = protocol byte + type + payload back to back. bin as Uint8Array, ext as { type, data }, 64 bit ints as plain numbers (nothing in terra past 2^53)
export function decodeMsgpack(bytes, offset = 0) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let pos = offset;

    // start of next n bytes, cursor moved past
    function take(n) {
        if (pos + n > bytes.length) throw new Error("msgpack: ran out of bytes");
        const at = pos;
        pos += n;
        return at;
    }

    function str(n) {
        const at = take(n);
        return utf8.decode(bytes.subarray(at, at + n));
    }

    function bin(n) {
        const at = take(n);
        return bytes.slice(at, at + n);
    }

    function ext(n) {
        const type = view.getInt8(take(1));
        return { type, data: bin(n) };
    }

    function array(n) {
        const out = [];
        for (let i = 0; i < n; i++) out.push(read());
        return out;
    }

    function map(n) {
        const out = {};
        for (let i = 0; i < n; i++) {
            const key = read();
            out[key] = read();
        }
        return out;
    }

    function read() {
        const b = bytes[take(1)];
        if (b <= 0x7f) return b;
        if (b <= 0x8f) return map(b & 0x0f);
        if (b <= 0x9f) return array(b & 0x0f);
        if (b <= 0xbf) return str(b & 0x1f);
        if (b >= 0xe0) return b - 0x100; // negative fixint
        switch (b) {
            case 0xc0: return null;
            case 0xc2: return false;
            case 0xc3: return true;
            case 0xc4: return bin(view.getUint8(take(1)));
            case 0xc5: return bin(view.getUint16(take(2)));
            case 0xc6: return bin(view.getUint32(take(4)));
            case 0xc7: return ext(view.getUint8(take(1)));
            case 0xc8: return ext(view.getUint16(take(2)));
            case 0xc9: return ext(view.getUint32(take(4)));
            case 0xca: return view.getFloat32(take(4));
            case 0xcb: return view.getFloat64(take(8));
            case 0xcc: return view.getUint8(take(1));
            case 0xcd: return view.getUint16(take(2));
            case 0xce: return view.getUint32(take(4));
            case 0xcf: return Number(view.getBigUint64(take(8)));
            case 0xd0: return view.getInt8(take(1));
            case 0xd1: return view.getInt16(take(2));
            case 0xd2: return view.getInt32(take(4));
            case 0xd3: return Number(view.getBigInt64(take(8)));
            case 0xd4: return ext(1);
            case 0xd5: return ext(2);
            case 0xd6: return ext(4);
            case 0xd7: return ext(8);
            case 0xd8: return ext(16);
            case 0xd9: return str(view.getUint8(take(1)));
            case 0xda: return str(view.getUint16(take(2)));
            case 0xdb: return str(view.getUint32(take(4)));
            case 0xdc: return array(view.getUint16(take(2)));
            case 0xdd: return array(view.getUint32(take(4)));
            case 0xde: return map(view.getUint16(take(2)));
            case 0xdf: return map(view.getUint32(take(4)));
        }
        throw new Error(`msgpack: 0x${b.toString(16)} isn't a type`); // only 0xc1 (never used)
    }

    const value = read();
    return { value, end: pos };
}

// for frames of ours, to the game or the server. json-ish stuff only (no bin, ext or 64 bit ints), under 64K of anything. plain byte values
export function encodeMsgpack(value) {
    if (value === null) return [0xc0];
    if (typeof value === "boolean") return [value ? 0xc3 : 0xc2];
    if (typeof value === "number") return encodeNumber(value);
    if (typeof value === "string") {
        const s = utf8out.encode(value);
        if (s.length < 32) return [0xa0 | s.length, ...s];
        if (s.length < 0x100) return [0xd9, s.length, ...s];
        if (s.length < 0x10000) return [0xda, ...bigEndian(s.length, 2, "setUint16"), ...s];
    } else if (Array.isArray(value)) {
        const items = value.flatMap(encodeMsgpack);
        if (value.length < 16) return [0x90 | value.length, ...items];
        if (value.length < 0x10000) return [0xdc, ...bigEndian(value.length, 2, "setUint16"), ...items];
    } else if (typeof value === "object") {
        const entries = Object.entries(value);
        const pairs = entries.flatMap(([k, v]) => [...encodeMsgpack(k), ...encodeMsgpack(v)]);
        if (entries.length < 16) return [0x80 | entries.length, ...pairs];
        if (entries.length < 0x10000) return [0xde, ...bigEndian(entries.length, 2, "setUint16"), ...pairs];
    }
    throw new Error(`msgpack: can't encode ${JSON.stringify(value)}`);
}

// fixint, 32 bit int or float64, any of them reads back the same
function encodeNumber(n) {
    const int = Number.isInteger(n);
    if (int && n >= -32 && n < 0x80) return [n & 0xff];
    if (int && n >= 0 && n <= 0xffffffff) return [0xce, ...bigEndian(n, 4, "setUint32")];
    if (int && n < 0 && n >= -0x80000000) return [0xd2, ...bigEndian(n, 4, "setInt32")];
    return [0xcb, ...bigEndian(n, 8, "setFloat64")];
}

function bigEndian(n, size, set) {
    const view = new DataView(new ArrayBuffer(size));
    view[set](0, n);
    return [...new Uint8Array(view.buffer)];
}
