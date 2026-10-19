// what to do next panel in terra's page

let root = null;

// screen corner for now, maybe terra menu tab later
export function mountPanel() {
    if (root) return;
    root = document.createElement("div");
    root.id = "terra-calc-panel";
    root.textContent = "Terra Calc";
    document.body.append(root);
}

// plan from main.js, null if not enough to go on
// TODO title only so far. needs this weeks line ("buy 5 plots + 25 apple seeds, code 35 h"), hours left, goal progress bar, game vs typed numbers
export function drawPanel(plan) {
    if (!root) return;
    root.textContent = plan ? "Terra Calc" : "Terra Calc (waiting for the game)";
}

// TODO: site-style inputs for whatever fill.js gave null + "Terra changed" notice on failed CHECKS or new build id
// maybe reuse terra's css (fonts, panel look)
