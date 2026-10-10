# Icons

Hand-drawn by Cloveian, traced over [Lucide](https://lucide.dev) icons (v0.460.0, ISC licence, see `LICENSE-lucide`) and the form icons from [Pico CSS](https://picocss.com) (v2.0.6, MIT). All 24 × 24, one colour.

The page uses most of them as CSS masks (only the shape counts, the colour comes from the CSS), so they can be any colour in the file. The list of what goes where is in `style.css` (`.icon-…` classes) and [docs/art-assets.md](../../docs/art-assets.md).

`checkbox-tick-white.svg` and `checkbox-tick-dark.svg` are recoloured copies of `checkbox-tick.svg`, because a checkbox's tick can only be a plain image, not a mask. After redrawing the tick, make them again:

```sh
sed 's/stroke:#000000/stroke:#ffffff/g' checkbox-tick.svg > checkbox-tick-white.svg
sed 's/stroke:#000000/stroke:#0f2a2e/g' checkbox-tick.svg > checkbox-tick-dark.svg
```
