// terra's real class names + one observer redrawing all our bits inside its DOM, n what those bits share
import { stepped, holdRepeat } from "../src/stepper.js";

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

const NUMBER_BIT = "terra-calc-number";
// terra brown chevrons inside the box's right end, chrome's grey spinner off
const NUMBER_CSS = `.${NUMBER_BIT} { position: relative; display: inline-block }
.${NUMBER_BIT} > input[type] { appearance: textfield; padding-right: 1.1em }
.${NUMBER_BIT} > input::-webkit-inner-spin-button, .${NUMBER_BIT} > input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0 }
.${NUMBER_BIT} > span { position: absolute; top: 0; bottom: 0; right: .3em; display: flex; flex-direction: column; justify-content: center }
.${NUMBER_BIT} button { all: unset; flex: 0 1 .6em; width: .8em; display: grid; place-items: center; cursor: pointer; color: #93582c }
.${NUMBER_BIT} button:hover { color: #462114 }
.${NUMBER_BIT} button::before { content: ""; width: .34em; height: .34em; border: solid currentColor; border-width: 2px 2px 0 0; border-radius: 1px; transform: translateY(20%) rotate(-45deg) }
.${NUMBER_BIT} button + button::before { transform: translateY(-20%) rotate(135deg) }`;
let numberStyled = false;

// cleaned on change (enter, clicking off or an arrow), cleaned number goes back in the box. hands back the wrap, input is its firstChild
export function numberBox(props, value, clean, onChange) {
    if (!numberStyled) addStyle(NUMBER_CSS);
    numberStyled = true;
    const box = document.createElement("input");
    box.type = "number";
    Object.assign(box, props);
    box.value = value ?? "";
    box.addEventListener("change", () => {
        const n = clean(box.value);
        box.value = n ?? "";
        onChange(n);
    });
    const wrap = document.createElement("span");
    wrap.className = NUMBER_BIT;
    wrap.append(box, arrows(box));
    return wrap;
}

// an empty box starts from its placeholder (the calendar's faded guess)
function arrows(box) {
    const span = document.createElement("span");
    for (const [direction, label] of [[1, "more"], [-1, "less"]]) {
        const b = document.createElement("button");
        b.type = "button";
        b.tabIndex = -1;
        b.ariaLabel = label;
        holdRepeat(b, () => {
            // focus in the box, the tree tags n calendar dont redraw a focused one
            box.focus({ preventScroll: true });
            box.value = stepped(box.value || box.placeholder, box, direction);
            box.dispatchEvent(new Event("change"));
        }, () => box.isConnected);
        span.append(b);
    }
    return span;
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
