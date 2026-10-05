//! The Board: an on-demand Excalidraw window for building a prompt from many
//! images and text. The window exists only while it's open. Boards are kept in
//! `<app data>/boards/`: `<id>.excalidraw` (the scene), `<id>.json` (name,
//! dates, image count) and `<id>.png` (a small preview), so closing loses
//! nothing and old boards can be reopened.

use super::output::{self, Item};
use super::target::{self, Target};
use crate::actions::ShortcutAction;
use log::{error, warn};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
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

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BoardMeta {
    pub id: String,
    pub name: String,
    pub created: i64,
    pub updated: i64,
    #[serde(default)]
    pub images: usize,
    /// Preview PNG, when one has been saved (filled in when listing).
    #[serde(default, skip_deserializing)]
    pub thumb: Option<String>,
}

/// A board as the window opens it.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadedBoard {
    meta: BoardMeta,
    scene: Option<String>,
}

fn boards_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("boards");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Board ids become file names, so only allow what `new_id` makes.
fn file(dir: &Path, id: &str, ext: &str) -> Result<PathBuf, String> {
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err(format!("Invalid board id '{id}'"));
    }
    Ok(dir.join(format!("{id}.{ext}")))
}

fn new_id() -> String {
    chrono::Local::now()
        .format("board-%Y%m%d-%H%M%S%3f")
        .to_string()
}

fn now_ms() -> i64 {
    chrono::Local::now().timestamp_millis()
}

fn read_meta(dir: &Path, id: &str) -> Option<BoardMeta> {
    let bytes = std::fs::read(file(dir, id, "json").ok()?).ok()?;
    let mut meta: BoardMeta = serde_json::from_slice(&bytes).ok()?;
    let thumb = file(dir, id, "png").ok()?;
    meta.thumb = thumb.exists().then(|| thumb.to_string_lossy().into_owned());
    Some(meta)
}

fn write_meta(dir: &Path, meta: &BoardMeta) -> Result<(), String> {
    let json = serde_json::to_vec_pretty(meta).map_err(|e| e.to_string())?;
    std::fs::write(file(dir, &meta.id, "json")?, json).map_err(|e| e.to_string())
}

/// Every board, most recently edited first.
pub fn list(app: &AppHandle) -> Vec<BoardMeta> {
    let Ok(dir) = boards_dir(app) else {
        return Vec::new();
    };
    let Ok(entries) = std::fs::read_dir(&dir) else {
        return Vec::new();
    };
    let mut boards: Vec<BoardMeta> = entries
        .flatten()
        .filter_map(|e| {
            let path = e.path();
            (path.extension()? == "json")
                .then(|| path.file_stem()?.to_str().map(str::to_string))
                .flatten()
        })
        .filter_map(|id| read_meta(&dir, &id))
        .collect();
    boards.sort_by_key(|b| std::cmp::Reverse(b.updated));
    boards
}

fn create(app: &AppHandle, scene: Option<String>) -> Result<BoardMeta, String> {
    let dir = boards_dir(app)?;
    let now = now_ms();
    let meta = BoardMeta {
        id: new_id(),
        name: format!("Board {}", list(app).len() + 1),
        created: now,
        updated: now,
        images: 0,
        thumb: None,
    };
    write_meta(&dir, &meta)?;
    if let Some(scene) = scene {
        std::fs::write(file(&dir, &meta.id, "excalidraw")?, scene).map_err(|e| e.to_string())?;
    }
    Ok(meta)
}

fn current_id(app: &AppHandle) -> Option<String> {
    super::store::get::<String>(app, "currentBoard")
}

fn set_current(app: &AppHandle, id: &str) {
    super::store::set(app, "currentBoard", &id.to_string());
}

fn load(app: &AppHandle, id: &str) -> Result<LoadedBoard, String> {
    let dir = boards_dir(app)?;
    let meta = read_meta(&dir, id).ok_or_else(|| format!("No board '{id}'"))?;
    let scene = std::fs::read_to_string(file(&dir, id, "excalidraw")?).ok();
    set_current(app, id);
    Ok(LoadedBoard { meta, scene })
}

/// The board to show: the last one used, the most recent one, or a new one.
/// The single board from before the library becomes "Board 1".
fn load_current(app: &AppHandle) -> Result<LoadedBoard, String> {
    if let Some(id) = current_id(app) {
        if let Ok(board) = load(app, &id) {
            return Ok(board);
        }
    }
    if let Some(latest) = list(app).first() {
        return load(app, &latest.id);
    }
    let old = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("board.excalidraw");
    let scene = std::fs::read_to_string(&old).ok();
    let meta = create(app, scene)?;
    if old.exists() {
        if let Err(e) = std::fs::remove_file(&old) {
            warn!("Couldn't remove the old board file: {}", e);
        }
    }
    load(app, &meta.id)
}

#[tauri::command]
pub fn vibe_board_load(app: AppHandle) -> Result<LoadedBoard, String> {
    load_current(&app)
}

#[tauri::command]
pub fn vibe_boards_list(app: AppHandle) -> Vec<BoardMeta> {
    list(&app)
}

/// Save the open board's scene; `images` is shown in the board list.
#[tauri::command]
pub fn vibe_board_save(
    app: AppHandle,
    id: String,
    scene: String,
    images: usize,
) -> Result<(), String> {
    let dir = boards_dir(&app)?;
    std::fs::write(file(&dir, &id, "excalidraw")?, scene).map_err(|e| e.to_string())?;
    let mut meta = read_meta(&dir, &id).ok_or_else(|| format!("No board '{id}'"))?;
    meta.updated = now_ms();
    meta.images = images;
    write_meta(&dir, &meta)
}

/// Save a preview PNG. Body: `[id length u32 LE][id][PNG bytes]`.
#[tauri::command]
pub fn vibe_board_thumb(app: AppHandle, request: Request<'_>) -> Result<(), String> {
    let InvokeBody::Raw(body) = request.body() else {
        return Err("Expected a raw request body".into());
    };
    let (id, png) = output::split_body(body)?;
    let id = std::str::from_utf8(id).map_err(|e| e.to_string())?;
    let dir = boards_dir(&app)?;
    std::fs::write(file(&dir, id, "png")?, png).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn vibe_board_new(app: AppHandle) -> Result<LoadedBoard, String> {
    let meta = create(&app, None)?;
    load(&app, &meta.id)
}

#[tauri::command]
pub fn vibe_board_open(app: AppHandle, id: String) -> Result<LoadedBoard, String> {
    load(&app, &id)
}

#[tauri::command]
pub fn vibe_board_rename(app: AppHandle, id: String, name: String) -> Result<(), String> {
    let dir = boards_dir(&app)?;
    let mut meta = read_meta(&dir, &id).ok_or_else(|| format!("No board '{id}'"))?;
    let name = name.trim();
    if !name.is_empty() {
        meta.name = name.chars().take(80).collect();
    }
    write_meta(&dir, &meta)
}

/// Delete a board. Returns the board to show next if it was the open one.
#[tauri::command]
pub fn vibe_board_delete(app: AppHandle, id: String) -> Result<Option<LoadedBoard>, String> {
    let dir = boards_dir(&app)?;
    for ext in ["excalidraw", "json", "png"] {
        let _ = std::fs::remove_file(file(&dir, &id, ext)?);
    }
    if current_id(&app).as_deref() != Some(id.as_str()) {
        return Ok(None);
    }
    match list(&app).first() {
        Some(next) => load(&app, &next.id).map(Some),
        None => vibe_board_new(app).map(Some),
    }
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
    /// With `copy_only`: the first image is the whole board for the
    /// clipboard (with the text), and the rest are held for Alt+V.
    #[serde(default)]
    hold: bool,
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
        let mut pngs = pngs.into_iter();
        let sheet = pngs.next().ok_or("Nothing to copy")?;
        if !meta.hold {
            return output::copy_png(app, &sheet);
        }
        output::copy_png_and_text(app, &sheet, &meta.text)?;
        super::pending::arm_many(app, pngs.collect(), meta.text);
        return Ok(());
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

    #[test]
    fn board_ids_cannot_escape_the_folder() {
        let dir = std::path::Path::new("boards");
        assert!(super::file(dir, "board-20261005-101010123", "json").is_ok());
        assert!(super::file(dir, "../settings", "json").is_err());
        assert!(super::file(dir, "a/b", "json").is_err());
        assert!(super::file(dir, "", "json").is_err());
    }
}
