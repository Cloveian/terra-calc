// hour boxes in the day boxes of terra's calendar week page
import { ourBit, numberBox, keepFromGame, cssModule, POINTER, KEYS } from "./page.js";
import { easternDay, DAY_MS } from "../src/week.js";
import { clamp } from "../src/state.js";

const DAY_BIT = "terra-calc-day";
const NOTE_BIT = "terra-calc-day-note"; // under a day, what i coded or whats left of today
// same cream box as the tree tags, small enough to sit under the date
const DAY_CSS = `.${DAY_BIT} { font: 700 .75em/1.3 var(--game-font, "Pleasurize", cursive); margin-top: .2em; z-index: 1 }
.${DAY_BIT} input { font: inherit; width: 3.4em; text-align: center; color: #462114; background: #fff9; border: 1px solid #93582c; border-radius: 1em; padding: 0 .3em }
.${DAY_BIT} input::placeholder { color: #93582c; opacity: .6 }
.${NOTE_BIT} { font: 700 .75em/1.3 var(--game-font, "Pleasurize", cursive); margin-top: .35em; color: #93582c; position: relative; z-index: 1 }`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const dayBit = ourBit(fillDays);
let onDay = null;

// setDay(day, h), h null clears
export function mountDayBoxes(setDay) {
    onDay = setDay;
    dayBit.mount(DAY_CSS);
}

// days = { "2026-10-26": 4 }, perDay = planned h per weekday [mon ... sun], null = no plan. codedOn = { "2026-10-20": 3.2 } h on gone days, todayLeft = h left of what i typed for today or null
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
        const words = day < today ? goneDay(cell, state, day) : openDay(cell, state, day, today, i);
        let note = cell.querySelector(`.${NOTE_BIT}`);
        if (words === null) return note?.remove();
        if (!note) {
            note = document.createElement("div");
            note.className = NOTE_BIT;
            cell.append(note);
        }
        note.textContent = words;
    });
}

// gone days are what i coded, nothing to type
function goneDay(cell, state, day) {
    cell.querySelector(`.${DAY_BIT}`)?.remove();
    const h = state.codedOn[day];
    return h === undefined ? null : codedWords(h);
}

// box from today on. today typed = whats left of it
function openDay(cell, state, day, today, i) {
    let wrap = cell.querySelector(`.${DAY_BIT}`);
    if (!wrap) {
        wrap = numberBox({ min: 0, max: 24, step: 0.1 }, null, cleanHours, (h) => onDay?.(wrap.dataset.day, h));
        wrap.classList.add(DAY_BIT);
        keepFromGame(wrap, [...POINTER, ...KEYS]);
        // note goes under it, a gone day's note can still be there from before midnight
        cell.querySelector(`.${NOTE_BIT}`)?.remove();
        cell.append(wrap);
    }
    const box = wrap.firstChild;
    wrap.dataset.day = day;
    box.title = `Hours you'll code on ${day}, blank = whatever the plan needs`;
    box.placeholder = state.perDay === null ? "" : String(Math.round(state.perDay[i] * 10) / 10);
    if (document.activeElement !== box) box.value = state.days[day] ?? "";
    if (day !== today || state.todayLeft === null) return null;
    // under a minute is done, like the card
    return Math.round(state.todayLeft * 60) > 0 ? `${codedWords(state.todayLeft)} left` : "done";
}
