use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
#[cfg(target_os = "linux")]
use std::process::Stdio;
use std::time::Duration;

const GH_REPO: &str = "fannsonetti/Judie";
const UA: &str = "Judie";
const API_TIMEOUT_SECS: u64 = 15;
const DOWNLOAD_TIMEOUT_SECS: u64 = 300;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum InstallStage {
    Downloading,
    Validating,
    Installing,
    Verifying,
    Rebooting,
}

impl InstallStage {
    pub fn label(self) -> &'static str {
        match self {
            Self::Downloading => "Downloading",
            Self::Validating => "Validating",
            Self::Installing => "Installing",
            Self::Verifying => "Verifying",
            Self::Rebooting => "Rebooting",
        }
    }
}

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

#[derive(Deserialize, Clone)]
struct GhRelease {
    tag_name: String,
    name: Option<String>,
    draft: bool,
    prerelease: bool,
    published_at: Option<String>,
    assets: Vec<GhAsset>,
}

#[derive(Deserialize, Clone)]
struct GhAsset {
    name: String,
    browser_download_url: String,
}

pub fn current_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

pub fn normalize_version(raw: &str) -> String {
    raw.trim().trim_start_matches('v').trim().to_string()
}

pub fn same_version(a: &str, b: &str) -> bool {
    let a = normalize_version(a);
    let b = normalize_version(b);
    !a.is_empty() && a == b
}

pub fn parse_version(raw: &str) -> Option<(u64, u64, u64)> {
    let s = normalize_version(raw);
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

pub fn change_kind(target: &str, current: &str) -> &'static str {
    if same_version(target, current) {
        "same"
    } else if is_newer(target, current) {
        "upgrade"
    } else {
        "downgrade"
    }
}

pub fn confirm_body(current: &str, target: &str) -> String {
    let kind = change_kind(target, current);
    let article = if kind == "upgrade" { "an" } else { "a" };
    format!(
        "Current version: {current}\nTarget version: {target}\nThis is {article} {kind}.\n\nThe panel stays on screen while the package is installed. It reboots after the new version is verified. Settings, widgets, and routines stay on this panel."
    )
}

pub fn asset_matches_for(name: &str, os: &str, arch: &str) -> bool {
    let n = name.to_ascii_lowercase();
    if os != "linux" || !n.ends_with(".deb") {
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
        _ => false,
    }
}

fn host_os() -> &'static str {
    if cfg!(target_os = "linux") {
        "linux"
    } else {
        "unsupported"
    }
}

fn compile_arch() -> &'static str {
    match std::env::consts::ARCH {
        "x86_64" => "x86_64",
        "aarch64" => "aarch64",
        "arm" => "arm",
        other => other,
    }
}

fn dpkg_architecture() -> Option<String> {
    let out = Command::new("dpkg")
        .args(["--print-architecture"])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let arch = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if arch.is_empty() {
        None
    } else {
        Some(arch)
    }
}

fn host_arch() -> String {
    dpkg_architecture().unwrap_or_else(|| compile_arch().to_string())
}

fn pick_asset<'a>(assets: &'a [GhAsset], os: &str, arch: &str) -> Option<&'a GhAsset> {
    let matches: Vec<&'a GhAsset> = assets
        .iter()
        .filter(|a| asset_matches_for(&a.name, os, arch))
        .collect();
    matches
        .iter()
        .copied()
        .find(|a| {
            let n = a.name.to_ascii_lowercase();
            n != "judie_armhf.deb"
                && n != "judie_arm64.deb"
                && n.starts_with("judie_")
                && n.ends_with(".deb")
        })
        .or_else(|| matches.first().copied())
}

fn api_agent() -> ureq::Agent {
    ureq::builder()
        .timeout(Duration::from_secs(API_TIMEOUT_SECS))
        .build()
}

fn download_agent() -> ureq::Agent {
    ureq::builder()
        .timeout(Duration::from_secs(DOWNLOAD_TIMEOUT_SECS))
        .build()
}

fn get_json(url: &str) -> Result<String, String> {
    api_agent()
        .get(url)
        .set("User-Agent", UA)
        .set("Accept", "application/vnd.github+json")
        .call()
        .map_err(|e| format!("Could not load releases: {e}"))?
        .into_string()
        .map_err(|e| e.to_string())
}

fn to_info(rel: GhRelease, current: &str, os: &str, arch: &str) -> ReleaseInfo {
    let asset = pick_asset(&rel.assets, os, arch);
    let tag = rel.tag_name.clone();
    ReleaseInfo {
        current: same_version(&tag, current),
        name: rel
            .name
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| rel.tag_name.clone()),
        published_at: rel.published_at.unwrap_or_default(),
        installable: asset.is_some() && !rel.draft && !rel.prerelease,
        asset_name: asset.map(|a| a.name.clone()).unwrap_or_default(),
        asset_url: asset
            .map(|a| a.browser_download_url.clone())
            .unwrap_or_default(),
        tag,
    }
}

fn select_compatible(parsed: Vec<GhRelease>, current: &str, os: &str, arch: &str) -> Vec<ReleaseInfo> {
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    for rel in parsed {
        if rel.draft || rel.prerelease {
            continue;
        }
        if pick_asset(&rel.assets, os, arch).is_none() {
            continue;
        }
        let key = normalize_version(&rel.tag_name);
        if key.is_empty() || !seen.insert(key) {
            continue;
        }
        out.push(to_info(rel, current, os, arch));
    }
    out
}

pub fn installed_package_version() -> Option<String> {
    let out = Command::new("dpkg-query")
        .args(["-W", "-f", "${Version}", "judie"])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let v = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if v.is_empty() {
        None
    } else {
        Some(v)
    }
}

/// Displayed version: installed package when present, otherwise the built crate version.
pub fn display_version() -> String {
    installed_package_version().unwrap_or_else(|| current_version().to_string())
}

pub fn list_releases() -> Result<Vec<ReleaseInfo>, String> {
    let url = format!("https://api.github.com/repos/{GH_REPO}/releases");
    let body = get_json(&url)?;
    let parsed: Vec<GhRelease> =
        serde_json::from_str(&body).map_err(|e| format!("Bad GitHub response: {e}"))?;
    let current = display_version();
    Ok(select_compatible(parsed, &current, host_os(), &host_arch()))
}

pub fn check_latest() -> Result<LatestUpdate, String> {
    let current = display_version();
    let list = list_releases()?;
    let Some(info) = list.into_iter().next() else {
        return Err("No compatible Judie package on GitHub for this computer".into());
    };
    let latest = normalize_version(&info.tag);
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

pub fn is_safe_staging_deb(path: &Path) -> bool {
    let raw = path.to_string_lossy().replace('\\', "/");
    if raw.contains("..") {
        return false;
    }
    if !raw.starts_with("/tmp/judie-update/") || !raw.ends_with(".deb") {
        return false;
    }
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    (name.starts_with("judie_") || name.starts_with("judie-")) && name.ends_with(".deb")
}

pub fn deb_magic_ok(bytes: &[u8]) -> bool {
    bytes.len() >= 7 && bytes.starts_with(b"!<arch>")
}

pub fn validate_deb_bytes(bytes: &[u8]) -> Result<(), String> {
    if bytes.is_empty() {
        return Err("Download was empty".into());
    }
    if bytes.len() < 64 {
        return Err("Download was too small to be a Debian package".into());
    }
    if !deb_magic_ok(bytes) {
        return Err("Not a Debian package".into());
    }
    Ok(())
}

fn read_prefix(path: &Path, n: usize) -> Result<Vec<u8>, String> {
    let mut file = fs::File::open(path).map_err(|e| format!("Could not read download: {e}"))?;
    let mut buf = vec![0u8; n];
    let got = file.read(&mut buf).map_err(|e| e.to_string())?;
    buf.truncate(got);
    Ok(buf)
}

#[cfg(target_os = "linux")]
fn dpkg_deb_field(path: &Path, field: &str) -> Result<String, String> {
    let out = Command::new("dpkg-deb")
        .arg("-f")
        .arg(path)
        .arg(field)
        .output()
        .map_err(|e| format!("Could not inspect package: {e}"))?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(if err.is_empty() {
            "Not a Debian package".into()
        } else {
            err
        });
    }
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

#[cfg(target_os = "linux")]
pub fn validate_judie_deb(path: &Path, expected_version: &str, arch: &str) -> Result<(), String> {
    let meta = fs::metadata(path).map_err(|_| "Download missing".to_string())?;
    if meta.len() == 0 {
        return Err("Download was empty".into());
    }
    let prefix = read_prefix(path, 64)?;
    validate_deb_bytes(&prefix)?;

    let pkg = dpkg_deb_field(path, "Package")?;
    if pkg != "judie" {
        return Err(format!("Package is {pkg}, not judie"));
    }
    let ver = dpkg_deb_field(path, "Version")?;
    if !same_version(&ver, expected_version) {
        return Err(format!("Package version {ver} does not match {expected_version}"));
    }
    let pkg_arch = dpkg_deb_field(path, "Architecture")?;
    let want = if arch == "arm" || arch == "armv7" {
        "armhf"
    } else if arch == "aarch64" {
        "arm64"
    } else if arch == "x86_64" {
        "amd64"
    } else {
        arch
    };
    if pkg_arch != want && pkg_arch != arch {
        return Err(format!(
            "Package architecture {pkg_arch} does not match this Raspberry Pi ({want})"
        ));
    }
    Ok(())
}

fn cleanup_path(path: &Path) {
    let _ = fs::remove_file(path);
}

pub fn download(url: &str, dest: &Path) -> Result<(), String> {
    if let Some(dir) = dest.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let resp = download_agent()
        .get(url)
        .set("User-Agent", UA)
        .call()
        .map_err(|e| format!("Download failed: {e}"))?;
    let mut file = fs::File::create(dest).map_err(|e| e.to_string())?;
    let mut reader = resp.into_reader();
    std::io::copy(&mut reader, &mut file).map_err(|e| {
        cleanup_path(dest);
        format!("Download failed: {e}")
    })?;
    file.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn spawn_detached(mut cmd: Command) -> Result<(), String> {
    cmd.stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    cmd.spawn().map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn apply_linux_deb(deb: &Path, expected_version: &str) -> Result<String, String> {
    if !is_safe_staging_deb(deb) {
        return Err("Refused package path".into());
    }
    let helper = Path::new("/usr/lib/judie/apply-update");
    if !helper.is_file() {
        return Err(
            "This copy cannot update silently yet. Install the latest .deb from a terminal once."
                .into(),
        );
    }
    let out = Command::new("sudo")
        .args(["-n", "/usr/lib/judie/apply-update"])
        .arg(deb)
        .arg(expected_version)
        .output()
        .map_err(|e| format!("Could not start updater: {e}"))?;
    let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
    if !out.status.success() {
        let msg = if stderr.is_empty() { stdout } else { stderr };
        if msg.is_empty() || msg.to_ascii_lowercase().contains("password") {
            return Err(
                "Could not apply the update without a password. Install this Judie build once from a terminal, then later updates stay silent.".into(),
            );
        }
        return Err(msg);
    }
    Ok(stdout)
}

pub fn apply_package(path: &Path, expected_version: &str) -> Result<String, String> {
    #[cfg(target_os = "linux")]
    {
        return apply_linux_deb(path, expected_version);
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = (path, expected_version);
        Err("Install is only available on Raspberry Pi / Linux".into())
    }
}

pub fn package_dest(asset_name: &str) -> PathBuf {
    let name = Path::new(asset_name)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("judie-update.deb");
    #[cfg(target_os = "linux")]
    {
        linux_staging_dir().join(name)
    }
    #[cfg(not(target_os = "linux"))]
    {
        std::env::temp_dir().join(name)
    }
}

#[cfg(target_os = "linux")]
fn verify_installed(expected: &str) -> Result<String, String> {
    let installed = installed_package_version()
        .ok_or_else(|| "Could not read the installed Judie package version".to_string())?;
    if !same_version(&installed, expected) {
        return Err(format!(
            "Installed package is {installed}, expected {expected}"
        ));
    }
    Ok(installed)
}

pub fn install_tag_with_progress(
    tag: &str,
    mut progress: impl FnMut(InstallStage),
) -> Result<String, String> {
    let current = display_version();
    if same_version(tag, &current) {
        return Err("This version is already installed".into());
    }
    let rel = find_release(tag)?;
    if !rel.installable || rel.asset_url.is_empty() {
        return Err("No compatible Judie package for this computer in that release".into());
    }
    let expected = normalize_version(&rel.tag);
    let dest = package_dest(&rel.asset_name);

    progress(InstallStage::Downloading);
    if let Err(err) = download(&rel.asset_url, &dest) {
        cleanup_path(&dest);
        return Err(err);
    }

    progress(InstallStage::Validating);
    #[cfg(target_os = "linux")]
    {
        if let Err(err) = validate_judie_deb(&dest, &expected, &host_arch()) {
            cleanup_path(&dest);
            return Err(err);
        }
    }
    #[cfg(not(target_os = "linux"))]
    {
        if let Ok(prefix) = read_prefix(&dest, 64) {
            if dest.extension().and_then(|e| e.to_str()) == Some("deb") {
                if let Err(err) = validate_deb_bytes(&prefix) {
                    cleanup_path(&dest);
                    return Err(err);
                }
            }
        }
    }

    progress(InstallStage::Installing);
    if let Err(err) = apply_package(&dest, &expected) {
        cleanup_path(&dest);
        return Err(err);
    }

    progress(InstallStage::Verifying);
    #[cfg(target_os = "linux")]
    let verified = match verify_installed(&expected) {
        Ok(v) => v,
        Err(err) => {
            cleanup_path(&dest);
            return Err(err);
        }
    };
    #[cfg(not(target_os = "linux"))]
    let verified = expected.clone();

    cleanup_path(&dest);
    Ok(verified)
}

#[allow(dead_code)]
pub fn download_and_apply(asset_url: &str, asset_name: &str) -> Result<(), String> {
    let dest = package_dest(asset_name);
    download(asset_url, &dest)?;
    apply_package(&dest, "")?;
    cleanup_path(&dest);
    Ok(())
}

pub fn find_release(tag: &str) -> Result<ReleaseInfo, String> {
    let releases = list_releases()?;
    releases
        .into_iter()
        .find(|r| {
            r.tag == tag
                || r.tag == format!("v{tag}")
                || normalize_version(&r.tag) == normalize_version(tag)
        })
        .ok_or_else(|| format!("Release {tag} not found"))
}

pub fn install_tag(tag: &str) -> Result<(), String> {
    install_tag_with_progress(tag, |_| {}).map(|_| ())
}

pub fn install_latest() -> Result<String, String> {
    let latest = check_latest()?;
    if !latest.outdated {
        return Err("Already on the latest version".into());
    }
    install_tag_with_progress(&latest.latest_tag, |_| {})
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

/// After a kiosk `.deb` update the UI reboots; do not `exec judie` on the old X session.
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

    fn gh(tag: &str, draft: bool, pre: bool, assets: &[(&str, &str)]) -> GhRelease {
        GhRelease {
            tag_name: tag.into(),
            name: Some(format!("Judie {tag}")),
            draft,
            prerelease: pre,
            published_at: Some("2026-09-01".into()),
            assets: assets
                .iter()
                .map(|(n, u)| GhAsset {
                    name: (*n).into(),
                    browser_download_url: (*u).into(),
                })
                .collect(),
        }
    }

    #[test]
    fn install_stage_labels() {
        assert_eq!(InstallStage::Downloading.label(), "Downloading");
        assert_eq!(InstallStage::Validating.label(), "Validating");
        assert_eq!(InstallStage::Installing.label(), "Installing");
        assert_eq!(InstallStage::Verifying.label(), "Verifying");
        assert_eq!(InstallStage::Rebooting.label(), "Rebooting");
    }

    #[test]
    fn newer_semver() {
        assert!(is_newer("0.1.1", "0.1.0"));
        assert!(is_newer("v0.1.2", "0.1.1"));
        assert!(!is_newer("0.1.0", "0.1.1"));
        assert!(!is_newer("0.1.1", "0.1.1"));
        assert!(is_newer("0.2.10", "0.2.9"));
        assert!(!is_newer("0.2.9", "0.2.10"));
    }

    #[test]
    fn same_and_kind() {
        assert!(same_version("v0.2.9", "0.2.9"));
        assert!(!same_version("0.2.10", "0.2.9"));
        assert_eq!(change_kind("0.2.10", "0.2.9"), "upgrade");
        assert_eq!(change_kind("v0.2.9", "0.2.10"), "downgrade");
        assert_eq!(change_kind("v0.2.9", "0.2.9"), "same");
        let body = confirm_body("0.2.9", "0.2.10");
        assert!(body.contains("Current version: 0.2.9"));
        assert!(body.contains("Target version: 0.2.10"));
        assert!(body.contains("an upgrade"));
        let down = confirm_body("0.2.10", "0.2.9");
        assert!(down.contains("a downgrade"));
    }

    #[test]
    fn linux_armhf_deb() {
        assert!(asset_matches_for("Judie_0.1.0_armhf.deb", "linux", "arm"));
        assert!(asset_matches_for("judie_armhf.deb", "linux", "arm"));
        assert!(!asset_matches_for("Judie_0.1.0_arm64.deb", "linux", "arm"));
        assert!(asset_matches_for("Judie_0.1.0_aarch64.deb", "linux", "aarch64"));
        assert!(asset_matches_for("Judie_0.1.6_arm64.deb", "linux", "arm64"));
        assert!(!asset_matches_for("Judie_0.2.9_x64-setup.exe", "linux", "arm"));
        assert!(!asset_matches_for("readme.md", "linux", "armhf"));
        assert!(!asset_matches_for("Judie_0.1.0_x64-setup.exe", "windows", "x86_64"));
        assert!(!asset_matches_for("Judie_0.1.0_armhf.deb", "windows", "x86_64"));
    }

    #[test]
    fn filters_drafts_prereleases_incompatible_and_duplicates() {
        let parsed = vec![
            gh(
                "v0.2.10",
                false,
                false,
                &[(
                    "Judie_0.2.10_armhf.deb",
                    "https://example/Judie_0.2.10_armhf.deb",
                )],
            ),
            gh(
                "v0.2.10",
                false,
                false,
                &[("judie_armhf.deb", "https://example/judie_armhf.deb")],
            ),
            gh(
                "v0.2.9-rc1",
                false,
                true,
                &[(
                    "Judie_0.2.9-rc1_armhf.deb",
                    "https://example/rc.deb",
                )],
            ),
            gh(
                "v0.2.8",
                true,
                false,
                &[(
                    "Judie_0.2.8_armhf.deb",
                    "https://example/Judie_0.2.8_armhf.deb",
                )],
            ),
            gh(
                "v0.2.7",
                false,
                false,
                &[(
                    "Judie_0.2.7_amd64.deb",
                    "https://example/Judie_0.2.7_amd64.deb",
                )],
            ),
            gh(
                "v0.2.6",
                false,
                false,
                &[(
                    "Judie_0.2.6_armhf.deb",
                    "https://example/Judie_0.2.6_armhf.deb",
                )],
            ),
        ];
        let rows = select_compatible(parsed, "0.2.9", "linux", "armhf");
        let tags: Vec<_> = rows.iter().map(|r| r.tag.as_str()).collect();
        assert_eq!(tags, vec!["v0.2.10", "v0.2.6"]);
        assert!(rows.iter().all(|r| r.installable));
        assert!(!rows.iter().any(|r| r.current));
    }

    #[test]
    fn current_row_matches_installed_package() {
        let parsed = vec![gh(
            "v0.2.9",
            false,
            false,
            &[("Judie_0.2.9_armhf.deb", "https://example/a.deb")],
        )];
        let rows = select_compatible(parsed, "0.2.9", "linux", "arm");
        assert!(rows[0].current);
        assert!(!is_newer(&rows[0].tag, "0.2.9"));
    }

    #[test]
    fn deb_magic_and_size() {
        assert!(deb_magic_ok(b"!<arch>\nrest"));
        assert!(!deb_magic_ok(b"<html>"));
        assert!(!deb_magic_ok(b""));
        assert!(validate_deb_bytes(&[]).is_err());
        assert!(validate_deb_bytes(&[0u8; 32]).is_err());
        let mut ok = vec![0u8; 80];
        ok[..8].copy_from_slice(b"!<arch>\n");
        assert!(validate_deb_bytes(&ok).is_ok());
        assert!(validate_deb_bytes(b"<html>not a deb file at all.............").is_err());
    }

    #[test]
    fn staging_path_rules() {
        assert!(is_safe_staging_deb(Path::new(
            "/tmp/judie-update/Judie_0.2.10_armhf.deb"
        )));
        assert!(is_safe_staging_deb(Path::new(
            "/tmp/judie-update/judie_armhf.deb"
        )));
        assert!(!is_safe_staging_deb(Path::new("/tmp/Judie_0.2.10_armhf.deb")));
        assert!(!is_safe_staging_deb(Path::new(
            "/tmp/judie-update/../etc/passwd.deb"
        )));
        assert!(!is_safe_staging_deb(Path::new(
            "/tmp/judie-update/evil.sh"
        )));
        assert!(!is_safe_staging_deb(Path::new(
            "/tmp/judie-update/not-judie_armhf.deb"
        )));
    }

    #[test]
    fn already_installed_is_rejected() {
        let err = install_tag_with_progress(&display_version(), |_| {}).unwrap_err();
        assert!(err.to_ascii_lowercase().contains("already"));
    }

    #[test]
    fn missing_compatible_asset_message() {
        let rel = to_info(
            gh("v9.9.9", false, false, &[("Judie_0.0.0_amd64.deb", "https://x")]),
            "0.2.9",
            "linux",
            "armhf",
        );
        assert!(!rel.installable);
        assert!(rel.asset_url.is_empty());
    }
}
