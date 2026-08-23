mod host;

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
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::Builder::new().app_name("Judie").build())
        .setup(|app| {
            use tauri_plugin_autostart::ManagerExt;
            let _ = app.autolaunch().enable();

            #[cfg(target_os = "linux")]
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_decorations(false);
                let _ = win.set_fullscreen(true);
                let _ = win.maximize();
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
            conversation_log_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
