mod host;
mod install;
#[cfg(target_os = "linux")]
mod linux_webview;

use serde::{Deserialize, Serialize};
use std::fs::{create_dir_all, OpenOptions};
use std::io::Write;
use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::sync::OnceLock;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

static START: OnceLock<Instant> = OnceLock::new();

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SystemStatus {
    server_online: bool,
    latency: u32,
    assistant_online: bool,
    uptime_ms: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LogEntry {
    timestamp: String,
    role: String,
    text: String,
    source: String,
    intent: Option<String>,
}

fn logs_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("logs");
    create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn log_file(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(logs_dir(app)?.join("conversation.log"))
}

#[tauri::command]
fn get_system_status() -> SystemStatus {
    let start = START.get_or_init(Instant::now);
    let t0 = Instant::now();
    let addr: SocketAddr = "127.0.0.1:8742".parse().unwrap();
    let assistant_online = TcpStream::connect_timeout(&addr, Duration::from_millis(120)).is_ok();
    let latency = t0.elapsed().as_millis().max(1) as u32;
    SystemStatus {
        server_online: true,
        latency,
        assistant_online,
        uptime_ms: start.elapsed().as_millis() as u64,
    }
}

#[tauri::command]
fn conversation_log_path(app: AppHandle) -> Result<String, String> {
    log_file(&app).map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
fn append_conversation_log(app: AppHandle, entry: LogEntry) -> Result<String, String> {
    let path = log_file(&app)?;
    let text = entry.text.replace('\r', " ").replace('\n', " ");
    let intent = entry
        .intent
        .clone()
        .filter(|s| !s.is_empty())
        .map(|s| format!("  [{}]", s))
        .unwrap_or_default();
    let line = format!(
        "[{}] {}  {}{}\n",
        entry.timestamp,
        pad_role(&entry.role),
        text,
        intent
    );
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| e.to_string())?;
    file.write_all(line.as_bytes()).map_err(|e| e.to_string())?;

    let jsonl = logs_dir(&app)?.join("conversation.jsonl");
    let mut jf = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&jsonl)
        .map_err(|e| e.to_string())?;
    let payload = serde_json::json!({
        "timestamp": entry.timestamp,
        "role": entry.role,
        "text": entry.text,
        "source": entry.source,
        "intent": entry.intent,
    });
    writeln!(jf, "{}", payload).map_err(|e| e.to_string())?;

    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
fn get_host_stats() -> host::HostStats {
    host::snapshot()
}

#[tauri::command]
fn list_releases() -> Result<Vec<install::ReleaseInfo>, String> {
    install::list_releases()
}

#[tauri::command]
fn install_release(app: AppHandle, tag: String) -> Result<(), String> {
    install::install_release(app, tag)
}

#[tauri::command]
fn uninstall_judie(app: AppHandle) -> Result<(), String> {
    install::uninstall_judie(app)
}

#[tauri::command]
fn get_kiosk(app: AppHandle) -> bool {
    install::kiosk_enabled(&app)
}

#[tauri::command]
fn set_kiosk(app: AppHandle, enabled: bool) -> Result<bool, String> {
    install::set_kiosk(&app, enabled)?;
    install::apply_kiosk(&app);
    Ok(enabled)
}

fn pad_role(role: &str) -> String {
    match role.to_lowercase().as_str() {
        "you" | "user" => "YOU ".to_string(),
        "nova" | "judie" => "JUDIE".to_string(),
        other => format!("{:<4}", other.to_uppercase()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    START.get_or_init(Instant::now);
    #[cfg(target_os = "linux")]
    linux_webview::prepare();

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.unminimize();
                let _ = win.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::Builder::new().app_name("Judie").build())
        .setup(|app| {
            #[cfg(target_os = "linux")]
            {
                use tauri_plugin_autostart::ManagerExt;
                install::repair_linux_autostart();
                let _ = app.autolaunch().disable();
            }
            #[cfg(not(target_os = "linux"))]
            {
                use tauri_plugin_autostart::ManagerExt;
                let _ = app.autolaunch().enable();
            }

            install::apply_kiosk(app.handle());

            #[cfg(target_os = "linux")]
            if let Some(win) = app.get_webview_window("main") {
                linux_webview::tune(&win);
            }

            #[cfg(any(target_os = "macos", windows, target_os = "linux"))]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_system_status,
            get_host_stats,
            append_conversation_log,
            conversation_log_path,
            list_releases,
            install_release,
            uninstall_judie,
            get_kiosk,
            set_kiosk
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
