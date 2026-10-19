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
        "chrome" | "google chrome" => Some("Chrome"),
        "msedge" | "microsoft edge" => Some("Edge"),
        "firefox" => Some("Firefox"),
        "code" | "visual studio code" => Some("VS Code"),
        "cursor" => Some("Cursor"),
        "windsurf" => Some("Windsurf"),
        "windowsterminal" => Some("Terminal"),
        "iterm2" => Some("iTerm"),
        "claude" => Some("Claude"),
        "chatgpt" => Some("ChatGPT"),
        "slack" => Some("Slack"),
        "teams" | "ms-teams" => Some("Teams"),
        "olk" | "outlook" | "microsoft outlook" => Some("Outlook"),
        "excel" | "microsoft excel" => Some("Excel"),
        "winword" | "microsoft word" => Some("Word"),
        "powerpnt" | "microsoft powerpoint" => Some("PowerPoint"),
        "pbidesktop" => Some("Power BI"),
        "explorer" => Some("File Explorer"),
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

/// Open app windows, front to back, for picking where to send: the ones on
/// the taskbar, without our own windows.
#[cfg(target_os = "windows")]
pub fn list() -> Vec<Target> {
    use windows::core::BOOL;
    use windows::Win32::Foundation::{HWND, LPARAM};
    use windows::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED};
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindow, GetWindowLongW, GetWindowThreadProcessId, IsWindowVisible,
        GWL_EXSTYLE, GW_OWNER, WS_EX_TOOLWINDOW,
    };

    unsafe extern "system" fn collect(hwnd: HWND, out: LPARAM) -> BOOL {
        // SAFETY: `out` is the Vec passed to EnumWindows below, alive for the call.
        unsafe { (*(out.0 as *mut Vec<HWND>)).push(hwnd) };
        true.into()
    }

    let mut hwnds: Vec<HWND> = Vec::new();
    let own_pid = std::process::id();
    unsafe {
        let _ = EnumWindows(Some(collect), LPARAM(&mut hwnds as *mut _ as isize));
        hwnds
            .into_iter()
            .filter(|&hwnd| {
                let mut pid = 0u32;
                GetWindowThreadProcessId(hwnd, Some(&mut pid));
                // Hidden UWP apps stay "visible" but cloaked.
                let mut cloaked = 0u32;
                let _ = DwmGetWindowAttribute(
                    hwnd,
                    DWMWA_CLOAKED,
                    &mut cloaked as *mut u32 as *mut core::ffi::c_void,
                    std::mem::size_of::<u32>() as u32,
                );
                IsWindowVisible(hwnd).as_bool()
                    && cloaked == 0
                    && pid != own_pid
                    && GetWindow(hwnd, GW_OWNER).is_err()
                    && GetWindowLongW(hwnd, GWL_EXSTYLE) as u32 & WS_EX_TOOLWINDOW.0 == 0
            })
            .filter_map(|hwnd| describe(hwnd))
            .filter(|t| {
                !t.title.trim().is_empty()
                    && !t.process.is_empty()
                    && !(t.process.eq_ignore_ascii_case("explorer.exe")
                        && t.title == "Program Manager")
            })
            .collect()
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

// macOS tracks apps rather than windows: `hwnd` holds the app's process id and
// `process` its name as shown in the Dock (e.g. `Google Chrome`).

#[cfg(target_os = "macos")]
pub fn foreground() -> Option<Target> {
    use objc2_app_kit::NSWorkspace;

    let app = NSWorkspace::sharedWorkspace().frontmostApplication()?;
    describe_app(&app)
}

#[cfg(target_os = "macos")]
fn describe_app(app: &objc2_app_kit::NSRunningApplication) -> Option<Target> {
    let pid = app.processIdentifier();
    if pid <= 0 || pid as u32 == std::process::id() {
        return None;
    }
    let name = app.localizedName()?.to_string();
    Some(Target {
        hwnd: pid as isize,
        process: name.clone(),
        title: name,
    })
}

/// Running apps that show in the Dock, for picking where to send.
#[cfg(target_os = "macos")]
pub fn list() -> Vec<Target> {
    use objc2_app_kit::{NSApplicationActivationPolicy, NSWorkspace};

    NSWorkspace::sharedWorkspace()
        .runningApplications()
        .iter()
        .filter(|app| app.activationPolicy() == NSApplicationActivationPolicy::Regular)
        .filter_map(|app| describe_app(&app))
        .collect()
}

/// An app saved earlier, if it's still running under the same name. Process
/// ids are reused, so the name check keeps us from pasting into another app.
#[cfg(target_os = "macos")]
pub fn find(hwnd: isize, process: &str) -> Option<Target> {
    use objc2_app_kit::NSRunningApplication;

    if hwnd <= 0 || process.is_empty() {
        return None;
    }
    let app = NSRunningApplication::runningApplicationWithProcessIdentifier(hwnd as i32)?;
    if app.isTerminated() {
        return None;
    }
    describe_app(&app).filter(|t| t.process.eq_ignore_ascii_case(process))
}

/// Bring the target app back to the front. Called while our capture window is
/// still active, since macOS lets the active app hand activation over.
#[cfg(target_os = "macos")]
pub fn focus(target: &Target) -> bool {
    use objc2_app_kit::{NSApplicationActivationOptions, NSRunningApplication, NSWorkspace};

    let Some(app) =
        NSRunningApplication::runningApplicationWithProcessIdentifier(target.hwnd as i32)
    else {
        return false;
    };
    // Ignored from macOS 14 on, where the active app can hand over without it.
    #[allow(deprecated)]
    app.activateWithOptions(NSApplicationActivationOptions::ActivateIgnoringOtherApps);
    for _ in 0..50 {
        let front = NSWorkspace::sharedWorkspace()
            .frontmostApplication()
            .map(|a| a.processIdentifier() as isize);
        if front == Some(target.hwnd) {
            return true;
        }
        std::thread::sleep(std::time::Duration::from_millis(10));
    }
    false
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn foreground() -> Option<Target> {
    None
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn list() -> Vec<Target> {
    Vec::new()
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn focus(_target: &Target) -> bool {
    false
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
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
        assert_eq!(display_name("olk.exe"), "Outlook");
        assert_eq!(display_name("PBIDesktop.exe"), "Power BI");
        // macOS app names
        assert_eq!(display_name("Google Chrome"), "Chrome");
        assert_eq!(display_name("Cursor"), "Cursor");
        assert_eq!(display_name("iTerm2"), "iTerm");
        assert_eq!(display_name(""), "");
    }
}
