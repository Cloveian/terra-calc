// bundler for dist/terra-calc.user.js
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
    if (file.endsWith("src/ui.js")) throw new Error("src/ui.js touches the site's page, it can't go in the userscript");
    const text = readFileSync(file, "utf8");
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

const files = collect(ENTRY);
checkNames(files);
const body = files.map(strip).join("\n");
const out = `${readFileSync(META, "utf8")}\n(() => {\n"use strict";\n\n${body}\n})();\n`;
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, out);
console.log(`${relative(ROOT, OUT)}: ${files.length} files, ${(out.length / 1024).toFixed(1)} KB`);

// TODO: package.json version into @version
// not sure if dist/ gets committed (pages needs it for install link)
