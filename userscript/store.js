// everything we keep in terra's localStorage

export function loadJSON(key) {
    let text;
    try {
        text = localStorage.getItem(key);
    } catch {
        return null; // blocked (private windows), nothing kept
    }
    try {
        return JSON.parse(text);
    } catch (err) {
        console.warn("[terra-calc] can't read saved", key, err);
        return null;
    }
}

export function saveJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // blocked
    }
}
