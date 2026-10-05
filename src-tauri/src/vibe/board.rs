//! The Board: an on-demand Excalidraw window for building a prompt from many
//! images and text. The window exists only while it's open; the scene is saved
//! to `<app data>/board.excalidraw` so closing it loses nothing.

use super::output::{self, Item};
use super::target::{self, Target};
use crate::actions::ShortcutAction;
use log::error;
use serde::Deserialize;
use std::sync::Mutex;
use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

pub const BOARD_WINDOW: &str = "board";
pub const INBOX_EVENT: &str = "vibe://board-inbox";

#[derive(Default)]
pub struct BoardState {
    /// Image paths waiting to be placed on the board.
    pub inbox: Mutex<Vec<String>>,
    /// The window that was active before the board opened.
    pub target: Mutex<Option<Target>>,
}

pub struct BoardAction;

impl ShortcutAction for BoardAction {
    fn start(&self, app: &AppHandle, _binding_id: &str, _shortcut_str: &str) {
        open(app);
    }

    fn stop(&self, _app: &AppHandle, _binding_id: &str, _shortcut_str: &str) {}
}

/// Use this window as the board's Send target (e.g. the app a capture came from).
pub fn set_target(app: &AppHandle, target: Option<Target>) {
    if target.is_none() {
        return;
    }
    if let Ok(mut t) = app.state::<BoardState>().target.lock() {
        *t = target;
    }
}

pub fn add_to_inbox(app: &AppHandle, path: &str) {
    if let Ok(mut inbox) = app.state::<BoardState>().inbox.lock() {
        inbox.push(path.to_string());
    }
    let _ = app.emit_to(BOARD_WINDOW, INBOX_EVENT, ());
}

/// Show the board, creating its window if needed.
pub fn open(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(BOARD_WINDOW) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }
    // Remember the app to send to, unless it's one of ours.
    let foreground = target::foreground();
    let ours = foreground.as_ref().is_some_and(|t| {
        let own = std::env::current_exe()
            .ok()
            .and_then(|p| p.file_name().map(|n| n.to_string_lossy().to_lowercase()));
        own.is_some_and(|own| own == t.process.to_lowercase())
    });
    if !ours {
        if let Ok(mut t) = app.state::<BoardState>().target.lock() {
            *t = foreground;
        }
    }

    let app = app.clone();
    // Window creation must not run on a thread that the main loop is waiting on.
    std::thread::spawn(move || {
        let result = WebviewWindowBuilder::new(
            &app,
            BOARD_WINDOW,
            WebviewUrl::App("src/board/index.html".into()),
        )
        .title("Vibius Maximus Board")
        .inner_size(1180.0, 800.0)
        .min_inner_size(720.0, 480.0)
        // Let Excalidraw receive files dragged in from Explorer.
        .disable_drag_drop_handler()
        .focused(true)
        .build();
        if let Err(e) = result {
            error!("Failed to open the board: {}", e);
        }
    });
}

fn scene_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("board.excalidraw"))
}

#[tauri::command]
pub fn vibe_board_load(app: AppHandle) -> Option<String> {
    std::fs::read_to_string(scene_path(&app).ok()?).ok()
}

#[tauri::command]
pub fn vibe_board_save(app: AppHandle, scene: String) -> Result<(), String> {
    std::fs::write(scene_path(&app)?, scene).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn vibe_board_take_inbox(app: AppHandle) -> Vec<String> {
    app.state::<BoardState>()
        .inbox
        .lock()
        .map(|mut inbox| std::mem::take(&mut *inbox))
        .unwrap_or_default()
}

/// Name of the app Send will paste into, for the board's Send button.
#[tauri::command]
pub fn vibe_board_target(app: AppHandle) -> Option<String> {
    app.state::<BoardState>()
        .target
        .lock()
        .ok()
        .and_then(|t| t.as_ref().map(|t| t.process.clone()))
}

/// Raw bytes of an image file, for adding files picked in a dialog.
#[tauri::command]
pub fn vibe_read_image(path: String) -> Result<tauri::ipc::Response, String> {
    let lower = path.to_lowercase();
    const ALLOWED: &[&str] = &[".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"];
    if !ALLOWED.iter().any(|ext| lower.ends_with(ext)) {
        return Err("Not a supported image file".into());
    }
    std::fs::read(&path)
        .map(tauri::ipc::Response::new)
        .map_err(|e| e.to_string())
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct BoardSendMeta {
    /// Byte length of each PNG, in paste order.
    image_sizes: Vec<usize>,
    text: String,
    submit: bool,
    /// Copy one combined image instead of pasting.
    copy_only: bool,
}

/// Body: `[meta length u32 LE][meta JSON][PNG 1][PNG 2]…`.
#[tauri::command]
pub async fn vibe_board_send(app: AppHandle, request: Request<'_>) -> Result<(), String> {
    let InvokeBody::Raw(body) = request.body() else {
        return Err("Expected a raw request body".into());
    };
    let (meta, rest) = output::split_body(body)?;
    let meta: BoardSendMeta = serde_json::from_slice(meta).map_err(|e| e.to_string())?;
    let pngs = split_images(rest, &meta.image_sizes)?;
    tauri::async_runtime::spawn_blocking(move || send_blocking(&app, meta, pngs))
        .await
        .map_err(|e| e.to_string())?
}

fn split_images(mut rest: &[u8], sizes: &[usize]) -> Result<Vec<Vec<u8>>, String> {
    let mut out = Vec::with_capacity(sizes.len());
    for &size in sizes {
        if rest.len() < size {
            return Err("Image data truncated".into());
        }
        let (png, tail) = rest.split_at(size);
        out.push(png.to_vec());
        rest = tail;
    }
    Ok(out)
}

fn send_blocking(app: &AppHandle, meta: BoardSendMeta, pngs: Vec<Vec<u8>>) -> Result<(), String> {
    if meta.copy_only {
        let png = pngs.first().ok_or("Nothing to copy")?;
        return output::copy_png(app, png);
    }
    let target = app
        .state::<BoardState>()
        .target
        .lock()
        .ok()
        .and_then(|t| t.clone())
        .ok_or("No app to send to. Open the board from the app you want to paste into.")?;
    if !target::focus(&target) {
        return Err(format!("Couldn't switch to {}", target.process));
    }
    std::thread::sleep(std::time::Duration::from_millis(80));

    let options = super::prefs::get(app);
    let items = if options.is_terminal(&target.process) {
        // Terminals get file paths, one per image, then the text.
        let mut lines = Vec::new();
        for png in &pngs {
            lines.push(super::history::save(app, png, "", Some(&target), None)?.path);
        }
        lines.push(meta.text.clone());
        vec![Item::Text(lines.join("\n"))]
    } else {
        let mut items: Vec<Item> = pngs.into_iter().map(Item::Png).collect();
        items.push(Item::Text(meta.text.clone()));
        items
    };
    output::paste_items(app, &target, items, meta.submit || options.always_submit)
}

#[cfg(test)]
mod tests {
    use super::split_images;

    #[test]
    fn splits_images_by_size() {
        let parts = split_images(b"aaabbc", &[3, 2, 1]).unwrap();
        assert_eq!(parts, vec![b"aaa".to_vec(), b"bb".to_vec(), b"c".to_vec()]);
    }

    #[test]
    fn rejects_short_image_data() {
        assert!(split_images(b"aa", &[3]).is_err());
    }
}
