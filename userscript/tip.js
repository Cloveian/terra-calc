// the maths behind a number on hover. TeX -> MathML by temml, off jsdelivr the first time a tip opens (chrome draws MathML itself, no css or fonts)
import { addStyle } from "./page.js";
import { perHour } from "../src/farm.js";

const TEMML = "https://cdn.jsdelivr.net/npm/temml@0.14.0/dist/temml.mjs"; // ~210 KB, MIT
const TIP = "terra-calc-tip";
// terra's tooltip look, theirs is in its own chunk so it isnt always loaded. left of the thing, the card hugs the right edge
const TIP_CSS = `.${TIP} { position: fixed; z-index: 99999; pointer-events: none; transform: translate(-100%, -50%); margin-left: -8px;
  display: flex; flex-direction: column; align-items: center; gap: .5em; width: max-content;
  background: #462114; color: #f9e6ce; border: 3px solid #93582c; border-radius: .6em; padding: .6em 1em; box-shadow: 2px 2px #1d0c00;
  font: 15px/1.2 var(--game-font, "Pleasurize", cursive) }
.${TIP}[hidden] { display: none }
.${TIP} math { font-size: 1.15em }`;

const lines = new WeakMap(); // node -> its TeX, general first then my numbers in it
let temml = null; // the import, once
let tip = null;
let over = null; // node under the mouse

// sets or swaps the TeX on node, listeners only the first time
export function texTip(node, tex) {
    if (!lines.has(node)) {
        node.addEventListener("mouseenter", () => show(node));
        node.addEventListener("mouseleave", hide);
    }
    lines.set(node, tex);
}

async function show(node) {
    over = node;
    temml ??= import(TEMML);
    let lib;
    try {
        lib = (await temml).default;
    } catch (err) {
        console.warn("[terra-calc] couldn't load temml for the maths tips", err);
        temml = null; // next hover tries again
        return;
    }
    // left before it loaded
    if (over !== node) return;
    if (!tip) {
        addStyle(TIP_CSS);
        tip = document.createElement("div");
        tip.className = TIP;
        document.body.append(tip);
        // the card redraws its lines while one's hovered, the old one never gets a mouseleave
        document.addEventListener("mouseover", (event) => {
            if (over && !over.contains(event.target)) hide();
        }, true);
    }
    // temml only makes MathML, \text{} gets escaped. seed names come from the game
    tip.innerHTML = lines.get(node).map((tex) => lib.renderToString(tex, { throwOnError: false })).join("");
    const rect = node.getBoundingClientRect();
    tip.style.left = `${rect.left}px`;
    tip.style.top = `${rect.top + rect.height / 2}px`;
    tip.hidden = false;
}

function hide() {
    over = null;
    if (tip) tip.hidden = true;
}

// 2 decimals at most, 1/3 -> 0.33
export function num(x) {
    return String(Math.round(x * 100) / 100);
}

// coins a water after the seed, v_{\text{eggplant}} = \frac{1.1 \cdot 75 - 15}{2} = 33.75
export function perHourTex(name, crop, m) {
    return `v_{\\text{${name}}} = \\frac{${num(m)} \\cdot ${crop.sell} - ${crop.buy}}{${crop.water}} = ${num(perHour(crop, m))}`;
}

export const PER_HOUR_TEX = "v = \\frac{m \\cdot \\text{sell} - \\text{buy}}{\\text{water}}";
