# How Terra looks

How the game draws its boxes, buttons and text, so the userscript's panel and the Want bits can look like they belong there instead of like a sticky note from 2004. Pulled out of the HAR captures on 21 Oct: the 20 Oct one (`terra.hackclub.com.har`) for most of it, plus the 9 Oct one for the panels the newer capture never opened (DevlogTerminal, BattleDome). The Chrome capture and the 19 Oct one have no CSS bodies in them.

The dump is in `research/terra-js/css/` (gitignored, it's their code): the raw files, the `/assets/sprites/ui/` images, and pretty-printed copies in `css/pretty/` cuz the originals are minified to 47 lines total. Everything below is copied from those, not eyeballed.

## The ground rules

- **Class names are CSS modules** (`._node_zskb9_255`), and the hash changes every build. The local name in the middle (`_node_`) doesn't. So anything here is named by its local name and file, grep the pretty copy for it.
- **Sprite paths aren't hashed** (`/assets/sprites/ui/quest-card-bg.svg`), and the userscript runs on `terra.hackclub.com`, so we can just use them in our own CSS. Nothing to copy or bundle.
- **The font is a variable.** Every rule in the game uses `font-family: var(--game-font, "Pleasurize", cursive)`. Use the same thing and we get whatever font the player picked in settings (OpenDyslexic included) for free.
- There's no `border-image` or 9-slice anywhere. Frames are flat colours, solid borders and hard offset shadows, and the fancy ones get a stretched SVG background on top.

## Palette

Counts are across GameCanvas, ban, index, DialogueUI and Tooltip.

| Colour | Count | What it's for |
| --- | --- | --- |
| `#93582c` | 126 | the main border colour, mid-brown labels, the fill of outlined text |
| `#462114` | 66 | dark outer frames, dark text, the tooltip background |
| `#f9e6ce` | 64 | lightest cream: text stroke, slots, inputs, inner cards |
| `#5c3310` | 43 | body text |
| `#f4ca95` | 38 | tan paper inside frames, text on dark buttons |
| `#c7793c` | 31 | the orange card frame, hover/selected borders |
| `#733b11` | 26 | headers, active tabs, dark buttons |
| `#c0392b` | 16 | errors, danger buttons |
| `#1d0c00` | 13 | the hard drop shadow |
| `#3b1900` | 11 | the softer shadow brown |
| `#ffdeb3` | 9 | the cream window |
| `#ffca86` | 5 | quest card fill (under the sprite) |
| `#a8693a` | 5 | inactive tabs |
| `#e74c3c` | 4 | unread badges |
| `#27ae60` | 3 | green: ship/accept buttons, the tree's "owned" badge |
| `#974d16` | 2 | dark button hover |

So it's basically five browns, two creams and a tan, plus red and green for yes/no. *So* much brown.

## Fonts

`fonts.css` sets `:root { --game-font: 'Pleasurize', cursive; }`, and the font setting (`src/lib/gameFont.ts` on their side) puts `html[data-font="..."]` on the page to swap it: `opendyslexic`, `atkinson`, `lexend`, `nunito`, `fredoka`, `patrick-hand`, `pixelify`, `jetbrains-mono`, `merriweather`. The faces load from CDNs only once one's in use. The only other family in the game CSS is `ui-monospace` for code.

Patrick Hand's in that list, which is funny cuz it's what the site already uses.

## Sizing

The HUD doesn't use rem steps or a `--u` unit (that one's only on the landing page). Each widget sets its own font size as a `clamp(px, vmin, px)` and everything inside is in `em`:

| Widget | font-size |
| --- | --- |
| chat, cream window, tour | `clamp(14px, 1.8vmin, 22px)` |
| quest card | `clamp(16px, 2.2vmin, 28px)` |
| big tabbed panels (ban) | `clamp(18px, 1.5vw, 22px)`, vw not vmin |
| device tree panel | `clamp(26px, 2.1vw, 34px)`, nodes `clamp(15px, 1.15vw, 19px)` |
| confirm dialog | `clamp(14px, 1.3vw, 18px)` |

Borders on the HUD cards scale too (`clamp(2px, .3vmin, 4px)`). Phones are `@media (width <= 500px)`, which mostly drops to fixed px.

## The box recipes

### Framed modal (confirm dialog, disconnected, takeover)

The most 'Terra' one: a brown frame with a hard shadow, and a tan inset with a stitched dashed edge. From `ConfirmDialog-*.css`, the same recipe is in GameCanvas (`_disconnectedBacking_`, `_backing_`).

```css
._backing_ { /* the frame */
  background: #93582c;
  border: 5px solid #462114;
  border-radius: 1.8em;
  padding: .3em;
  position: relative;
}
._backing_:before { /* the hard shadow, a copy shoved 6px down-right */
  content: ""; border-radius: inherit; z-index: -1;
  background: #1d0c00;
  position: absolute; inset: -5px;
  transform: translate(6px, 6px);
}
._backingInset_ {
  background: #f4ca95;
  border-radius: 1.5em;
  padding: 1.8em 2.2em;
  position: relative;
}
._backingInset_:after { /* the stitching */
  content: ""; border-radius: inherit; pointer-events: none; z-index: -1;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100%25' height='100%25' rx='34' fill='none' stroke='%2393582C' stroke-width='8' stroke-dasharray='18 12' stroke-dashoffset='15' stroke-linecap='round'/%3E%3C/svg%3E") 0 0/100% 100% no-repeat;
  position: absolute; inset: -2px;
}
```

The stitching SVG has no viewBox, so it stretches to whatever box it's on and the dashes stay 18/12 px. The tabbed panels' headers use the same SVG with `rx='26'` and `stroke='%23F4CA9540'` (faint tan on dark brown), and the dialogue name tag uses `rx='10'`.

Title on these: `color: #462114; -webkit-text-stroke: .1rem #f9e6ce; paint-order: stroke fill;`, message `#5c3310` at line-height 1.5.

### Quest card (the HUD cards: chat, quests, notifications)

`_card_` + `_inner_` in GameCanvas. An orange frame, a double hard shadow, and the painted card sprite inside.

```css
._card_ {
  background: #c7793c;
  border: clamp(2px, .3vmin, 4px) solid #462114;
  border-radius: 1.2em;
  padding: .15em;
  box-shadow: clamp(2px, .2vmin, 3px) clamp(2px, .25vmin, 4px) #3b1900,
              clamp(2px, .2vmin, 3px) clamp(2px, .25vmin, 4px) 0 clamp(1px, .2vmin, 3px) #1d0c00;
}
._inner_ {
  background: #ffca86 url(/assets/sprites/ui/quest-card-bg.svg) top/100% repeat-y;
  border-radius: .95em;
  overflow: hidden;
}
```

`quest-card-bg.svg` is a 3916x1182 Figma export: a `#FFCA86` rect, wavy `#E9AE65` strokes and a noise filter. It tiles down at full width, so it works on any height. The quest title is the outlined-text recipe (below) at 1.2em with a 3px stroke.

### Cream window (the little popup at the top, the tour)

`_window_` in GameCanvas. One element, all the frame rings are box-shadows:

```css
background: #ffdeb3;
border: .3rem solid #c7793c;
border-radius: 1.4rem;
padding: .9em 1.2em .7em;
color: #5c3310;
box-shadow: inset 0 0 0 .12rem #e3bd8f, 0 0 0 .15rem #462114, .15rem .3rem 0 .15rem #3b1900;
```

That's prolly the easiest one to steal for our panel, it's a single div with no pseudo-elements. The simpler bubble version (`_note_` in ban, `_foxBubble_` in index) is `#ffdeb3`, `3px solid #93582c`, `border-radius: 12px`, `filter: drop-shadow(2px 3px #00000040)`.

### Big tabbed panel (inventory, friends, settings, mail)

In ban. `_backing_` is `#c7793c` with a `5px solid #462114` border and `1.8em` radius. The header is `#733b11` with the faint stitching. Tabs are `#a8693a` (`#733b11` when active) with `4px solid #462114` and no bottom border, rounded `1em 1em 0 0`. Inside is `_paper_`, a `#f4ca95` sheet with a `#f9e6ce` one under it rotated 5deg. Cute, but way too big for anything we'd draw.

### The device tree

`DeviceUpgradesUI-*.css`, the one the Want bits actually sit on. No sprites at all, just flat boxes and the faded tree picture behind.

- **panel:** `_backing_` `#c7793c`, `5px solid #462114`, `1.5em` radius. `_header_` `#733b11`. `_content_` `#f4ca95` with a faint grid (`linear-gradient(#93582c1f 1px, #0000 1px)` both ways).
- **nodes:** `_node_` is a **circle**, `140px`, `border-radius: 50%`, `#f9e6cedb` with `4px solid #93582c`, `box-shadow: 0 4px #46211459`, and `color: #462114`. It's centred with `transform: translate(-50%, -50%)`, and hover adds `scale(1.05)`, so anything we hang on a node scales with it. The device in the middle (`_nodeRoot_`) is 190px, `#c7793ce0` with a 5px `#462114` border.
- **node states:** `_nodeLocked_` gets `opacity: .55` and a dashed border, `_nodeOwned_` is `#faebd7e0` with a `#733b11` border, `_nodeMaxed_` is `#f2c183e0`, and `_nodeUnaffordable_` only changes the border to `#a38269`.
- **edges:** SVG lines with `stroke: #93582c; stroke-width: 4px`. Locked ones are `#93582c73` dashed `10 10`, owned ones `#733b11` at 6px.
- **badge:** `_nodeBadge_`, top-right of a node (`top: -.4em; right: -.4em`), `#f9e6ce` on `#733b11`, `2px solid #462114`, `border-radius: 1em`, `padding: .1em .5em`, `.65em` bold. The owned one is `#27ae60`.
- **text:** `_nodeTitle_` is .82em bold with `-webkit-text-stroke: 2px #f9e6ce`, and `_nodePrice_` / `_nodeCounter_` / `_nodeHint_` are `#5c3310`.
- **buttons:** primary `_primaryBtn_` is `#f4ca95` on `#733b11`, `3px solid #462114`, `.7em` radius, `.35em 1.1em` padding, `#974d16` on hover and `.55` when disabled. Secondary `_secondaryBtn_` is `#5c3310` on `#f0b870`, `3px solid #93582c`, `#edaa54` on hover. Danger is the secondary with `#c0392b` text and border.
- **modal / toast:** `_modal_` is `#f4ca95`, `4px solid #462114`, `1.2em` radius, `box-shadow: 0 6px #462114`. `_toast_` is `#f9e6ce` on `#462114` with `3px solid #733b11`, red border when it's an error.

Our tag right now (`#fffbe8`, a green `#6a9a3a` border, sans-serif) is the opposite of all of that lol. The nearest thing Terra has is the badge, so a tag in the badge's colours under the node would match without looking like part of Terra's own badge.

## Buttons

| Kind | Recipe | Where |
| --- | --- | --- |
| dark | `#f4ca95` on `#733b11`, `3px solid #462114`, radius `.7em`, padding `.35em 1.1em`. hover `#974d16`, disabled `.55` | tree, GameCanvas `_button_` |
| dark, pushable | same, radius `.8em`, `box-shadow: 3px 3px #1d0c00`. active `translate(2px, 2px)` with a `1px 1px` shadow | `_disconnectedButton_` |
| cream | `#5c3310` on `#f9e6ce`, `3px solid #93582c` (4px on the dialog), radius `.8em`-`1em`, bold, `box-shadow: 2px 2px #1d0c0080`. hover `#f4ca95`, active loses the shadow and moves 2px. the dialog's is `3px 3px` and only drops to `1px 1px` | confirm, chat send, submit |
| small tab / close | `#f4ca95` on `#a8693a`, `3px solid #462114`, radius `.8em`, padding `.15em .7em`. hover `#733b11` | chat tabs |
| round key | `#462114` on `#f4ca95`, `3px solid #93582c`, `50%`, `box-shadow: 0 3px #46211459`, pressed `translateY(2px)` | touch buttons |
| text only | `#733b11` at opacity `.7` (`.75` on the dialog), 1 on hover | cancel, close |
| green / red | `#fff` on `#27ae60` / `#c0392b` | ship, accept, reject, logout |

The press effect is the same everywhere: the button moves into its own hard shadow. No gradients, no blur on buttons.

## Inputs and checkboxes

- chat `_input_`: `#5c3310` on `#f9e6ce`, `3px solid #93582c`, radius `1em`, padding `.35em .7em`, no outline. On focus the border goes `#733b11`. Placeholder is `#93582c` at `.6`.
- the ban panels use a lighter version (`#fff`, `1px solid #93582c`, pill radius `1.8em`), so it's not totally consistent on their end either.
- checkbox (ban): `#f9e6ce`, `2px solid #93582c`, radius `.3em`, `1.6em` square, checked is `#93582c` with a cream tick.

## Badges and tooltips

- small count badge: `#f4ca95` on `#93582c`, radius `.4em`, `.75em` (`_quantity_`, `_timeBadge_`)
- unread: `#fff` on `#e74c3c`, `2px solid #a8693a`, radius `.7em`, `.7em` bold
- status banners: `#c0392b` text on `#c0392b22` with `1px solid #c0392b55`, and the green one is `#1e7e34` on `#27ae6022`
- tooltip: `#f9e6ce` on `#462114`, `3px solid #93582c`, radius `.6em`, padding `.3em .7em`, `.85em`, `box-shadow: 2px 2px #1d0c00`. The file sets arrow colours on an `:after` that never gets drawn, so their tooltips have no arrow.

## Outlined text

The big labels and coin counts are text with a cream outline, no box:

```css
color: #93582c;
-webkit-text-stroke: 3px #f9e6ce;  /* 2-4px depending on size */
paint-order: stroke fill;
letter-spacing: .05em;
font-weight: 700;
```

`paint-order: stroke fill` is what stops the stroke eating into the letters. Without it a 4px stroke makes everything look bold and blurry.

## What the sprites are

| Sprite | How it's used |
| --- | --- |
| `quest-card-bg.svg` | `#ffca86 url(...) top/100% repeat-y`, the HUD cards |
| `dialogue-box.svg` | `50%/100% 100% no-repeat`, stretched, the NPC text box. Also the seed shop's balance (`cover`) |
| `dialogue-option.svg` | stretched, the dialogue choice buttons |
| `tome/page.webp` | stretched, the tome pages |
| `pricetag.webp` | `50%/contain`, seed shop prices |
| `2-level-shelf.webp`, `seed-shop-{green,red,purple}.webp` | seed shop background and tabs |

`dialogue-box.svg` is 6864x1352: a dark `#3B1900` rect, the `#C7793C` frame on top with a `#462114` stroke, then a `#FFDEB3` inset with noise and wavy lines. It's the framed modal again, just painted. The HUD's map and bag buttons are `<img>`s, not CSS. They get `filter: drop-shadow(2px 3px #00000040)` and scale to 1.1 on hover.

## For us

None of this is decided, it's just what the dump makes easy:

- **the panel:** the cream window recipe (one div, box-shadow rings) with the cream buttons and outlined text for the "Terra Calc" title. Or the full framed modal if we want it to look like a real Terra dialog, that one needs a pseudo-element, so a `<style>` tag instead of inline `cssText`.
- **the Want tag:** badge colours (`#f9e6ce` on `#733b11`, `2px solid #462114`, radius `1em`), hung under the circle, with steppers like the round keys shrunk down.
- **font:** `var(--game-font, "Pleasurize", cursive)` everywhere, never hardcoded.
- **if Terra restyles:** this is a snapshot of the 9 and 20 Oct builds. Hardcoding the colours means a restyle leaves us behind but never breaks us. Reading them live out of `document.styleSheets` by local name (the "looking native" idea in [goal-in-terra.md](../docs/goal-in-terra.md#other-stuff)) would follow a restyle, but it breaks if they rename a class. idk, hardcoded is fine till it isn't.
