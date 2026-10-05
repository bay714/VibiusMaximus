//! The window the user was in before a capture, so Send can paste back into it.

#[derive(Clone, Debug, Default)]
pub struct Target {
    pub hwnd: isize,
    /// Executable file name, e.g. `chrome.exe`.
    pub process: String,
    /// Window title when the capture started, e.g. `New chat - Claude`.
    pub title: String,
}

/// A short app name for the Send button: `chrome.exe` becomes `Chrome`.
pub fn display_name(process: &str) -> String {
    let stem = process
        .rsplit_once('.')
        .map_or(process, |(stem, _)| stem)
        .trim();
    let known = match stem.to_ascii_lowercase().as_str() {
        "chrome" => Some("Chrome"),
        "msedge" => Some("Edge"),
        "firefox" => Some("Firefox"),
        "code" => Some("VS Code"),
        "cursor" => Some("Cursor"),
        "windsurf" => Some("Windsurf"),
        "windowsterminal" => Some("Terminal"),
        "claude" => Some("Claude"),
        "chatgpt" => Some("ChatGPT"),
        "slack" => Some("Slack"),
        "teams" | "ms-teams" => Some("Teams"),
        _ => None,
    };
    match known {
        Some(name) => name.to_string(),
        None => {
            let mut chars = stem.chars();
            chars
                .next()
                .map(|c| c.to_uppercase().chain(chars).collect())
                .unwrap_or_default()
        }
    }
}

#[cfg(target_os = "windows")]
pub fn foreground() -> Option<Target> {
    use windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow;

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return None;
        }
        describe(hwnd)
    }
}

/// Process name and title of a window.
#[cfg(target_os = "windows")]
unsafe fn describe(hwnd: windows::Win32::Foundation::HWND) -> Option<Target> {
    use windows::core::PWSTR;
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::WindowsAndMessaging::{GetWindowTextW, GetWindowThreadProcessId};

    unsafe {
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));

        let mut process = String::new();
        if let Ok(handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) {
            let mut buf = [0u16; 512];
            let mut len = buf.len() as u32;
            if QueryFullProcessImageNameW(
                handle,
                PROCESS_NAME_WIN32,
                PWSTR(buf.as_mut_ptr()),
                &mut len,
            )
            .is_ok()
            {
                let path = String::from_utf16_lossy(&buf[..len as usize]);
                process = path.rsplit('\\').next().unwrap_or_default().to_string();
            }
            let _ = CloseHandle(handle);
        }

        let mut buf = [0u16; 512];
        let len = GetWindowTextW(hwnd, &mut buf).max(0) as usize;
        let title = String::from_utf16_lossy(&buf[..len]);

        Some(Target {
            hwnd: hwnd.0 as isize,
            process,
            title,
        })
    }
}

/// A window saved earlier (e.g. with a capture in history), if it is still
/// open and still belongs to the same app. Window handles are reused, so the
/// process name check keeps us from pasting into an unrelated window.
#[cfg(target_os = "windows")]
pub fn find(hwnd: isize, process: &str) -> Option<Target> {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::IsWindow;

    if hwnd == 0 || process.is_empty() {
        return None;
    }
    unsafe {
        let hwnd = HWND(hwnd as *mut core::ffi::c_void);
        if !IsWindow(Some(hwnd)).as_bool() {
            return None;
        }
        describe(hwnd).filter(|t| t.process.eq_ignore_ascii_case(process))
    }
}

/// Bring the target window back to the front. Must be called while our capture
/// window still has focus: Windows only lets the foreground process hand focus
/// to another window.
#[cfg(target_os = "windows")]
pub fn focus(target: &Target) -> bool {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, IsIconic, SetForegroundWindow, ShowWindow, SW_RESTORE,
    };

    unsafe {
        let hwnd = HWND(target.hwnd as *mut core::ffi::c_void);
        if IsIconic(hwnd).as_bool() {
            let _ = ShowWindow(hwnd, SW_RESTORE);
        }
        let _ = SetForegroundWindow(hwnd);
        for _ in 0..30 {
            if GetForegroundWindow() == hwnd {
                return true;
            }
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
        false
    }
}

#[cfg(not(target_os = "windows"))]
pub fn foreground() -> Option<Target> {
    None
}

#[cfg(not(target_os = "windows"))]
pub fn focus(_target: &Target) -> bool {
    false
}

#[cfg(not(target_os = "windows"))]
pub fn find(_hwnd: isize, _process: &str) -> Option<Target> {
    None
}

#[cfg(test)]
mod tests {
    use super::display_name;

    #[test]
    fn friendly_app_names() {
        assert_eq!(display_name("chrome.exe"), "Chrome");
        assert_eq!(display_name("Code.exe"), "VS Code");
        assert_eq!(display_name("WindowsTerminal.exe"), "Terminal");
        assert_eq!(display_name("notepad++.exe"), "Notepad++");
        assert_eq!(display_name(""), "");
    }
}
