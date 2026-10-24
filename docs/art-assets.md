# Art Assets

## How to draw them

- **SVG** where possible (sharp at any size, small). PNG only for textures, at 2× the shown size.
- **Same style as the logo:** thick dark outline, flat fill, slightly wobbly.
- **Dark mode:** the page follows the system theme. Either draw for both (the logo already works on dark and light), or leave outlines as `currentColor` so the CSS can recolour them.
- Put files in `assets/`, e.g. `assets/icons/coin.svg`.
- Sizes below are how big they're shown. Draw bigger, it scales down.

## 1. Game item icons (most visible, start here)

Shown next to inputs, in the route table header and in messages.

- [x] **Coin**: coins input, "Your picks cost", Spent / Sold / End coins columns (~20 px)
- [x] **Dirt plot**: plots input, Plots / New plots columns (~20 px)
- [x] **Apple seed**: apple seeds input (~20 px)
- [x] **Apple**: Sold column, milestones (~20 px) (drawn, not on the page yet)
- [x] **Carrot**: rent / free seeds (~20 px) (drawn, not on the page yet)
- [x] **Water drop**: hours: Hours / Max hours columns, Hours/week input (~20 px)
- [x] **Multiplier**: multiplier input (a star or sparkle?) (~20 px)
- [x] **Calendar**: date input, Week column (~20 px)
- [ ] **New seed** (placeholder): for when new seeds come out, see [how-terra-works.md](../research/how-terra-works.md) (~20 px)

## 2. Devices (tree root card + device picker)

Shown in the dashed root card at the bottom of the tree (~64 px) and next to the device picker (~24 px).

- [x] Framework 12
- [x] iPad Mini
- [x] Galaxy Tab S10 FE+

## 3. Upgrade icons (one per tree card, ~40 px)

Optional, but the tree looks a lot more like the game with them. Some can share a drawing.

Framework:
- [x] Framework Stylus
- [x] USB Expansion Card
- [ ] Fancy Expansion Card (USB card + sparkle?) (uses the USB card drawing for now)
- [x] Framework 12 DIY Edition (a box / kit)
- [x] RAM stick
- [x] SSD
- [x] CPU chip: one drawing for Core 3 304, i5-1334U, Core 5 320, Ryzen AI 7 350 (label underneath), or four (one drawing, saved as four rotated files: `upgrade-cpu-core3/-i5/-core5/-ryzen.svg`, so each can be tweaked on its own; `upgrade-cpu.svg` is the original)
- [x] Framework 13 (laptop) (uses the Framework laptop drawing)
- [x] 2.8K Display

iPad:
- [x] Apple Pencil (one pencil for both)
- [x] Apple Pencil Pro (one pencil for both)
- [x] iPad Air 11 / iPad Air 13 / iPad Pro 11 (one tablet drawing, different sizes?) (one tablet for all three)
- [x] Smart Folio
- [x] Magic Keyboard Folio

Galaxy:
- [x] Galaxy Tab S11 / Galaxy Tab S10+ (one tablet drawing?) (one tablet for both)
- [x] Smart Book Cover (uses the folio drawing)
- [x] Book Cover Keyboard Slim (uses the keyboard drawing)

## 4. Small marks and status icons

These are the little glyphs. Right now they're Pico's built-in icons or plain text characters. Draw them simple and chunky, they're shown small.

Marks (~16 px):
- [x] **Check mark**: inside checked checkboxes, and in the green milestone pills ("after Week 3")
- [x] **Cross**: in the red milestone pills ("not by Week 12"), and the error panel's ok button
- [x] **Plus** and **minus**: the − / + steppers (now the text characters − and +)
- [x] **Dropdown arrow**: the device picker (now Pico's chevron)
- [x] **Calendar**: inside the date input (now Pico's / the browser's icon) (drawn (`date-input.svg`), not on the page yet: Firefox draws its own calendar inside date inputs and doesn't let pages replace it)
- [ ] **Up / down arrows** for number inputs: optional. Firefox and Chrome draw these themselves and they're hard to restyle, so the easy option is hiding them

Message box icons (~20 px), one per tone:
- [x] **Positive** (green box: "You need X h/week")
- [x] **Warning** (orange box: wasted water)
- [x] **Error** (red box: not reachable, stylus note)
- [x] **Info** (blue box: notes, "Terra hasn't started")

## 5. Controls

Each needs every state listed. The real inputs stay underneath (keyboard and screen readers keep working), your drawing is the skin.

- [ ] **Checkbox**: unchecked, checked, disabled, checked + disabled (~20 px)
- [ ] **− and + buttons**: normal, hover, disabled (~22 px)
- [ ] **Toolbar button** (presets): normal, hover, pressed (stretchy frame, see 6)
- [ ] **Button** (ok, Use my picks, Reset order, first): normal, hover (stretchy frame)
- [x] **Dropdown arrow** for the device picker (~16 px)
- [ ] **Text box frame** for inputs: normal, focused (stretchy frame)

## 6. Frames (stretchy borders)

Drawn once and stretched with CSS `border-image`: corners stay as drawn, edges stretch. Draw each as a square (~96 px) with the corners and edges clearly separate.

- [ ] **Panel** (Inventory, Plan, Goal, Your plan)
- [ ] **Tree card**: normal, wanted, owned
- [ ] **Root card** (dashed, the device)
- [ ] **Sunken area** (upgrades box, route table)
- [ ] **Message box** (one frame, recoloured per tone, or one per tone)

## 7. Lines and lettering

- [ ] **Tree lines**: the lines between cards are drawn by code, so they can't be images. Options: a hand-drawn line texture as a pattern, or a slight wobble filter. Tell me which and I'll wire it up.
- [ ] **Section titles** (Inventory, Plan, Goal, Upgrades, Your plan, When you can afford each pick): hand-lettered images instead of the Patrick Hand font. Optional, the font already does this.

## 8. Big pictures

- [ ] **Goofy error drawing** for the "something in that link was off" panel (~150 px), see the `TODO` in `index.html`
- [ ] **Terra's over** (after Week 12) (~120 px)
- [ ] **Terra hasn't started** (before Prep 1) (~120 px)
- [ ] **Not reachable** (sad, maybe next to the red box) (~120 px)

## Already done

- [x] Logo (`assets/terra-calc-logo-large.svg`)
- [x] Small logo (`assets/terra-calc-small-logo.svg`, not used on the page yet)
- [x] Icon / favicon (`assets/terra-calc-icon.svg`)

## Suggested order

1. Section 1 (game items). Small, everywhere, biggest change for the effort.
2. Section 4 (status icons) and the goofy error drawing.
3. Section 2 (devices).
4. Section 5 (controls), then 6 (frames). These change the whole feel the most but are the most fiddly.
5. Section 3 (upgrade icons) whenever, one at a time.

Remember art time counts toward Terra (up to 30%), track it with lapse.
