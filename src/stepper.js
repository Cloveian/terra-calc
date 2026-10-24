// number box arrows, the site n the userscript both use these

// one arrow click on a number box, as text for its value. box = anything with step/min/max strings like an input
// step "any" counts as 1, stepUp() throws on it
export function stepped(value, box, direction) {
    const step = parseFloat(box.step) || 1;
    const decimals = (String(step).split(".")[1] ?? "").length;
    let n = (parseFloat(value) || 0) + direction * step;
    if (box.min !== "") n = Math.max(n, parseFloat(box.min));
    if (box.max !== "") n = Math.min(n, parseFloat(box.max));
    return n.toFixed(decimals);
}

// press() once on pointerdown, held = again every 70 ms after 400. stillThere() false = a redraw took the box, pointerup never comes
export function holdRepeat(button, press, stillThere = () => true) {
    let timer;
    button.addEventListener("pointerdown", (event) => {
        if (event.button > 0) return; // right / middle click
        event.preventDefault(); // focus stays where it was
        clearTimeout(timer); // second finger
        press();
        const again = (delay) => { timer = setTimeout(() => { if (stillThere()) { press(); again(70); } }, delay); };
        again(400);
    });
    for (const type of ["pointerup", "pointerleave", "pointercancel"]) button.addEventListener(type, () => clearTimeout(timer));
}
