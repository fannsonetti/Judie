use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tauri::{AppHandle, Manager};

const GH_REPO: &str = "fannsonetti/Judie";

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseInfo {
    pub tag: String,
    pub name: String,
    pub published_at: String,
    pub current: bool,
    pub installable: bool,
    pub asset_name: String,
    pub asset_url: String,
}

#[derive(Deserialize)]
struct GhRelease {
    tag_name: String,
    name: Option<String>,
    draft: bool,
    prerelease: bool,
    published_at: Option<String>,
    assets: Vec<GhAsset>,
}

#[derive(Deserialize)]
struct GhAsset {
    name: String,
    browser_download_url: String,
}

pub fn asset_matches_for(name: &str, os: &str, arch: &str) -> bool {
    let n = name.to_ascii_lowercase();
    match os {
        "windows" => {
            n.ends_with(".exe")
                && (n.contains("x64-setup") || n.contains("x64") || n.contains("setup"))
        }
        "linux" => {
            if !n.ends_with(".deb") {
                return false;
            }
            match arch {
                "arm" | "armv7" | "armhf" => {
                    n.contains("armhf") || n.contains("armv7") || n.contains("_arm.")
                }
                "aarch64" | "arm64" => n.contains("aarch64") || n.contains("arm64"),
                "x86_64" | "amd64" => n.contains("amd64") || n.contains("x86_64") || n.contains("x64"),
                _ => true,
            }
        }
        _ => false,
    }
}

fn host_os() -> &'static str {
    if cfg!(windows) {
        "windows"
    } else {
        "linux"
    }
}

fn host_arch() -> &'static str {
    match std::env::consts::ARCH {
        "x86_64" => "x86_64",
        "aarch64" => "aarch64",
        "arm" => "arm",
        other => other,
    }
}

fn current_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

fn pick_asset(assets: &[GhAsset]) -> Option<&GhAsset> {
    let os = host_os();
    let arch = host_arch();
    assets
        .iter()
        .find(|a| asset_matches_for(&a.name, os, arch))
}

pub fn list_releases() -> Result<Vec<ReleaseInfo>, String> {
    let url = format!("https://api.github.com/repos/{}/releases", GH_REPO);
    let body = ureq::get(&url)
        .set("User-Agent", "Judie")
        .set("Accept", "application/vnd.github+json")
        .call()
        .map_err(|e| format!("Could not load releases: {e}"))?
        .into_string()
        .map_err(|e| e.to_string())?;
    let parsed: Vec<GhRelease> =
        serde_json::from_str(&body).map_err(|e| format!("Bad GitHub response: {e}"))?;
    let current = current_version();
    let mut out = Vec::new();
    for rel in parsed {
        if rel.draft {
            continue;
        }
        let asset = pick_asset(&rel.assets);
        let tag = rel.tag_name.trim_start_matches('v').to_string();
        out.push(ReleaseInfo {
            current: tag == current || rel.tag_name == format!("v{current}"),
            name: rel
                .name
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| rel.tag_name.clone()),
            published_at: rel.published_at.unwrap_or_default(),
            installable: asset.is_some() && !rel.prerelease,
            asset_name: asset.map(|a| a.name.clone()).unwrap_or_default(),
            asset_url: asset.map(|a| a.browser_download_url.clone()).unwrap_or_default(),
            tag: rel.tag_name,
        });
    }
    Ok(out)
}

fn download(url: &str, dest: &Path) -> Result<(), String> {
    let resp = ureq::get(url)
        .set("User-Agent", "Judie")
        .call()
        .map_err(|e| format!("Download failed: {e}"))?;
    let mut file = fs::File::create(dest).map_err(|e| e.to_string())?;
    let mut reader = resp.into_reader();
    std::io::copy(&mut reader, &mut file).map_err(|e| e.to_string())?;
    file.flush().map_err(|e| e.to_string())?;
    Ok(())
}

fn spawn_detached(mut cmd: Command) -> Result<(), String> {
    cmd.stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const DETACHED_PROCESS: u32 = 0x00000008;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;
        cmd.creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP);
    }
    cmd.spawn().map_err(|e| e.to_string())?;
    Ok(())
}

pub fn install_release(app: AppHandle, tag: String) -> Result<(), String> {
    let releases = list_releases()?;
    let rel = releases
        .into_iter()
        .find(|r| r.tag == tag || r.tag == format!("v{tag}") || r.tag.trim_start_matches('v') == tag)
        .ok_or_else(|| format!("Release {tag} not found"))?;
    if !rel.installable || rel.asset_url.is_empty() {
        return Err("No installer for this computer in that release".into());
    }
    let tmp = std::env::temp_dir().join(&rel.asset_name);
    download(&rel.asset_url, &tmp)?;

    #[cfg(target_os = "linux")]
    {
        let status = Command::new("pkexec")
            .args(["apt-get", "install", "-y", "--reinstall"])
            .arg(&tmp)
            .status()
            .map_err(|e| format!("Could not start installer: {e}"))?;
        if !status.success() {
            return Err("Install was cancelled or failed".into());
        }
        let _ = fs::remove_file(&tmp);
        let mut relaunch = Command::new("sh");
        relaunch.args(["-c", "sleep 2; exec judie"]);
        let _ = spawn_detached(relaunch);
        app.exit(0);
        return Ok(());
    }

    #[cfg(windows)]
    {
        spawn_detached(Command::new(&tmp))?;
        app.exit(0);
        return Ok(());
    }

    #[cfg(not(any(target_os = "linux", windows)))]
    {
        let _ = (&app, tmp);
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
        let dir = exe.parent().ok_or_else(|| "Missing install folder".to_string())?;
        let uninst = dir.join("uninstall.exe");
        if !uninst.exists() {
            return Err("Windows uninstaller was not found".into());
        }
        let mut cmd = Command::new(&uninst);
        cmd.arg("/S");
        spawn_detached(cmd)?;
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

#[cfg(test)]
mod tests {
    use super::asset_matches_for;

    #[test]
    fn linux_armhf_deb() {
        assert!(asset_matches_for("Judie_0.1.0_armhf.deb", "linux", "arm"));
        assert!(!asset_matches_for("Judie_0.1.0_arm64.deb", "linux", "arm"));
        assert!(asset_matches_for("Judie_0.1.0_aarch64.deb", "linux", "aarch64"));
        assert!(asset_matches_for("Judie_0.1.6_arm64.deb", "linux", "arm64"));
    }

    #[test]
    fn windows_setup() {
        assert!(asset_matches_for("Judie_0.1.0_x64-setup.exe", "windows", "x86_64"));
        assert!(!asset_matches_for("Judie_0.1.0_armhf.deb", "windows", "x86_64"));
    }
}
