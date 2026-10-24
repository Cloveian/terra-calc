// hour boxes in the day boxes of terra's calendar week page
import { ourBit, numberBox, keepFromGame, cssModule, POINTER, KEYS } from "./page.js";
import { easternDay, DAY_MS } from "../src/week.js";
import { clamp } from "../src/state.js";

const DAY_BIT = "terra-calc-day";
const CODED_BIT = "terra-calc-coded"; // gone days, what i coded
// same cream box as the tree tags, small enough to sit under the date
const DAY_CSS = `.${DAY_BIT} { font: 700 .75em/1.3 var(--game-font, "Pleasurize", cursive); margin-top: .2em; z-index: 1 }
.${DAY_BIT} input { font: inherit; width: 3.4em; text-align: center; color: #462114; background: #fff9; border: 1px solid #93582c; border-radius: 1em; padding: 0 .3em }
.${DAY_BIT} input::placeholder { color: #93582c; opacity: .6 }
.${CODED_BIT} { font: 700 .75em/1.3 var(--game-font, "Pleasurize", cursive); margin-top: .35em; color: #93582c; position: relative; z-index: 1 }`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const dayBit = ourBit(fillDays);
let onDay = null;

// setDay(day, h), h null clears
export function mountDayBoxes(setDay) {
    onDay = setDay;
    dayBit.mount(DAY_CSS);
}

// days = { "2026-10-26": 4 }, perDay = planned h per weekday [mon ... sun], null = no plan. codedOn = { "2026-10-20": 3.2 } h on gone days
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

// "3h 12m" like terra's "39h 33m logged"
export function codedWords(h) {
    const minutes = Math.round(h * 60);
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
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
        let wrap = cell.querySelector(`.${DAY_BIT}`);
        let done = cell.querySelector(`.${CODED_BIT}`);
        // gone days are what i coded, nothing to type
        if (day < today) {
            wrap?.remove();
            const h = state.codedOn[day];
            if (h === undefined) return done?.remove();
            if (!done) {
                done = document.createElement("div");
                done.className = CODED_BIT;
                cell.append(done);
            }
            done.textContent = codedWords(h);
            return;
        }
        done?.remove();
        if (!wrap) {
            wrap = numberBox({ min: 0, max: 24, step: 0.1 }, null, cleanHours, (h) => onDay?.(wrap.dataset.day, h));
            wrap.classList.add(DAY_BIT);
            keepFromGame(wrap, [...POINTER, ...KEYS]);
            cell.append(wrap);
        }
        const box = wrap.firstChild;
        wrap.dataset.day = day;
        box.title = `Hours you'll code on ${day}, blank = whatever the plan needs`;
        box.placeholder = state.perDay === null ? "" : String(Math.round(state.perDay[i] * 10) / 10);
        if (document.activeElement !== box) box.value = state.days[day] ?? "";
    });
}
