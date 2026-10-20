// console logging of everything, off unless debug setting

const STYLE = "color: #6a9a3a; font-weight: bold";
let enabled = false;

export function setDebug(on) {
    enabled = on;
}

// skip log-only work (hex dumps)
export function debugOn() {
    return enabled;
}

export function debug(label, ...data) {
    if (enabled) console.log(`%c[terra-calc]%c ${label}`, STYLE, "", ...data);
}

// hex dump for non-msgpack frames
export function hex(bytes, max = 64) {
    const shown = [...bytes.subarray(0, max)].map((b) => b.toString(16).padStart(2, "0")).join(" ");
    return bytes.length > max ? `${shown} ... (${bytes.length} bytes)` : shown;
}
