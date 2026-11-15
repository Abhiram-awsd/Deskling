//! Deskling's desktop shell. It does only what the web page cannot:
//! size and move the transparent window, the tray icon, and a one-second heartbeat.

use std::{sync::Mutex, thread, time::Duration};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State, WebviewWindow,
};

/// Where the figurine's feet are (bottom-centre of the window, in physical pixels).
/// The window grows upward from this point when a bubble or the panel opens,
/// and shrinks back to it afterwards, so the figurine never appears to move.
#[derive(Default)]
struct Anchor {
    home: Option<(i32, i32)>,
    compact: bool,
}
struct Pet(Mutex<Anchor>);

type Res<T> = Result<T, String>;
fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

/// Usable area of the screen the window is on: (x, y, width, height).
fn screen(win: &WebviewWindow) -> Option<(i32, i32, i32, i32)> {
    let m = win
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| win.primary_monitor().ok().flatten())?;
    let area = m.work_area();
    Some((
        area.position.x,
        area.position.y,
        area.size.width as i32,
        area.size.height as i32,
    ))
}

fn feet(win: &WebviewWindow) -> Res<(i32, i32)> {
    let pos = win.outer_position().map_err(err)?;
    let size = win.outer_size().map_err(err)?;
    Ok((pos.x + size.width as i32 / 2, pos.y + size.height as i32))
}

/// Place a `w` x `h` window so its bottom-centre sits on `home`, kept on screen.
fn place(win: &WebviewWindow, home: (i32, i32), w: i32, h: i32) -> Res<()> {
    let (mut x, mut y) = (home.0 - w / 2, home.1 - h);
    if let Some((sx, sy, sw, sh)) = screen(win) {
        x = x.min(sx + sw - w).max(sx);
        y = y.min(sy + sh - h).max(sy);
    }
    win.set_size(PhysicalSize::new(w.max(1) as u32, h.max(1) as u32))
        .map_err(err)?;
    win.set_position(PhysicalPosition::new(x, y)).map_err(err)
}

#[tauri::command]
fn set_stage(win: WebviewWindow, pet: State<Pet>, w: f64, h: f64, compact: bool) -> Res<()> {
    let scale = win.scale_factor().map_err(err)?;
    let mut a = pet.0.lock().map_err(err)?;
    // While compact the user may have dragged it (or it walked), so re-read where it stands.
    if a.compact || a.home.is_none() {
        a.home = Some(feet(&win)?);
    }
    a.compact = compact;
    place(&win, a.home.unwrap(), (w * scale).round() as i32, (h * scale).round() as i32)
}

/// Move sideways by `dx` logical pixels. Returns true when a screen edge is reached.
#[tauri::command]
fn walk_step(win: WebviewWindow, dx: f64) -> Res<bool> {
    let scale = win.scale_factor().map_err(err)?;
    let pos = win.outer_position().map_err(err)?;
    let width = win.outer_size().map_err(err)?.width as i32;
    let mut x = pos.x + (dx * scale).round() as i32;
    let mut edge = false;
    if let Some((sx, _, sw, _)) = screen(&win) {
        if x <= sx {
            x = sx;
            edge = true;
        } else if x + width >= sx + sw {
            x = sx + sw - width;
            edge = true;
        }
    }
    win.set_position(PhysicalPosition::new(x, pos.y)).map_err(err)?;
    Ok(edge)
}

/// Stand on the bottom edge of the screen (used by "Walks" mode).
#[tauri::command]
fn dock(win: WebviewWindow, pet: State<Pet>) -> Res<()> {
    let size = win.outer_size().map_err(err)?;
    let (cx, _) = feet(&win)?;
    let Some((_, sy, _, sh)) = screen(&win) else {
        return Ok(());
    };
    let home = (cx, sy + sh);
    pet.0.lock().map_err(err)?.home = Some(home);
    place(&win, home, size.width as i32, size.height as i32)
}

#[tauri::command]
fn show_pet(win: WebviewWindow) -> Res<()> {
    win.show().map_err(err)
}

#[tauri::command]
fn hide_pet(win: WebviewWindow) -> Res<()> {
    win.hide().map_err(err)
}

#[tauri::command]
fn quit(app: AppHandle) {
    app.exit(0);
}

fn tray(app: &tauri::App) -> tauri::Result<()> {
    let item = |id: &str, text: &str| MenuItem::with_id(app, id, text, true, None::<&str>);
    let menu = Menu::with_items(
        app,
        &[
            &item("open", "Open Deskling")?,
            &item("focus", "Start or pause focus")?,
            &PredefinedMenuItem::separator(app)?,
            &item("mode-sit", "Sit still")?,
            &item("mode-walk", "Walk around")?,
            &item("mode-hide", "Hide until needed")?,
            &PredefinedMenuItem::separator(app)?,
            &item("quit", "Quit")?,
        ],
    )?;
    let mut tray = TrayIconBuilder::with_id("deskling")
        .tooltip("Deskling")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => app.exit(0),
            id => {
                let _ = app.emit("tray", id.to_string());
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let _ = tray.app_handle().emit("tray", "open");
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(Pet(Mutex::new(Anchor {
            home: None,
            compact: true,
        })))
        .invoke_handler(tauri::generate_handler![
            set_stage, walk_step, dock, show_pet, hide_pet, quit
        ])
        .setup(|app| {
            // A desk toy has no business in the Dock or the app switcher.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            // Start in the bottom-right corner of the screen.
            if let Some(win) = app.get_webview_window("main") {
                if let (Some((sx, sy, sw, sh)), Ok(size), Ok(scale)) =
                    (screen(&win), win.outer_size(), win.scale_factor())
                {
                    let gap = (28.0 * scale) as i32;
                    let _ = win.set_position(PhysicalPosition::new(
                        sx + sw - size.width as i32 - gap,
                        sy + sh - size.height as i32 - gap,
                    ));
                }
            }
            tray(app)?;

            // One event a second drives the timer and reminders. The page keeps no
            // timers of its own, so an idle Deskling uses close to zero CPU.
            let handle = app.handle().clone();
            thread::spawn(move || loop {
                thread::sleep(Duration::from_secs(1));
                let _ = handle.emit("tick", ());
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Deskling");
}
