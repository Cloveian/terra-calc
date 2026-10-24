import { test } from "node:test";
import assert from "node:assert/strict";
import { taggedBody } from "../userscript/travel.js";

const url = "https://game.terra.hackclub.com/matchmake/joinOrCreate/world";
const armed = { levelId: "town-square", spawnTag: "Island return", until: 1000 };
const join = (options) => JSON.stringify({ token: "t", levelId: "town-square", fromSessionId: "s", ...options });

test("taggedBody: the hub trip's matchmake gets the dock's spawn tag", () => {
    assert.deepEqual(JSON.parse(taggedBody(url, join(), armed, 500)), {
        token: "t", levelId: "town-square", fromSessionId: "s", spawnTag: "Island return",
    });
});

test("taggedBody: leaves everything else alone", () => {
    assert.equal(taggedBody(url, join(), null, 500), null); // nothing armed
    assert.equal(taggedBody(url, join(), armed, 1500), null); // armed too long ago
    assert.equal(taggedBody(url, join({ levelId: "farm-island" }), armed, 500), null); // going somewhere else
    assert.equal(taggedBody(url, join({ spawnTag: "dock" }), armed, 500), null); // has its own
    assert.equal(taggedBody("https://api.terra.hackclub.com/friends", join(), armed, 500), null);
    assert.equal(taggedBody(url, "not json", armed, 500), null);
    assert.equal(taggedBody(url, undefined, armed, 500), null);
});
