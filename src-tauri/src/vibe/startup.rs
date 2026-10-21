//! Startup watchdog. Now and then the app freezes partway through starting:
//! no window, no tray icon, and every later launch hangs too, because a new
//! copy hands its arguments to the frozen one and waits for an answer that
//! never comes. A relaunch starts normally, so when startup stops making
//! progress we log the step it stopped at, start a fresh copy and end this one.

use log::{error, info};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// A normal start takes 10–20 seconds; most of that is one step (loading the
/// speech engine), so a minute without progress means it's stuck.
const STALL: Duration = Duration::from_secs(60);
/// Fresh copies to try before giving up, so a start that always freezes
/// doesn't relaunch forever.
const MAX_RETRIES: u32 = 2;
/// Set on the fresh copy: the frozen copy's process id, to wait for.
const WAIT_PID_VAR: &str = "VIBE_STARTUP_WAIT_PID";
/// Set on the fresh copy: how many fresh copies came before it.
const RETRY_VAR: &str = "VIBE_STARTUP_RETRY";

static STEP: Mutex<Option<(&'static str, Instant)>> = Mutex::new(None);
static DONE: AtomicBool = AtomicBool::new(false);
static RETRY: AtomicU32 = AtomicU32::new(0);

/// Called first thing in `main`. On a fresh copy started by the watchdog,
/// waits for the frozen copy to be gone, so this one doesn't hand over to it.
pub fn wait_for_stuck_copy() {
    let retry = std::env::var(RETRY_VAR)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);
    RETRY.store(retry, Ordering::Relaxed);
    let pid = std::env::var(WAIT_PID_VAR)
        .ok()
        .and_then(|v| v.parse::<u32>().ok());
    // Not passed on to the speech worker or to a later restart.
    std::env::remove_var(RETRY_VAR);
    std::env::remove_var(WAIT_PID_VAR);
    #[cfg(windows)]
    if let Some(pid) = pid {
        wait_for_exit(pid);
    }
    #[cfg(not(windows))]
    let _ = pid;
}

/// Startup has begun: watch it from here on.
pub fn begin() {
    step("window");
    if let Err(e) = std::thread::Builder::new()
        .name("startup-watchdog".into())
        .spawn(watch)
    {
        error!("Couldn't start the startup watchdog: {}", e);
    }
}

/// Startup reached `name`. Logged, so a freeze shows where it stopped.
pub fn step(name: &'static str) {
    info!("Startup: {}", name);
    if let Ok(mut step) = STEP.lock() {
        *step = Some((name, Instant::now()));
    }
}

/// Startup finished; the watchdog stops.
pub fn done() {
    info!("Startup: done");
    DONE.store(true, Ordering::Relaxed);
}

fn watch() {
    loop {
        std::thread::sleep(Duration::from_secs(1));
        if DONE.load(Ordering::Relaxed) {
            return;
        }
        let Some((name, since)) = STEP.lock().ok().and_then(|step| *step) else {
            continue;
        };
        if since.elapsed() >= STALL {
            stuck(name);
            return;
        }
    }
}

fn stuck(name: &str) {
    let retry = RETRY.load(Ordering::Relaxed);
    error!(
        "Startup stuck at '{}' for {}s (attempt {})",
        name,
        STALL.as_secs(),
        retry + 1
    );
    if retry < MAX_RETRIES {
        relaunch(retry + 1);
    } else {
        error!("Startup kept getting stuck; not trying again");
    }
    log::logger().flush();
    // Ending this copy also lets go of any later launches waiting on it. Not
    // `process::exit`: that runs cleanup, which can wait on the frozen thread.
    #[cfg(windows)]
    unsafe {
        use windows::Win32::System::Threading::{GetCurrentProcess, TerminateProcess};
        let _ = TerminateProcess(GetCurrentProcess(), 1);
    }
    #[cfg(not(windows))]
    std::process::abort();
}

fn relaunch(retry: u32) {
    let exe = match std::env::current_exe() {
        Ok(exe) => exe,
        Err(e) => {
            error!("Couldn't find the app to start again: {}", e);
            return;
        }
    };
    match std::process::Command::new(exe)
        .args(std::env::args_os().skip(1))
        .env(WAIT_PID_VAR, std::process::id().to_string())
        .env(RETRY_VAR, retry.to_string())
        .spawn()
    {
        Ok(_) => info!("Started a fresh copy"),
        Err(e) => error!("Couldn't start a fresh copy: {}", e),
    }
}

#[cfg(windows)]
fn wait_for_exit(pid: u32) {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Threading::{
        OpenProcess, WaitForSingleObject, PROCESS_SYNCHRONIZE,
    };
    unsafe {
        // Gone already if it can't be opened.
        if let Ok(process) = OpenProcess(PROCESS_SYNCHRONIZE, false, pid) {
            let _ = WaitForSingleObject(process, 10_000);
            let _ = CloseHandle(process);
        }
    }
    // Launches that were waiting on the frozen copy wake up and quit; give
    // them a moment to let go of the single-instance lock.
    std::thread::sleep(Duration::from_millis(500));
}
