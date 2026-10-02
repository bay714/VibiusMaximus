//! MaximusVibius additions to Handy: screen capture, send-to-chat and prompt
//! macros. Kept in its own module so merges from upstream Handy stay small.

pub mod board;
pub mod capture;
pub mod cleanup;
mod history;
mod keys;
pub mod macros;
pub mod output;
mod prefs;
mod store;
pub mod target;
mod vocab;

use tauri::ipc::Invoke;

/// MaximusVibius commands. They are registered outside Handy's tauri-specta
/// builder: some move raw bytes (the screen frame and the exported PNG), which
/// specta can't describe, and keeping them apart avoids churn in Handy's
/// generated `bindings.ts`.
pub fn invoke_handler() -> impl Fn(Invoke<tauri::Wry>) -> bool + Send + Sync + 'static {
    tauri::generate_handler![
        capture::vibe_frame,
        capture::vibe_capture_ready,
        capture::vibe_close,
        output::vibe_send,
        cleanup::vibe_cleanup,
        history::vibe_captures_list,
        history::vibe_capture_delete,
        history::vibe_capture_star,
        history::vibe_capture_copy,
        history::vibe_capture_to_board,
        board::vibe_board_load,
        board::vibe_board_save,
        board::vibe_board_take_inbox,
        board::vibe_board_target,
        board::vibe_board_send,
        board::vibe_read_image,
        prefs::vibe_capture_settings_get,
        prefs::vibe_capture_settings_set,
        macros::vibe_macros_list,
        macros::vibe_macro_save,
        macros::vibe_macro_delete,
        macros::vibe_macro_clear_hotkey,
    ]
}

/// Runs after Handy registers its shortcuts: first-run seeding, then the
/// macro hotkeys Handy doesn't know about.
pub fn on_shortcuts_ready(app: &tauri::AppHandle) {
    macros::seed(app);
    vocab::seed(app);
    macros::register_all(app);
}

/// True for commands handled by [`invoke_handler`].
pub fn is_vibe_command(command: &str) -> bool {
    command.starts_with("vibe_")
}
