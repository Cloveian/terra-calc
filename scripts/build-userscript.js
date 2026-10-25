// bundler for dist/terra-calc.user.js
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { execSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRY = join(ROOT, "userscript/main.js");
const META = join(ROOT, "userscript/meta.js");
const OUT = join(ROOT, "dist/terra-calc.user.js");

const IMPORT = /^import\s*\{[^}]*\}\s*from\s*"(\.[^"]+)";[ \t]*\n?/gm;
const DECL = /^(?:export\s+)?(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm;

// each file after its imports
function collect(file, seen = new Set(), order = []) {
    if (seen.has(file)) return order;
    seen.add(file);
    const text = readFileSync(file, "utf8");
    // ui.js and the bits split off it are the only src/ files using document
    if (file.includes("/src/") && text.includes("document.")) throw new Error(`${file} touches the site's page, it can't go in the userscript`);
    for (const [, spec] of text.matchAll(IMPORT)) collect(resolve(dirname(file), spec), seen, order);
    order.push({ file, text });
    return order;
}

function strip({ file, text }) {
    const name = relative(ROOT, file);
    const body = text.replace(IMPORT, "");
    // leftover imports (default, *, bare, package) would land inside wrapper function
    if (/^export\s+(default|\{|\*)/m.test(text) || /^import\s/m.test(body)) {
        throw new Error(`${name}: only \`export const/function\` and \`import { ... } from "./..."\` are supported`);
    }
    return `// ${name}\n` + body.replace(/^export\s+/gm, "");
}

// all one function once bundled
function checkNames(files) {
    const owner = new Map();
    for (const { file, text } of files) {
        for (const [, id] of text.matchAll(DECL)) {
            const name = relative(ROOT, file);
            if (owner.has(id)) throw new Error(`\`${id}\` is in both ${owner.get(id)} and ${name}`);
            owner.set(id, name);
        }
    }
}

// --update-url <url> for the install / update links (wip gist raw link), --check = bundle n check it, dist/ left alone
const args = parseArgs({ options: { "update-url": { type: "string" }, check: { type: "boolean" } } }).values;

const files = collect(ENTRY);
checkNames(files);
const body = files.map(strip).join("\n");
const wrapped = `(() => {\n"use strict";\n\n${body}\n})();\n`;
if (args.check) {
    // parsed, never run
    new Function(wrapped);
    console.log(`${files.length} files bundle fine`);
    process.exit(0);
}
// @version = major.minor from package.json + commit count, userscript managers only update to a higher one
const { version: base } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const commits = execSync("git rev-list --count HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
const version = base.replace(/\d+$/, commits);
const updateUrl = args["update-url"];
let meta = readFileSync(META, "utf8").replace(/^(\/\/ @version\s+).*$/m, `$1${version}`);
// a function so a $ in the url stays a $
if (updateUrl) meta = meta.replace(/^(\/\/ @(?:downloadURL|updateURL)\s+).*$/gm, (_, key) => key + updateUrl);
const out = `${meta}\n${wrapped}`;
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, out);
console.log(`${relative(ROOT, OUT)}: ${files.length} files, ${(out.length / 1024).toFixed(1)} KB`);

// not sure if dist/ gets committed (pages needs it for install link)
