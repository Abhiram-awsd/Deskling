/* Deskling characters.
   Every figurine is described once, as a short list of vector shapes on a 64x64 grid.
   The same description is drawn three ways: "soft" (shaded SVG), "pixel" (32x32 sprite)
   and "neon" (glowing outline). To add your own figurine, copy one entry in CHARS,
   change the shapes and colours, and it shows up in all three looks. See CONTRIBUTING.md. */
(function () {
  'use strict';

  // ---- tiny path helpers (everything is a path so one renderer handles all shapes)
  const E = (cx, cy, rx, ry = rx) =>
    `M${cx - rx},${cy}a${rx},${ry} 0 1,0 ${2 * rx},0a${rx},${ry} 0 1,0 ${-2 * rx},0Z`;
  const R = (x, y, w, h, r = 0) =>
    `M${x + r},${y}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 ${-r},${r}h${-(w - 2 * r)}a${r},${r} 0 0 1 ${-r},${-r}v${-(h - 2 * r)}a${r},${r} 0 0 1 ${r},${-r}Z`;
  // a rounded "figurine" dome: centre x, top y, half width, bottom y
  const D = (cx, t, hw, b) => {
    const k = (b - t) * 0.16;
    return `M${cx - hw},${b - 12}C${cx - hw},${t + k} ${cx - hw * 0.62},${t} ${cx},${t}C${cx + hw * 0.62},${t} ${cx + hw},${t + k} ${cx + hw},${b - 12}C${cx + hw},${b - 2} ${cx + hw * 0.6},${b} ${cx},${b}C${cx - hw * 0.6},${b} ${cx - hw},${b - 2} ${cx - hw},${b - 12}Z`;
  };

  const INK = '#2b2438', WHITE = '#ffffff', BLUSH = '#ff8fa6';

  // shape = [path, fill, stroke, strokeWidth]; colours are palette keys or hex
  // optional `over` shapes are drawn on top of the face (teeth, visors...)
  const CHARS = [
    { id: 'bolt', name: 'Bolt', kind: 'robot', glow: '#3df0ff',
      pal: { a: '#8f9bbd', b: '#5f6a90', c: '#3df0ff', d: '#1a1f38' },
      face: { x: [25.5, 38.5], y: 27, r: 2.8, my: 32, mouth: 'smile', ink: 'c', brow: false },
      body: [
        [R(31, 6, 2, 8), 'd'], [R(28.5, 3.5, 7, 4, 1.5), 'c'],
        [R(7, 22, 7, 13, 2), 'b'], [R(50, 22, 7, 13, 2), 'b'],
        [R(19, 43, 26, 13, 4), 'b'], [R(27, 47, 10, 4, 1.5), 'd'], [R(28.5, 48.2, 4, 1.6, 0.8), 'c'],
        [R(21, 54.5, 9, 4, 1.5), 'd'], [R(34, 54.5, 9, 4, 1.5), 'd'],
        [R(13, 13, 38, 31, 7), 'a'], [R(17, 19, 30, 19, 4), 'd'],
      ] },
    { id: 'nova', name: 'Nova', kind: 'astronaut', glow: '#7fe7ff',
      pal: { a: '#eef1f7', b: '#b9c0d2', c: '#ff8a2a', d: '#1c2440', e: '#7fe7ff', f: '#4a5a8c' },
      face: { x: [26, 38], y: 27, r: 2.6, my: 32.5, mouth: 'smile', ink: 'e', brow: false },
      body: [
        [R(11, 32, 42, 20, 6), 'b'],
        [D(32, 34, 15.5, 57), 'a'],
        [R(27, 46, 10, 6, 2), 'c'],
        [R(21, 54.5, 9, 4, 2), 'b'], [R(34, 54.5, 9, 4, 2), 'b'],
        [E(32, 26, 20.5, 19), 'a'],
        [R(16.5, 16.5, 31, 20, 9.5), 'd'],
        ['M21,23q2.5,-3.5 8,-4', null, 'f', 2],
      ] },
    { id: 'fang', name: 'Fang', kind: 'wolf', glow: '#9fc4ff',
      pal: { a: '#76819a', b: '#4d566e', d: '#2c3145', w: '#e8ecf4' },
      face: { x: [24, 40], y: 32.5, r: 2.8, my: 45.5, mouth: 'smile', nose: 42 },
      body: [
        ['M46,55C60,55 63,42 56,33C56,43 52,46 45,47Z', 'b'],
        ['M11,29L12,5L29,20Z', 'a'], ['M53,29L52,5L35,20Z', 'a'],
        ['M14.5,22L14.8,11L22,17.5Z', 'd'], ['M49.5,22L49.2,11L42,17.5Z', 'd'],
        [D(32, 17, 21, 57), 'a'],
        ['M32,22L27,16h10Z', 'b'],
        ['M32,38C26,34 15,37 12,44C15,54 25,57 32,57C39,57 49,54 52,44C49,37 38,34 32,38Z', 'w'],
      ] },
    { id: 'bones', name: 'Bones', kind: 'skull', glow: '#d8fff2',
      pal: { a: '#f1ede2', b: '#353a58', d: '#b9b3a2' },
      face: { x: [24, 40], y: 28, r: 5, my: 40, mouth: 'none', hl: false, brow: false },
      body: [
        [D(32, 44, 13, 58), 'b'],
        [R(21.5, 38, 21, 12.5, 4), 'a'],
        [R(13, 10, 38, 32, 15), 'a'],
        ['M27,44.5v6M32,44.5v6M37,44.5v6', null, 'd', 1.5],
      ],
      over: [['M32,34.5l-2.3,4.2h4.6Z', 'ink']] },
    { id: 'rook', name: 'Rook', kind: 'raccoon', glow: '#c8d2ff',
      pal: { a: '#8a90a2', b: '#646a7e', d: '#262a3a', w: '#eef0f6', e: '#f6f7fb' },
      face: { x: [24, 40], y: 31.5, r: 2.5, my: 46, mouth: 'smile', nose: 42.5, ink: 'e', brow: false },
      body: [
        ['M46,55C60,55 63,42 56,33C56,43 52,46 45,47Z', 'a'], ['M49.5,50.5l5,2.5M54,43.5l5,1', null, 'd', 2.6],
        [E(16.5, 20, 6.5), 'a'], [E(47.5, 20, 6.5), 'a'], [E(16.5, 20, 3.2), 'd'], [E(47.5, 20, 3.2), 'd'],
        [D(32, 17, 21, 57), 'a'],
        ['M12.5,31C18,24.5 27,25.5 32,29.5C37,25.5 46,24.5 51.5,31C49,38.5 40,38.5 32,35C24,38.5 15,38.5 12.5,31Z', 'd'],
        [E(32, 45.5, 8.5, 6), 'w'],
      ],
      over: [[E(32, 42.5, 2.3, 1.7), 'd'], ['M29,46q3,3 6,0', null, 'd', 1.7]] },
    { id: 'strix', name: 'Strix', kind: 'owl', glow: '#ffb45c',
      pal: { a: '#7d5b45', b: '#5a3f30', c: '#ff9a2e', w: '#f4e4c4' },
      face: { x: [24, 40], y: 31, r: 3.3, my: 40, mouth: 'none', brow: false },
      body: [
        ['M12,36C6,43 7,51 12,54C13,47 15,42 17,39Z', 'b'], ['M52,36C58,43 57,51 52,54C51,47 49,42 47,39Z', 'b'],
        ['M13,25L14,7L28,18Z', 'a'], ['M51,25L50,7L36,18Z', 'a'],
        [D(32, 15, 20.5, 57), 'a'],
        [E(32, 49, 11.5, 7), 'w'], ['M27,46l2.5,2l2.5,-2l2.5,2l2.5,-2M29.5,50.5l2.5,2l2.5,-2', null, 'a', 1.2],
        [E(24, 31, 8.2), 'w'], [E(40, 31, 8.2), 'w'],
        [E(25.5, 57, 4.5, 2), 'c'], [E(38.5, 57, 4.5, 2), 'c'],
      ],
      over: [['M29.3,35.5h5.4l-2.7,5Z', 'c']] },
    { id: 'nimbo', name: 'Nimbo', kind: 'storm cloud', glow: '#ffe45c', float: true,
      pal: { a: '#5f6a8c', b: '#47506e', c: '#ffd93b' },
      face: { x: [25, 39], y: 31, r: 2.6, my: 37, mouth: 'smile', ink: 'c', brow: false },
      body: [
        ['M34,43l-7,9h4.5l-2.5,7.5l9,-11h-5l3,-5.5Z', 'c'],
        ['M16,44C8,44 6,34 12.5,30C11.5,22 20.5,17 27,21C31,11.5 45.5,12.5 47.5,23C55.5,23 59.5,33 53.5,40C51.5,43 48.5,44 45,44Z', 'a'],
        ['M18,40.5h10M38,40.5h9', null, 'b', 2],
      ] },
    { id: 'inky', name: 'Inky', kind: 'octopus', glow: '#b79bff',
      pal: { a: '#7658d1', b: '#5a3fb0', w: '#c9b8ff' },
      face: { x: [25, 39], y: 30, r: 3, my: 37.5, mouth: 'smile' },
      body: [
        ['M17,42q-3,9 -9,8', null, 'a', 6], ['M47,42q3,9 9,8', null, 'a', 6],
        ['M25,45q-1,9 -7,10.5', null, 'a', 6], ['M39,45q1,9 7,10.5', null, 'a', 6],
        ['M32,46v9', null, 'a', 6],
        [D(32, 11, 19.5, 48), 'a'],
        [E(20, 21, 2), 'b'], [E(44.5, 19, 1.6), 'b'], [E(41, 15.5, 1.1), 'b'],
        [E(8.5, 50, 1.3), 'w'], [E(55.5, 50, 1.3), 'w'],
      ] },
    { id: 'frost', name: 'Frost', kind: 'yeti', glow: '#9fe3ff',
      pal: { a: '#e9f2fb', b: '#c3d5e8', f: '#7f9fc2', h: '#51607f' },
      face: { x: [25, 39], y: 33, r: 2.6, my: 41, mouth: 'wide' },
      body: [
        ['M16,24L8,9L24,17Z', 'h'], ['M48,24L56,9L40,17Z', 'h'],
        ['M11,40C4,43 4,51 9,54C10,48 12,46 15,44Z', 'b'], ['M53,40C60,43 60,51 55,54C54,48 52,46 49,44Z', 'b'],
        [D(32, 14, 21.5, 57), 'a'],
        ['M32,24.5C24,22 16.5,27 16.5,35.5C16.5,44 24,48.5 32,48.5C40,48.5 47.5,44 47.5,35.5C47.5,27 40,22 32,24.5Z', 'f'],
        ['M27,15.5l2.5,4l2.5,-4l2.5,4l2.5,-4', null, 'b', 1.6],
        [E(24.5, 56.5, 5.5, 2.3), 'b'], [E(39.5, 56.5, 5.5, 2.3), 'b'],
      ],
      over: [['M25.5,45.4l1.6,-3.2l1.6,3.2Z', 'white'], ['M35.3,45.4l1.6,-3.2l1.6,3.2Z', 'white']] },
    { id: 'echo', name: 'Echo', kind: 'bat', glow: '#d59bff', float: true,
      pal: { a: '#4b4070', b: '#342b52', c: '#c58be0', w: '#6f629a', e: '#ffe45c' },
      face: { x: [25, 39], y: 32, r: 3, my: 41, mouth: 'smile', ink: 'e', brow: false },
      body: [
        ['M15,31L1,21L5,35L1,45L15,45Z', 'b'], ['M49,31L63,21L59,35L63,45L49,45Z', 'b'],
        ['M14,26L15,4L30,18Z', 'a'], ['M50,26L49,4L34,18Z', 'a'],
        ['M17.5,20L18,10L25,16.5Z', 'c'], ['M46.5,20L46,10L39,16.5Z', 'c'],
        [D(32, 16, 19.5, 57), 'a'],
        [E(32, 50, 9.5, 5.5), 'w'],
      ],
      over: [['M28,43.3l1.3,2.6l1.3,-2.6Z', 'white'], ['M33.4,43.3l1.3,2.6l1.3,-2.6Z', 'white']] },
  ];

  // ---- face: drawn by the engine so every figurine shares the same expressions
  function faceShapes(ch, expr) {
    const f = ch.face, out = [], ink = f.ink || 'ink';
    const [x0, x1] = f.x, y = f.y, r = f.r;
    const push = (d, fill, stroke, w, extra) => out.push(Object.assign({ d, fill, stroke, w, face: true }, extra));
    if (f.cheeks) {
      const cx = f.cx || [x0 - 4.5, x1 + 4.5], cy = f.cy || y + 5.5;
      push(E(cx[0], cy, 3, 1.9), 'blush', null, 0, { o: 0.6, soft: true });
      push(E(cx[1], cy, 3, 1.9), 'blush', null, 0, { o: 0.6, soft: true });
    }
    for (const x of [x0, x1]) {
      if (expr === 'blink') push(`M${x - r},${y}h${2 * r}`, null, ink, 1.9);
      else if (expr === 'sleep') push(`M${x - r},${y - 0.5}q${r},${r * 0.9} ${2 * r},0`, null, ink, 1.9);
      else if (expr === 'happy') push(`M${x - r},${y + 1}q${r},${-r * 1.5} ${2 * r},0`, null, ink, 2);
      else {
        const rr = expr === 'wow' ? r * 1.25 : r;
        push(E(x, y, rr), ink);
        if (!f.ink && f.hl !== false) push(E(x + rr * 0.34, y - rr * 0.36, rr * 0.36), 'white', null, 0, { hl: true });
      }
    }
    if (f.brow !== false && (expr === 'idle' || expr === 'focus' || expr === 'wow')) {
      const k = expr === 'focus' ? 1.7 : expr === 'wow' ? -0.6 : 0.7, up = expr === 'wow' ? 4 : 2.9;
      push(`M${x0 - r - 0.6},${y - r - up}l${2 * r + 1.2},${k}`, null, ink, 1.8);
      push(`M${x1 + r + 0.6},${y - r - up}l${-(2 * r + 1.2)},${k}`, null, ink, 1.8);
    }
    if (f.nose) push(E(32, f.nose, 2.3, 1.7), f.noseInk || ink);
    const my = f.my, open = expr === 'happy' || expr === 'wow';
    if (f.mouth === 'smile') {
      if (open) push(`M28.6,${my - 0.5}q3.4,6 6.8,0Z`, ink);
      else if (expr === 'focus') push(`M29.8,${my + 0.8}h4.4`, null, ink, 1.7);
      else push(`M29,${my}q3,3 6,0`, null, ink, 1.7);
    } else if (f.mouth === 'cat') {
      push(`M27.5,${my}q2.25,2.6 4.5,0q2.25,2.6 4.5,0`, null, ink, 1.6);
    } else if (f.mouth === 'wide') {
      push(open ? `M23,${my - 1}Q32,${my + 9} 41,${my - 1}Z` : `M22,${my - 1}Q32,${my + 6} 42,${my - 1}`, open ? ink : null, open ? null : ink, 1.8);
    } else if (f.mouth === 'o') {
      push(open ? E(32, my + 0.5, 3.2, 3.8) : E(32, my, 2.1, 2.6), ink);
    }
    return out;
  }

  function shapesFor(ch, expr) {
    const body = ch.body.map(([d, fill, stroke, w]) => ({ d, fill, stroke, w }));
    const over = (ch.over || []).map(([d, fill, stroke, w]) => ({ d, fill, stroke, w, over: true }));
    return body.concat(faceShapes(ch, expr), over);
  }

  // ---- colour helpers
  const named = { ink: INK, white: WHITE, blush: BLUSH };
  const col = (ch, k) => (k == null ? null : ch.pal[k] || named[k] || k);
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const hex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (h, t, a) => { const A = rgb(h), B = rgb(t); return hex(A.map((v, i) => v + (B[i] - v) * a)); };
  function neonize(h, glow) {
    let [r, g, b] = rgb(h).map((v) => v / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let l = (mx + mn) / 2, s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)), hu = 0;
    if (s < 0.14) return glow;
    if (mx === r) hu = ((g - b) / d) % 6; else if (mx === g) hu = (b - r) / d + 2; else hu = (r - g) / d + 4;
    hu = (hu * 60 + 360) % 360; s = Math.max(s, 0.9); l = Math.min(0.74, Math.max(0.64, l));
    return `hsl(${hu.toFixed(0)} ${(s * 100).toFixed(0)}% ${(l * 100).toFixed(0)}%)`;
  }

  // ---- soft + neon: SVG
  function svg(ch, expr, look) {
    const shapes = shapesFor(ch, expr);
    let defs = '', body = '', inFace = false;
    const seen = new Set();
    for (const s of shapes) {
      if (!!s.face !== inFace) { body += s.face ? '<g class="f">' : '</g>'; inFace = !!s.face; }
      const fill = col(ch, s.fill), stroke = col(ch, s.stroke);
      if (look === 'neon') {
        if (s.hl || s.soft) continue;
        if (s.face) {
          const c = ch.glow;
          body += fill
            ? `<path d="${s.d}" fill="${c}"/>`
            : `<path d="${s.d}" fill="none" stroke="${c}" stroke-width="${s.w}" stroke-linecap="round" stroke-linejoin="round"/>`;
        } else if (fill && s.over) {
          body += `<path d="${s.d}" fill="${neonize(fill, ch.glow)}"/>`;
        } else if (fill) {
          body += `<path d="${s.d}" fill="#17142a" fill-opacity=".92" stroke="${neonize(fill, ch.glow)}" stroke-width="1.5" stroke-linejoin="round"/>`;
        } else {
          body += `<path d="${s.d}" fill="none" stroke="#17142a" stroke-width="${s.w + 1.6}" stroke-linecap="round"/><path d="${s.d}" fill="none" stroke="${neonize(stroke, ch.glow)}" stroke-width="1.5" stroke-linecap="round"/>`;
        }
        continue;
      }
      const op = s.o ? ` opacity="${s.o}"` : '';
      if (fill) {
        let paint = fill;
        if (!s.face) {
          const id = 'g' + fill.slice(1);
          if (!seen.has(id)) {
            seen.add(id);
            defs += `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(fill, '#ffffff', 0.22)}"/><stop offset=".55" stop-color="${fill}"/><stop offset="1" stop-color="${mix(fill, '#3a2a66', 0.2)}"/></linearGradient>`;
          }
          paint = `url(#${id})`;
        }
        body += `<path d="${s.d}" fill="${paint}"${op}/>`;
      } else {
        body += `<path d="${s.d}" fill="none" stroke="${stroke}" stroke-width="${s.w}" stroke-linecap="round" stroke-linejoin="round"${op}/>`;
      }
    }
    if (inFace) body += '</g>';
    return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>${defs}</defs>${body}</svg>`;
  }

  // ---- pixel: draw the same shapes on a 32x32 canvas, snap to the palette, add an outline
  const cache = new Map();
  let scratch = null;
  function pixelData(ch, expr) {
    const key = ch.id + ':' + expr;
    if (cache.has(key)) return cache.get(key);
    const N = 32;
    if (!scratch) { scratch = document.createElement('canvas'); scratch.width = scratch.height = N; }
    const ctx = scratch.getContext('2d', { willReadFrequently: true });
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, N, N); ctx.scale(N / 64, N / 64);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const pal = [];
    for (const s of ch.body.concat(ch.over || []).map(([d, fill, stroke, w]) => ({ d, fill, stroke, w }))) {
      const p = new Path2D(s.d), c = col(ch, s.fill) || col(ch, s.stroke);
      if (!pal.includes(c)) pal.push(c);
      if (s.fill) { ctx.fillStyle = c; ctx.fill(p); }
      else { ctx.strokeStyle = c; ctx.lineWidth = Math.max(s.w, 2.2); ctx.stroke(p); }
    }
    const P = pal.map(rgb), img = ctx.getImageData(0, 0, N, N), px = img.data;
    const solid = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) {
      const o = i * 4;
      if (px[o + 3] < 120) { px[o + 3] = 0; continue; }
      let best = 0, bd = 1e9;
      for (let k = 0; k < P.length; k++) {
        const d = (px[o] - P[k][0]) ** 2 + (px[o + 1] - P[k][1]) ** 2 + (px[o + 2] - P[k][2]) ** 2;
        if (d < bd) { bd = d; best = k; }
      }
      px[o] = P[best][0]; px[o + 1] = P[best][1]; px[o + 2] = P[best][2]; px[o + 3] = 255; solid[i] = 1;
    }
    // the face is placed by hand on the pixel grid so it stays crisp (mirrored left/right)
    const f = ch.face, ink = rgb(col(ch, f.ink || 'ink'));
    const dot = (x, y, c) => { if (x < 0 || y < 0 || x >= N || y >= N) return; const o = (y * N + x) * 4; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255; solid[y * N + x] = 1; };
    const both = (x, y, c = ink) => { dot(x, y, c); dot(N - 1 - x, y, c); };
    const L = Math.round(f.x[0] / 2) - 1, T = Math.round(f.y / 2) - 1, big = f.r >= 4, s = big ? 3 : 2;
    if (f.cheeks) {
      const cx = Math.round((f.cx ? f.cx[0] : f.x[0] - 4.5) / 2) - 1, cy = Math.round((f.cy || f.y + 5.5) / 2);
      const bl = rgb(mix(BLUSH, col(ch, 'a'), 0.3)); both(cx, cy, bl); both(cx + 1, cy, bl);
    }
    if (expr === 'blink' || expr === 'sleep') { for (let i = -1; i < s; i++) both(L + i, T + 1); if (expr === 'sleep') both(L + s, T + 1); }
    else if (expr === 'happy') { both(L - 1, T + 1); for (let i = 0; i < s; i++) both(L + i, T); both(L + s, T + 1); }
    else {
      const h = expr === 'wow' ? s + 1 : s;
      for (let y = 0; y < h; y++) for (let x = 0; x < s; x++) both(L + x, T + y - (h - s));
      if (!f.ink && f.hl !== false) { dot(L + s - 1, T - (h - s), [255, 255, 255]); dot(N - 1 - L, T - (h - s), [255, 255, 255]); }
      if (expr === 'focus' && f.brow !== false) { both(L - 1, T - 2); both(L, T - 2); both(L + 1, T - 1); }
    }
    if (f.nose) { const c = rgb(col(ch, f.noseInk || f.ink || 'ink')), n = Math.floor(f.nose / 2); dot(15, n, c); dot(16, n, c); }
    const M = Math.round(f.my / 2), open = expr === 'happy' || expr === 'wow';
    if (f.mouth === 'smile') {
      if (expr === 'focus') both(15, M);
      else { both(14, M); both(15, M + 1); if (open) both(15, M); }
    } else if (f.mouth === 'cat') { both(13, M); both(14, M + 1); both(15, M); }
    else if (f.mouth === 'wide') { both(11, M); for (let x = 12; x < 16; x++) both(x, M + 1); if (open) for (let x = 13; x < 16; x++) both(x, M + 2); }
    else if (f.mouth === 'o') { both(15, M); if (open) both(15, M + 1); }
    const line = rgb(mix(col(ch, 'a'), '#1d1730', 0.78));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      if (solid[i]) continue;
      if ((x > 0 && solid[i - 1]) || (x < N - 1 && solid[i + 1]) || (y > 0 && solid[i - N]) || (y < N - 1 && solid[i + N])) {
        px[i * 4] = line[0]; px[i * 4 + 1] = line[1]; px[i * 4 + 2] = line[2]; px[i * 4 + 3] = 255;
      }
    }
    cache.set(key, img);
    return img;
  }

  const byId = (id) => CHARS.find((c) => c.id === id) || CHARS[0];

  function mount(el, opts) {
    const cur = { char: opts.char, look: opts.look, expr: opts.expr || 'idle' };
    function draw() {
      const ch = byId(cur.char);
      el.dataset.look = cur.look;
      el.style.setProperty('--glow', ch.glow);
      el.classList.toggle('floats', !!ch.float);
      if (cur.look === 'pixel') {
        let c = el.querySelector('canvas');
        if (!c) { el.innerHTML = '<canvas width="32" height="32"></canvas>'; c = el.firstChild; }
        c.getContext('2d').putImageData(pixelData(ch, cur.expr), 0, 0);
      } else el.innerHTML = svg(ch, cur.expr, cur.look);
    }
    draw();
    return { set(p) { let ch = false; for (const k in p) if (cur[k] !== p[k]) { cur[k] = p[k]; ch = true; } if (ch) draw(); }, get: () => cur };
  }

  window.Buddy = { CHARS, LOOKS: ['pixel', 'soft', 'neon'], byId, mount, svg };
})();
