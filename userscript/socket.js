// game websocket reader
import { GAME_HOST, CHECKS } from "./endpoints.js";
import { decodeMsgpack } from "./msgpack.js";
import { decoderFromJoin } from "./schema.js";
import { debug, debugOn, hex } from "./debug.js";

// colyseus protocol codes read here, rest skipped (leave, errors, raw bytes)
const JOIN_ROOM = 10;
const ROOM_DATA = 13;
const ROOM_STATE = 14;
const ROOM_STATE_PATCH = 15;

// made up types for room state, handled like real game messages
export const ROOM = {
    joined: "room.joined", // { sessionId }, new room, always before its state + joinComplete
    state: "room.state", // { state, touched, sessionId } after every state or patch
    broken: "room.broken", // { sessionId }, undecodable frame, state gone till next room
};

const handlers = new Map(); // message type -> [fn]
let gameSocket = null;

export function onGameMessage(type, fn) {
    if (!handlers.has(type)) handlers.set(type, []);
    handlers.get(type).push(fn);
}

// one session only on terra, second connection kicked game off (sessionConflict / forceTakeover). window.WebSocket swapped for wrapper keeping the game socket to game.terra.hackclub.com. needs document-start or game is already connected
export function hookWebSocket() {
    const Real = window.WebSocket;
    window.WebSocket = function (url, protocols) {
        const ws = new Real(url, protocols);
        if (String(url).includes(GAME_HOST)) {
            gameSocket = ws;
            debug("socket opening", String(url).replace(/\?.*/, "?...")); // query has session + reconnection token
            ws.addEventListener("open", () => debug("socket open"));
            ws.addEventListener("close", (event) => debug("socket closed", event.code, event.reason));
            const sessionId = new URL(String(url)).searchParams.get("sessionId");
            // state decoder for this socket, null till join frame (or no handshake, or broke)
            let room = null;
            ws.addEventListener("message", (event) => {
                const msg = decodeFrame(event.data);
                logFrame("in", event.data, msg);
                if (msg) dispatch(msg.type, msg.payload);
                else room = roomFrame(room, asBytes(event.data), sessionId);
            });
            // log only, sent untouched
            const send = ws.send;
            ws.send = function (data) {
                logFrame("out", data, decodeFrame(data));
                return send.call(this, data);
            };
        }
        return ws;
    };
    // for instanceof and WebSocket.OPEN etc in game code
    window.WebSocket.prototype = Real.prototype;
    Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
}

// JOIN_ROOM starts room decoder (schema.js), full state + patches go through it out as ROOM.state. undecodable frame = state dropped till next join (next room)
function roomFrame(room, bytes, sessionId) {
    if (!bytes) return room;
    try {
        if (bytes[0] === JOIN_ROOM) {
            room = decoderFromJoin(bytes);
            debug("room joined", room ? `${room.types.size} types` : "no handshake");
            dispatch(ROOM.joined, { sessionId });
        } else if ((bytes[0] === ROOM_STATE || bytes[0] === ROOM_STATE_PATCH) && room) {
            const touched = room.apply(bytes, 1);
            dispatch(ROOM.state, { state: room.root, touched, sessionId });
        }
        return room;
    } catch (err) {
        debug("room state didn't decode, ignoring it till the next room", err);
        dispatch(ROOM.broken, { sessionId });
        return null;
    }
}

// both ways when debug is on. state patches arent msgpack, hex for those
function logFrame(way, data, msg) {
    if (!debugOn()) return;
    if (msg) return debug(`${way} ${msg.type}`, msg.payload);
    const bytes = asBytes(data);
    if (bytes) debug(`${way} protocol ${bytes[0]}`, hex(bytes));
    else debug(`${way} text`, data);
}

function dispatch(type, payload) {
    const problems = CHECKS[type]?.(payload) ?? [];
    if (problems.length > 0) debug(`${type} looks different`, problems);
    for (const fn of handlers.get(type) ?? []) {
        try {
            fn(payload);
        } catch (err) {
            console.warn("[terra-calc]", type, err); // one broken handler shouldnt take down the others
        }
    }
}

// message frames only (ROOM_DATA byte then type and payload, both msgpack), null for anything else or bad decodes
export function decodeFrame(data) {
    const bytes = asBytes(data);
    if (!bytes || bytes[0] !== ROOM_DATA) return null;
    try {
        const head = decodeMsgpack(bytes, 1);
        const payload = head.end < bytes.length ? decodeMsgpack(bytes, head.end).value : undefined;
        return { type: head.value, payload };
    } catch {
        return null;
    }
}

// frame as Uint8Array, null for text. incoming is ArrayBuffer (colyseus binaryType), outgoing usually Uint8Array
function asBytes(data) {
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    return null;
}

// TODO: send(type, payload) through gameSocket for shortcut buttons (shop.purchase etc). needs encode side of decodeFrame(), reading first
export function gameConnected() {
    return gameSocket !== null && gameSocket.readyState === 1;
}
