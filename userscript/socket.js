// game websocket reader
import { GAME_HOST } from "./endpoints.js";
import { decodeMsgpack } from "./msgpack.js";

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
            ws.addEventListener("message", (event) => {
                const msg = decodeFrame(event.data);
                if (msg) dispatch(msg.type, msg.payload);
            });
        }
        return ws;
    };
    // for instanceof and WebSocket.OPEN etc in game code
    window.WebSocket.prototype = Real.prototype;
    Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
}

function dispatch(type, payload) {
    for (const fn of handlers.get(type) ?? []) {
        try {
            fn(payload);
        } catch (err) {
            console.warn("[terra-calc]", type, err); // one broken handler shouldnt take down the others
        }
    }
}

const ROOM_DATA = 13; // colyseus code for a message, state patches etc skipped

// message frames only (ROOM_DATA byte then type and payload, both msgpack), null for anything else or bad decodes
// TODO: check against chrome capture with WS messages (firefox doesnt save them in HARs). framing off = try game room.onMessage
export function decodeFrame(data) {
    if (!(data instanceof ArrayBuffer)) return null; // colyseus sets binaryType = "arraybuffer"
    const bytes = new Uint8Array(data);
    if (bytes[0] !== ROOM_DATA) return null;
    try {
        const head = decodeMsgpack(bytes, 1);
        const payload = head.end < bytes.length ? decodeMsgpack(bytes, head.end).value : undefined;
        return { type: head.value, payload };
    } catch {
        return null;
    }
}

// TODO: send(type, payload) through gameSocket for shortcut buttons (shop.purchase etc). needs encode side of decodeFrame(), reading first
export function gameConnected() {
    return gameSocket !== null && gameSocket.readyState === 1;
}
