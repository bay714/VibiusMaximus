//! Paste a copied capture or board later. Alt+C puts an image and the text
//! on the clipboard together, but many chat apps take only the image from a
//! single paste. So after a copy, Alt+V is held for a few minutes: pressed in
//! any app it pastes each image, then the text, the same step-by-step paste
//! Send uses. After one paste, or when the time runs out, Alt+V goes back to
//! normal.
//!
//! Paste again (Alt+Shift+V) is always held. It pastes the last thing sent,
//! copied or dictated into the app in front, for when it went to the wrong
//! window.

use super::output::{self, join_nonempty, Item};
use super::{history, keys, prefs, target};
use crate::input::EnigoState;
use crate::settings::ShortcutBinding;
use log::{error, info, warn};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Manager};

pub const BINDING_ID: &str = "vibe:paste-capture";
pub const AGAIN_ID: &str = "vibe:paste-again";
const HOLD_FOR: Duration = Duration::from_secs(5 * 60);

#[derive(Clone)]
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
    /// The last thing sent, copied or dictated, for Paste again.
    last: Mutex<Option<Pending>>,
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

/// The Paste again key from Settings → Hotkeys (Alt+Shift+V unless changed).
fn again_binding(options: &prefs::CaptureOptions) -> ShortcutBinding {
    let hotkey = options.again_hotkey();
    ShortcutBinding {
        id: AGAIN_ID.to_string(),
        name: "Paste again".to_string(),
        description: "Paste the last thing sent, copied or dictated".to_string(),
        default_binding: hotkey.clone(),
        current_binding: hotkey,
    }
}

/// Register Paste again, first freeing the key from `old` settings when the
/// user changed it.
pub fn register_again(app: &AppHandle, old: Option<&prefs::CaptureOptions>) {
    if let Some(old) = old {
        let _ = crate::shortcut::unregister_shortcut(app, again_binding(old));
    }
    let binding = again_binding(&prefs::get(app));
    let _ = crate::shortcut::unregister_shortcut(app, binding.clone());
    if let Err(e) = crate::shortcut::register_shortcut(app, binding) {
        warn!("Couldn't register Paste again: {}", e);
    }
}

/// True for the hotkeys handled here: Alt+V and Paste again.
pub fn handles(binding_id: &str) -> bool {
    binding_id == BINDING_ID || binding_id == AGAIN_ID
}

fn remember(app: &AppHandle, pending: Pending) {
    if let Ok(mut last) = app.state::<PendingState>().last.lock() {
        *last = Some(pending);
    }
}

/// Keep dictated text for Paste again.
pub fn remember_text(app: &AppHandle, text: &str) {
    if text.trim().is_empty() {
        return;
    }
    remember(
        app,
        Pending {
            pngs: Vec::new(),
            text: text.to_string(),
            paths: Vec::new(),
            label: false,
        },
    );
}

/// Keep a sent capture for Paste again.
pub fn remember_capture(app: &AppHandle, png: Vec<u8>, text: String, path: String) {
    remember(
        app,
        Pending {
            pngs: vec![png],
            text,
            paths: vec![path],
            label: true,
        },
    );
}

/// Keep a sent board's images and text for Paste again.
pub fn remember_many(app: &AppHandle, pngs: Vec<Vec<u8>>, text: String) {
    remember(
        app,
        Pending {
            pngs,
            text,
            paths: Vec::new(),
            label: false,
        },
    );
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
    let pending = Pending {
        pngs,
        text,
        paths,
        label,
    };
    remember(app, pending.clone());
    let generation = {
        let state = app.state::<PendingState>();
        let Ok(mut inner) = state.inner.lock() else {
            return;
        };
        inner.1 += 1;
        inner.0 = Some(pending);
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

/// Alt+V or Paste again was pressed: paste into the app in front. Runs off
/// the shortcut thread, which must not unregister its own hotkey.
pub fn fire(app: &AppHandle, binding_id: &str) {
    let app = app.clone();
    let again = binding_id == AGAIN_ID;
    std::thread::spawn(move || {
        let pending = if again {
            app.state::<PendingState>()
                .last
                .lock()
                .ok()
                .and_then(|last| last.clone())
        } else {
            disarm(&app)
        };
        let Some(pending) = pending else {
            info!("Nothing sent yet to paste again");
            return;
        };
        if let Err(e) = paste(&app, pending) {
            error!("Pasting again failed: {}", e);
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
    // Dictation is only text, so it's pasted whatever the caption setting.
    let text = if options.include_text || pending.pngs.is_empty() {
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
    info!("Pasting into {}", target.process);
    output::paste_items(app, &target, items, false)
}
