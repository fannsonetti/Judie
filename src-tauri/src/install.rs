use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Manager};

pub use crate::releases::{LatestUpdate, ReleaseInfo};

pub fn list_releases() -> Result<Vec<ReleaseInfo>, String> {
    crate::releases::list_releases()
}

pub fn check_latest() -> Result<LatestUpdate, String> {
    crate::releases::check_latest()
}

pub fn install_release(app: AppHandle, tag: String) -> Result<(), String> {
    crate::releases::install_tag(&tag)?;
    finish_install(app)
}

pub fn install_latest(app: AppHandle) -> Result<(), String> {
    crate::releases::install_latest()?;
    finish_install(app)
}

fn finish_install(app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        let _ = crate::releases::relaunch_linux();
        app.exit(0);
        return Ok(());
    }
    #[cfg(windows)]
    {
        app.exit(0);
        return Ok(());
    }
    #[cfg(not(any(target_os = "linux", windows)))]
    {
        let _ = app;
        Err("Install is only available on Windows and Linux".into())
    }
}

pub fn uninstall_judie(app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        let status = Command::new("pkexec")
            .args(["apt-get", "remove", "-y", "judie"])
            .status()
            .map_err(|e| format!("Could not start uninstall: {e}"))?;
        if !status.success() {
            return Err("Uninstall was cancelled or failed".into());
        }
        app.exit(0);
        return Ok(());
    }

    #[cfg(windows)]
    {
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let dir = exe
            .parent()
            .ok_or_else(|| "Missing install folder".to_string())?;
        let uninst = dir.join("uninstall.exe");
        if !uninst.exists() {
            return Err("Windows uninstaller was not found".into());
        }
        let mut cmd = Command::new(&uninst);
        cmd.arg("/S");
        cmd.spawn().map_err(|e| e.to_string())?;
        app.exit(0);
        return Ok(());
    }

    #[cfg(not(any(target_os = "linux", windows)))]
    {
        let _ = app;
        Err("Uninstall is only available on Windows and Linux".into())
    }
}

fn kiosk_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("kiosk"))
}

pub fn kiosk_enabled(app: &AppHandle) -> bool {
    match kiosk_path(app) {
        Ok(p) if p.exists() => fs::read_to_string(p)
            .map(|s| s.trim() != "0")
            .unwrap_or(true),
        _ => cfg!(target_os = "linux"),
    }
}

pub fn set_kiosk(app: &AppHandle, enabled: bool) -> Result<(), String> {
    let path = kiosk_path(app)?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    fs::write(&path, if enabled { "1" } else { "0" }).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn apply_kiosk(app: &AppHandle) {
    let enabled = kiosk_enabled(app);
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_decorations(!enabled);
        let _ = win.set_fullscreen(enabled);
        if enabled {
            let _ = win.maximize();
        }
    }
}

/// The .deb already starts Judie via /etc/xdg/autostart. The autostart plugin
/// also writes ~/.config/autostart, which opens a second window at login.
#[cfg(target_os = "linux")]
pub fn repair_linux_autostart() {
    let Some(home) = std::env::var_os("HOME") else {
        return;
    };
    let dir = PathBuf::from(home).join(".config/autostart");
    let Ok(entries) = fs::read_dir(&dir) else {
        return;
    };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_ascii_lowercase();
        if name.ends_with(".desktop") && (name.contains("judie") || name.contains("com.judie")) {
            let _ = fs::remove_file(entry.path());
        }
    }
}
