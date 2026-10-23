// island / hub and goal buttons under terra's map

import { LEVEL_KEY, HUB_LEVEL } from "./endpoints.js";
import { cssModule, watchPage } from "./page.js";

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

let redrawHud = null; // from watchPage
let pickGoal = null;
let onFarm = false;

// onPickGoal opens terra's tree
export function mountHud(onPickGoal) {
    if (redrawHud) return;
    pickGoal = onPickGoal;
    const style = document.createElement("style");
    style.textContent = HUD_CSS;
    document.head.append(style);
    redrawHud = watchPage(fillHud);
    // map size is in vmin, a resize moves it without touching the DOM
    window.addEventListener("resize", () => redrawHud());
    redrawHud();
}

export function drawHud(onOwnFarm) {
    onFarm = onOwnFarm;
    redrawHud?.();
}

function fillHud() {
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
    const [text, title] = onFarm ? ["Hub", "Go to the hub (reloads)"] : ["Island", "Go to your island"];
    if (travel.textContent !== text) {
        travel.textContent = text;
        travel.title = title;
    }
}

function makeHud() {
    const hud = document.createElement("div");
    hud.id = HUD;
    // game walks you to wherever you click
    for (const type of ["pointerdown", "mousedown", "touchstart", "click"]) {
        hud.addEventListener(type, (event) => {
            event.stopPropagation();
            if (type === "mousedown") event.preventDefault(); // no focus, a focused one clicked again on space
        });
    }
    const button = (go) => {
        const b = document.createElement("button");
        b.type = "button";
        b.addEventListener("click", go);
        return b;
    };
    const goal = button(() => pickGoal());
    goal.textContent = "Goal";
    goal.title = "Pick your goal";
    hud.append(button(() => (onFarm ? goToHub() : goToIsland())), goal);
    document.body.append(hud);
    return hud;
}

// same event as friends list "visit their farm", no user = my own
function goToIsland() {
    window.dispatchEvent(new CustomEvent("visit_farm"));
}

// the dock is the only way to the hub and nothing outside the game can walk you there. a load joins the last saved level tho
function goToHub() {
    localStorage.setItem(LEVEL_KEY, HUB_LEVEL);
    location.reload(); // lands at hub spawn, nowhere near the dock
}
