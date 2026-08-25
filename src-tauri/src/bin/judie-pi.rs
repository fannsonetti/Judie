//! Native Slint kiosk for Raspberry Pi — no WebKit process.
#![cfg(feature = "pi-native")]

#[path = "../host.rs"]
mod host;
#[path = "../releases.rs"]
mod releases;

slint::include_modules!();

use slint::TimerMode;
use std::time::Duration;

fn format_uptime(secs: u64) -> String {
    let days = secs / 86400;
    let hours = (secs % 86400) / 3600;
    let mins = (secs % 3600) / 60;
    if days > 0 {
        format!("{days}d {hours}h")
    } else if hours > 0 {
        format!("{hours}h {mins}m")
    } else {
        format!("{mins}m")
    }
}

fn refresh(ui: &MainWindow) {
    let now = chrono::Local::now();
    ui.set_clock(now.format("%H:%M").to_string().into());
    ui.set_date_text(now.format("%a %d %b").to_string().into());

    let stats = host::snapshot();
    ui.set_cpu(stats.cpu);
    ui.set_memory(stats.memory);
    ui.set_mem_detail(
        format!(
            "{:.1} / {:.1} GB",
            stats.memory_used_mb / 1024.0,
            stats.memory_total_mb / 1024.0
        )
        .into(),
    );
    ui.set_temp_text(
        stats
            .temperature
            .map(|t| format!("{t:.0}°C"))
            .unwrap_or_else(|| "—".into())
            .into(),
    );
    ui.set_load_text(format!("{:.2} {:.2} {:.2}", stats.load1, stats.load5, stats.load15).into());
    ui.set_uptime_text(format_uptime(stats.uptime_sec).into());
}

fn apply_latest_notice(ui: &MainWindow, latest: releases::LatestUpdate) {
    if latest.outdated {
        ui.set_update_available(true);
        ui.set_update_label(format!("Judie {} is available", latest.latest).into());
        ui.set_update_error("".into());
    }
}

fn poll_latest(ui: slint::Weak<MainWindow>) {
    std::thread::spawn(move || {
        let notice = releases::check_latest().ok();
        let _ = slint::invoke_from_event_loop(move || {
            if let (Some(ui), Some(notice)) = (ui.upgrade(), notice) {
                apply_latest_notice(&ui, notice);
            }
        });
    });
}

fn main() {
    host::warm();
    let ui = MainWindow::new().expect("ui");
    ui.window().set_fullscreen(true);
    refresh(&ui);
    poll_latest(ui.as_weak());

    let ui_weak = ui.as_weak();
    slint::Timer::default().start(TimerMode::Repeated, Duration::from_secs(2), move || {
        if let Some(ui) = ui_weak.upgrade() {
            refresh(&ui);
        }
    });

    let ui_weak = ui.as_weak();
    slint::Timer::default().start(TimerMode::SingleShot, Duration::from_secs(45), move || {
        poll_latest(ui_weak.clone());
    });

    let ui_weak = ui.as_weak();
    ui.on_dismiss_update(move || {
        if let Some(ui) = ui_weak.upgrade() {
            ui.set_update_available(false);
        }
    });

    let ui_weak = ui.as_weak();
    ui.on_update_now(move || {
        let Some(ui) = ui_weak.upgrade() else { return };
        if ui.get_updating() {
            return;
        }
        ui.set_updating(true);
        ui.set_update_error("".into());
        let ui_weak = ui.as_weak();
        std::thread::spawn(move || {
            let result = releases::install_latest();
            let _ = slint::invoke_from_event_loop(move || {
                match result {
                    Ok(_) => {
                        #[cfg(target_os = "linux")]
                        let _ = releases::relaunch_linux();
                        std::process::exit(0);
                    }
                    Err(err) => {
                        if let Some(ui) = ui_weak.upgrade() {
                            ui.set_updating(false);
                            ui.set_update_error(err.into());
                        }
                    }
                }
            });
        });
    });

    ui.run().expect("run");
}
