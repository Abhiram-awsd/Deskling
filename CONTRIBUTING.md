# Contributing

## Add a character

Characters live in `src/characters.js` in the `CHARS` list. You describe a figurine once and it appears in all three looks.

1. Copy an existing entry and give it a new `id` and `name`.
2. `pal` is its palette. Shapes refer to colours by these keys.
3. `body` is a list of shapes on a 64×64 grid, drawn back to front: `[path, fillKey]` or `[path, null, strokeKey, strokeWidth]`.
   Helpers: `E(cx, cy, rx, ry)` ellipse, `R(x, y, w, h, radius)` rounded box, `D(cx, top, halfWidth, bottom)` figurine dome.
4. `face` says where the eyes (`x`, `y`, radius `r`) and mouth (`my`) go. Expressions (blink, happy, focus, sleep) come for free.
   Keep it left-right symmetric around x = 32.
5. `glow` is the neon colour.
6. Optional: give a shape a fifth value (`tail`, `earL`, `earR`, `flopL`, `flopR`, `lamp`, `tongue`) and it moves on its own.

Open `src/index.html` in a browser, go to Buddy, and check your character in Pixel, Soft and Neon.

## Ground rules

- Keep it light: no frameworks, no build step, no image assets, no network calls.
- No always-running timers in the page. Hook into `tick()` in `src/app.js`.
- Original characters only, nothing from existing games, films or brands.
