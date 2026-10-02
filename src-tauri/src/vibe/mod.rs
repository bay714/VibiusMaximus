//! MaximusVibius additions to Handy: screen capture, send-to-chat and prompt
//! macros. Kept in its own module so merges from upstream Handy stay small.

pub mod capture;
pub mod output;
pub mod target;

use tauri::ipc::Invoke;

/// Commands used by the capture window. They are registered outside Handy's
/// tauri-specta builder because they move raw bytes (the screen frame and the
/// exported PNG), which specta can't describe.
pub fn invoke_handler() -> impl Fn(Invoke<tauri::Wry>) -> bool + Send + Sync + 'static {
    tauri::generate_handler![
        capture::vibe_frame,
        capture::vibe_capture_ready,
        capture::vibe_close,
        output::vibe_send,
    ]
}

/// True for commands handled by [`invoke_handler`].
pub fn is_vibe_command(command: &str) -> bool {
    command.starts_with("vibe_")
}
