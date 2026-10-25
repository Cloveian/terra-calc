// spawn tag on the games own matchmake, for trips our buttons start
import { GAME_HOST } from "./endpoints.js";
import { debug } from "./debug.js";

const ARMED_MS = 15000; // the trips matchmake goes out a second or two after the button
let armed = null; // { levelId, spawnTag, until }

// next matchmake into levelId gets spawnTag. a join without one the server takes as a reload n sends you back
export function armSpawnTag(levelId, spawnTag) {
    armed = { levelId, spawnTag, until: Date.now() + ARMED_MS };
}

// for fetch.js, the body to send instead or null. uses the arm up
export function spawnTagged(url, body) {
    const tagged = taggedBody(url, body, armed, Date.now());
    if (tagged === null) return null;
    debug("matchmake got a spawn tag", armed.levelId, armed.spawnTag); // body has my token in it
    armed = null;
    return tagged;
}

// the json body with the spawn tag in, null to send it as is. only a game matchmake into the armed level without a tag of its own
export function taggedBody(url, body, armed, now) {
    if (!armed || now > armed.until) return null;
    if (!url.includes(GAME_HOST) || !url.includes("/matchmake/") || typeof body !== "string") return null;
    let options;
    try {
        options = JSON.parse(body);
    } catch {
        return null;
    }
    if (options?.levelId !== armed.levelId || options.spawnTag) return null;
    return JSON.stringify({ ...options, spawnTag: armed.spawnTag });
}
