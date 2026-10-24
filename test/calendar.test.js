import { test } from "node:test";
import assert from "node:assert/strict";
import { mondayFrom } from "../userscript/calendar.js";

test("mondayFrom reads the week page's range, year closest to today", () => {
    assert.equal(mondayFrom("Oct 12 - Oct 18", "2026-10-24"), "2026-10-12");
    assert.equal(mondayFrom("Dec 28 - Jan 3", "2027-01-02"), "2026-12-28"); // over new year
    assert.equal(mondayFrom("Jan 4 - Jan 10", "2026-12-30"), "2027-01-04"); // next week from new year's eve
    assert.equal(mondayFrom("no dates here", "2026-10-24"), null);
});
