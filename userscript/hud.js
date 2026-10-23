// island / hub and goal buttons under terra's map

import { IN, HUB_LEVEL, HUB_SPAWN } from "./endpoints.js";
import { tellGame } from "./socket.js";
import { cssModule, ourBit, keepFromGame, POINTER } from "./page.js";

const HUD = "terra-calc-hud";
// looks like the touch controls round key. terras map n bag are pixel art, ours get a word till theres art
const HUD_CSS = `#${HUD} { position: fixed; z-index: 50; display: flex; flex-direction: column; align-items: center; gap: 0.5em; transform: translateX(-50%) }
#${HUD} button { width: var(--size); height: var(--size); padding: 0; cursor: pointer;
  font: inherit; font-size: calc(var(--size) * 0.24); font-weight: bold;
  color: #462114; background: #f4ca95; border: 3px solid #93582c; border-radius: 50%; box-shadow: 0 3px #46211459 }
#${HUD} button:hover { background: #f9e6ce }
#${HUD} button:active { transform: translateY(2px); box-shadow: 0 1px #46211459 }`;

// px, map button on a phone. any smaller n the words dont fit
const MIN_SIZE = 44;

const hudBit = ourBit(fillHud);
let pickGoal = null;

// onPickGoal opens terra's tree
export function mountHud(onPickGoal) {
    pickGoal = onPickGoal;
    if (!hudBit.mount(HUD_CSS)) return;
    // map size is in vmin, a resize moves it without touching the DOM
    window.addEventListener("resize", hudBit.redraw);
    hudBit.redraw();
}

export function drawHud(onOwnFarm) {
    hudBit.draw(onOwnFarm);
}

function fillHud(onFarm) {
    const c = cssModule("mapButton", "mapIcon");
    const map = c && document.querySelector(`.${c.mapButton}`);
    const ours = document.getElementById(HUD);
    // still loading, or the game hid its hud
    if (!map) return ours?.remove();
    const hud = ours ?? makeHud();
    // centred under the map, same .5rem gap terra leaves between bag n map. sized every draw, its smaller on phones
    // offsetTop cuz getBoundingClientRect grows with the map on hover and ours jumped with it
    const size = Math.max(MIN_SIZE, 0.75 * map.offsetWidth);
    const place = `top: calc(${map.offsetTop + map.offsetHeight}px + 0.5rem); left: ${map.offsetLeft + map.offsetWidth / 2}px; --size: ${size}px;`;
    if (hud.style.cssText !== place) hud.style.cssText = place;
    const travel = hud.firstChild;
    const [text, title, go] = onFarm ? ["Hub", "Go to the hub", goToHub] : ["Island", "Go to your island", goToIsland];
    if (travel.textContent !== text) {
        travel.textContent = text;
        travel.title = title;
        travel.onclick = go;
    }
}

function makeHud() {
    const hud = document.createElement("div");
    hud.id = HUD;
    keepFromGame(hud, POINTER);
    // no focus, a focused one clicked again on space
    hud.addEventListener("mousedown", (event) => event.preventDefault());
    const button = () => {
        const b = document.createElement("button");
        b.type = "button";
        return b;
    };
    const goal = button();
    goal.textContent = "Goal";
    goal.title = "Pick your goal";
    goal.onclick = () => pickGoal();
    // travel one gets its words n click in fillHud
    hud.append(button(), goal);
    document.body.append(hud);
    return hud;
}

// same event as friends list "visit their farm", no user = my own
function goToIsland() {
    window.dispatchEvent(new CustomEvent("visit_farm"));
}

// game only goes to the hub off the dock, but it travels wherever a server redirect says. so it gets a fake one, same trip as the dock
function goToHub() {
    tellGame(IN.redirect, { levelId: HUB_LEVEL, spawnTag: HUB_SPAWN });
}
