import { test } from "node:test";
import assert from "node:assert/strict";
import { summariesUrl, hoursByDay, statusWords, fetchDays } from "../userscript/hackatime.js";

test("statusWords: nothing with no key, the status on a bad one", () => {
    assert.equal(statusWords(null), "");
    assert.equal(statusWords({ fetchedAt: 1, error: "Hackatime said 401" }), "Didn't work: Hackatime said 401");
    assert.equal(statusWords({ fetchedAt: 1, days: { "2026-10-20": 3, "2026-10-21": 0 } }), "Got 2 days of hours");
});

test("summariesUrl: eastern days", () => {
    assert.equal(
        summariesUrl("2026-09-01", "2026-10-24"),
        "https://hackatime.hackclub.com/api/hackatime/v1/users/current/summaries?start=2026-09-01&end=2026-10-24&timezone=America%2FNew_York",
    );
});

test("hoursByDay: summaries rows to hours, junk rows skipped", () => {
    const json = {
        data: [
            { grand_total: { total_seconds: 3 * 3600 + 1800 }, range: { date: "2026-10-20" } },
            { grand_total: { total_seconds: 0 }, range: { date: "2026-10-21" } }, // empty days come back too
            { grand_total: {}, range: { date: "2026-10-22" } },
            { grand_total: { total_seconds: 60 } },
        ],
    };
    assert.deepEqual(hoursByDay(json), { "2026-10-20": 3.5, "2026-10-21": 0 });
    assert.deepEqual(hoursByDay({ error: "Unauthorized" }), {});
});

test("fetchDays: a key fetch wont send doesnt end up in the error", async () => {
    await assert.rejects(fetchDays("sekrit\nkey", "2026-10-01", "2026-10-24"), (err) => !err.message.includes("sekrit"));
});
