import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

// two files with the same top level name only break once they're one bundle, every other test stays green
test("the userscript bundles: no name in two files, the whole thing parses", () => {
    const out = execFileSync(process.execPath, ["scripts/build-userscript.js", "--check"], { cwd: new URL("../", import.meta.url), encoding: "utf8" });
    assert.match(out, /files bundle fine/);
});
