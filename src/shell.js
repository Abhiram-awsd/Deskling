/* Thin bridge to the desktop shell (Tauri). Opened in a normal browser, it falls back
   to no-ops so the whole UI can be developed and previewed without building the app. */
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
      walk: (dx) => inv('walk_step', { dx }),
      dock: () => inv('dock'),
      drag: () => T.window.getCurrentWindow().startDragging().catch(() => {}),
      quit: () => inv('quit'),
      onTick: (cb) => T.event.listen('tick', cb),
      onTray: (cb) => T.event.listen('tray', (e) => cb(e.payload)),
      autostart: {
        get: () => inv('plugin:autostart|is_enabled'),
        set: (on) => inv(on ? 'plugin:autostart|enable' : 'plugin:autostart|disable'),
      },
    };
  } else {
    const nop = () => Promise.resolve(false);
    document.documentElement.classList.add('preview');
    window.Shell = {
      native: false, stage: nop, show: nop, hide: nop, walk: nop, dock: nop, drag: nop, quit: nop,
      onTick: (cb) => setInterval(cb, 1000), onTray: () => {},
      autostart: { get: nop, set: nop },
    };
  }
})();
