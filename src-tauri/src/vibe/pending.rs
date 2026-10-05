//! Paste a copied capture later. Alt+C puts the image and the text on the
//! clipboard together, but many chat apps take only the image from a single
//! paste. So after a copy, Alt+V is held for a few minutes: pressed in any app
//! it pastes the image, then the text, the same two-step paste Send uses.
//! After one paste, or when the time runs out, Alt+V goes back to normal.

use super::output::{self, Item};
use super::{keys, prefs, target};
use crate::input::EnigoState;
use crate::settings::ShortcutBinding;
use log::{error, info, warn};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Manager};

pub const BINDING_ID: &str = "vibe:paste-capture";
const HOTKEY: &str = "alt+v";
const HOLD_FOR: Duration = Duration::from_secs(5 * 60);

struct Pending {
    png: Vec<u8>,
    text: String,
    /// The saved PNG, which terminals get instead of the image.
    path: String,
}

#[derive(Default)]
pub struct PendingState {
    /// The capture waiting for Alt+V, and a counter that tells a timer whether
    /// the capture it was started for is still the current one.
    inner: Mutex<(Option<Pending>, u64)>,
}

fn binding() -> ShortcutBinding {
    ShortcutBinding {
        id: BINDING_ID.to_string(),
        name: "Paste copied capture".to_string(),
        description: "Paste the copied image, then its text".to_string(),
        default_binding: HOTKEY.to_string(),
        current_binding: HOTKEY.to_string(),
    }
}

/// Hold `png` and `text` for Alt+V.
pub fn arm(app: &AppHandle, png: Vec<u8>, text: String, path: String) {
    let generation = {
        let state = app.state::<PendingState>();
        let Ok(mut inner) = state.inner.lock() else {
            return;
        };
        inner.1 += 1;
        inner.0 = Some(Pending { png, text, path });
        inner.1
    };
    // Re-register so a hotkey left over from an earlier copy isn't doubled.
    let _ = crate::shortcut::unregister_shortcut(app, binding());
    if let Err(e) = crate::shortcut::register_shortcut(app, binding()) {
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
    let _ = crate::shortcut::unregister_shortcut(app, binding());
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
    let items: Vec<Item> =
        output::items_for(&options, &target.process, &pending.path, pending.png, text);
    info!("Pasting the copied capture into {}", target.process);
    output::paste_items(app, &target, items, false)
}
