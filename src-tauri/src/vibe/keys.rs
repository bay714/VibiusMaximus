//! Keyboard helpers for hotkeys that type into another app.

use crate::input::EnigoState;
use enigo::{Direction, Key, Keyboard};
use std::time::{Duration, Instant};

/// After an Alt-based hotkey whose key was swallowed, the target app sees Alt
/// pressed and released on its own and opens its menu bar, which would eat the
/// paste. Tapping an unassigned key while Alt is down prevents that (the same
/// "menu mask" trick AutoHotkey uses, with the same key: vkE8).
pub fn mask_menu(enigo_state: &EnigoState) {
    #[cfg(target_os = "windows")]
    if let Ok(mut enigo) = enigo_state.0.lock() {
        let _ = enigo.key(Key::Other(0xE8), Direction::Click);
    }
    #[cfg(not(target_os = "windows"))]
    let _ = enigo_state;
}

/// Wait until Ctrl, Alt, Shift and Win are all released, so a synthetic Ctrl+V
/// isn't combined with modifiers the user is still holding.
pub fn wait_for_modifiers_released(timeout: Duration) {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::UI::Input::KeyboardAndMouse::{
            GetAsyncKeyState, VK_CONTROL, VK_LWIN, VK_MENU, VK_RWIN, VK_SHIFT,
        };
        let start = Instant::now();
        loop {
            let held = [VK_CONTROL, VK_MENU, VK_SHIFT, VK_LWIN, VK_RWIN]
                .iter()
                .any(|vk| unsafe { GetAsyncKeyState(vk.0 as i32) } as u16 & 0x8000 != 0);
            if !held || start.elapsed() > timeout {
                break;
            }
            std::thread::sleep(Duration::from_millis(10));
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (timeout, Instant::now());
        std::thread::sleep(Duration::from_millis(150));
    }
}
