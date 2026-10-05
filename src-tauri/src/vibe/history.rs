//! Capture history: every sent or copied capture is kept as a PNG with a small
//! JSON sidecar in `<app data>/captures/`. No database, and nothing is loaded
//! until the Captures page or the board asks for it. Captures made in the
//! editor also keep `<id>.scene.json` (the original screenshot, pins, notes and
//! drawings) so they can be reopened and edited.

use super::target::Target;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

/// Oldest unstarred captures beyond this are deleted.
const MAX_CAPTURES: usize = 200;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CaptureRecord {
    pub id: String,
    /// Absolute path of the PNG.
    pub path: String,
    pub text: String,
    pub target: String,
    pub created: i64,
    #[serde(default)]
    pub starred: bool,
    /// Window the capture was sent from, so a reopened capture can send there.
    #[serde(default)]
    pub hwnd: isize,
    /// True when a scene file exists (filled in by [`list`]).
    #[serde(default, skip_deserializing)]
    pub editable: bool,
}

pub fn dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("captures");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn sidecar(png: &Path) -> PathBuf {
    png.with_extension("json")
}

fn scene_file(png: &Path) -> PathBuf {
    png.with_extension("scene.json")
}

pub fn save(
    app: &AppHandle,
    png: &[u8],
    text: &str,
    target: Option<&Target>,
    scene: Option<&str>,
) -> Result<CaptureRecord, String> {
    let now = chrono::Local::now();
    let id = now.format("capture-%Y%m%d-%H%M%S%3f").to_string();
    let path = dir(app)?.join(format!("{id}.png"));
    std::fs::write(&path, png).map_err(|e| e.to_string())?;
    if let Some(scene) = scene {
        std::fs::write(scene_file(&path), scene).map_err(|e| e.to_string())?;
    }
    let record = CaptureRecord {
        id,
        path: path.to_string_lossy().into_owned(),
        text: text.to_string(),
        target: target.map(|t| t.process.clone()).unwrap_or_default(),
        created: now.timestamp_millis(),
        starred: false,
        hwnd: target.map_or(0, |t| t.hwnd),
        editable: scene.is_some(),
    };
    write_record(&record)?;
    prune(app);
    Ok(record)
}

fn write_record(record: &CaptureRecord) -> Result<(), String> {
    let json = serde_json::to_vec_pretty(record).map_err(|e| e.to_string())?;
    std::fs::write(sidecar(Path::new(&record.path)), json).map_err(|e| e.to_string())
}

pub fn list(app: &AppHandle) -> Vec<CaptureRecord> {
    let Ok(dir) = dir(app) else {
        return Vec::new();
    };
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut records: Vec<CaptureRecord> = entries
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|x| x == "json"))
        .filter_map(|p| std::fs::read(p).ok())
        .filter_map(|bytes| serde_json::from_slice::<CaptureRecord>(&bytes).ok())
        .filter(|r| Path::new(&r.path).exists())
        .map(|mut r| {
            r.editable = scene_file(Path::new(&r.path)).exists();
            r
        })
        .collect();
    records.sort_by(|a, b| b.created.cmp(&a.created));
    records
}

pub fn get(app: &AppHandle, id: &str) -> Result<CaptureRecord, String> {
    list(app)
        .into_iter()
        .find(|r| r.id == id)
        .ok_or_else(|| format!("No capture '{id}'"))
}

/// The saved editor scene, if this capture has one.
pub fn scene(record: &CaptureRecord) -> Option<String> {
    std::fs::read_to_string(scene_file(Path::new(&record.path))).ok()
}

fn remove(record: &CaptureRecord) {
    let png = PathBuf::from(&record.path);
    let _ = std::fs::remove_file(scene_file(&png));
    let _ = std::fs::remove_file(sidecar(&png));
    let _ = std::fs::remove_file(png);
}

fn prune(app: &AppHandle) {
    let records = list(app);
    let mut unstarred = records.iter().filter(|r| !r.starred).count();
    for record in records.iter().rev() {
        if unstarred <= MAX_CAPTURES {
            break;
        }
        if !record.starred {
            remove(record);
            unstarred -= 1;
        }
    }
}

#[tauri::command]
pub fn vibe_captures_list(app: AppHandle) -> Vec<CaptureRecord> {
    list(&app)
}

#[tauri::command]
pub fn vibe_capture_delete(app: AppHandle, id: String) -> Result<(), String> {
    remove(&get(&app, &id)?);
    Ok(())
}

#[tauri::command]
pub fn vibe_capture_star(app: AppHandle, id: String, starred: bool) -> Result<(), String> {
    let mut record = get(&app, &id)?;
    record.starred = starred;
    write_record(&record)
}

#[tauri::command]
pub fn vibe_capture_copy(app: AppHandle, id: String, what: String) -> Result<(), String> {
    let record = get(&app, &id)?;
    if what == "text" {
        super::output::copy_text(&app, &record.text)
    } else {
        let png = std::fs::read(&record.path).map_err(|e| e.to_string())?;
        super::output::copy_png(&app, &png)
    }
}

/// Open a capture from history in the editor again.
#[tauri::command]
pub fn vibe_capture_reopen(app: AppHandle, id: String) -> Result<(), String> {
    let record = get(&app, &id)?;
    super::capture::reopen(&app, record);
    Ok(())
}

#[tauri::command]
pub fn vibe_capture_to_board(app: AppHandle, id: String) -> Result<(), String> {
    let record = get(&app, &id)?;
    super::board::add_to_inbox(&app, &record.path);
    super::board::open(&app);
    Ok(())
}
