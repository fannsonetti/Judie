use tauri::{Runtime, WebviewWindow};
use webkit2gtk::{HardwareAccelerationPolicy, SettingsExt, WebViewExt};

/// DMA-BUF in WebKitGTK often stalls the compositor on VideoCore while CPU looks idle.
pub fn prepare() {
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }
}

pub fn tune<R: Runtime>(win: &WebviewWindow<R>) {
    let _ = win.with_webview(|platform| {
        let webview = platform.inner();
        if let Some(settings) = webview.settings() {
            settings.set_hardware_acceleration_policy(HardwareAccelerationPolicy::Always);
            settings.set_enable_smooth_scrolling(false);
            settings.set_enable_webgl(false);
            settings.set_enable_page_cache(false);
        }
    });
}
