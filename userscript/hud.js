// island / hub and goal buttons, bottom of terra's button column or next to the water meter

import { IN, HUB_LEVEL, HUB_SPAWN } from "./endpoints.js";
import { armSpawnTag } from "./travel.js";
import { tellGame } from "./socket.js";
import { cssModule, ourBit, keepFromGame, POINTER } from "./page.js";

const HUD = "terra-calc-hud";
// looks like the touch controls round key. terras buttons are drawn, ours get a word till theres art
// one slot each like terras: --pad fills the circle out to their button size, gap is their .5rem. shadow n hover scale off their .mapButton
const HUD_CSS = `#${HUD} { position: fixed; z-index: 50; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; transform: translateX(-50%) }
#${HUD} button { width: var(--size); height: var(--size); margin: var(--pad); padding: 0; cursor: pointer;
  font: inherit; font-size: calc(var(--size) * 0.24); font-weight: bold;
  color: #462114; background: #f4ca95; border: 3px solid #93582c; border-radius: 50%;
  filter: drop-shadow(2px 3px #00000040); transition: transform .2s }
#${HUD} button:hover { transform: scale(1.1) }
#${HUD} button:active { transform: scale(.95) }
#${HUD}.beside { flex-direction: row; transform: none }
#${HUD}.beside button { margin: 0 }`;

// px, map button on a phone. any smaller n the words dont fit
const MIN_SIZE = 44;

const hudBit = ourBit(fillHud);
let pickGoal = null;

// onPickGoal opens terra's tree
export function mountHud(onPickGoal) {
    pickGoal = onPickGoal;
    if (!hudBit.mount(HUD_CSS)) return;
    // terra's column is sized in vmin, a resize moves it without touching the DOM
    window.addEventListener("resize", hudBit.redraw);
    hudBit.redraw();
}

export function drawHud(onOwnFarm) {
    hudBit.draw(onOwnFarm);
}

function fillHud(onFarm) {
    const c = cssModule("mapButton", "mapIcon");
    const ours = document.getElementById(HUD);
    // calendar, map, quests, help... each fixed in its own .stacked* slot, so ours go under the lowest one
    let lowest = null;
    for (const b of c ? document.querySelectorAll(`.${c.mapButton}`) : []) {
        if (!lowest || b.offsetTop > lowest.offsetTop) lowest = b;
    }
    // still loading, or the game hid its hud
    if (!lowest) return ours?.remove();
    const hud = ours ?? makeHud();
    // sized every draw, its smaller on phones
    // offsetTop cuz getBoundingClientRect grows with terras button on hover and ours jumped with it
    const slot = lowest.offsetWidth;
    const size = Math.max(MIN_SIZE, 0.75 * slot);
    const pad = Math.max(0, (slot - size) / 2);
    const box = size + 2 * pad;
    const gap = parseFloat(getComputedStyle(document.documentElement).fontSize) / 2; // .5rem
    const top = lowest.offsetTop + lowest.offsetHeight + gap;
    // short screens: a row right of terra's water meter (bottom left), bottoms lined up
    const meter = document.querySelector('[data-hud="water-meter"]');
    const beside = meter !== null && top + 2 * box + gap > meter.offsetTop - gap;
    hud.classList.toggle("beside", beside);
    // no slots to match in the row, so no pad either
    const y = beside ? meter.offsetTop + meter.offsetHeight - size : top;
    const x = beside ? meter.offsetLeft + meter.offsetWidth + gap : lowest.offsetLeft + slot / 2;
    const place = `top: ${y}px; left: ${x}px; --size: ${size}px; --pad: ${pad}px;`;
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

// game only goes to the hub off the dock, so it gets a fake "your friend is there" n its matchmake gets the dock's spawn tag
function goToHub() {
    armSpawnTag(HUB_LEVEL, HUB_SPAWN);
    tellGame(IN.friendRoom, { levelId: HUB_LEVEL });
}
