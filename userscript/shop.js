// coins an hour badges on heidi's seeds (SeedMenuUI), how many the plan buys n a warning on ones it doesnt want

import { cssModule, watchPage } from "./page.js";

const BADGE = "terra-calc-badge";
const WARNING = "terra-calc-warning";
// p. or the dialog's own class wins, its css loads aftr ours
const SHOP_CSS = `p.${WARNING} { color: #c0392b }
.${BADGE} { position: absolute; right: 4%; bottom: 4%; z-index: 1;
  padding: 0 0.35em; font-family: inherit; font-size: clamp(12px, 1.1vw, 16px); font-weight: bold;
  color: #5a3a1a; background: #ffe0a3; border: 2px solid #93582c; border-radius: 0.5em }`;

let bits = null; // from drawShopBadges. toBuy = how many this weeks plan stil buys, null with no steps to go by
let redrawBadges = null; // from watchPage, null till mountShopBadges

export function mountShopBadges() {
    const style = document.createElement("style");
    style.textContent = SHOP_CSS;
    document.head.append(style);
    // shop asks for stock every 30 s while open n rebuilds every row
    redrawBadges = watchPage(() => {
        fillBadges();
        fillWarning();
    });
}

export function drawShopBadges(next) {
    bits = next;
    redrawBadges?.();
}

// coins per hour of water, sold at m minus seed price. plots not in it
export function perHour({ buy, sell, water }, m) {
    return (m * sell - buy) / water;
}

// "Eggplant Seeds" and "Eggplant" both -> "eggplant", seedsFrom drops " Seeds", the row doesnt
function plain(name) {
    return name.trim().replace(/\s+Seeds?$/, "").toLowerCase();
}

function fillBadges() {
    const shelf = cssModule("itemShelf", "priceTag");
    if (!shelf || !bits) return;
    const seeds = new Map(bits.seeds.map((seed) => [plain(seed.name), seed]));
    for (const row of document.querySelectorAll(`.${shelf.itemShelf} .${shelf.item}`)) {
        // rows have no id or itemId, matched by name in their <strong>
        const seed = seeds.get(plain(row.querySelector("strong")?.textContent ?? ""));
        let badge = row.querySelector(`.${BADGE}`);
        if (!seed) {
            badge?.remove();
            continue;
        }
        // row = one button, seed picutre front, price tag back (flips on click). badge on the button shows both sides
        if (!badge) {
            badge = document.createElement("span"); // shelf css squashes every div in its buttons to nothing
            badge.className = BADGE;
            row.append(badge);
        }
        const n = Math.round(perHour(seed, bits.m));
        const buy = bits.toBuy?.[seed.id] ?? 0;
        const text = buy > 0 ? `${n}/h, buy ${buy}` : `${n}/h`;
        if (badge.textContent !== text) badge.textContent = text;
        badge.title = `about ${n} coins for each hour you code, after what the seed costs (plots not counted), at a multiplier of ${Math.round(bits.m * 100) / 100}`
            + (buy > 0 ? `, and this week's plan has you buying ${buy} more` : "");
    }
}

// red line under heidi's "Buy Eggplant Seeds for 15 coins? You'll have 40 left." (ConfirmDialog) when the plan wants no more
function fillWarning() {
    const asking = /^Buy (.+) for \d+ coins\?/;
    const message = [...document.querySelectorAll("[role=alertdialog] p")].find((p) => asking.test(p.textContent));
    if (!message || !bits) return;
    const seed = bits.seeds.find((s) => plain(s.name) === plain(message.textContent.match(asking)[1]));
    let line = message.parentElement.querySelector(`.${WARNING}`);
    if (!seed || !bits.toBuy || bits.toBuy[seed.id] > 0) {
        line?.remove();
        return;
    }
    if(!line) {
        line = document.createElement("p");
        line.className = `${message.className} ${WARNING}`;
        message.after(line);
    }
    const text = `Terra Calc: this week's plan doesn't need more ${plain(seed.name)} seeds. Seeds you don't plant and water by Monday night are lost.`;
    if(line.textContent !== text) line.textContent = text;
}
