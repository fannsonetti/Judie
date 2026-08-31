//! Native Slint kiosk for Raspberry Pi — full home UI, no WebKit.
#![cfg(feature = "pi-native")]

#[path = "../host.rs"]
mod host;
#[path = "../pi_room.rs"]
mod pi_room;
#[path = "../pi_ctl.rs"]
mod pi_ctl;
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

fn overlay_name(o: Overlay) -> (bool, bool, bool, bool) {
    match o {
        Overlay::None => (false, false, false, false),
        Overlay::Settings => (true, false, false, false),
        Overlay::Palette => (false, true, false, false),
        Overlay::Gallery => (false, false, true, false),
        Overlay::Creator => (false, false, false, true),
    }
}

fn slop_ui(widget_id: &str, n: &pi_room::SlopNode) -> SlopNode {
    let (r, g, b) = pi_room::Room::node_rgb(n);
    SlopNode {
        widget_id: widget_id.into(),
        id: n.id.clone().into(),
        kind: n.kind.clone().into(),
        x: n.x,
        y: n.y,
        w: n.w,
        h: n.h,
        text: n.text.clone().into(),
        r,
        g,
        b,
        value: n.value,
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
    ui.set_date_text(now.format("%A %e %B").to_string().split_whitespace().collect::<Vec<_>>().join(" ").into());
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
        ui.set_page_count(room.visible_page_count());
        ui.set_assistant_url(room.assistant_url.clone().into());
        ui.set_latitude(room.latitude.clone().into());
        ui.set_longitude(room.longitude.clone().into());
        ui.set_notice_timers(room.notice_timers);
        ui.set_notice_calendar(room.notice_calendar);
        ui.set_notice_weather(room.notice_weather);
        ui.set_notice_air(room.notice_air);
        ui.set_notice_devices(room.notice_devices);
        ui.set_gallery_query(room.gallery_query.clone().into());
        ui.set_gallery_custom(room.gallery_kind == "custom");
        ui.set_gallery_custom_id(room.gallery_custom_id.clone().into());
        ui.set_pending_remove(room.pending_remove.clone().into());
        ui.set_pending_label(
            room.slots
                .iter()
                .find(|s| s.id == room.pending_remove)
                .map(|s| {
                    if s.kind == "custom" {
                        s.label.clone()
                    } else {
                        s.kind.clone()
                    }
                })
                .unwrap_or_default()
                .into(),
        );
        ui.set_expanded(expanded_name(room.expanded));
        let (settings, palette, gallery, creator) = overlay_name(room.overlay);
        ui.set_settings_open(settings);
        ui.set_palette_open(palette);
        ui.set_gallery_open(gallery);
        ui.set_creator_open(creator);
        ui.set_gallery_kind(room.gallery_kind.clone().into());
        ui.set_gallery_size(room.gallery_size.clone().into());
        ui.set_creator_name(room.creator_name.clone().into());
        ui.set_creator_template(room.creator_template.clone().into());
        ui.set_creator_size(room.creator_size.clone().into());
        ui.set_creator_selected(room.creator_selected.clone().into());
        ui.set_creator_node_text(room.selected_creator_text().into());
        let desc = if room.gallery_kind == "custom" {
            "A widget from Widget Creator."
        } else {
            pi_room::gallery_kinds()
                .iter()
                .find(|(k, _, _)| *k == room.gallery_kind)
                .map(|(_, _, d)| *d)
                .unwrap_or("")
        };
        ui.set_gallery_desc(desc.into());

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
                name: l.name.replace(" LEDs", "").replace(" Light", "").into(),
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
                time: a.time.clone().into(),
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
            ServiceRow { name: "Core".into(), status: "124 ms".into(), online: true },
            ServiceRow { name: "Lights".into(), status: "6 ms".into(), online: true },
            ServiceRow { name: "Media".into(), status: "9 ms".into(), online: true },
            ServiceRow { name: "Weather".into(), status: "1 ms".into(), online: true },
            ServiceRow { name: "Assistant".into(), status: "Down".into(), online: false },
        ];
        ui.set_services(ModelRc::new(VecModel::from(services)));

        let slots: Vec<Slot> = room
            .slots
            .iter()
            .map(|s| {
                let (cols, rows) = match s.size.as_str() {
                    "1x2" => (2, 1),
                    "2x2" => (2, 2),
                    _ => (1, 1),
                };
                Slot {
                    id: s.id.clone().into(),
                    kind: s.kind.clone().into(),
                    size: s.size.clone().into(),
                    col: s.col,
                    row: s.row,
                    cols,
                    rows,
                    page: s.page,
                    label: s.label.clone().into(),
                    custom_id: s.custom_id.clone().into(),
                }
            })
            .collect();
        ui.set_slots(ModelRc::new(VecModel::from(slots)));

        let gallery: Vec<GalleryItem> = room
            .filtered_gallery()
            .into_iter()
            .map(|(kind, label, custom, id)| GalleryItem {
                kind: kind.into(),
                label: label.into(),
                custom,
                id: id.into(),
            })
            .collect();
        ui.set_gallery_items(ModelRc::new(VecModel::from(gallery)));

        let hits: Vec<PaletteHit> = room
            .palette_hits()
            .into_iter()
            .map(|(id, title, hint)| PaletteHit {
                id: id.into(),
                title: title.into(),
                hint: hint.into(),
            })
            .collect();
        ui.set_palette_hits(ModelRc::new(VecModel::from(hits)));

        let routines: Vec<RoutineRow> = room
            .routines
            .iter()
            .map(|r| RoutineRow {
                id: r.id.clone().into(),
                name: r.name.clone().into(),
                hint: format!(
                    "{}{}",
                    r.phrases.join(", "),
                    if r.builtin { " · built-in" } else { "" }
                )
                .into(),
                builtin: r.builtin,
            })
            .collect();
        ui.set_routines(ModelRc::new(VecModel::from(routines)));

        let slop: Vec<SlopNode> = room
            .home_slop_nodes()
            .iter()
            .map(|(wid, n)| slop_ui(wid, n))
            .collect();
        ui.set_slop_nodes(ModelRc::new(VecModel::from(slop)));

        let creator: Vec<SlopNode> = room
            .creator_nodes
            .iter()
            .map(|n| slop_ui("", n))
            .collect();
        ui.set_creator_nodes(ModelRc::new(VecModel::from(creator)));

        let cells: Vec<CalCell> = room
            .cal_cells
            .iter()
            .map(|c| CalCell {
                label: c.label.clone().into(),
                today: c.today,
            })
            .collect();
        ui.set_cal_cells(ModelRc::new(VecModel::from(cells)));
    });
}

fn apply_kb_field(ui: &MainWindow, field: &str, text: &str) {
    match field {
        "room-name" => {
            pi_room::with(|room| room.room_name = text.to_string());
            ui.set_room_name(text.into());
        }
        "location" => {
            pi_room::with(|room| room.weather_loc = text.to_string());
            ui.set_weather_loc(text.into());
        }
        "latitude" => {
            pi_room::with(|room| room.latitude = text.to_string());
            ui.set_latitude(text.into());
        }
        "longitude" => {
            pi_room::with(|room| room.longitude = text.to_string());
            ui.set_longitude(text.into());
        }
        "assistant-url" => {
            pi_room::with(|room| room.assistant_url = text.to_string());
            ui.set_assistant_url(text.into());
        }
        "palette" => {
            pi_room::with(|room| room.palette_query = text.to_string());
            ui.set_palette_query(text.into());
        }
        "wifi-pass" => ui.set_wifi_pass(text.into()),
        _ => {}
    }
}

fn kb_seed(ui: &MainWindow, field: &str) -> String {
    match field {
        "room-name" => ui.get_room_name().to_string(),
        "location" => ui.get_weather_loc().to_string(),
        "latitude" => ui.get_latitude().to_string(),
        "longitude" => ui.get_longitude().to_string(),
        "assistant-url" => ui.get_assistant_url().to_string(),
        "palette" => ui.get_palette_query().to_string(),
        "wifi-pass" => ui.get_wifi_pass().to_string(),
        _ => String::new(),
    }
}

fn load_wifi_status(ui: &MainWindow) {
    let st = pi_ctl::wifi_status();
    ui.set_wifi_ssid(st.ssid.into());
    ui.set_wifi_ip(st.ip.into());
    ui.set_wifi_state(st.state.into());
}

fn load_releases(ui: &MainWindow) {
    ui.set_release_status("Checking GitHub…".into());
    let weak = ui.as_weak();
    std::thread::spawn(move || {
        let rows = pi_ctl::version_rows();
        let latest = releases::check_latest().ok();
        let _ = slint::invoke_from_event_loop(move || {
            let Some(ui) = weak.upgrade() else { return };
            match rows {
                Ok(rows) => {
                    let current = rows.iter().find(|r| r.current).map(|r| r.tag.clone());
                    if ui.get_selected_release().is_empty() {
                        if let Some(tag) = current {
                            ui.set_selected_release(tag.into());
                        }
                    }
                    let model: Vec<ReleaseRow> = rows
                        .into_iter()
                        .map(|r| ReleaseRow {
                            tag: r.tag.into(),
                            name: r.name.into(),
                            current: r.current,
                            installable: r.installable,
                        })
                        .collect();
                    ui.set_releases(ModelRc::new(VecModel::from(model)));
                    if let Some(n) = latest {
                        ui.set_update_available(n.outdated);
                        ui.set_update_label(format!("Judie {} is available", n.latest).into());
                        ui.set_release_status(if n.outdated {
                            format!("Update available: {}", n.latest)
                        } else {
                            format!("Up to date ({})", n.current)
                        }.into());
                    } else {
                        ui.set_release_status("Release list loaded.".into());
                    }
                }
                Err(err) => ui.set_release_status(err.into()),
            }
        });
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
    let weak = ui.as_weak();
    ui.on_open_settings(move || {
        pi_room::with(|room| room.overlay = Overlay::Settings);
        r();
        if let Some(ui) = weak.upgrade() {
            load_wifi_status(&ui);
            load_releases(&ui);
        }
    });
    let r = refresh.clone();
    ui.on_open_palette(move || {
        pi_room::with(|room| room.overlay = Overlay::Palette);
        r();
    });
    let r = refresh.clone();
    let weak = ui.as_weak();
    ui.on_close_overlay(move || {
        pi_room::with(|room| room.overlay = Overlay::None);
        if let Some(ui) = weak.upgrade() {
            ui.set_kb_open(false);
        }
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
        pi_room::with(|room| {
            let max = (room.visible_page_count() - 1).max(0);
            room.page = p.clamp(0, max);
        });
        r();
    });
    let r = refresh.clone();
    ui.on_expand(move |kind| {
        pi_room::with(|room| {
            if room.edit_mode {
                return;
            }
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
            room.pending_remove.clear();
            room.overlay = Overlay::None;
            let max = (room.visible_page_count() - 1).max(0);
            if room.page > max {
                room.page = max;
            }
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
    let r = refresh.clone();
    ui.on_request_remove(move |id| {
        pi_room::with(|room| room.request_remove(id.as_str()));
        r();
    });
    let r = refresh.clone();
    ui.on_confirm_remove(move || {
        pi_room::with(|room| room.confirm_remove());
        r();
    });
    let r = refresh.clone();
    ui.on_cancel_remove(move || {
        pi_room::with(|room| room.cancel_remove());
        r();
    });
    let r = refresh.clone();
    ui.on_cycle_slot(move |id| {
        pi_room::with(|room| room.cycle_slot_size(id.as_str()));
        r();
    });
    let r = refresh.clone();
    ui.on_place_slot(move |id, col, row| {
        pi_room::with(|room| room.place_slot(id.as_str(), col, row));
        r();
    });
    let r = refresh.clone();
    ui.on_gallery_pick(move |kind| {
        pi_room::with(|room| {
            room.gallery_kind = kind.to_string();
            room.gallery_custom_id.clear();
            room.gallery_size = pi_room::supported_sizes(kind.as_str())
                .first()
                .copied()
                .unwrap_or("1x1")
                .into();
        });
        r();
    });
    let r = refresh.clone();
    ui.on_gallery_pick_custom(move |id| {
        pi_room::with(|room| {
            room.gallery_kind = "custom".into();
            room.gallery_custom_id = id.to_string();
            room.gallery_size = "1x1".into();
        });
        r();
    });
    let r = refresh.clone();
    ui.on_gallery_add(move || {
        pi_room::with(|room| {
            let _ = room.gallery_add_selected();
        });
        r();
    });
    let r = refresh.clone();
    ui.on_gallery_search(move |t| {
        pi_room::with(|room| room.gallery_query = t.to_string());
        r();
    });
    let r = refresh.clone();
    ui.on_gallery_import(move || {
        pi_room::with(|room| room.import_json_files());
        r();
    });
    let r = refresh.clone();
    ui.on_gallery_size_next(move || {
        pi_room::with(|room| room.cycle_gallery_size(1));
        r();
    });
    let r = refresh.clone();
    ui.on_gallery_size_prev(move || {
        pi_room::with(|room| room.cycle_gallery_size(-1));
        r();
    });
    let r = refresh.clone();
    ui.on_open_creator(move || {
        pi_room::with(|room| {
            room.overlay = Overlay::Creator;
            room.apply_template();
        });
        r();
    });
    let r = refresh.clone();
    ui.on_close_creator(move || {
        pi_room::with(|room| {
            room.overlay = if room.edit_mode {
                Overlay::Gallery
            } else {
                Overlay::None
            };
        });
        r();
    });
    let r = refresh.clone();
    ui.on_save_creator(move || {
        pi_room::with(|room| {
            let _ = room.save_creator();
        });
        r();
    });
    ui.on_creator_name_changed(move |t| {
        pi_room::with(|room| room.creator_name = t.to_string());
    });
    let r = refresh.clone();
    ui.on_set_creator_size(move |s| {
        pi_room::with(|room| {
            room.creator_size = s.to_string();
            room.apply_template();
        });
        r();
    });
    let r = refresh.clone();
    ui.on_set_creator_template(move |s| {
        pi_room::with(|room| {
            room.creator_template = s.to_string();
            room.apply_template();
        });
        r();
    });
    let r = refresh.clone();
    ui.on_add_creator_kind(move |k| {
        pi_room::with(|room| room.add_creator_kind(k.as_str()));
        r();
    });
    let r = refresh.clone();
    ui.on_select_creator_node(move |id| {
        pi_room::with(|room| room.select_creator_node(id.as_str()));
        r();
    });
    let r = refresh.clone();
    ui.on_creator_node_text_changed(move |t| {
        pi_room::with(|room| room.set_creator_node_text(t.as_str()));
        r();
    });
    let r = refresh.clone();
    ui.on_delete_creator_node(move || {
        pi_room::with(|room| room.delete_creator_node());
        r();
    });
    let r = refresh.clone();
    ui.on_palette_text(move |t| {
        pi_room::with(|room| room.palette_query = t.to_string());
        r();
    });
    let r = refresh.clone();
    ui.on_submit_palette(move || {
        pi_room::with(|room| {
            let q = room.palette_query.clone();
            room.palette_reply = room.run_command(&q);
        });
        r();
    });
    let r = refresh.clone();
    ui.on_run_palette_hit(move |id| {
        pi_room::with(|room| room.run_palette_hit(id.as_str()));
        r();
    });
    let r = refresh.clone();
    ui.on_set_purifier_mode(move |m| {
        pi_room::with(|room| room.set_purifier_mode(m.as_str()));
        r();
    });
    let r = refresh.clone();
    ui.on_toggle_notice(move |key| {
        pi_room::with(|room| match key.as_str() {
            "timers" => room.notice_timers = !room.notice_timers,
            "calendar" => room.notice_calendar = !room.notice_calendar,
            "weather" => room.notice_weather = !room.notice_weather,
            "air" => room.notice_air = !room.notice_air,
            "devices" => room.notice_devices = !room.notice_devices,
            _ => {}
        });
        r();
    });
    ui.on_set_room_name(move |t| {
        pi_room::with(|room| room.room_name = t.to_string());
    });
    ui.on_set_location(move |t| {
        pi_room::with(|room| room.weather_loc = t.to_string());
    });
    ui.on_set_latitude(move |t| {
        pi_room::with(|room| room.latitude = t.to_string());
    });
    ui.on_set_longitude(move |t| {
        pi_room::with(|room| room.longitude = t.to_string());
    });
    ui.on_set_assistant_url(move |t| {
        pi_room::with(|room| room.assistant_url = t.to_string());
    });
    let r = refresh.clone();
    ui.on_remove_routine(move |id| {
        pi_room::with(|room| room.remove_routine(id.as_str()));
        r();
    });

    let weak = ui.as_weak();
    ui.on_check_updates(move || {
        if let Some(ui) = weak.upgrade() {
            load_releases(&ui);
        }
    });
    let weak = ui.as_weak();
    ui.on_pick_release(move |tag| {
        if let Some(ui) = weak.upgrade() {
            ui.set_selected_release(tag);
        }
    });
    let weak = ui.as_weak();
    ui.on_install_tag(move |tag| {
        let Some(ui) = weak.upgrade() else { return };
        if ui.get_updating() {
            return;
        }
        let tag = tag.to_string();
        if tag.is_empty() {
            ui.set_release_status("Pick a version first.".into());
            return;
        }
        ui.set_updating(true);
        ui.set_release_status(format!("Installing {tag}…").into());
        let weak = ui.as_weak();
        std::thread::spawn(move || {
            let result = releases::install_tag(&tag);
            let _ = slint::invoke_from_event_loop(move || match result {
                Ok(()) => std::process::exit(0),
                Err(err) => {
                    if let Some(ui) = weak.upgrade() {
                        ui.set_updating(false);
                        ui.set_release_status(err.clone().into());
                        ui.set_update_error(err.into());
                    }
                }
            });
        });
    });
    let weak = ui.as_weak();
    ui.on_scan_wifi(move || {
        let Some(ui) = weak.upgrade() else { return };
        ui.set_wifi_busy(true);
        ui.set_wifi_status("Scanning…".into());
        let weak = ui.as_weak();
        std::thread::spawn(move || {
            let result = pi_ctl::wifi_scan();
            let _ = slint::invoke_from_event_loop(move || {
                let Some(ui) = weak.upgrade() else { return };
                ui.set_wifi_busy(false);
                load_wifi_status(&ui);
                match result {
                    Ok(nets) => {
                        let model: Vec<WifiNet> = nets
                            .into_iter()
                            .map(|n| WifiNet {
                                ssid: n.ssid.into(),
                                signal: n.signal.to_string().into(),
                                secured: n.secured,
                            })
                            .collect();
                        ui.set_wifi_status(format!("{} networks", model.len()).into());
                        ui.set_wifi_nets(ModelRc::new(VecModel::from(model)));
                    }
                    Err(err) => ui.set_wifi_status(err.into()),
                }
            });
        });
    });
    let weak = ui.as_weak();
    ui.on_pick_wifi(move |ssid| {
        if let Some(ui) = weak.upgrade() {
            ui.set_wifi_pick(ssid);
            ui.set_wifi_status("Network selected. Type the password if needed, then CONNECT.".into());
        }
    });
    let weak = ui.as_weak();
    ui.on_connect_wifi(move || {
        let Some(ui) = weak.upgrade() else { return };
        let ssid = ui.get_wifi_pick().to_string();
        let pass = ui.get_wifi_pass().to_string();
        ui.set_wifi_busy(true);
        ui.set_wifi_status(format!("Connecting to {ssid}…").into());
        let weak = ui.as_weak();
        std::thread::spawn(move || {
            let result = pi_ctl::wifi_connect(&ssid, &pass);
            let _ = slint::invoke_from_event_loop(move || {
                let Some(ui) = weak.upgrade() else { return };
                ui.set_wifi_busy(false);
                load_wifi_status(&ui);
                ui.set_wifi_status(match result {
                    Ok(()) => "Connected.".into(),
                    Err(err) => err.into(),
                });
            });
        });
    });
    let weak = ui.as_weak();
    ui.on_disconnect_wifi(move || {
        let weak = weak.clone();
        std::thread::spawn(move || {
            let result = pi_ctl::wifi_disconnect();
            let _ = slint::invoke_from_event_loop(move || {
                if let Some(ui) = weak.upgrade() {
                    load_wifi_status(&ui);
                    ui.set_wifi_status(match result {
                        Ok(()) => "Disconnected.".into(),
                        Err(err) => err.into(),
                    });
                }
            });
        });
    });
    ui.on_reboot_now(move || {
        let _ = pi_ctl::power("reboot");
    });
    ui.on_shutdown_now(move || {
        let _ = pi_ctl::power("poweroff");
    });
    let weak = ui.as_weak();
    ui.on_open_keyboard(move |field| {
        let Some(ui) = weak.upgrade() else { return };
        let field_s = field.to_string();
        let seed = kb_seed(&ui, &field_s);
        ui.set_kb_field(field);
        ui.set_kb_text(seed.into());
        ui.set_kb_open(true);
        ui.set_kb_symbols(false);
    });
    let weak = ui.as_weak();
    ui.on_keyboard_key(move |ch| {
        let Some(ui) = weak.upgrade() else { return };
        let mut text = ui.get_kb_text().to_string();
        let mut key = ch.to_string();
        if key.len() == 1 && key.chars().all(|c| c.is_ascii_alphabetic()) && ui.get_kb_shift() {
            key = key.to_uppercase();
            ui.set_kb_shift(false);
        }
        text.push_str(&key);
        ui.set_kb_text(text.clone().into());
        apply_kb_field(&ui, ui.get_kb_field().as_str(), &text);
    });
    let weak = ui.as_weak();
    ui.on_keyboard_back(move || {
        let Some(ui) = weak.upgrade() else { return };
        let mut text = ui.get_kb_text().to_string();
        text.pop();
        ui.set_kb_text(text.clone().into());
        apply_kb_field(&ui, ui.get_kb_field().as_str(), &text);
    });
    let weak = ui.as_weak();
    ui.on_keyboard_submit(move || {
        let Some(ui) = weak.upgrade() else { return };
        apply_kb_field(&ui, ui.get_kb_field().as_str(), ui.get_kb_text().as_str());
        ui.set_kb_open(false);
    });
    let weak = ui.as_weak();
    ui.on_keyboard_close(move || {
        if let Some(ui) = weak.upgrade() {
            ui.set_kb_open(false);
        }
    });
    let weak = ui.as_weak();
    ui.on_kb_toggle_shift(move || {
        if let Some(ui) = weak.upgrade() {
            ui.set_kb_shift(!ui.get_kb_shift());
        }
    });
    let weak = ui.as_weak();
    ui.on_kb_toggle_symbols(move || {
        if let Some(ui) = weak.upgrade() {
            ui.set_kb_symbols(!ui.get_kb_symbols());
        }
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
                    // apply-update reboots; this process dies with the old session.
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
