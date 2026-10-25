// how to use terra calc, as a book on terra's own tome classes. opened from the ? on the card
import { cssModule, el, keepFromGame, POINTER, KEYS } from "./page.js";

// left page = what it is, right page = faq, like theirs
const PAGES = [
    {
        heading: "Terra Calc",
        left: [
            "Terra Calc works out how to get the upgrades you want by the end of Terra: how many crops to plant each week, which seeds to buy, and how long to code.",
            "Pick a goal in the device tree and the This Week card turns into your checklist.",
            "It plans off what Terra already shows you. Nothing goes anywhere except Terra, and Hackatime if you add a key.",
        ],
        faq: [
            { q: "Where did Terra's checklist go?", a: "Terra Calc's steps replace it. \"hide Terra Calc\" at the bottom of the card brings it back." },
            { q: "Where do the numbers come from?", a: "Hover a line with maths in it (or a seed badge in Heidi's shop) to see the formula, then the same with your numbers in." },
            { q: "Something looks wrong?", a: "Terra changes a lot. Turn on \"Log everything to the console\" in settings and send the log my way." },
        ],
    },
    {
        heading: "The This Week card",
        left: [
            "Your steps for the week, in the order you'd do them. A step that waits on another one sits indented under it, and done ones stay ticked till the week ends.",
            "Under the steps: today's best seeds, where your goal stands, and when each pick lands (\"show more\" lists them all).",
            "It only plans off a farm it's seen today, so visit your island once a day.",
        ],
        faq: [
            { q: "Why does it say to open Heidi's shop?", a: "It plans with whatever Heidi has today, and it only sees her seeds while her shop is open." },
            { q: "What's \"won't fit\"?", a: "You can own 45 plots at most. Past that only Ratticus's loan plots make room." },
            { q: "Why buy fewer seeds than the plan?", a: "If your past weeks say you usually wouldn't code enough to water them, they'd be wasted coins." },
        ],
    },
    {
        heading: "Your hours",
        left: [
            "Open Terra's calendar to a week. Every day left has a box: type how long you'll code that day.",
            "The faded number is what the plan needs from that day, \"usually\" is what you normally do on that weekday.",
            "Blank days get the rest, spread the way your weeks usually go. Days already gone show what you coded.",
        ],
        faq: [
            { q: "Where does \"usually\" come from?", a: "Terra Calc writes down your hours every day it's open. With a Hackatime key it knows your last 8 weeks right away." },
            { q: "Does AI time count?", a: "A third, same as Terra." },
        ],
    },
    {
        heading: "Goals",
        left: [
            "Open the device tree (the Goal button) and click want on the upgrades you're after.",
            "The box next to want is a priority, 1 is what you care about most. Blank ones come after the numbered ones.",
            "The card then says when each one lands, and what's out of reach with your hours.",
        ],
        faq: [
            { q: "Should I buy upgrades early?", a: "Nope, they only arrive at the end anyway, and coins in an upgrade aren't buying plots. The plan buys everything in the last week." },
            { q: "My goal's on another device?", a: "Then it counts the coins you'd get back by switching." },
            { q: "What's \"on apple weeks\"?", a: "Your goal if Heidi only had her worst seed from now on, or her best. It only shows up when that changes something." },
        ],
    },
    {
        heading: "Buttons and settings",
        left: [
            "Island / Hub, under Terra's own buttons, takes you home or to the hub from anywhere. Goal opens the device tree.",
            "Terra Calc's part of Terra's settings turns each piece on or off, sets your own multiplier for \"what if\" plans, and has boxes to type your numbers in if reading the game ever breaks.",
        ],
        faq: [
            { q: "Where's my Hackatime key?", a: "hackatime.hackclub.com/api-key. It stays in your browser and only ever goes to Hackatime." },
        ],
    },
];

const CLOSE_MS = 250; // their fadeOut

// tome n map overlay classes, null till both have loaded
function classes() {
    const c = cssModule("book", "spine", "leftPage");
    const o = cssModule("mapOverlay", "mapLarge");
    return c && o ? { c, o } : null;
}

export function canHelp() {
    return classes() !== null;
}

export function openHelp() {
    const found = classes();
    if (!found) return;
    const { c, o } = found;
    const overlay = el("div", o.mapOverlay);
    overlay.tabIndex = -1;
    const dialog = el("div", c.book);
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-label", "Terra Calc help");
    const header = el("div", c.header);
    header.append(el("div", c.headerInner));
    const left = el("div", c.leftPage);
    const right = el("div", c.rightPage);
    const spread = el("div", c.spread);
    spread.append(left, el("div", c.spine), right);
    const nav = (cls, src, label, step) => {
        const button = el("button", `${c.nav} ${cls}`);
        button.setAttribute("aria-label", label);
        const img = el("img");
        img.src = src;
        img.alt = "";
        button.append(img);
        button.addEventListener("click", () => {
            show(page + step);
            // a hidden button drops focus to body, then esc n arrows went to the game
            if (button.hidden) overlay.focus();
        });
        return button;
    };
    const prev = nav(c.navPrev, "/assets/sprites/ui/tome/page-prev.webp", "Previous page", -1);
    const next = nav(c.navNext, "/assets/sprites/ui/tome/page-next.webp", "Next page", 1);
    dialog.append(el("div", c.cover), el("div", c.coverInner), el("div", c.page), header, el("div", c.title, "Terra Calc"), spread, prev, next);
    overlay.append(dialog);

    let page = 0;
    function show(n) {
        page = n;
        const { heading, left: lines, faq } = PAGES[n];
        const column = el("div", c.column);
        column.append(...lines.map((line) => el("p", c.body, line)));
        left.replaceChildren(el("h2", c.heading, heading), column);
        const answers = el("div", c.faq);
        faq.forEach(({ q, a }, i) => {
            if (i > 0) answers.append(el("div", c.rule));
            answers.append(el("p", c.question, q), el("p", c.answer, a));
        });
        right.replaceChildren(el("h2", c.heading, "FAQ"), answers);
        prev.hidden = n === 0;
        next.hidden = n === PAGES.length - 1;
    }
    function close() {
        overlay.classList.add(o.closing);
        setTimeout(() => overlay.remove(), CLOSE_MS);
    }

    keepFromGame(overlay, [...POINTER, ...KEYS]);
    // clicks outside the book close it like theirs
    overlay.addEventListener("click", (event) => {
        if (!dialog.contains(event.target)) close();
    });
    overlay.addEventListener("keydown", (event) => {
        if (event.key === "Escape") close();
        if (event.key === "ArrowLeft" && page > 0) show(page - 1);
        if (event.key === "ArrowRight" && page < PAGES.length - 1) show(page + 1);
    });
    show(0);
    document.body.append(overlay);
    overlay.focus();
}
