//! Paste captures into the window the user came from: images first, then
//! text, then the user's clipboard is put back.

use super::capture::{self, CaptureState};
use super::target::{self, Target};
use super::{board, history, prefs};
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

#[derive(Deserialize, PartialEq, Eq, Clone, Copy, Debug)]
#[serde(rename_all = "camelCase")]
enum SendMode {
    Send,
    CopyOnly,
    /// Add to the board instead of sending.
    Board,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct SendMeta {
    /// Caption and numbered notes, already formatted.
    text: String,
    mode: SendMode,
    submit: bool,
    /// Editor scene JSON, kept with the capture so it can be reopened.
    #[serde(default)]
    scene: Option<String>,
}

/// One thing to paste.
pub enum Item {
    Png(Vec<u8>),
    Text(String),
}

/// Body: `[meta length u32 LE][meta JSON][PNG bytes]`.
#[tauri::command]
pub async fn vibe_send(app: AppHandle, request: Request<'_>) -> Result<(), String> {
    let InvokeBody::Raw(body) = request.body() else {
        return Err("Expected a raw request body".into());
    };
    let (meta_bytes, png) = split_body(body)?;
    let meta: SendMeta = serde_json::from_slice(meta_bytes).map_err(|e| e.to_string())?;
    let png = png.to_vec();
    tauri::async_runtime::spawn_blocking(move || send_capture(&app, meta, png))
        .await
        .map_err(|e| e.to_string())?
}

/// Split `[meta length u32 LE][meta][rest]`.
pub(super) fn split_body(body: &[u8]) -> Result<(&[u8], &[u8]), String> {
    if body.len() < 4 {
        return Err("Request body too short".into());
    }
    let meta_len = u32::from_le_bytes([body[0], body[1], body[2], body[3]]) as usize;
    let meta_end = 4 + meta_len;
    if body.len() < meta_end {
        return Err("Request body truncated".into());
    }
    Ok((&body[4..meta_end], &body[meta_end..]))
}

fn send_capture(app: &AppHandle, meta: SendMeta, png: Vec<u8>) -> Result<(), String> {
    let target = app.state::<CaptureState>().target();
    let record = history::save(
        app,
        &png,
        &meta.text,
        target.as_ref(),
        meta.scene.as_deref(),
    )?;

    if meta.mode == SendMode::Board {
        capture::close(app);
        board::set_target(app, target);
        board::add_to_inbox(app, &record.path);
        board::open(app);
        return Ok(());
    }

    let options = prefs::get(app);
    let text = if options.include_text {
        meta.text.as_str()
    } else {
        ""
    };
    let copy_only = meta.mode == SendMode::CopyOnly
        || target
            .as_ref()
            .is_some_and(|t| options.is_copy_only(&t.process));

    // Hand focus back while our window is still in front (Windows only lets the
    // foreground process do that), then close the capture window.
    let focused = match (&target, meta.mode) {
        _ if copy_only => false,
        (Some(t), SendMode::Send) => target::focus(t),
        _ => false,
    };
    capture::close(app);

    if copy_only || !focused {
        if !copy_only {
            warn!("Couldn't return focus to the previous window; copied instead");
        }
        info!("Copied capture ({} chars of text)", text.len());
        return copy_png_and_text(app, &png, text);
    }
    let target = target.unwrap_or_default();
    std::thread::sleep(Duration::from_millis(80));

    let items = if options.is_terminal(&target.process) {
        vec![Item::Text(join_nonempty(&[&record.path, text]))]
    } else if text.trim().is_empty() {
        vec![Item::Png(png)]
    } else {
        vec![
            Item::Png(png),
            Item::Text(join_nonempty(&["[screenshot above]", text])),
        ]
    };
    paste_items(app, &target, items, meta.submit || options.always_submit)
}

/// Paste each item in order into the focused window, then restore the
/// clipboard. Terminals can't take images, so callers convert those to paths.
pub fn paste_items(
    app: &AppHandle,
    target: &Target,
    items: Vec<Item>,
    submit: bool,
) -> Result<(), String> {
    let clipboard = app.clipboard();
    let saved_text = clipboard.read_text().ok();
    let settings = get_settings(app);
    let enigo_state = app
        .try_state::<EnigoState>()
        .ok_or("Keyboard input not initialised")?;

    let gap = prefs::get(app).paste_gap_ms;
    let count = items.len();
    for (i, item) in items.into_iter().enumerate() {
        match item {
            Item::Png(png) => {
                let image = decode(&png)?;
                clipboard.write_image(&image).map_err(|e| e.to_string())?;
            }
            Item::Text(text) => {
                if text.trim().is_empty() {
                    continue;
                }
                clipboard.write_text(text).map_err(|e| e.to_string())?;
            }
        }
        paste(&enigo_state)?;
        if i + 1 < count {
            std::thread::sleep(Duration::from_millis(gap));
        }
    }

    if submit {
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
    info!("Pasted {} item(s) into {}", count, target.process);
    Ok(())
}

fn decode(png: &[u8]) -> Result<tauri::image::Image<'static>, String> {
    let image = image::load_from_memory_with_format(png, image::ImageFormat::Png)
        .map_err(|e| e.to_string())?
        .to_rgba8();
    let (width, height) = image.dimensions();
    Ok(tauri::image::Image::new_owned(
        image.into_raw(),
        width,
        height,
    ))
}

pub fn copy_png(app: &AppHandle, png: &[u8]) -> Result<(), String> {
    app.clipboard()
        .write_image(&decode(png)?)
        .map_err(|e| e.to_string())
}

/// The image and the text in one clipboard entry, so one paste can bring
/// both: chat apps that accept images attach it and insert the text, and
/// apps that take only one format use the one they understand.
#[cfg(target_os = "windows")]
pub fn copy_png_and_text(_app: &AppHandle, png: &[u8], text: &str) -> Result<(), String> {
    use clipboard_win::{options::NoClear, raw, register_format, Clipboard};
    const CF_DIB: u32 = 8;

    let dib = to_dib(&decode(png)?);
    let _open = Clipboard::new_attempts(10).map_err(|e| e.to_string())?;
    raw::empty().map_err(|e| e.to_string())?;
    raw::set_without_clear(CF_DIB, &dib).map_err(|e| e.to_string())?;
    // Chromium-based apps read this one first, at full quality.
    if let Some(format) = register_format("PNG") {
        raw::set_without_clear(format.get(), png).map_err(|e| e.to_string())?;
    }
    if !text.trim().is_empty() {
        raw::set_string_with(text, NoClear).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn copy_png_and_text(app: &AppHandle, png: &[u8], _text: &str) -> Result<(), String> {
    copy_png(app, png)
}

/// A 32-bit bottom-up device-independent bitmap (`CF_DIB`): a
/// BITMAPINFOHEADER followed by BGRA rows, last row first.
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
fn to_dib(image: &tauri::image::Image<'_>) -> Vec<u8> {
    let (width, height) = (image.width() as usize, image.height() as usize);
    let rgba = image.rgba();
    let mut out = Vec::with_capacity(40 + width * height * 4);
    out.extend_from_slice(&40u32.to_le_bytes()); // biSize
    out.extend_from_slice(&(width as i32).to_le_bytes());
    out.extend_from_slice(&(height as i32).to_le_bytes()); // positive: bottom-up
    out.extend_from_slice(&1u16.to_le_bytes()); // biPlanes
    out.extend_from_slice(&32u16.to_le_bytes()); // biBitCount
    out.extend_from_slice(&0u32.to_le_bytes()); // biCompression: BI_RGB
    out.extend_from_slice(&((width * height * 4) as u32).to_le_bytes());
    out.extend_from_slice(&[0u8; 16]); // resolution and palette: unused
    for row in (0..height).rev() {
        for px in rgba[row * width * 4..(row + 1) * width * 4].as_chunks::<4>().0 {
            out.extend_from_slice(&[px[2], px[1], px[0], px[3]]);
        }
    }
    out
}

pub fn copy_text(app: &AppHandle, text: &str) -> Result<(), String> {
    app.clipboard()
        .write_text(text.to_string())
        .map_err(|e| e.to_string())
}

pub(super) fn paste(enigo_state: &EnigoState) -> Result<(), String> {
    let mut enigo = enigo_state.0.lock().map_err(|e| e.to_string())?;
    send_paste_ctrl_v(&mut enigo, PASTE_HOLD_MS)
}

pub(super) fn join_nonempty(parts: &[&str]) -> String {
    parts
        .iter()
        .map(|p| p.trim())
        .filter(|p| !p.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_meta_and_rest() {
        let meta = br#"{"text":"hi","mode":"copyOnly","submit":false}"#;
        let mut body = (meta.len() as u32).to_le_bytes().to_vec();
        body.extend_from_slice(meta);
        body.extend_from_slice(b"PNGDATA");
        let (m, rest) = split_body(&body).unwrap();
        let parsed: SendMeta = serde_json::from_slice(m).unwrap();
        assert_eq!(parsed.text, "hi");
        assert_eq!(parsed.mode, SendMode::CopyOnly);
        assert_eq!(rest, b"PNGDATA");
    }

    #[test]
    fn rejects_truncated_body() {
        assert!(split_body(&[10, 0, 0, 0, b'{']).is_err());
    }

    #[test]
    fn dib_is_bottom_up_bgra() {
        // 1x2: top pixel red, bottom pixel blue.
        let image = tauri::image::Image::new_owned(vec![255, 0, 0, 255, 0, 0, 255, 255], 1, 2);
        let dib = to_dib(&image);
        assert_eq!(dib.len(), 40 + 8);
        assert_eq!(&dib[0..4], &40u32.to_le_bytes());
        assert_eq!(&dib[8..12], &2i32.to_le_bytes());
        assert_eq!(&dib[14..16], &32u16.to_le_bytes());
        // Bottom row (blue) comes first, as BGRA.
        assert_eq!(&dib[40..44], &[255, 0, 0, 255]);
        assert_eq!(&dib[44..48], &[0, 0, 255, 255]);
    }

    #[test]
    fn joins_only_nonempty_parts() {
        assert_eq!(join_nonempty(&["a", "  ", "b"]), "a\nb");
        assert_eq!(join_nonempty(&["[x]", ""]), "[x]");
    }
}
