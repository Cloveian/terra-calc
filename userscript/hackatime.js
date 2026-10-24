// hours i coded each day off hackatime, with my own key. the key only ever goes there

const SUMMARIES = "https://hackatime.hackclub.com/api/hackatime/v1/users/current/summaries";
export const BACK_DAYS = 56; // 8 of each weekday
export const FETCH_EVERY_MS = 60 * 60 * 1000; // 1 h

// eastern days like terra's
export function summariesUrl(start, end) {
    return `${SUMMARIES}?${new URLSearchParams({ start, end, timezone: "America/New_York" })}`;
}

// { "2026-10-20": 3.2 } in h, days hackatime left out skipped
export function hoursByDay(json) {
    const days = {};
    for (const row of json?.data ?? []) {
        const day = row?.range?.date;
        const seconds = Number(row?.grand_total?.total_seconds);
        if (typeof day === "string" && Number.isFinite(seconds)) days[day] = seconds / 3600;
    }
    return days;
}

// throws on a bad key or no network, the error says the status and never the key
export async function fetchDays(key, start, end) {
    const res = await fetch(summariesUrl(start, end), { headers: { Authorization: `Bearer ${key}` } }).catch(() => {
        // the browsers message can quote the header back, key n all ("Bearer ... is an invalid header value")
        throw new Error("Couldn't reach Hackatime");
    });
    if (!res.ok) throw new Error(`Hackatime said ${res.status}`);
    return hoursByDay(await res.json());
}

// under the key box, saved = what main.js keeps from fetchDays
export function statusWords(saved) {
    if (!saved) return "";
    if (saved.error) return `Didn't work: ${saved.error}`;
    return `Got ${Object.keys(saved.days).length} days of hours`;
}
