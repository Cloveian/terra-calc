// colyseus schema decoder for room state (farm)

const SWITCH_TO_STRUCTURE = 0xff;
const TYPE_ID = 0xd5; // after child refId for subclasses, then its typeId

const ADD = 128;
const DELETE = 64;
const DELETE_AND_ADD = 192;
const CLEAR = 10;
const REVERSE = 15;
const DELETE_BY_REFID = 33;
const ADD_BY_REFID = 129;

// colyseus Reflection / ReflectionType / ReflectionField, handshake encoding (handshake is schema too, same decoder reads it)
const REFLECTION_TYPES = new Map([
    [0, { fields: [{ name: "types", type: "array", ref: 1 }, { name: "rootType", type: "number" }] }],
    [1, { fields: [{ name: "id", type: "number" }, { name: "extendsId", type: "number" }, { name: "fields", type: "array", ref: 2 }] }],
    [2, { fields: [{ name: "name", type: "string" }, { name: "type", type: "string" }, { name: "referencedType", type: "number" }] }],
]);

const utf8Schema = new TextDecoder();

// byte cursor, little endian throughout
function reader(bytes, offset) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const it = { bytes, view, pos: offset };
    it.take = (n) => {
        if (it.pos + n > bytes.length) throw new Error("schema: ran out of bytes");
        const at = it.pos;
        it.pos += n;
        return at;
    };
    return it;
}

function readNumber(it) {
    const b = it.bytes[it.take(1)];
    if (b < 0x80) return b;
    if (b > 0xdf) return b - 0x100;
    switch (b) {
        case 0xca: return it.view.getFloat32(it.take(4), true);
        case 0xcb: return it.view.getFloat64(it.take(8), true);
        case 0xcc: return it.view.getUint8(it.take(1));
        case 0xcd: return it.view.getUint16(it.take(2), true);
        case 0xce: return it.view.getUint32(it.take(4), true);
        case 0xcf: return Number(it.view.getBigUint64(it.take(8), true));
        case 0xd0: return it.view.getInt8(it.take(1));
        case 0xd1: return it.view.getInt16(it.take(2), true);
        case 0xd2: return it.view.getInt32(it.take(4), true);
        case 0xd3: return Number(it.view.getBigInt64(it.take(8), true));
    }
    throw new Error(`schema: 0x${b.toString(16)} isn't a number`);
}

function readString(it) {
    const b = it.bytes[it.take(1)];
    let n;
    if ((b & 0xe0) === 0xa0) n = b & 0x1f;
    else if (b === 0xd9) n = it.view.getUint8(it.take(1));
    else if (b === 0xda) n = it.view.getUint16(it.take(2), true);
    else if (b === 0xdb) n = it.view.getUint32(it.take(4), true);
    else throw new Error(`schema: 0x${b.toString(16)} isn't a string`);
    const at = it.take(n);
    return utf8Schema.decode(it.bytes.subarray(at, at + n));
}

// fixed size ones raw, no prefix byte
const PRIMITIVES = {
    string: readString,
    number: readNumber,
    boolean: (it) => it.view.getUint8(it.take(1)) !== 0,
    int8: (it) => it.view.getInt8(it.take(1)),
    uint8: (it) => it.view.getUint8(it.take(1)),
    int16: (it) => it.view.getInt16(it.take(2), true),
    uint16: (it) => it.view.getUint16(it.take(2), true),
    int32: (it) => it.view.getInt32(it.take(4), true),
    uint32: (it) => it.view.getUint32(it.take(4), true),
    int64: (it) => Number(it.view.getBigInt64(it.take(8), true)),
    uint64: (it) => Number(it.view.getBigUint64(it.take(8), true)),
    float32: (it) => it.view.getFloat32(it.take(4), true),
    float64: (it) => it.view.getFloat64(it.take(8), true),
};

// types = Map(typeId -> { fields, extendsId }) from JOIN_ROOM handshake (reflection), own fields only. root = decoded state, objects for schemas, Maps and arrays for collections. anything unknown throws, state broken till next full one
export class SchemaDecoder {
    constructor(types, rootType) {
        this.types = types;
        this.refs = new Map([[0, this.schemaRef(rootType)]]);
    }

    get root() {
        return this.refs.get(0).value;
    }

    // root type fields from handshake
    get rootFields() {
        return this.refs.get(0).fields;
    }

    // parent fields first, child indexes continue from parent
    fieldsOf(typeId) {
        const type = this.types.get(typeId);
        if (!type) throw new Error(`schema: no type ${typeId}`);
        const parent = type.extendsId;
        return parent !== undefined && parent !== -1 && parent !== typeId
            ? [...this.fieldsOf(parent), ...type.fields]
            : type.fields;
    }

    schemaRef(typeId) {
        return { kind: "schema", fields: this.fieldsOf(typeId), value: {} };
    }

    // ROOM_STATE or ROOM_STATE_PATCH bytes past protocol byte: ops grouped by ref, 0xff <refId> switches ref (root 0). Set of touched values back, most patches are players walking around
    apply(bytes, offset = 0) {
        const it = reader(bytes, offset);
        let ref = this.refs.get(0);
        const touched = new Set();
        const deleted = new Set(); // arrays with holes, closed at end like colyseus
        while (it.pos < bytes.length) {
            if (bytes[it.pos] === SWITCH_TO_STRUCTURE) {
                it.pos++;
                const refId = readNumber(it);
                ref = this.refs.get(refId);
                if (!ref) throw new Error(`schema: no ref ${refId}`);
                continue;
            }
            if (ref.kind === "schema") this.schemaOp(ref, it);
            else if (ref.kind === "map") this.mapOp(ref, it);
            else this.arrayOp(ref, it, deleted);
            touched.add(ref.value);
        }
        // in place, parent field points at this same array
        for (const ref of deleted) ref.value.splice(0, ref.value.length, ...ref.value.filter((item) => item !== undefined));
        return touched;
    }

    // op byte: top two bits operation, low six field index, then value
    schemaOp(ref, it) {
        const b = it.bytes[it.take(1)];
        const op = b & 0xc0;
        const index = b & 0x3f;
        const field = ref.fields[index];
        if (!field) throw new Error(`schema: no field ${index}`);
        const value = this.value(op, field, it);
        if (op === DELETE) delete ref.value[field.name];
        else ref.value[field.name] = value;
    }

    // whole op byte then index, map ADD has key too
    mapOp(ref, it) {
        const op = it.bytes[it.take(1)];
        if (op === CLEAR) {
            ref.value.clear();
            ref.keys.clear();
            return;
        }
        if (op !== ADD && op !== 0 && op !== DELETE && op !== DELETE_AND_ADD) throw new Error(`schema: map op ${op}`);
        const index = readNumber(it);
        let key;
        if ((op & ADD) === ADD) {
            key = readString(it);
            ref.keys.set(index, key);
        } else {
            key = ref.keys.get(index);
        }
        const value = this.value(op, ref.child, it);
        if (op === DELETE) {
            ref.value.delete(key);
            ref.keys.delete(index);
        } else {
            ref.value.set(key, value);
        }
    }

    arrayOp(ref, it, deleted) {
        const op = it.bytes[it.take(1)];
        const items = ref.value;
        if (op === CLEAR) {
            items.length = 0;
            return;
        }
        if (op === REVERSE) {
            items.reverse();
            return;
        }
        if (op === DELETE_BY_REFID) {
            const gone = this.refs.get(readNumber(it))?.value;
            const at = items.indexOf(gone);
            if (at !== -1) items[at] = undefined;
            deleted.add(ref);
            return;
        }
        let index;
        if (op === ADD_BY_REFID) {
            // refId written twice, here and as value
            index = items.indexOf(this.refs.get(readNumber(it))?.value);
            if (index === -1) index = items.length;
        } else if (op === ADD || op === 0 || op === DELETE || op === DELETE_AND_ADD) {
            index = readNumber(it);
        } else {
            throw new Error(`schema: array op ${op}`);
        }
        const value = this.value(op, ref.child, it);
        if (op === DELETE) {
            items[index] = undefined;
            deleted.add(ref);
        } else {
            items[index] = value;
        }
    }

    // field or item value, desc = { type, ref } like reflection field. schema / collection values just refIds, numbers msgpack-ish but little endian
    value(op, desc, it) {
        if (op === DELETE) return undefined;
        const primitive = PRIMITIVES[desc.type];
        if (primitive) return primitive(it);
        const refId = readNumber(it);
        if (desc.type === "ref") {
            if ((op & ADD) === ADD) {
                let typeId = desc.ref;
                if (it.bytes[it.pos] === TYPE_ID) {
                    it.pos++;
                    typeId = readNumber(it);
                }
                if (!this.refs.has(refId)) this.refs.set(refId, this.schemaRef(typeId));
            }
            return this.refs.get(refId)?.value;
        }
        // map / array / map:string types for primitive collections
        const [kind, childType] = desc.type.split(":");
        if (kind !== "map" && kind !== "array") throw new Error(`schema: type ${desc.type}`);
        if (!this.refs.has(refId)) {
            const child = childType ? { type: childType } : { type: "ref", ref: desc.ref };
            const value = kind === "map" ? new Map() : [];
            this.refs.set(refId, kind === "map" ? { kind, child, value, keys: new Map() } : { kind, child, value });
        }
        return this.refs.get(refId).value;
    }
}

// whole JOIN_ROOM frame (protocol byte too) -> room SchemaDecoder, null without handshake. after protocol byte: reconnection token + serializer id (length byte then text each), then handshake length as a number and the handshake. older colyseus has no length, only taken when it matches
export function decoderFromJoin(bytes) {
    if (bytes[0] !== 10) return null;
    const it = reader(bytes, 1);
    it.take(bytes[it.take(1)]); // reconnection token, skipped
    const idLength = bytes[it.take(1)];
    const at = it.take(idLength);
    if (utf8Schema.decode(bytes.subarray(at, at + idLength)) !== "schema" || it.pos >= bytes.length) return null;
    const start = it.pos;
    let length = -1;
    try {
        length = readNumber(it);
    } catch {
        // no number there = no length
    }
    if (it.pos + length !== bytes.length) it.pos = start;
    const reflection = new SchemaDecoder(REFLECTION_TYPES, 0);
    reflection.apply(bytes, it.pos);
    const { types, rootType } = reflection.root;
    const byId = new Map();
    for (const type of types) {
        const fields = (type.fields ?? []).map((f) => ({ name: f.name, type: f.type, ref: f.referencedType }));
        byId.set(type.id, { fields, extendsId: type.extendsId });
    }
    return new SchemaDecoder(byId, rootType ?? 0);
}
