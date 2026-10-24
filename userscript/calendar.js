// hour boxes in the day boxes of terra's calendar week page
import { ourBit, numberBox, keepFromGame, cssModule, POINTER, KEYS } from "./page.js";
import { easternDay, DAY_MS } from "../src/week.js";
import { clamp } from "../src/state.js";

const DAY_BIT = "terra-calc-day";
// same cream box as the tree tags, small enough to sit under the date
const DAY_CSS = `.${DAY_BIT} { font: 700 .75em/1.3 var(--game-font, "Pleasurize", cursive); width: 3.4em; margin-top: .2em; text-align: center;
  color: #462114; background: #fff9; border: 1px solid #93582c; border-radius: 1em; padding: 0 .3em; position: relative; z-index: 1 }
.${DAY_BIT}::placeholder { color: #93582c; opacity: .6 }`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const dayBit = ourBit(fillDays);
let onDay = null;

// setDay(day, h), h null clears
export function mountDayBoxes(setDay) {
    onDay = setDay;
    dayBit.mount(DAY_CSS);
}

// days = { "2026-10-26": 4 }, perDay = h an open day's planned at (cap / 7), null = no plan
export function drawDayBoxes(state) {
    dayBit.draw(state);
}

// "Oct 12 - Oct 18" -> "2026-10-12", year = whichever puts it closest to today (terra runs sep to jan)
export function mondayFrom(range, today) {
    const match = range.match(/([A-Z][a-z]{2}) (\d{1,2})/);
    const month = match && MONTHS.indexOf(match[1]);
    if (!match || month < 0) return null;
    const now = Date.parse(today);
    const year = Number(today.slice(0, 4));
    const tries = [year - 1, year, year + 1].map((y) => Date.UTC(y, month, Number(match[2])));
    const best = tries.reduce((a, b) => (Math.abs(b - now) < Math.abs(a - now) ? b : a));
    return new Date(best).toISOString().slice(0, 10);
}

// boxes from 0 to 24 h, a tenth is plenty. blank = back to open
function cleanHours(text) {
    if (String(text).trim() === "") return null;
    const n = Number(text);
    return Number.isFinite(n) ? Math.round(clamp(n, 0, 24) * 10) / 10 : null;
}

function fillDays(state) {
    const c = cssModule("weekPage", "dayBox", "range", "calendar", "hidden");
    if (!c || !state) return;
    const page = [...document.querySelectorAll(`.${c.weekPage}`)].find((el) => !el.closest(`.${c.hidden}`));
    const range = page && (page.closest(`.${c.calendar}`) ?? document).querySelector(`.${c.range}`);
    const today = easternDay(new Date());
    const monday = range && mondayFrom(range.textContent, today);
    if (!monday) return;
    [...page.querySelectorAll(`.${c.dayBox}`)].forEach((cell, i) => {
        const day = new Date(Date.parse(monday) + i * DAY_MS).toISOString().slice(0, 10);
        let box = cell.querySelector(`.${DAY_BIT}`);
        // gone days are what i coded, nothing to type
        if (day < today) return box?.remove();
        if (!box) {
            box = numberBox({ className: DAY_BIT, min: 0, max: 24, step: 0.1 }, null, cleanHours, (h) => onDay?.(box.dataset.day, h));
            keepFromGame(box, [...POINTER, ...KEYS]);
            cell.append(box);
        }
        box.dataset.day = day;
        box.title = `Hours you'll code on ${day}, blank = whatever the plan needs`;
        box.placeholder = state.perDay === null ? "" : String(Math.round(state.perDay * 10) / 10);
        if (document.activeElement !== box) box.value = state.days[day] ?? "";
    });
}
