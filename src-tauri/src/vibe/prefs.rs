//! Capture settings (Settings → Capture), stored in `vibe.json`.

use super::store;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct CaptureOptions {
    /// Press the submit key after every Send, not just Ctrl+Enter.
    pub always_submit: bool,
    /// Print the caption and notes in a band under the image.
    pub caption_band: bool,
    /// Paste the caption text after the image.
    pub include_text: bool,
    /// Pause between pastes so the chat app can attach each image.
    pub paste_gap_ms: u64,
    /// Apps that get a file path instead of an image (exe names).
    pub terminal_apps: Vec<String>,
    /// Apps where Send only copies to the clipboard.
    pub copy_only_apps: Vec<String>,
}

impl Default for CaptureOptions {
    fn default() -> Self {
        Self {
            always_submit: false,
            caption_band: true,
            include_text: true,
            paste_gap_ms: 250,
            terminal_apps: [
                "WindowsTerminal.exe",
                "OpenConsole.exe",
                "conhost.exe",
                "cmd.exe",
                "pwsh.exe",
                "powershell.exe",
                "wezterm-gui.exe",
                "alacritty.exe",
            ]
            .iter()
            .map(|s| s.to_string())
            .collect(),
            copy_only_apps: Vec::new(),
        }
    }
}

impl CaptureOptions {
    pub fn is_terminal(&self, process: &str) -> bool {
        self.terminal_apps
            .iter()
            .any(|a| a.eq_ignore_ascii_case(process))
    }

    pub fn is_copy_only(&self, process: &str) -> bool {
        self.copy_only_apps
            .iter()
            .any(|a| a.eq_ignore_ascii_case(process))
    }
}

pub fn get(app: &AppHandle) -> CaptureOptions {
    store::get(app, "capture").unwrap_or_default()
}

#[tauri::command]
pub fn vibe_capture_settings_get(app: AppHandle) -> CaptureOptions {
    get(&app)
}

#[tauri::command]
pub fn vibe_capture_settings_set(app: AppHandle, options: CaptureOptions) {
    store::set(&app, "capture", &options);
}

#[cfg(test)]
mod tests {
    use super::CaptureOptions;

    #[test]
    fn matches_apps_case_insensitively() {
        let o = CaptureOptions::default();
        assert!(o.is_terminal("windowsterminal.exe"));
        assert!(!o.is_terminal("chrome.exe"));
        assert!(!o.is_copy_only("chrome.exe"));
    }

    #[test]
    fn missing_fields_fall_back_to_defaults() {
        let o: CaptureOptions = serde_json::from_str(r#"{"alwaysSubmit":true}"#).unwrap();
        assert!(o.always_submit);
        assert!(o.caption_band);
        assert_eq!(o.paste_gap_ms, 250);
    }
}
