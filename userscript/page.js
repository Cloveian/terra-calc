// terra's real class names + one observer redrawing all our bits inside its DOM, n what those bits share

const WATCH = { childList: true, subtree: true };

// css modules, _quest_k6rzi_16, middle bit new every build. hash -> { local: class }
let modules = null;
let scannedAt = -Infinity;
// modules loading later (a panel opened the first time) need a rescan. capped, a panel nobody opened would rescan every frame the hud ticks
const RESCAN_MS = 1000;

function scan() {
    modules = {};
    scannedAt = performance.now();
    for (const sheet of document.styleSheets) {
        let rules;
        try {
            rules = sheet.cssRules;
        } catch {
            continue; // other origins (fonts) throw, none of terra's do
        }
        for (const rule of rules) {
            for (const [, name, local, hash] of (rule.selectorText ?? "").matchAll(/\.(_([A-Za-z]+)_([a-z0-9]+)_\d+)/g)) {
                (modules[hash] ??= {})[local] ??= name;
            }
        }
    }
}

// module with all these local names, or null. _container_ and _task_ are in loads of them, pick ones only it has
export function cssModule(...locals) {
    const find = () => Object.values(modules ?? {}).find((names) => locals.every((local) => local in names)) ?? null;
    let found = find();
    if (!found && performance.now() - scannedAt >= RESCAN_MS) {
        scan();
        found = find();
    }
    return found;
}

export function addStyle(css) {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
}

// game walks you wherever you click, opens its buy popup off clicks in tree nodes n build mode off keys anywhere
export const POINTER = ["pointerdown", "mousedown", "touchstart", "click", "dblclick"];
export const KEYS = ["keydown", "keyup", "keypress"];

export function keepFromGame(el, types) {
    for (const type of types) el.addEventListener(type, (event) => event.stopPropagation());
}

// cleaned on change (enter or clicking off), cleaned number goes back in the box
export function numberBox(props, value, clean, onChange) {
    const box = document.createElement("input");
    box.type = "number";
    Object.assign(box, props);
    box.value = value ?? "";
    box.addEventListener("change", () => {
        const n = clean(box.value);
        box.value = n ?? "";
        onChange(n);
    });
    return box;
}

// one observer for everything, with one each the card and tree tags redrew each other every frame
const draws = [];
let observer = null;
let queued = false;

function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
        queued = false;
        drawUnhooked(draws);
    });
}

function drawUnhooked(list) {
    // game changes not queued yet would get dropped by disconnect
    const missed = observer.takeRecords().length > 0;
    observer.disconnect();
    for (const draw of list) {
        // a throw would stop the rest n leave the observer off for good
        try {
            draw();
        } catch (err) {
            reportError(err);
        }
    }
    observer.observe(document.body, WATCH);
    if (missed) queue();
}

// reruns draw() on page changes, hands back a draw-now. always unhooked so our own changes dont count
export function watchPage(draw) {
    draws.push(draw);
    observer ??= new MutationObserver(queue);
    observer.observe(document.body, WATCH);
    return () => drawUnhooked([draw]);
}

// mount / draw / redraw for card, tree tags, shop badges n hud. fill gets the last drawn state, mount is false if it already was
export function ourBit(fill) {
    let state = null;
    let redraw = null;
    return {
        mount(css) {
            if (redraw) return false;
            addStyle(css);
            redraw = watchPage(() => fill(state));
            return true;
        },
        draw(next) {
            state = next;
            redraw?.();
        },
        redraw: () => redraw?.(),
    };
}
