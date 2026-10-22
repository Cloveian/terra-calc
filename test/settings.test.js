import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSettings } from "../userscript/settings.js";

// no localStorage in node, loadSettings only needs getItem
const stored = (json) => {
    globalThis.localStorage = { getItem: () => json };
};

test("loadSettings: nothing saved is the defaults, the game's multiplier", () => {
    stored(null);
    const settings = loadSettings();
    assert.equal(settings.fill, true);
    assert.equal(settings.debug, false);
    assert.equal(settings.m, null);
});

test("loadSettings: a saved multiplier gets the same clamp as the box, junk is the game's again", () => {
    stored('{"m": 1.3}');
    assert.equal(loadSettings().m, 1.3);
    stored('{"m": 9}');
    assert.equal(loadSettings().m, 1.5);
    stored('{"m": "lots"}');
    assert.equal(loadSettings().m, null);
    stored("not json");
    assert.equal(loadSettings().m, null);
});
