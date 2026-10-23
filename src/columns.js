// The column divider on wide screens: drag it or use the arrow keys, double-click for the default. Your width is remembered in this browser
import { clamp } from "./state.js";
import { wobblyLine, seedOf } from "./sketch.js";
import { SVG, SKETCH_BRANCHES } from "./outline.js";

const divider = document.getElementById("column-divider");
const SPLIT = { min: 30, max: 70, step: 2, normal: 44.4 }; // the left column, % of the page

function currentSplit() {
    return parseFloat(document.querySelector(".page").style.getPropertyValue("--split")) || SPLIT.normal;
}

function setSplit(percent, save = true) {
    const split = clamp(percent, SPLIT.min, SPLIT.max);
    document.querySelector(".page").style.setProperty("--split", split);
    divider.setAttribute("aria-valuenow", Math.round(split));
    if (save) {
        try {
            localStorage.setItem("split", split);
        } catch {
            // storage blocked: the width just lasts until the page is closed
        }
    }
}

// the line: wobbly like the tree's branches, as tall as the divider
function drawDivider() {
    const h = divider.offsetHeight;
    if (!h) return;
    const x = divider.offsetWidth / 2;
    const lines = document.createElementNS(SVG, "svg");
    lines.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(SVG, "path");
    path.setAttribute("d", wobblyLine(x, 8, x, h - 8, seedOf("column-divider"), SKETCH_BRANCHES));
    lines.append(path);
    divider.replaceChildren(lines);
}

// afterResize runs once the columns have a new width
export function mountDivider(afterResize) {
    divider.addEventListener("pointerdown", (event) => {
        divider.setPointerCapture(event.pointerId);
        document.body.classList.add("resizing");
    });
    divider.addEventListener("pointermove", (event) => {
        if (!divider.hasPointerCapture(event.pointerId)) return;
        const page = document.querySelector(".page").getBoundingClientRect();
        setSplit(((event.clientX - page.left) / page.width) * 100, false);
    });
    divider.addEventListener("lostpointercapture", () => {
        document.body.classList.remove("resizing");
        setSplit(currentSplit()); // save where you let go
        afterResize();
    });
    divider.addEventListener("keydown", (event) => {
        const step = { ArrowLeft: -SPLIT.step, ArrowRight: SPLIT.step }[event.key];
        if (!step) return;
        event.preventDefault();
        setSplit(currentSplit() + step);
        afterResize();
    });
    divider.addEventListener("dblclick", () => {
        document.querySelector(".page").style.removeProperty("--split");
        divider.setAttribute("aria-valuenow", Math.round(SPLIT.normal));
        try {
            localStorage.removeItem("split");
        } catch {
            // nothing saved to remove
        }
        afterResize();
    });
    new ResizeObserver(drawDivider).observe(divider);
    try {
        const saved = parseFloat(localStorage.getItem("split"));
        setSplit(Number.isFinite(saved) ? saved : SPLIT.normal, false);
    } catch {
        setSplit(SPLIT.normal, false);
    }
}
