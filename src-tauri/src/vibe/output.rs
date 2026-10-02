//! Send a finished capture: paste the image, then the text, into the window
//! the user came from, and put their clipboard back afterwards.

use super::capture::{self, CaptureState};
use super::target;
use crate::clipboard::send_return_key;
use crate::input::{send_paste_ctrl_v, EnigoState};
use crate::settings::get_settings;
use log::{info, warn};
use serde::Deserialize;
use std::time::Duration;
use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;

/// How long the modifier is held during Ctrl+V (see `send_paste_ctrl_v`).
const PASTE_HOLD_MS: u64 = 40;
/// Pause after pasting the image so the chat app can attach it before the text.
const PASTE_GAP_MS: u64 = 250;

#[derive(Deserialize, PartialEq, Eq, Clone, Copy, Debug)]
#[serde(rename_all = "camelCase")]
enum SendMode {
    Send,
    CopyOnly,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct SendMeta {
    /// Caption and numbered notes, already formatted.
    text: String,
    mode: SendMode,
    submit: bool,
}

/// Body: `[meta length u32 LE][meta JSON][PNG bytes]`.
#[tauri::command]
pub async fn vibe_send(app: AppHandle, request: Request<'_>) -> Result<(), String> {
    let InvokeBody::Raw(body) = request.body() else {
        return Err("Expected a raw request body".into());
    };
    let (meta, png) = parse_body(body)?;
    tauri::async_runtime::spawn_blocking(move || send_blocking(&app, meta, png))
        .await
        .map_err(|e| e.to_string())?
}

fn parse_body(body: &[u8]) -> Result<(SendMeta, Vec<u8>), String> {
    if body.len() < 4 {
        return Err("Request body too short".into());
    }
    let meta_len = u32::from_le_bytes([body[0], body[1], body[2], body[3]]) as usize;
    let meta_end = 4 + meta_len;
    if body.len() < meta_end {
        return Err("Request body truncated".into());
    }
    let meta: SendMeta = serde_json::from_slice(&body[4..meta_end]).map_err(|e| e.to_string())?;
    Ok((meta, body[meta_end..].to_vec()))
}

fn send_blocking(app: &AppHandle, meta: SendMeta, png: Vec<u8>) -> Result<(), String> {
    let image = image::load_from_memory_with_format(&png, image::ImageFormat::Png)
        .map_err(|e| e.to_string())?
        .to_rgba8();
    let (width, height) = image.dimensions();
    let clip_image = tauri::image::Image::new_owned(image.into_raw(), width, height);

    let target = app.state::<CaptureState>().target();
    // Hand focus back while our window is still in front (Windows only lets the
    // foreground process do that), then close the capture window.
    let focused = match (&target, meta.mode) {
        (Some(t), SendMode::Send) => target::focus(t),
        _ => false,
    };
    capture::close(app);

    let clipboard = app.clipboard();
    if meta.mode == SendMode::CopyOnly || !focused {
        if meta.mode == SendMode::Send {
            warn!("Couldn't return focus to the previous window; copied the image instead");
        }
        return clipboard
            .write_image(&clip_image)
            .map_err(|e| e.to_string());
    }
    let target = target.unwrap_or_default();
    std::thread::sleep(Duration::from_millis(80));

    let saved_text = clipboard.read_text().ok();
    let settings = get_settings(app);
    let enigo_state = app
        .try_state::<EnigoState>()
        .ok_or("Keyboard input not initialised")?;

    if target.is_terminal() {
        let path = save_png(app, &png)?;
        let text = join_nonempty(&[path.as_str(), meta.text.as_str()]);
        clipboard.write_text(text).map_err(|e| e.to_string())?;
        paste(&enigo_state)?;
    } else {
        clipboard
            .write_image(&clip_image)
            .map_err(|e| e.to_string())?;
        paste(&enigo_state)?;
        if !meta.text.trim().is_empty() {
            std::thread::sleep(Duration::from_millis(PASTE_GAP_MS));
            let text = join_nonempty(&["[screenshot above]", meta.text.as_str()]);
            clipboard.write_text(text).map_err(|e| e.to_string())?;
            paste(&enigo_state)?;
        }
    }

    if meta.submit {
        std::thread::sleep(Duration::from_millis(120));
        let mut enigo = enigo_state.0.lock().map_err(|e| e.to_string())?;
        send_return_key(&mut enigo, settings.auto_submit_key)?;
    }

    // Let the target app read the clipboard before restoring it.
    std::thread::sleep(Duration::from_millis(
        settings.paste_delay_after_ms.max(200),
    ));
    if let Some(text) = saved_text {
        let _ = clipboard.write_text(text);
    }
    info!(
        "Capture sent to {} ({}x{}, terminal: {})",
        target.process,
        width,
        height,
        target.is_terminal()
    );
    Ok(())
}

pub(super) fn paste(enigo_state: &EnigoState) -> Result<(), String> {
    let mut enigo = enigo_state.0.lock().map_err(|e| e.to_string())?;
    send_paste_ctrl_v(&mut enigo, PASTE_HOLD_MS)
}

fn join_nonempty(parts: &[&str]) -> String {
    parts
        .iter()
        .map(|p| p.trim())
        .filter(|p| !p.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

/// Save the PNG under the app data folder and return its path.
fn save_png(app: &AppHandle, png: &[u8]) -> Result<String, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("captures");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let name = chrono::Local::now()
        .format("capture-%Y%m%d-%H%M%S%3f.png")
        .to_string();
    let path = dir.join(name);
    std::fs::write(&path, png).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_meta_and_png() {
        let meta = br#"{"text":"hi","mode":"copyOnly","submit":false}"#;
        let mut body = (meta.len() as u32).to_le_bytes().to_vec();
        body.extend_from_slice(meta);
        body.extend_from_slice(b"PNGDATA");
        let (m, png) = parse_body(&body).unwrap();
        assert_eq!(m.text, "hi");
        assert_eq!(m.mode, SendMode::CopyOnly);
        assert_eq!(png, b"PNGDATA");
    }

    #[test]
    fn rejects_truncated_body() {
        assert!(parse_body(&[10, 0, 0, 0, b'{']).is_err());
    }

    #[test]
    fn joins_only_nonempty_parts() {
        assert_eq!(join_nonempty(&["a", "  ", "b"]), "a\nb");
        assert_eq!(join_nonempty(&["[x]", ""]), "[x]");
    }
}
