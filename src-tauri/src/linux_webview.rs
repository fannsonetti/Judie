use tauri::{Runtime, WebviewWindow};
use webkit2gtk::{HardwareAccelerationPolicy, SettingsExt, WebViewExt};

fn is_raspberry_pi() -> bool {
    for path in [
        "/proc/device-tree/model",
        "/sys/firmware/devicetree/base/model",
        "/proc/cpuinfo",
    ] {
        if let Ok(raw) = std::fs::read(path) {
            let text = String::from_utf8_lossy(&raw).to_ascii_lowercase();
            if text.contains("raspberry") {
                return true;
            }
        }
    }
    false
}

/// VideoCore + WebKitGTK DMA-BUF often stalls the compositor: CPU idle, UI crawls.
/// The `judie` process stays tiny because painting lives in WebKitWebProcess.
pub fn prepare() {
    if !is_raspberry_pi() {
        return;
    }
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }
    if std::env::var_os("WEBKIT_DISABLE_COMPOSITING_MODE").is_none() {
        std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
    }
}

pub fn tune<R: Runtime>(win: &WebviewWindow<R>) {
    if !is_raspberry_pi() {
        return;
    }
    let _ = win.with_webview(|platform| {
        let webview = platform.inner();
        if let Some(settings) = webview.settings() {
            // CPU raster is slower per-frame but doesn't freeze waiting on VideoCore.
            settings.set_hardware_acceleration_policy(HardwareAccelerationPolicy::Never);
            settings.set_enable_smooth_scrolling(false);
            settings.set_enable_webgl(false);
            settings.set_enable_page_cache(false);
        }
    });
}
