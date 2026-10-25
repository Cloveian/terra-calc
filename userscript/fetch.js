// the games own fetch calls, wrapped at document-start like the socket
import { API_BASE, REST } from "./endpoints.js";
import { spawnTagged } from "./travel.js";

// colyseus grabs window.fetch on its first matchmake n keeps it, so this has to be in before that
// onUpgrades once a buy, refund or device pick of the games comes back ok
export function hookFetch(onUpgrades) {
    const realFetch = window.fetch;
    window.fetch = function (input, init) {
        const url = input?.url ?? String(input);
        const body = spawnTagged(url, init?.body);
        const sent = realFetch.call(this, input, body === null ? init : { ...init, body });
        // a failed one is the games to show
        if (upgradeChange(url, init?.method ?? input?.method)) sent.then((res) => res.ok && onUpgrades(), () => {});
        return sent;
    };
}

// anything but a GET under /device-upgrades/, the trees themselves are /device-upgrades
export function upgradeChange(url, method = "GET") {
    return url.startsWith(`${API_BASE}${REST.deviceUpgrades}/`) && method.toUpperCase() !== "GET";
}
