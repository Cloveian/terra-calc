import { PREP1_START, PREP_WEEKS, MAIN_WEEKS } from "./data.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export const LAST_WEEK = PREP_WEEKS + MAIN_WEEKS - 1; // t = 14 is Week 12

// "YYYY-MM-DD" of the US Eastern calendar day `date` falls on (en-CA formats as YYYY-MM-DD)
export function easternDay(date) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(date);
}

// 0-2 prep, 3-14 main, <0 not started, >14 over.
// A Date is converted to its Eastern day; a "YYYY-MM-DD" string is taken as an Eastern day already.
export function weekIndex(date) {
    const day = typeof date === "string" ? date : easternDay(date);
    // both parse as UTC midnight, so the difference is a whole number of days
    const days = Math.round((Date.parse(day) - Date.parse(PREP1_START)) / DAY_MS);
    return Math.floor(days / 7);
}

export function isPrep(t) {
    return t < PREP_WEEKS;
}

export function weekName(t) {
    return isPrep(t) ? `Prep ${t + 1}` : `Week ${t - PREP_WEEKS + 1}`;
}
