//! Paste a copied capture or board later. Alt+C puts an image and the text
//! on the clipboard together, but many chat apps take only the image from a
//! single paste. So after a copy, Alt+V is held for a few minutes: pressed in
//! any app it pastes each image, then the text, the same step-by-step paste
//! Send uses. After one paste, or when the time runs out, Alt+V goes back to
//! normal.

use super::output::{self, join_nonempty, Item};
use super::{history, keys, prefs, target};
use crate::input::EnigoState;
use crate::settings::ShortcutBinding;
use log::{error, info, warn};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Manager};

pub const BINDING_ID: &str = "vibe:paste-capture";
const HOLD_FOR: Duration = Duration::from_secs(5 * 60);

struct Pending {
    pngs: Vec<Vec<u8>>,
    text: String,
    /// Saved files for terminals, which get paths instead of images. Empty
    /// means save the images when they're pasted into a terminal.
    paths: Vec<String>,
    /// Put "[screenshot above]" before the text (a single capture).
    label: bool,
}

#[derive(Default)]
pub struct PendingState {
    /// The capture waiting for Alt+V, and a counter that tells a timer whether
    /// the capture it was started for is still the current one.
    inner: Mutex<(Option<Pending>, u64)>,
}

/// The paste key from Settings → Hotkeys (Alt+V unless changed).
fn binding(app: &AppHandle) -> ShortcutBinding {
    let hotkey = prefs::get(app).paste_hotkey();
    ShortcutBinding {
        id: BINDING_ID.to_string(),
        name: "Paste copied capture".to_string(),
        description: "Paste the copied image, then its text".to_string(),
        default_binding: hotkey.clone(),
        current_binding: hotkey,
    }
}

/// Hold one capture for Alt+V.
pub fn arm(app: &AppHandle, png: Vec<u8>, text: String, path: String) {
    hold(app, vec![png], text, vec![path], true);
}

/// Hold a board's images (in paste order) and its text for Alt+V.
pub fn arm_many(app: &AppHandle, pngs: Vec<Vec<u8>>, text: String) {
    hold(app, pngs, text, Vec::new(), false);
}

fn hold(app: &AppHandle, pngs: Vec<Vec<u8>>, text: String, paths: Vec<String>, label: bool) {
    let generation = {
        let state = app.state::<PendingState>();
        let Ok(mut inner) = state.inner.lock() else {
            return;
        };
        inner.1 += 1;
        inner.0 = Some(Pending {
            pngs,
            text,
            paths,
            label,
        });
        inner.1
    };
    // Re-register so a hotkey left over from an earlier copy isn't doubled.
    let _ = crate::shortcut::unregister_shortcut(app, binding(app));
    if let Err(e) = crate::shortcut::register_shortcut(app, binding(app)) {
        warn!("Couldn't hold Alt+V for the copied capture: {}", e);
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(HOLD_FOR);
        let current = app
            .state::<PendingState>()
            .inner
            .lock()
            .map(|inner| inner.1)
            .unwrap_or_default();
        if current == generation {
            disarm(&app);
        }
    });
}

/// Forget the capture and give Alt+V back.
fn disarm(app: &AppHandle) -> Option<Pending> {
    let pending = app
        .state::<PendingState>()
        .inner
        .lock()
        .ok()
        .and_then(|mut inner| inner.0.take());
    let _ = crate::shortcut::unregister_shortcut(app, binding(app));
    pending
}

/// Alt+V was pressed: paste into the app in front. Runs off the shortcut
/// thread, which must not unregister its own hotkey.
pub fn fire(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || {
        let Some(pending) = disarm(&app) else {
            return;
        };
        if let Err(e) = paste(&app, pending) {
            error!("Pasting the copied capture failed: {}", e);
        }
    });
}

fn paste(app: &AppHandle, pending: Pending) -> Result<(), String> {
    let enigo_state = app
        .try_state::<EnigoState>()
        .ok_or("Keyboard input not initialised")?;
    keys::mask_menu(&enigo_state);
    keys::wait_for_modifiers_released(Duration::from_millis(1500));

    let target = target::foreground().unwrap_or_default();
    let options = prefs::get(app);
    let text = if options.include_text {
        pending.text.as_str()
    } else {
        ""
    };
    let items = if options.is_terminal(&target.process) {
        let mut lines = pending.paths;
        if lines.is_empty() {
            for png in &pending.pngs {
                lines.push(history::save(app, png, "", Some(&target), None)?.path);
            }
        }
        lines.push(text.to_string());
        let lines: Vec<&str> = lines.iter().map(String::as_str).collect();
        vec![Item::Text(join_nonempty(&lines))]
    } else {
        let label = if pending.label && !pending.pngs.is_empty() {
            "[screenshot above]"
        } else {
            ""
        };
        let mut items: Vec<Item> = pending.pngs.into_iter().map(Item::Png).collect();
        items.push(Item::Text(join_nonempty(&[label, text])));
        items
    };
    info!("Pasting the copied capture into {}", target.process);
    output::paste_items(app, &target, items, false)
}
