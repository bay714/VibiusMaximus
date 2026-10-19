//! A short note after Send: which app it went to, and the Paste again key in
//! case that was the wrong one. A small click-through window that never takes
//! focus, shown for a few seconds and then destroyed.

use super::prefs;
use super::target::{self, Target};
use log::warn;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder};

const LABEL_PREFIX: &str = "toast-";
/// Logical size of the toast.
const WIDTH: f64 = 460.0;
const HEIGHT: f64 = 56.0;
/// Gap above the bottom of the screen's work area.
const MARGIN: f64 = 72.0;
const SHOW_FOR: Duration = Duration::from_secs(4);

static NEXT_ID: AtomicU64 = AtomicU64::new(1);

/// Show "Sent to <app>", unless turned off in Settings → Capture.
pub fn sent(app: &AppHandle, target: &Target) {
    let options = prefs::get(app);
    if !options.send_toast {
        return;
    }
    let key = match options.again_key.trim() {
        "" => "Alt+Shift+V",
        key => key,
    };
    let query = format!(
        "?app={}&key={}",
        encode(&target::display_name(&target.process)),
        encode(key)
    );
    if let Err(e) = show(app, &query) {
        warn!("Couldn't show the sent toast: {}", e);
    }
}

fn show(app: &AppHandle, query: &str) -> Result<(), String> {
    // One toast at a time.
    for (label, window) in app.webview_windows() {
        if label.starts_with(LABEL_PREFIX) {
            let _ = window.destroy();
        }
    }

    let (cx, cy) = crate::input::get_cursor_position(app).unwrap_or((0, 0));
    let monitor = app
        .monitor_from_point(f64::from(cx), f64::from(cy))
        .ok()
        .flatten()
        .or_else(|| app.primary_monitor().ok().flatten())
        .ok_or("No monitor")?;
    let scale = monitor.scale_factor();
    let area = monitor.work_area();
    let (width, height) = ((WIDTH * scale) as i32, (HEIGHT * scale) as i32);
    let x = area.position.x + (area.size.width as i32 - width) / 2;
    let y = area.position.y + area.size.height as i32 - height - (MARGIN * scale) as i32;

    let label = format!("{LABEL_PREFIX}{}", NEXT_ID.fetch_add(1, Ordering::Relaxed));
    let window = WebviewWindowBuilder::new(
        app,
        &label,
        WebviewUrl::App(format!("src/toast/index.html{query}").into()),
    )
    .title("Vibius Maximus")
    .decorations(false)
    .transparent(true)
    .shadow(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .focusable(false)
    .focused(false)
    .visible(false)
    .build()
    .map_err(|e| e.to_string())?;
    window
        .set_size(PhysicalSize::new(width as u32, height as u32))
        .map_err(|e| e.to_string())?;
    window
        .set_position(PhysicalPosition::new(x, y))
        .map_err(|e| e.to_string())?;
    let _ = window.set_ignore_cursor_events(true);
    window.show().map_err(|e| e.to_string())?;

    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(SHOW_FOR);
        if let Some(window) = app.get_webview_window(&label) {
            let _ = window.destroy();
        }
    });
    Ok(())
}

/// Percent-encode for a query string (`+` too, which would read as a space).
fn encode(s: &str) -> String {
    s.bytes()
        .map(|b| {
            if b.is_ascii_alphanumeric() {
                (b as char).to_string()
            } else {
                format!("%{b:02X}")
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::encode;

    #[test]
    fn encodes_keys_and_names() {
        assert_eq!(encode("Alt+Shift+V"), "Alt%2BShift%2BV");
        assert_eq!(encode("VS Code"), "VS%20Code");
    }
}
