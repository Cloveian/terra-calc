// the maths behind a number, on a little i. TeX -> MathML by temml, off jsdelivr the first time a tip opens (chrome draws MathML itself)
import { addStyle } from "./page.js";
import { perHour } from "../src/farm.js";

const TEMML = "https://cdn.jsdelivr.net/npm/temml@0.14.0/dist/temml.mjs"; // ~210 KB, MIT
const TIP = "terra-calc-tip";
const ICON = "terra-calc-tex";
// terra's tooltip look (Tooltip css, its own chunk so it isnt always loaded). left of the icon, the card hugs the right edge
// chrome draws MathML in its own serif, game font instead
const TIP_CSS = `.${TIP} { position: fixed; z-index: 99999; pointer-events: none; transform: translate(-100%, -50%); margin-left: -8px;
  display: flex; flex-direction: column; align-items: center; gap: .5em; width: max-content;
  background: #462114; color: #f9e6ce; border: 3px solid #93582c; border-radius: .6em; padding: .65em 1em; box-shadow: 2px 2px #1d0c00;
  font: 18px/1.2 var(--game-font, "Pleasurize", cursive) }
.${TIP}[hidden] { display: none }
.${TIP} math, .${TIP} math * { font-family: var(--game-font, "Pleasurize", cursive) }
/* small cream i like the card's ?, grows on hover like terra's buttons */
.${ICON} { display: inline-grid; place-items: center; box-sizing: border-box; width: 1.2em; height: 1.2em; margin-left: .35em; vertical-align: -.2em;
  border-radius: 50%; background: #f9e6ce; border: 1.5px solid #93582c; color: #93582c; font: 700 .8em/1 var(--game-font, "Pleasurize", cursive);
  cursor: help; transition: transform .15s }
.${ICON}:hover { transform: scale(1.15) }`;

const lines = new WeakMap(); // icon -> its TeX, general first then my numbers in it
let styled = false;
let temml = null; // the import, once
let tip = null;
let over = null; // icon under the mouse

// a little i that shows the maths on hover. give it the icon from last time to just swap the TeX
export function texIcon(tex, icon = null) {
    if (!styled) {
        addStyle(TIP_CSS);
        styled = true;
    }
    if (!icon) {
        icon = document.createElement("span");
        icon.className = ICON;
        icon.textContent = "i";
        icon.addEventListener("mouseenter", () => show(icon));
        icon.addEventListener("mouseleave", hide);
    }
    lines.set(icon, tex);
    return icon;
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
    // one letter <mi>s go math italic (U+1D434 on), pleasurize hasnt got those n they fell back to serif
    for (const mi of tip.querySelectorAll("mi:not([mathvariant])")) mi.setAttribute("mathvariant", "normal");
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
