// game websocket reader
import { GAME_HOST } from "./endpoints.js";

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
                const msg = decode(event.data);
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

// TODO: decode colyseus frames: protocol byte (ROOM_DATA = 13), message type (string or number), msgpack payload. needs small msgpack decoder checked against chrome capture with WS messages (firefox doesnt save them in HARs). game room.onMessage would skip decoding but means finding the room object
function decode(data) {
    return null;
}

// TODO: send(type, payload) through gameSocket for shortcut buttons (shop.purchase etc). needs encode side of decode(), reading first
export function gameConnected() {
    return gameSocket !== null && gameSocket.readyState === 1;
}
