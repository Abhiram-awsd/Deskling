# Deskling

A tiny figurine that lives on your desktop and keeps you on track. Windows, macOS and Linux.

![The characters in their three looks](docs/characters.png)

## What it does

- **Focus timer** – Pomodoro sessions with short and long breaks. The countdown sits under the figurine.
- **Tasks** – a short list for today, plus "the one thing" that would make the day a win.
- **Reminders** – water, stretch, eye rest, posture. They wait until your focus session ends.
- **Days** – streak, focus minutes for the last 7 days, and today's tally.
- **Morning check-in and evening recap.**
- **4 characters × 3 looks** – Bolt the robot, Nova the astronaut, Miso the cat and Biscuit the dog, each in pixel, soft or neon. Tails wag, ears twitch, lamps blink.
- **3 ways to live on screen** – sits where you drag it, walks along the bottom of the screen, or hides in the tray and pops out only for reminders.

Click the figurine to open the panel. Drag it to move it. Right-click it for a trick. Its eyes follow your pointer, and it reacts to hovers, clicks, drops, finished tasks and focus sessions.

![The panel](docs/panel.png)

## Why it is light

- Built on [Tauri](https://tauri.app): it uses the webview your OS already ships instead of bundling a browser.
- One small window that is only ever as big as what is on screen.
- No framework, no bundler, no image files. Characters are drawn from ~100 lines of shape data.
- The page runs no timers of its own while idle; the shell sends one tick a second.
- Everything is stored locally. No account, no network requests.

## Install

Download the installer for your system from the Releases page (built automatically, see below).

## Build from source

You need [Rust](https://rustup.rs), [Node.js](https://nodejs.org) and the
[Tauri system prerequisites](https://tauri.app/start/prerequisites/) for your OS.

```sh
npm install
npm run dev      # run it
npm run build    # make an installer in src-tauri/target/release/bundle
```

To work on the look and feel only, open `src/index.html` in a browser. Everything except window movement works there.

## Releases

Push a tag like `v0.1.0` and `.github/workflows/release.yml` builds installers for all three systems and attaches them to a draft GitHub release.

The builds are not code-signed, so Windows SmartScreen and macOS Gatekeeper will warn on first launch.

## Layout

```
src/characters.js   the figurines and the three renderers
src/app.js          timer, tasks, reminders, stats, panel
src/shell.js        bridge to the desktop shell (no-ops in a browser)
src/style.css       all styling
src-tauri/          the Rust shell: window, tray, heartbeat
```

Want to add a character? See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
