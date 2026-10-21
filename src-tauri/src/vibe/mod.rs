//! VibiusMaximus additions to Handy: screen capture, send-to-chat and prompt
//! macros. Kept in its own module so merges from upstream Handy stay small.

pub mod board;
pub mod capture;
pub mod cleanup;
mod history;
mod keys;
pub mod macros;
pub mod output;
pub mod pending;
mod prefs;
pub mod startup;
mod store;
pub mod target;
mod toast;
mod vocab;

use tauri::ipc::Invoke;

/// VibiusMaximus commands. They are registered outside Handy's tauri-specta
/// builder: some move raw bytes (the screen frame and the exported PNG), which
/// specta can't describe, and keeping them apart avoids churn in Handy's
/// generated `bindings.ts`.
pub fn invoke_handler() -> impl Fn(Invoke<tauri::Wry>) -> bool + Send + Sync + 'static {
    tauri::generate_handler![
        capture::vibe_frame,
        capture::vibe_capture_ready,
        capture::vibe_capture_session,
        capture::vibe_close,
        capture::vibe_windows_list,
        capture::vibe_capture_set_target,
        output::vibe_send,
        cleanup::vibe_cleanup,
        history::vibe_captures_list,
        history::vibe_capture_delete,
        history::vibe_capture_star,
        history::vibe_capture_copy,
        history::vibe_capture_reopen,
        history::vibe_capture_to_board,
        board::vibe_board_load,
        board::vibe_board_save,
        board::vibe_boards_list,
        board::vibe_board_thumb,
        board::vibe_board_new,
        board::vibe_board_open,
        board::vibe_board_rename,
        board::vibe_board_delete,
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
        vibe_restart,
    ]
}

/// Runs after Handy registers its shortcuts: first-run seeding, then the
/// macro hotkeys Handy doesn't know about.
pub fn on_shortcuts_ready(app: &tauri::AppHandle) {
    keys::migrate_global(app);
    macros::seed(app);
    macros::upgrade_starters(app);
    vocab::seed(app);
    macros::register_all(app);
    pending::register_again(app, None);
    migrate_history_limit(app);
    // Old captures are otherwise only cleared when a new one is saved.
    let app = app.clone();
    std::thread::spawn(move || history::prune(&app));
}

/// Handy keeps the last 5 transcriptions; we keep 25, so a dictation that
/// went to the wrong window can still be found in History. Installs still on
/// the old default move up once; a limit the user chose is left alone.
fn migrate_history_limit(app: &tauri::AppHandle) {
    if store::get::<bool>(app, "historyLimitV2").unwrap_or(false) {
        return;
    }
    let mut settings = crate::settings::get_settings(app);
    if settings.history_limit == 5 {
        settings.history_limit = 25;
        crate::settings::write_settings(app, settings);
    }
    store::set(app, "historyLimitV2", &true);
}

/// Quit and start again: the fix when dictation stops responding after a long
/// session (a dead keyboard hook, a stuck "Transcribing…", a mic that went
/// quiet after sleep). Clearing those in place can't reach a thread that's
/// hung, and a fresh process clears them all in a couple of seconds.
pub fn restart(app: &tauri::AppHandle) {
    log::info!("Restart requested from the Restart button");
    let handle = app.clone();
    // On the main thread, which owns the single-instance window.
    let _ = app.run_on_main_thread(move || {
        // Restarting from the main thread skips the exit event, so the
        // single-instance lock would still be held when the new copy starts,
        // and it would hand over to this one and quit. Let go of it first.
        tauri_plugin_single_instance::destroy(&handle);
        handle.restart();
    });
}

#[tauri::command]
fn vibe_restart(app: tauri::AppHandle) {
    restart(&app);
}

/// True for commands handled by [`invoke_handler`].
pub fn is_vibe_command(command: &str) -> bool {
    command.starts_with("vibe_")
}
