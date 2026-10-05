//! Freeze-frame screen capture. The capture window exists only while it's in
//! use: it is created on the hotkey and destroyed on send or cancel, and the
//! frame is dropped with it.

use super::history::{self, CaptureRecord};
use super::target::{self, Target};
use crate::actions::ShortcutAction;
use log::{error, warn};
use serde::Serialize;
use std::sync::Mutex;
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder,
};

pub const CAPTURE_WINDOW: &str = "capture";
pub const DICTATION_EVENT: &str = "vibe://dictation";

/// Raw RGBA pixels of the monitor that was captured.
pub struct Frame {
    pub rgba: Vec<u8>,
    pub width: u32,
    pub height: u32,
}

#[derive(Default)]
pub struct CaptureState {
    pub frame: Mutex<Option<Frame>>,
    pub target: Mutex<Option<Target>>,
    /// A capture from history to edit again, instead of selecting a region.
    pub reopen: Mutex<Option<CaptureRecord>>,
}

impl CaptureState {
    pub fn target(&self) -> Option<Target> {
        self.target.lock().ok().and_then(|t| t.clone())
    }
}

pub struct CaptureAction;

impl ShortcutAction for CaptureAction {
    fn start(&self, app: &AppHandle, _binding_id: &str, _shortcut_str: &str) {
        begin(app);
    }

    fn stop(&self, _app: &AppHandle, _binding_id: &str, _shortcut_str: &str) {}
}

/// Start a capture (hotkey or tray). Grabbing the screen takes tens of
/// milliseconds, so it runs off the calling thread.
pub fn begin(app: &AppHandle) {
    spawn_capture(app, None);
}

/// Open a capture from history in the editor. The screen is still frozen
/// behind it, like a new capture. Send goes to the window it was first sent
/// to, if that window is still open.
pub fn reopen(app: &AppHandle, record: CaptureRecord) {
    spawn_capture(app, Some(record));
}

fn spawn_capture(app: &AppHandle, reopen: Option<CaptureRecord>) {
    let app = app.clone();
    std::thread::spawn(move || {
        if let Err(e) = start_capture(&app, reopen) {
            error!("Capture failed: {}", e);
            close(&app);
        }
    });
}

fn start_capture(app: &AppHandle, reopen: Option<CaptureRecord>) -> Result<(), String> {
    if app.get_webview_window(CAPTURE_WINDOW).is_some() {
        return Ok(());
    }
    let state = app.state::<CaptureState>();

    // Remember where the user was before our window takes focus. A reopened
    // capture was started from our own Captures page, so use its saved window.
    if let Ok(mut t) = state.target.lock() {
        *t = match &reopen {
            Some(r) => target::find(r.hwnd, &r.target),
            None => target::foreground(),
        };
    }
    if let Ok(mut r) = state.reopen.lock() {
        *r = reopen;
    }

    let (cx, cy) = crate::input::get_cursor_position(app).unwrap_or((0, 0));
    let monitor = match xcap::Monitor::from_point(cx, cy) {
        Ok(m) => m,
        Err(e) => {
            warn!(
                "No monitor at cursor ({}, {}): {}; using the first",
                cx, cy, e
            );
            xcap::Monitor::all()
                .map_err(|e| e.to_string())?
                .into_iter()
                .next()
                .ok_or("No monitors found")?
        }
    };
    let image = monitor.capture_image().map_err(|e| e.to_string())?;
    let (x, y) = (
        monitor.x().map_err(|e| e.to_string())?,
        monitor.y().map_err(|e| e.to_string())?,
    );
    let (width, height) = image.dimensions();

    if let Ok(mut f) = state.frame.lock() {
        *f = Some(Frame {
            rgba: image.into_raw(),
            width,
            height,
        });
    }

    let window = WebviewWindowBuilder::new(
        app,
        CAPTURE_WINDOW,
        WebviewUrl::App("src/capture/index.html".into()),
    )
    .title("VibiusMaximus capture")
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .shadow(false)
    .visible(false)
    .focused(true)
    .build()
    .map_err(|e| e.to_string())?;

    // Physical units, so the window exactly covers the captured monitor at any
    // display scaling.
    window
        .set_position(PhysicalPosition::new(x, y))
        .map_err(|e| e.to_string())?;
    window
        .set_size(PhysicalSize::new(width, height))
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Destroy the capture window and drop the frame.
pub fn close(app: &AppHandle) {
    let state = app.state::<CaptureState>();
    if let Ok(mut f) = state.frame.lock() {
        *f = None;
    }
    if let Ok(mut r) = state.reopen.lock() {
        *r = None;
    }
    if let Some(window) = app.get_webview_window(CAPTURE_WINDOW) {
        let _ = window.destroy();
    }
}

/// Send a finished dictation to the capture editor instead of pasting it.
/// Returns false when no capture window is open.
pub fn deliver_dictation(app: &AppHandle, text: &str) -> bool {
    let visible = app
        .get_webview_window(CAPTURE_WINDOW)
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false);
    if visible {
        let _ = app.emit_to(CAPTURE_WINDOW, DICTATION_EVENT, text.to_string());
    }
    visible
}

/// The frame as `[width u32 LE][height u32 LE][RGBA bytes]`.
#[tauri::command]
pub fn vibe_frame(state: tauri::State<'_, CaptureState>) -> Result<tauri::ipc::Response, String> {
    let guard = state.frame.lock().map_err(|e| e.to_string())?;
    let frame = guard.as_ref().ok_or("No capture in progress")?;
    let mut out = Vec::with_capacity(8 + frame.rgba.len());
    out.extend_from_slice(&frame.width.to_le_bytes());
    out.extend_from_slice(&frame.height.to_le_bytes());
    out.extend_from_slice(&frame.rgba);
    Ok(tauri::ipc::Response::new(out))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionTarget {
    /// Short app name for the Send button, e.g. `Chrome`.
    app: String,
    title: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Reopened {
    /// Editor scene JSON, when the capture was saved with one.
    scene: Option<String>,
    /// The flattened PNG, used as the screenshot when there is no scene.
    path: String,
    text: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    target: Option<SessionTarget>,
    reopen: Option<Reopened>,
}

/// Where Send will paste, and the capture being reopened, if any.
#[tauri::command]
pub fn vibe_capture_session(state: tauri::State<'_, CaptureState>) -> Session {
    let target = state.target().map(|t| SessionTarget {
        app: target::display_name(&t.process),
        title: t.title,
    });
    let reopen = state
        .reopen
        .lock()
        .ok()
        .and_then(|r| r.clone())
        .map(|r| Reopened {
            scene: history::scene(&r),
            path: r.path,
            text: r.text,
        });
    Session { target, reopen }
}

/// Called by the capture window once the frame is drawn, to avoid a blank flash.
#[tauri::command]
pub fn vibe_capture_ready(window: tauri::WebviewWindow) -> Result<(), String> {
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn vibe_close(app: AppHandle) {
    close(&app);
}
