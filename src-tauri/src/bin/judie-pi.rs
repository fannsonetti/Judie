//! Native Slint kiosk for Raspberry Pi — full home UI, no WebKit.
#![cfg(feature = "pi-native")]

#[path = "../host.rs"]
mod host;
#[path = "../pi_room.rs"]
mod pi_room;
#[path = "../releases.rs"]
mod releases;

slint::include_modules!();

use pi_room::{Expanded, Overlay};
use slint::{ModelRc, SharedString, TimerMode, VecModel};
use std::time::Duration;

/// Bare Xorg has no WM, so `set_fullscreen` (EWMH) is a no-op. Size the window
/// to the framebuffer so Judie fills HDMI without matchbox/openbox.
fn framebuffer_size() -> Option<slint::PhysicalSize> {
    let raw = std::fs::read_to_string("/sys/class/graphics/fb0/virtual_size").ok()?;
    let mut parts = raw.trim().split(',');
    let w: u32 = parts.next()?.parse().ok()?;
    let h: u32 = parts.next()?.parse().ok()?;
    (w >= 320 && h >= 240).then_some(slint::PhysicalSize::new(w, h))
}

fn apply_kiosk_geometry(ui: &MainWindow) {
    if let Some(size) = framebuffer_size() {
        ui.window().set_size(size);
    }
    ui.window().set_fullscreen(true);
}

fn ensure_display() {
    let has_display = std::env::var_os("DISPLAY").is_some()
        || std::env::var_os("WAYLAND_DISPLAY").is_some()
        || std::env::var_os("WAYLAND_SOCKET").is_some();
    if has_display {
        return;
    }
    if std::path::Path::new("/tmp/.X11-unix/X0").exists() {
        unsafe {
            std::env::set_var("DISPLAY", ":0");
        }
        return;
    }
    let uid = std::fs::read_to_string("/proc/self/status")
        .ok()
        .and_then(|s| {
            s.lines()
                .find(|l| l.starts_with("Uid:"))
                .and_then(|l| l.split_whitespace().nth(1)?.parse().ok())
        })
        .unwrap_or(1000u32);
    for sock in ["wayland-0", "wayland-1"] {
        let path = format!("/run/user/{uid}/{sock}");
        if std::path::Path::new(&path).exists() {
            unsafe {
                std::env::set_var("WAYLAND_DISPLAY", sock);
                if std::env::var_os("XDG_RUNTIME_DIR").is_none() {
                    std::env::set_var("XDG_RUNTIME_DIR", format!("/run/user/{uid}"));
                }
            }
            return;
        }
    }
    eprintln!(
        "Judie needs a graphical session (DISPLAY or WAYLAND_DISPLAY).\n\
         systemd kiosk:   journalctl -u judie -b\n\
         Debug from SSH:  sudo systemctl stop judie && DISPLAY=:0 judie\n\
         Manual start:    startx /usr/bin/judie -- :0 vt1 -nolisten tcp -nocursor"
    );
    std::process::exit(1);
}

fn overlay_name(o: Overlay) -> (&'static str, bool, bool, bool) {
    match o {
        Overlay::None => ("", false, false, false),
        Overlay::Settings => ("settings", true, false, false),
        Overlay::Palette => ("palette", false, true, false),
        Overlay::Gallery => ("gallery", false, false, true),
    }
}

fn expanded_name(e: Expanded) -> SharedString {
    SharedString::from(match e {
        Expanded::None => "",
        Expanded::Weather => "weather",
        Expanded::Lights => "lights",
        Expanded::Media => "media",
        Expanded::Calendar => "calendar",
        Expanded::Purifier => "purifier",
    })
}

fn push_ui(ui: &MainWindow) {
    let now = chrono::Local::now();
    ui.set_clock(now.format("%H:%M").to_string().into());
    ui.set_date_text(now.format("%a %d %b").to_string().into());
    ui.set_month_name(now.format("%B").to_string().into());
    ui.set_version_text(env!("CARGO_PKG_VERSION").into());

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
            .map(|t| format!("SoC {t:.0}°C"))
            .unwrap_or_else(|| "SoC —".into())
            .into(),
    );

    pi_room::with(|room| {
        ui.set_dnd(room.dnd);
        ui.set_page(room.page);
        ui.set_weather_loc(room.weather_loc.clone().into());
        ui.set_weather_temp(format!("{}°", room.weather_temp).into());
        ui.set_weather_cond(room.weather_cond.clone().into());
        ui.set_weather_range(format!("L{}° · H{}°", room.weather_low, room.weather_high).into());
        ui.set_weather_feel(room.weather_feel.clone().into());
        ui.set_weather_note(room.weather_note.clone().into());
        ui.set_master_on(room.master_on());
        ui.set_brightness(i32::from(room.master_brightness()));
        ui.set_scene(room.scene.clone().into());
        ui.set_master_color(room.master_color().into());
        ui.set_playing(room.playing);
        let track = room.current_track();
        ui.set_track_title(track.title.clone().into());
        ui.set_track_artist(track.artist.clone().into());
        ui.set_volume(i32::from(room.volume));
        ui.set_media_progress(room.progress);
        ui.set_indoor(format!("{:.1}°", room.indoor).into());
        ui.set_outdoor(format!("{}°", room.outdoor).into());
        ui.set_humidity(format!("{}%", room.humidity).into());
        ui.set_comfort(room.comfort().into());
        ui.set_purifier_on(room.purifier_on);
        ui.set_purifier_mode(room.purifier_mode.clone().into());
        ui.set_purifier_aq(room.purifier_aq.clone().into());
        ui.set_purifier_filter(i32::from(room.purifier_filter));
        ui.set_room_name(room.room_name.clone().into());
        ui.set_voice_enabled(room.voice);
        ui.set_speak_replies(room.speak);
        ui.set_units_metric(room.units_metric);
        ui.set_settings_tab(room.settings_tab);
        ui.set_palette_query(room.palette_query.clone().into());
        ui.set_palette_reply(room.palette_reply.clone().into());
        ui.set_edit_mode(room.edit_mode);
        ui.set_expanded(expanded_name(room.expanded));
        let (_, settings, palette, gallery) = overlay_name(room.overlay);
        ui.set_settings_open(settings);
        ui.set_palette_open(palette);
        ui.set_gallery_open(gallery);

        let hours: Vec<HourRow> = room
            .hours
            .iter()
            .map(|h| HourRow {
                hour: h.hour.clone().into(),
                temp: format!("{}°", h.temp).into(),
                precip: format!("{}%", h.precip).into(),
            })
            .collect();
        ui.set_hours(ModelRc::new(VecModel::from(hours)));

        let lights: Vec<LightRow> = room
            .lights
            .iter()
            .map(|l| LightRow {
                id: l.id.clone().into(),
                name: l.name.clone().into(),
                on: l.on,
                brightness: format!("{}%", l.brightness).into(),
            })
            .collect();
        ui.set_lights(ModelRc::new(VecModel::from(lights)));

        let events: Vec<EventRow> = room
            .events
            .iter()
            .filter(|e| e.day_offset == 0)
            .take(4)
            .map(|e| EventRow {
                time: e.time.clone().into(),
                title: e.title.clone().into(),
                detail: e.detail.clone().into(),
            })
            .collect();
        ui.set_events(ModelRc::new(VecModel::from(events)));

        let activity: Vec<ActivityRow> = room
            .activity
            .iter()
            .map(|a| ActivityRow {
                title: a.title.clone().into(),
                source: a.source.clone().into(),
            })
            .collect();
        ui.set_activity(ModelRc::new(VecModel::from(activity)));

        let timers: Vec<TimerRow> = room
            .timers
            .iter()
            .map(|t| TimerRow {
                label: t.label.clone().into(),
                remain: t.remain.clone().into(),
            })
            .collect();
        ui.set_timers(ModelRc::new(VecModel::from(timers)));

        let services = vec![
            ServiceRow {
                name: "Core".into(),
                status: "online".into(),
                online: true,
            },
            ServiceRow {
                name: "Assistant".into(),
                status: "local".into(),
                online: true,
            },
            ServiceRow {
                name: "Weather".into(),
                status: "Open-Meteo".into(),
                online: true,
            },
        ];
        ui.set_services(ModelRc::new(VecModel::from(services)));
    });
}

fn bind(ui: &MainWindow) {
    let weak = ui.as_weak();
    let refresh = move || {
        if let Some(ui) = weak.upgrade() {
            push_ui(&ui);
        }
    };

    let r = refresh.clone();
    ui.on_toggle_master(move || {
        pi_room::with(|room| room.set_master_power(!room.master_on()));
        r();
    });
    let r = refresh.clone();
    ui.on_brightness_changed(move |v| {
        pi_room::with(|room| room.set_master_brightness(v.clamp(0, 100) as u8));
        r();
    });
    let r = refresh.clone();
    ui.on_set_color(move |c| {
        pi_room::with(|room| room.set_master_color(c.as_str()));
        r();
    });
    let r = refresh.clone();
    ui.on_set_scene(move |s| {
        pi_room::with(|room| room.set_scene(s.as_str()));
        r();
    });
    let r = refresh.clone();
    ui.on_toggle_light(move |id| {
        pi_room::with(|room| room.toggle_light(id.as_str()));
        r();
    });
    let r = refresh.clone();
    ui.on_toggle_play(move || {
        pi_room::with(|room| room.toggle_play());
        r();
    });
    let r = refresh.clone();
    ui.on_next_track(move || {
        pi_room::with(|room| room.next_track());
        r();
    });
    let r = refresh.clone();
    ui.on_prev_track(move || {
        pi_room::with(|room| room.prev_track());
        r();
    });
    let r = refresh.clone();
    ui.on_volume_changed(move |v| {
        pi_room::with(|room| room.volume = v.clamp(0, 100) as u8);
        r();
    });
    let r = refresh.clone();
    ui.on_quick(move |a| {
        pi_room::with(|room| room.quick(a.as_str()));
        r();
    });
    let r = refresh.clone();
    ui.on_toggle_purifier(move || {
        pi_room::with(|room| room.toggle_purifier());
        r();
    });
    let r = refresh.clone();
    ui.on_cycle_purifier(move || {
        pi_room::with(|room| room.cycle_purifier_mode());
        r();
    });
    let r = refresh.clone();
    ui.on_open_settings(move || {
        pi_room::with(|room| room.overlay = Overlay::Settings);
        r();
    });
    let r = refresh.clone();
    ui.on_open_palette(move || {
        pi_room::with(|room| room.overlay = Overlay::Palette);
        r();
    });
    let r = refresh.clone();
    ui.on_close_overlay(move || {
        pi_room::with(|room| room.overlay = Overlay::None);
        r();
    });
    let r = refresh.clone();
    ui.on_set_tab(move |t| {
        pi_room::with(|room| room.settings_tab = t);
        r();
    });
    let r = refresh.clone();
    ui.on_toggle_voice(move || {
        pi_room::with(|room| room.voice = !room.voice);
        r();
    });
    let r = refresh.clone();
    ui.on_toggle_speak(move || {
        pi_room::with(|room| room.speak = !room.speak);
        r();
    });
    let r = refresh.clone();
    ui.on_toggle_units(move || {
        pi_room::with(|room| room.units_metric = !room.units_metric);
        r();
    });
    let r = refresh.clone();
    ui.on_set_page(move |p| {
        pi_room::with(|room| room.page = p.clamp(0, 1));
        r();
    });
    let r = refresh.clone();
    ui.on_expand(move |kind| {
        pi_room::with(|room| {
            room.expanded = match kind.as_str() {
                "weather" => Expanded::Weather,
                "lights" => Expanded::Lights,
                "media" => Expanded::Media,
                "calendar" => Expanded::Calendar,
                "purifier" => Expanded::Purifier,
                _ => Expanded::None,
            };
        });
        r();
    });
    let r = refresh.clone();
    ui.on_collapse(move || {
        pi_room::with(|room| room.expanded = Expanded::None);
        r();
    });
    let r = refresh.clone();
    ui.on_enter_edit(move || {
        pi_room::with(|room| room.edit_mode = true);
        r();
    });
    let r = refresh.clone();
    ui.on_exit_edit(move || {
        pi_room::with(|room| {
            room.edit_mode = false;
            room.overlay = Overlay::None;
        });
        r();
    });
    let r = refresh.clone();
    ui.on_open_gallery(move || {
        pi_room::with(|room| room.overlay = Overlay::Gallery);
        r();
    });
    let r = refresh.clone();
    ui.on_close_gallery(move || {
        pi_room::with(|room| room.overlay = Overlay::None);
        r();
    });
    let r = refresh.clone();
    ui.on_hold_home(move || {
        pi_room::with(|room| room.edit_mode = true);
        r();
    });
    ui.on_palette_text(move |t| {
        pi_room::with(|room| room.palette_query = t.to_string());
    });
    let r = refresh.clone();
    ui.on_submit_palette(move || {
        pi_room::with(|room| {
            let q = room.palette_query.clone();
            room.palette_reply = room.run_command(&q);
        });
        r();
    });
}

fn poll_latest(ui: slint::Weak<MainWindow>) {
    std::thread::spawn(move || {
        let notice = releases::check_latest().ok();
        let _ = slint::invoke_from_event_loop(move || {
            if let (Some(ui), Some(notice)) = (ui.upgrade(), notice) {
                if notice.outdated {
                    ui.set_update_available(true);
                    ui.set_update_label(format!("Judie {} is available", notice.latest).into());
                    ui.set_update_error("".into());
                }
            }
        });
    });
}

fn main() {
    ensure_display();
    host::warm();
    pi_room::with(|_| {});

    let ui = match MainWindow::new() {
        Ok(ui) => ui,
        Err(err) => {
            eprintln!(
                "Could not open Judie window: {err}\n\
                 systemd kiosk:   journalctl -u judie -b\n\
                 Debug from SSH:  sudo systemctl stop judie && DISPLAY=:0 judie"
            );
            std::process::exit(1);
        }
    };
    apply_kiosk_geometry(&ui);
    bind(&ui);
    push_ui(&ui);
    poll_latest(ui.as_weak());

    let weak = ui.as_weak();
    slint::Timer::default().start(TimerMode::Repeated, Duration::from_secs(1), move || {
        if let Some(ui) = weak.upgrade() {
            pi_room::with(|room| room.tick_media());
            push_ui(&ui);
        }
    });

    let weak = ui.as_weak();
    slint::Timer::default().start(TimerMode::SingleShot, Duration::from_secs(45), move || {
        poll_latest(weak.clone());
    });

    let weak = ui.as_weak();
    ui.on_dismiss_update(move || {
        if let Some(ui) = weak.upgrade() {
            ui.set_update_available(false);
        }
    });

    let weak = ui.as_weak();
    ui.on_update_now(move || {
        let Some(ui) = weak.upgrade() else { return };
        if ui.get_updating() {
            return;
        }
        ui.set_updating(true);
        ui.set_update_error("".into());
        let weak = ui.as_weak();
        std::thread::spawn(move || {
            let result = releases::install_latest();
            let _ = slint::invoke_from_event_loop(move || match result {
                Ok(_) => {
                    std::process::exit(0);
                }
                Err(err) => {
                    if let Some(ui) = weak.upgrade() {
                        ui.set_updating(false);
                        ui.set_update_error(err.into());
                    }
                }
            });
        });
    });

    ui.run().expect("run");
}
