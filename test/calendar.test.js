import { test } from "node:test";
import assert from "node:assert/strict";
import { mondayFrom, codedWords } from "../userscript/calendar.js";

test("codedWords: like terra's 39h 33m", () => {
    assert.equal(codedWords(3.2), "3h 12m");
    assert.equal(codedWords(0), "0h 0m");
    assert.equal(codedWords(1.9999), "2h 0m"); // rounds to the minute first, no "1h 60m"
});

test("mondayFrom reads the week page's range, year closest to today", () => {
    assert.equal(mondayFrom("Oct 12 - Oct 18", "2026-10-24"), "2026-10-12");
    assert.equal(mondayFrom("Dec 28 - Jan 3", "2027-01-02"), "2026-12-28"); // over new year
    assert.equal(mondayFrom("Jan 4 - Jan 10", "2026-12-30"), "2027-01-04"); // next week from new year's eve
    assert.equal(mondayFrom("no dates here", "2026-10-24"), null);
});
