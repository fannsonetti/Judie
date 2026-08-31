use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Duration;

const GH_REPO: &str = "fannsonetti/Judie";
const UA: &str = "Judie";

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

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LatestUpdate {
    pub current: String,
    pub latest: String,
    pub latest_tag: String,
    pub outdated: bool,
    pub installable: bool,
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

pub fn current_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

pub fn parse_version(raw: &str) -> Option<(u64, u64, u64)> {
    let s = raw.trim().trim_start_matches('v');
    let mut parts = s.split('.');
    let major = parts.next()?.parse().ok()?;
    let minor = parts.next()?.parse().ok()?;
    let patch = parts
        .next()
        .map(|p| p.chars().take_while(|c| c.is_ascii_digit()).collect::<String>())
        .filter(|p| !p.is_empty())
        .and_then(|p| p.parse().ok())
        .unwrap_or(0);
    Some((major, minor, patch))
}

pub fn is_newer(candidate: &str, current: &str) -> bool {
    match (parse_version(candidate), parse_version(current)) {
        (Some(a), Some(b)) => a > b,
        _ => false,
    }
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
                "x86_64" | "amd64" => {
                    n.contains("amd64") || n.contains("x86_64") || n.contains("x64")
                }
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

fn pick_asset(assets: &[GhAsset]) -> Option<&GhAsset> {
    let os = host_os();
    let arch = host_arch();
    assets
        .iter()
        .find(|a| asset_matches_for(&a.name, os, arch))
}

fn agent() -> ureq::Agent {
    ureq::builder()
        .timeout(Duration::from_secs(8))
        .build()
}

fn get_json(url: &str) -> Result<String, String> {
    agent()
        .get(url)
        .set("User-Agent", UA)
        .set("Accept", "application/vnd.github+json")
        .call()
        .map_err(|e| format!("Could not load releases: {e}"))?
        .into_string()
        .map_err(|e| e.to_string())
}

fn to_info(rel: GhRelease, current: &str) -> ReleaseInfo {
    let asset = pick_asset(&rel.assets);
    let tag = rel.tag_name.trim_start_matches('v').to_string();
    ReleaseInfo {
        current: tag == current || rel.tag_name == format!("v{current}"),
        name: rel
            .name
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| rel.tag_name.clone()),
        published_at: rel.published_at.unwrap_or_default(),
        installable: asset.is_some() && !rel.prerelease,
        asset_name: asset.map(|a| a.name.clone()).unwrap_or_default(),
        asset_url: asset
            .map(|a| a.browser_download_url.clone())
            .unwrap_or_default(),
        tag: rel.tag_name,
    }
}

pub fn list_releases() -> Result<Vec<ReleaseInfo>, String> {
    let url = format!("https://api.github.com/repos/{GH_REPO}/releases");
    let body = get_json(&url)?;
    let parsed: Vec<GhRelease> =
        serde_json::from_str(&body).map_err(|e| format!("Bad GitHub response: {e}"))?;
    let current = current_version();
    Ok(parsed
        .into_iter()
        .filter(|r| !r.draft)
        .map(|r| to_info(r, current))
        .collect())
}

pub fn check_latest() -> Result<LatestUpdate, String> {
    let url = format!("https://api.github.com/repos/{GH_REPO}/releases/latest");
    let body = get_json(&url)?;
    let parsed: GhRelease =
        serde_json::from_str(&body).map_err(|e| format!("Bad GitHub response: {e}"))?;
    let current = current_version().to_string();
    let info = to_info(parsed, &current);
    let latest = info.tag.trim_start_matches('v').to_string();
    Ok(LatestUpdate {
        outdated: is_newer(&latest, &current) && info.installable,
        latest_tag: info.tag,
        latest,
        current,
        installable: info.installable,
    })
}

#[cfg(target_os = "linux")]
fn linux_staging_dir() -> PathBuf {
    PathBuf::from("/tmp/judie-update")
}

pub fn download(url: &str, dest: &Path) -> Result<(), String> {
    if let Some(dir) = dest.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let resp = agent()
        .get(url)
        .set("User-Agent", UA)
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

#[cfg(target_os = "linux")]
fn apply_linux_deb(deb: &Path) -> Result<(), String> {
    let helper = Path::new("/usr/lib/judie/apply-update");
    if helper.is_file() {
        let status = Command::new("sudo")
            .args(["-n", "/usr/lib/judie/apply-update"])
            .arg(deb)
            .status()
            .map_err(|e| format!("Could not start updater: {e}"))?;
        if status.success() {
            return Ok(());
        }
        return Err(
            "Could not apply the update without a password. Install this Judie build once from a terminal, then later updates stay silent.".into(),
        );
    }
    Err(
        "This copy cannot update silently yet. Install the latest .deb from a terminal once.".into(),
    )
}

pub fn apply_package(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        return apply_linux_deb(path);
    }

    #[cfg(windows)]
    {
        let mut cmd = Command::new(path);
        cmd.arg("/S");
        spawn_detached(cmd)?;
        return Ok(());
    }

    #[cfg(not(any(target_os = "linux", windows)))]
    {
        let _ = path;
        Err("Install is only available on Windows and Linux".into())
    }
}

pub fn package_dest(asset_name: &str) -> PathBuf {
    #[cfg(target_os = "linux")]
    {
        linux_staging_dir().join(asset_name)
    }
    #[cfg(not(target_os = "linux"))]
    {
        std::env::temp_dir().join(asset_name)
    }
}

pub fn download_and_apply(asset_url: &str, asset_name: &str) -> Result<(), String> {
    let dest = package_dest(asset_name);
    download(asset_url, &dest)?;
    apply_package(&dest)?;
    #[cfg(target_os = "linux")]
    {
        let _ = fs::remove_file(&dest);
    }
    Ok(())
}

pub fn find_release(tag: &str) -> Result<ReleaseInfo, String> {
    let releases = list_releases()?;
    releases
        .into_iter()
        .find(|r| {
            r.tag == tag
                || r.tag == format!("v{tag}")
                || r.tag.trim_start_matches('v') == tag
        })
        .ok_or_else(|| format!("Release {tag} not found"))
}

pub fn install_tag(tag: &str) -> Result<(), String> {
    let rel = find_release(tag)?;
    if !rel.installable || rel.asset_url.is_empty() {
        return Err("No installer for this computer in that release".into());
    }
    download_and_apply(&rel.asset_url, &rel.asset_name)
}

pub fn install_latest() -> Result<String, String> {
    let latest = check_latest()?;
    if !latest.outdated {
        return Err("Already on the latest version".into());
    }
    install_tag(&latest.latest_tag)?;
    Ok(latest.latest_tag)
}

#[cfg(target_os = "linux")]
pub fn running_under_systemd() -> bool {
    if std::env::var_os("INVOCATION_ID").is_some() {
        return true;
    }
    Path::new("/run/systemd/system").is_dir()
        && Command::new("systemctl")
            .args(["is-active", "--quiet", "judie.service"])
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
}

/// After a kiosk `.deb` update the helper reboots; do not `exec judie` on the old X session.
#[cfg(target_os = "linux")]
pub fn relaunch_linux() -> Result<(), String> {
    if running_under_systemd() {
        return Ok(());
    }
    let mut relaunch = Command::new("sh");
    relaunch.args(["-c", "sleep 2; exec judie"]);
    spawn_detached(relaunch)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn newer_semver() {
        assert!(is_newer("0.1.1", "0.1.0"));
        assert!(is_newer("v0.1.2", "0.1.1"));
        assert!(!is_newer("0.1.0", "0.1.1"));
        assert!(!is_newer("0.1.1", "0.1.1"));
    }

    #[test]
    fn linux_armhf_deb() {
        assert!(asset_matches_for("Judie_0.1.0_armhf.deb", "linux", "arm"));
        assert!(asset_matches_for("judie_armhf.deb", "linux", "arm"));
        assert!(!asset_matches_for("Judie_0.1.0_arm64.deb", "linux", "arm"));
        assert!(asset_matches_for("Judie_0.1.0_aarch64.deb", "linux", "aarch64"));
        assert!(asset_matches_for("Judie_0.1.6_arm64.deb", "linux", "arm64"));
    }

    #[test]
    fn windows_setup() {
        assert!(asset_matches_for(
            "Judie_0.1.0_x64-setup.exe",
            "windows",
            "x86_64"
        ));
        assert!(!asset_matches_for(
            "Judie_0.1.0_armhf.deb",
            "windows",
            "x86_64"
        ));
    }
}
