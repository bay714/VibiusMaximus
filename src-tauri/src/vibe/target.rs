//! The window the user was in before a capture, so Send can paste back into it.

#[derive(Clone, Debug, Default)]
pub struct Target {
    pub hwnd: isize,
    /// Executable file name, e.g. `chrome.exe`.
    pub process: String,
}

#[cfg(target_os = "windows")]
pub fn foreground() -> Option<Target> {
    use windows::core::PWSTR;
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return None;
        }
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

        Some(Target {
            hwnd: hwnd.0 as isize,
            process,
        })
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
