// what to do next panel in terra's page

let root = null;
let noticeBox = null;
let planBox = null;

// screen corner for now, maybe terra menu tab later
export function mountPanel() {
    if (root) return;
    root = document.createElement("div");
    root.id = "terra-calc-panel";
    noticeBox = document.createElement("div");
    planBox = document.createElement("div");
    planBox.textContent = "Terra Calc";
    root.append(noticeBox, planBox);
    document.body.append(root);
}

// notices above plan, no dupes
export function showNotice(text) {
    if (!root || [...noticeBox.children].some((line) => line.textContent === text)) return;
    const line = document.createElement("p");
    line.textContent = text;
    noticeBox.append(line);
}

// plan from main.js, null if not enough to go on
// TODO title only so far. needs this weeks line ("buy 5 plots + 25 apple seeds, code 35 h"), hours left, goal progress bar, game vs typed numbers
export function drawPanel(plan) {
    if (!root) return;
    planBox.textContent = plan ? "Terra Calc" : "Terra Calc (waiting for the game)";
}

// TODO: site-style inputs for whatever fill.js gave null
// maybe reuse terra's css (fonts, panel look)
