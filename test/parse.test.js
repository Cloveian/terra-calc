import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";

const root = new URL("../", import.meta.url);

// main.js n the page files arent imported by any test, a typo in them only showed up as a dead userscript
test("every src/ and userscript/ file parses", () => {
    for (const dir of ["src", "userscript"]) {
        for (const file of readdirSync(new URL(dir, root)).filter((name) => name.endsWith(".js"))) {
            assert.doesNotThrow(() => execFileSync(process.execPath, ["--check", `${dir}/${file}`], { cwd: root, stdio: "pipe" }), `${dir}/${file}`);
        }
    }
});
