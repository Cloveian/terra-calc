import { test } from "node:test";
import assert from "node:assert/strict";
import { hookFetch, upgradeChange } from "../userscript/fetch.js";
import { API_BASE } from "../userscript/endpoints.js";

test("upgradeChange: the games buys n refunds, not the tree GET or anything else", () => {
    assert.equal(upgradeChange(`${API_BASE}/device-upgrades/purchase`, "POST"), true);
    assert.equal(upgradeChange(`${API_BASE}/device-upgrades/select-device`, "post"), true);
    assert.equal(upgradeChange(`${API_BASE}/device-upgrades`, "GET"), false);
    assert.equal(upgradeChange(`${API_BASE}/device-upgrades/purchase`), false);
    assert.equal(upgradeChange(`${API_BASE}/ysws/projects`, "POST"), false);
});

test("hookFetch: onUpgrades once an ok buy comes back, the games own call goes through untouched", async (t) => {
    const calls = [];
    let ok = true;
    globalThis.window = { fetch: async (input, init) => { calls.push([input, init]); return { ok }; } };
    t.after(() => delete globalThis.window);
    let seen = 0;
    hookFetch(() => seen++);
    const init = { method: "POST", body: '{"nodeId":"ram_1"}' };
    await window.fetch(`${API_BASE}/device-upgrades/purchase`, init);
    await window.fetch(`${API_BASE}/device-upgrades`);
    ok = false;
    await window.fetch(`${API_BASE}/device-upgrades/purchase`, init);
    assert.equal(seen, 1);
    assert.deepEqual(calls[0], [`${API_BASE}/device-upgrades/purchase`, init]);
});
