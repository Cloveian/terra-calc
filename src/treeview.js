// Moving the tree around in its window: drag, scroll or pinch to zoom, the zoom buttons, and fitting it. The maths is in view.js
import { zoomAt, clampView, fitView } from "./view.js";

const treeView = document.getElementById("tree-view");
const canvas = document.getElementById("tree");

let view = { scale: 1, x: 0, y: 0 };
let viewDevice = null; // which device `view` belongs to
let viewMoved = false; // you've panned or zoomed since it was last fitted (then it isn't re-fitted for you)

function viewportSize() {
    return { w: treeView.clientWidth, h: treeView.clientHeight };
}

function treeSize() {
    return { w: parseFloat(canvas.style.width), h: parseFloat(canvas.style.height) };
}

// fitted to the window; if it's too wide for that, centred on the device card
function fitTree() {
    const root = canvas.querySelector(".tree-root");
    const focusX = root ? root.offsetLeft + root.offsetWidth / 2 : undefined;
    return fitView(treeSize(), viewportSize(), undefined, focusX);
}

function setView(next) {
    view = clampView(next, treeSize(), viewportSize());
    canvas.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
}

// zoom around the middle of the window (the buttons)
function zoomBy(factor) {
    viewMoved = true;
    const { w, h } = viewportSize();
    setView(zoomAt(view, factor, w / 2, h / 2));
}

// In the split view (two columns) the Goal panel doesn't scroll, so plain scrolling zooms; in one column it scrolls the page, so it takes ctrl + scroll (a trackpad pinch sends that too). Same query as in style.css.
const splitView = matchMedia("(min-width: 1200px) and (min-height: 700px)");
const pointers = new Map(); // pointers pressed on the tree: id -> { x, y }

// after the tree's drawn: a new device gets fitted, the same one stays where you had it
export function showTree(device) {
    if (viewDevice !== device) {
        viewDevice = device;
        viewMoved = false;
        setView(fitTree());
    } else {
        setView(view);
    }
}

// the window changed size: fit the tree again, or if you've moved it yourself, just keep it in view
export function refitTree() {
    setView(viewMoved ? view : fitTree());
}

export function mountTreeView() {
    treeView.addEventListener("wheel", (event) => {
        if (!event.ctrlKey && !splitView.matches) return;
        event.preventDefault(); // zoom the tree, not the whole page
        viewMoved = true;
        const box = treeView.getBoundingClientRect();
        const px = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? box.height : 1; // lines/pages -> px
        setView(zoomAt(view, Math.exp(-event.deltaY * px * 0.002), event.clientX - box.left, event.clientY - box.top));
    }, { passive: false });

    treeView.addEventListener("pointerdown", (event) => {
        if (event.target.closest("input, button, label, select")) return; // let the controls work
        treeView.setPointerCapture(event.pointerId);
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        treeView.classList.add("dragging");
    });
    treeView.addEventListener("pointermove", (event) => {
        if (!pointers.has(event.pointerId)) return;
        const before = [...pointers.values()];
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const now = [...pointers.values()];
        if (now.length === 1) {
            viewMoved = true;
            setView({ ...view, x: view.x + now[0].x - before[0].x, y: view.y + now[0].y - before[0].y });
        } else if (now.length === 2) {
            // pinch: zoom by how much the fingers spread, around their middle, and follow the middle
            const middle = ([a, b]) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
            const spread = ([a, b]) => Math.hypot(a.x - b.x, a.y - b.y) || 1;
            const box = treeView.getBoundingClientRect();
            const [m0, m1] = [middle(before), middle(now)];
            const zoomed = zoomAt(view, spread(now) / spread(before), m1.x - box.left, m1.y - box.top);
            setView({ ...zoomed, x: zoomed.x + m1.x - m0.x, y: zoomed.y + m1.y - m0.y });
        }
    });
    for (const type of ["pointerup", "pointercancel"]) {
        treeView.addEventListener(type, (event) => {
            pointers.delete(event.pointerId);
            if (pointers.size === 0) treeView.classList.remove("dragging");
        });
    }

    // Tab onto a card that's out of view: move the tree so it's in view
    treeView.addEventListener("focusin", (event) => {
        const box = treeView.getBoundingClientRect();
        const target = event.target.getBoundingClientRect();
        const pad = 24;
        let { x, y } = view;
        if (target.left < box.left + pad) x += box.left + pad - target.left;
        else if (target.right > box.right - pad) x -= target.right - (box.right - pad);
        if (target.top < box.top + pad) y += box.top + pad - target.top;
        else if (target.bottom > box.bottom - pad) y -= target.bottom - (box.bottom - pad);
        setView({ ...view, x, y });
    });

    document.getElementById("zoom-in").addEventListener("click", () => zoomBy(1.25));
    document.getElementById("zoom-out").addEventListener("click", () => zoomBy(1 / 1.25));
    document.getElementById("zoom-fit").addEventListener("click", () => setView(fitTree()));

    // the window changes size with the page too (fonts loading, text wrapping, the hint opening)
    new ResizeObserver(refitTree).observe(treeView);

    // switching between one and two columns changes the tree window's size a lot: fit the tree again
    splitView.addEventListener("change", () => setView(fitTree()));
}
