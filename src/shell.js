/* Thin bridge to the desktop shell (Tauri). Opened in a normal browser, it falls back
   to a stand-in so the whole UI works as a web demo without building the app. */
(function () {
  'use strict';
  const T = window.__TAURI__;
  if (T) {
    const inv = (cmd, args) => T.core.invoke(cmd, args).catch((e) => { console.warn(cmd, e); });
    window.Shell = {
      native: true,
      stage: (w, h, compact) => inv('set_stage', { w, h, compact }),
      show: () => inv('show_pet'),
      hide: () => inv('hide_pet'),
      focus: () => inv('focus_pet'),
      walk: (dx) => inv('walk_step', { dx }),
      dock: () => inv('dock'),
      drag: () => T.window.getCurrentWindow().startDragging().catch(() => {}),
      quit: () => inv('quit'),
      open: (url) => inv('plugin:opener|open_url', { url }),
      version: () => T.app.getVersion().catch(() => null),
      onTick: (cb) => T.event.listen('tick', cb),
      onTray: (cb) => T.event.listen('tray', (e) => cb(e.payload)),
      autostart: {
        get: () => inv('plugin:autostart|is_enabled'),
        set: (on) => inv(on ? 'plugin:autostart|enable' : 'plugin:autostart|disable'),
      },
    };
  } else {
    const nop = () => Promise.resolve(false);
    let x = 0; // in the demo, "walking" slides the stage across the page
    document.documentElement.classList.add('preview');
    window.Shell = {
      native: false, stage: nop, show: nop, hide: nop, focus: nop, dock: nop, drag: nop, quit: nop,
      walk: (dx) => {
        const st = document.getElementById('stage'), lo = -st.offsetLeft, hi = Math.max(lo, innerWidth - st.offsetLeft - st.offsetWidth);
        x += dx; const edge = x <= lo || x >= hi; x = Math.max(lo, Math.min(hi, x));
        st.style.translate = x + 'px 0';
        return Promise.resolve(edge);
      },
      open: (url) => { window.open(url, '_blank', 'noopener'); return Promise.resolve(); },
      version: () => Promise.resolve(null),
      onTick: (cb) => setInterval(cb, 1000), onTray: () => {},
      autostart: { get: nop, set: nop },
    };
  }
})();
