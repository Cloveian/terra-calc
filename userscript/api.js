// REST calls like game fetch helper (api-*.js)
import { API_BASE, VERSION_URL, TOKEN_KEY, CHECKS } from "./endpoints.js";

export async function apiGet(path) {
    return request(path, { method: "GET" });
}

export async function apiPost(path, body) {
    return request(path, { method: "POST", body: JSON.stringify(body) });
}

async function request(path, opts) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) throw new Error("not logged in to Terra");
    const res = await fetch(API_BASE + path, {
        ...opts,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.error ?? `${path} failed (${res.status})`);
    // TODO: rewardEstimate(id) paths unchecked (CHECKS keyed by plain path)
    const problems = CHECKS[path]?.(body) ?? [];
    if (problems.length > 0) throw new Error(`${path} looks different: ${problems.join(", ")}`);
    return body;
}

// for "Terra updated" notice
export async function liveBuild() {
    const res = await fetch(VERSION_URL, { cache: "no-store" });
    return (await res.json()).buildId;
}

// TODO buyUpgrade(nodeId): POST to REST.buyUpgrade behind confirm once reading works
