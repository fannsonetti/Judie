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
use slint::{Model, ModelRc, SharedString, TimerMode, VecModel};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// Bare Xorg has no WM, so `set_fullscreen` (EWMH) is a no-op. Size the window
/// to the framebuffer so Judie fills HDMI without matchbox/openbox.
fn framebuffer_size() -> Option<slint::PhysicalSize> {
    let raw = std::fs::read_to_string("/sys/class/graphics/fb0/virtual_size").ok()?;
    let mut parts = raw.trim().split(',');
    let w: u32 = parts.next()?.parse().ok()?;
    let h: u32 = parts.next()?.parse().ok()?;
    (w >= 320 && h >= 240).then_some(slint::PhysicalSize::new(w, h))
}

fn prefers_reduced_motion() -> bool {
    match std::env::var("JUDIE_REDUCED_MOTION") {
        Ok(v) => matches!(v.to_ascii_lowercase().as_str(), "1" | "true" | "yes"),
        Err(_) => matches!(std::env::var("GTK_ENABLE_ANIMATIONS").as_deref(), Ok("0")),
    }
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

struct Pending {
    math: i32,
    tag: String,
}

static PENDING: Mutex<Pending> = Mutex::new(Pending {
    math: 0,
    tag: String::new(),
});

fn mix_rand() -> u32 {
    use std::sync::atomic::{AtomicU32, Ordering};
    static S: AtomicU32 = AtomicU32::new(0x9e3779b9);
    let t = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(1);
    S.fetch_add(0x6d2b79f5, Ordering::Relaxed).wrapping_add(t)
}

fn math_challenge() -> (String, i32) {
    let x = (mix_rand() % 9 + 1) as i32;
    let y = (mix_rand() % 9 + 1) as i32;
    let z = (mix_rand() % 9 + 1) as i32;
    (format!("{x} + {y} × {z}"), x + y * z)
}

fn verify_challenge() -> String {
    const LOWER: &[u8] = b"abcdefghijkmnpqrstuvwxyz";
    const UPPER: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ";
    const DIGITS: &[u8] = b"23456789";
    const SPEC: &[u8] = b"!@#$%&*?+=-_";
    let mut out = Vec::with_capacity(9);
    out.push(LOWER[(mix_rand() as usize) % LOWER.len()]);
    out.push(UPPER[(mix_rand() as usize) % UPPER.len()]);
    out.push(DIGITS[(mix_rand() as usize) % DIGITS.len()]);
    out.push(SPEC[(mix_rand() as usize) % SPEC.len()]);
    let all = [LOWER, UPPER, DIGITS, SPEC].concat();
    for _ in 0..5 {
        out.push(all[(mix_rand() as usize) % all.len()]);
    }
    for i in 0..out.len() {
        let j = (mix_rand() as usize) % out.len();
        out.swap(i, j);
    }
    String::from_utf8(out).unwrap_or_else(|_| "aK7@q2P!x".into())
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
    ui.set_host_ip(pi_ctl::lan_addrs().into());

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
        ui.set_temp_unit(room.temp_unit.clone().into());
        ui.set_distance_unit(room.distance_unit.clone().into());
        ui.set_settings_tab(room.settings_tab.clamp(0, 2));
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
        ui.set_creator_selected_kind(room.selected_creator_kind_label().into());
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

        let editing_routine = ui.get_kb_field().to_string().starts_with("routine-");
        if !editing_routine {
            let routines: Vec<RoutineRow> = room
                .routine_edits
                .iter()
                .map(|e| routine_row_for(room, e))
                .collect();
            ui.set_routines(ModelRc::new(VecModel::from(routines)));
        }

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

        let gallery_nodes: Vec<SlopNode> = room
            .gallery_preview_nodes()
            .iter()
            .map(|(wid, n)| slop_ui(wid, n))
            .collect();
        ui.set_gallery_nodes(ModelRc::new(VecModel::from(gallery_nodes)));
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
        "math" => ui.set_math_typed(text.into()),
        "verify" => ui.set_verify_typed(text.into()),
        "creator-name" => {
            pi_room::with(|room| room.creator_name = text.to_string());
            ui.set_creator_name(text.into());
        }
        "creator-node" => {
            pi_room::with(|room| room.set_creator_node_text(text));
            ui.set_creator_node_text(text.into());
        }
        "gallery-query" => {
            pi_room::with(|room| room.gallery_query = text.to_string());
            ui.set_gallery_query(text.into());
            push_ui(ui);
        }
        _ => {
            if apply_routine_kb(ui, field, text) {
                return;
            }
        }
    }
}

fn routine_field_parts(field: &str) -> Option<(&'static str, &str)> {
    let (kind, id) = field.split_once(':')?;
    let key = match kind {
        "routine-name" => "name",
        "routine-phrase" => "phrase",
        "routine-command" => "command",
        _ => return None,
    };
    Some((key, id))
}

fn apply_routine_kb(ui: &MainWindow, field: &str, text: &str) -> bool {
    let Some((key, id)) = routine_field_parts(field) else {
        return false;
    };
    pi_room::with(|room| room.set_routine_edit_field(id, key, text));
    patch_routine_row(ui, id);
    true
}

fn routine_row_for(room: &pi_room::Room, e: &pi_room::RoutineEdit) -> RoutineRow {
    let saved = room.routines.iter().find(|r| r.id == e.id);
    let (name_error, phrase_error, command_error) = if e.builtin {
        (String::new(), String::new(), String::new())
    } else {
        pi_room::validate_routine_fields(&e.name, &e.phrase, &e.command)
    };
    let valid = e.builtin || pi_room::routine_fields_valid(&e.name, &e.phrase, &e.command);
    let dirty = e.is_new
        || saved
            .map(|s| {
                e.name.trim() != s.name.trim()
                    || e.phrase.trim() != s.phrases.first().cloned().unwrap_or_default().trim()
                    || (!s.builtin && e.command.trim() != s.command.trim())
            })
            .unwrap_or(true);
    RoutineRow {
        id: e.id.clone().into(),
        name: e.name.clone().into(),
        phrase: e.phrase.clone().into(),
        command: e.command.clone().into(),
        builtin: e.builtin,
        enabled: e.enabled,
        is_new: e.is_new,
        dirty,
        valid,
        status: pi_room::routine_status_label(e, saved).into(),
        name_error: name_error.into(),
        phrase_error: phrase_error.into(),
        command_error: command_error.into(),
    }
}

fn patch_routine_row(ui: &MainWindow, id: &str) {
    let row = pi_room::with(|room| {
        room.routine_edits
            .iter()
            .find(|e| e.id == id)
            .map(|e| routine_row_for(room, e))
    });
    let Some(row) = row else {
        return;
    };
    let model = ui.get_routines();
    if let Some(vm) = model.as_any().downcast_ref::<VecModel<RoutineRow>>() {
        for i in 0..vm.row_count() {
            if vm.row_data(i).is_some_and(|r| r.id.as_str() == id) {
                vm.set_row_data(i, row);
                return;
            }
        }
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
        "math" => ui.get_math_typed().to_string(),
        "verify" => ui.get_verify_typed().to_string(),
        "creator-name" => ui.get_creator_name().to_string(),
        "creator-node" => ui.get_creator_node_text().to_string(),
        "gallery-query" => ui.get_gallery_query().to_string(),
        _ => {
            if let Some((key, id)) = routine_field_parts(field) {
                return pi_room::with(|room| {
                    room.routine_edits
                        .iter()
                        .find(|e| e.id == id)
                        .map(|e| match key {
                            "name" => e.name.clone(),
                            "phrase" => e.phrase.clone(),
                            "command" => e.command.clone(),
                            _ => String::new(),
                        })
                        .unwrap_or_default()
                });
            }
            String::new()
        }
    }
}

fn load_link(ui: &MainWindow) {
    let link = pi_ctl::link_status();
    ui.set_net_kind(link.kind.clone().into());
    ui.set_net_bars(link.bars);
    ui.set_wifi_ssid(link.ssid.into());
    ui.set_wifi_ip(link.ip.into());
    ui.set_wifi_state(link.state.into());
    ui.set_dhcp_on(pi_ctl::dhcp_enabled());
    ui.set_preferred_net(pi_ctl::preferred_iface().into());
}

fn load_wifi_status(ui: &MainWindow) {
    load_link(ui);
}

fn begin_package_install(ui: &MainWindow, tag: String) {
    if ui.get_updating() || ui.get_power_busy() {
        return;
    }
    if tag.is_empty() {
        ui.set_release_status("Pick a version first.".into());
        return;
    }
    if releases::same_version(&tag, &ui.get_version_text()) {
        ui.set_release_status("This version is already installed.".into());
        ui.set_version_menu_open(false);
        return;
    }
    ui.set_updating(true);
    ui.set_version_menu_open(false);
    ui.set_update_error("".into());
    ui.set_release_status(releases::InstallStage::Downloading.label().into());
    let weak = ui.as_weak();
    std::thread::spawn(move || {
        let progress_ui = weak.clone();
        let result = releases::install_tag_with_progress(&tag, |stage| {
            let label = stage.label().to_string();
            let weak = progress_ui.clone();
            let _ = slint::invoke_from_event_loop(move || {
                if let Some(ui) = weak.upgrade() {
                    ui.set_release_status(label.into());
                }
            });
        });
        let _ = slint::invoke_from_event_loop(move || {
            let Some(ui) = weak.upgrade() else { return };
            match result {
                Ok(ver) => {
                    ui.set_version_text(ver.clone().into());
                    ui.set_release_status(releases::InstallStage::Rebooting.label().into());
                    if let Err(err) = pi_ctl::power("reboot") {
                        ui.set_updating(false);
                        ui.set_release_status(
                            format!("Installed {ver}, but reboot failed: {err}. Use Restart.")
                                .into(),
                        );
                    }
                }
                Err(err) => {
                    ui.set_updating(false);
                    ui.set_release_status(err.clone().into());
                    ui.set_update_error(err.into());
                }
            }
        });
    });
}

fn load_releases(ui: &MainWindow) {
    ui.set_refresh_status("Checking GitHub…".into());
    ui.set_release_status("Checking GitHub…".into());
    let weak = ui.as_weak();
    std::thread::spawn(move || {
        let rows = pi_ctl::version_rows();
        let latest = releases::check_latest().ok();
        let _ = slint::invoke_from_event_loop(move || {
            let Some(ui) = weak.upgrade() else { return };
            match rows {
                Ok(rows) => {
                    let count = rows.len();
                    let current = rows.iter().find(|r| r.current).map(|r| r.tag.clone());
                    if ui.get_selected_release().is_empty() {
                        if let Some(tag) = current.clone() {
                            ui.set_selected_release(tag.into());
                        } else {
                            ui.set_selected_release(format!("v{}", ui.get_version_text()).into());
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
                    ui.set_refresh_status(
                        format!("Checked GitHub. {count} compatible release{}.", if count == 1 { "" } else { "s" })
                            .into(),
                    );
                    if let Some(n) = latest {
                        ui.set_update_available(n.outdated);
                        let status = if n.outdated {
                            format!("Current {} is not latest. Latest is {}.", n.current, n.latest)
                        } else {
                            format!("Current {} is the latest compatible release.", n.current)
                        };
                        ui.set_update_label(status.clone().into());
                        ui.set_release_status(status.into());
                    } else {
                        ui.set_update_label("Could not compare with GitHub.".into());
                        ui.set_release_status("Release list loaded.".into());
                    }
                }
                Err(err) => {
                    ui.set_refresh_status(err.clone().into());
                    ui.set_release_status(err.into());
                }
            }
        });
    });
}

fn begin_power_action(ui: &MainWindow, action: &str) {
    if ui.get_updating() || ui.get_power_busy() {
        return;
    }
    let action = match pi_ctl::allowed_power_action(action) {
        Ok(action) => action,
        Err(err) => {
            ui.set_power_status(err.into());
            return;
        }
    };
    ui.set_power_busy(true);
    ui.set_power_status(pi_ctl::power_status_label(action).into());
    let mocked = pi_ctl::power_mock_path().is_some();
    let weak = ui.as_weak();
    let action = action.to_string();
    std::thread::spawn(move || {
        let result = match action.as_str() {
            "uninstall" => match pi_ctl::power("uninstall") {
                Ok(()) => {
                    let weak = weak.clone();
                    let _ = slint::invoke_from_event_loop(move || {
                        if let Some(ui) = weak.upgrade() {
                            ui.set_power_status("Removed. Rebooting…".into());
                        }
                    });
                    pi_ctl::power("reboot")
                }
                err => err,
            },
            other => pi_ctl::power(other),
        };
        let _ = slint::invoke_from_event_loop(move || {
            let Some(ui) = weak.upgrade() else { return };
            match result {
                Ok(()) if mocked => {
                    ui.set_power_busy(false);
                    ui.set_power_status(
                        format!("Mock: {action} recorded. The panel stays on.")
                            .into(),
                    );
                }
                Ok(()) => {}
                Err(err) => {
                    ui.set_power_busy(false);
                    ui.set_power_status(err.into());
                }
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
        pi_room::with(|room| room.settings_tab = t.clamp(0, 2));
        r();
    });
    let r = refresh.clone();
    ui.on_toggle_voice(move || {
        pi_room::with(|room| {
            room.voice = !room.voice;
            room.save();
        });
        r();
    });
    let r = refresh.clone();
    ui.on_toggle_speak(move || {
        pi_room::with(|room| {
            room.speak = !room.speak;
            room.save();
        });
        r();
    });
    let r = refresh.clone();
    ui.on_toggle_units(move || {
        pi_room::with(|room| {
            let next = if room.temp_unit == "f" { "c-km" } else { "f-mi" };
            room.apply_units_preset(next);
            room.save();
        });
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
        pi_room::with(|room| {
            room.room_name = t.to_string();
            room.save();
        });
    });
    ui.on_set_location(move |t| {
        pi_room::with(|room| {
            room.weather_loc = t.to_string();
            room.save();
        });
    });
    ui.on_set_latitude(move |t| {
        pi_room::with(|room| {
            room.latitude = t.to_string();
            room.save();
        });
    });
    ui.on_set_longitude(move |t| {
        pi_room::with(|room| {
            room.longitude = t.to_string();
            room.save();
        });
    });
    ui.on_set_assistant_url(move |t| {
        pi_room::with(|room| room.assistant_url = t.to_string());
    });
    let r = refresh.clone();
    ui.on_add_routine(move || {
        pi_room::with(|room| room.add_routine_draft());
        r();
    });
    let r = refresh.clone();
    ui.on_save_routine(move |id| {
        pi_room::with(|room| {
            room.save_routine_edit(id.as_str());
        });
        r();
    });
    let r = refresh.clone();
    ui.on_cancel_routine(move |id| {
        pi_room::with(|room| room.cancel_routine_edit(id.as_str()));
        r();
    });
    let r = refresh.clone();
    ui.on_duplicate_routine(move |id| {
        pi_room::with(|room| room.duplicate_routine_edit(id.as_str()));
        r();
    });
    let r = refresh.clone();
    ui.on_toggle_routine(move |id| {
        pi_room::with(|room| {
            let enabled = room
                .routine_edits
                .iter()
                .find(|e| e.id == id.as_str())
                .map(|e| !e.enabled)
                .unwrap_or(true);
            room.set_routine_enabled(id.as_str(), enabled);
        });
        r();
    });
    let weak = ui.as_weak();
    ui.on_ask_delete_routine(move |id| {
        let Some(ui) = weak.upgrade() else { return };
        let name = pi_room::with(|room| {
            room.routine_edits
                .iter()
                .find(|e| e.id == id.as_str())
                .map(|e| {
                    if e.name.trim().is_empty() {
                        "this routine".into()
                    } else {
                        e.name.clone()
                    }
                })
                .unwrap_or_else(|| "this routine".into())
        });
        ui.set_pending_routine_id(id);
        ui.set_pending_routine_name(name.into());
        ui.set_confirm_title("Delete this routine?".into());
        ui.set_confirm_body(
            format!(
                "“{}” will be removed. This cannot be undone.",
                ui.get_pending_routine_name()
            )
            .into(),
        );
        ui.set_confirm_kind("delete-routine".into());
    });

    let weak = ui.as_weak();
    ui.on_check_updates(move || {
        if let Some(ui) = weak.upgrade() {
            if ui.get_updating() || ui.get_power_busy() {
                return;
            }
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
        begin_package_install(&ui, tag.to_string());
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
                                bars: n.bars,
                                secured: n.secured,
                                saved: n.saved,
                                connected: n.connected,
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
            ui.set_wifi_pick(ssid.clone());
            ui.set_wifi_detail(ssid.clone());
            ui.set_wifi_auto(pi_ctl::wants_autoconnect(ssid.as_str()));
            if let Some(pass) = pi_ctl::remembered_password(ssid.as_str()) {
                ui.set_wifi_pass(pass.into());
            }
            ui.set_wifi_status("Available network".into());
        }
    });
    let weak = ui.as_weak();
    ui.on_connect_wifi(move || {
        let Some(ui) = weak.upgrade() else { return };
        let ssid = ui.get_wifi_pick().to_string();
        if ssid.is_empty() {
            return;
        }
        let mut pass = ui.get_wifi_pass().to_string();
        if pass.is_empty() {
            pass = pi_ctl::remembered_password(&ssid).unwrap_or_default();
        }
        let secured = {
            let model = ui.get_wifi_nets();
            (0..model.row_count()).any(|i| {
                model
                    .row_data(i)
                    .map(|n| n.ssid.as_str() == ssid && n.secured)
                    .unwrap_or(false)
            })
        };
        if secured && pass.is_empty() {
            let seed = kb_seed(&ui, "wifi-pass");
            ui.set_kb_field("wifi-pass".into());
            ui.set_kb_text(seed.into());
            ui.set_kb_open(true);
            return;
        }
        let auto = ui.get_wifi_auto();
        ui.set_wifi_busy(true);
        ui.set_wifi_status(format!("Connecting to {ssid}…").into());
        let weak = ui.as_weak();
        std::thread::spawn(move || {
            let result = pi_ctl::wifi_connect(&ssid, &pass, auto);
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
    let weak = ui.as_weak();
    ui.on_reboot_now(move || {
        if let Some(ui) = weak.upgrade() {
            begin_power_action(&ui, "reboot");
        }
    });
    let weak = ui.as_weak();
    ui.on_shutdown_now(move || {
        if let Some(ui) = weak.upgrade() {
            begin_power_action(&ui, "poweroff");
        }
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
        text.push_str(ch.as_str());
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
        let field = ui.get_kb_field().to_string();
        ui.set_kb_open(false);
        if field == "wifi-pass" {
            ui.invoke_connect_wifi();
        }
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

    let r = refresh.clone();
    ui.on_drag_drop(move |id, col, row| {
        pi_room::with(|room| room.place_slot(id.as_str(), col, row));
        r();
    });
    let r = refresh.clone();
    ui.on_gallery_set_index(move |i| {
        let size = match i {
            1 => "1x2",
            2 => "2x2",
            _ => "1x1",
        };
        pi_room::with(|room| room.gallery_size = size.into());
        r();
    });
    let r = refresh.clone();
    ui.on_set_units_preset(move |u| {
        pi_room::with(|room| {
            room.apply_units_preset(u.as_str());
            room.save();
        });
        r();
    });
    let weak = ui.as_weak();
    ui.on_set_preferred_net(move |kind| {
        let kind = kind.to_string();
        let _ = pi_ctl::set_preferred_iface(&kind);
        if let Some(ui) = weak.upgrade() {
            ui.set_preferred_net(kind.into());
            load_link(&ui);
        }
    });
    let weak = ui.as_weak();
    ui.on_toggle_dhcp(move || {
        let Some(ui) = weak.upgrade() else { return };
        let next = !ui.get_dhcp_on();
        let _ = pi_ctl::set_dhcp(next);
        ui.set_dhcp_on(next);
        load_link(&ui);
    });
    let weak = ui.as_weak();
    ui.on_reconnect_net(move || {
        let weak = weak.clone();
        std::thread::spawn(move || {
            let result = pi_ctl::reconnect();
            let _ = slint::invoke_from_event_loop(move || {
                if let Some(ui) = weak.upgrade() {
                    load_link(&ui);
                    ui.set_wifi_status(match result {
                        Ok(()) => "Reconnected.".into(),
                        Err(err) => err.into(),
                    });
                }
            });
        });
    });
    let weak = ui.as_weak();
    ui.on_open_net_menu(move || {
        let Some(ui) = weak.upgrade() else { return };
        ui.set_net_menu_open(true);
        ui.set_wifi_detail("".into());
        load_link(&ui);
        ui.invoke_scan_wifi();
    });
    let weak = ui.as_weak();
    ui.on_close_net_menu(move || {
        if let Some(ui) = weak.upgrade() {
            ui.set_net_menu_open(false);
            ui.set_wifi_detail("".into());
        }
    });
    let weak = ui.as_weak();
    ui.on_toggle_wifi_auto(move || {
        if let Some(ui) = weak.upgrade() {
            ui.set_wifi_auto(!ui.get_wifi_auto());
        }
    });
    let weak = ui.as_weak();
    ui.on_begin_confirm(move |kind| {
        let Some(ui) = weak.upgrade() else { return };
        if ui.get_updating() || ui.get_power_busy() {
            return;
        }
        match kind.as_str() {
            "restart" => {
                ui.set_confirm_title("Restart?".into());
                ui.set_confirm_body("The panel will reboot. Judie stays on screen until the computer restarts.".into());
                ui.set_confirm_kind("restart".into());
            }
            "shutdown" => {
                ui.set_confirm_title("Shut down?".into());
                ui.set_confirm_body("The panel will power off. Judie stays on screen until the computer shuts down.".into());
                ui.set_confirm_kind("shutdown".into());
            }
            "uninstall1" => {
                ui.set_confirm_title("Uninstall Judie?".into());
                ui.set_confirm_body(pi_ctl::uninstall_warning().into());
                ui.set_confirm_kind("uninstall1".into());
            }
            _ => ui.set_confirm_kind(kind),
        }
    });
    let weak = ui.as_weak();
    ui.on_cancel_confirm(move || {
        if let Some(ui) = weak.upgrade() {
            ui.set_confirm_kind("".into());
            ui.set_pending_routine_id("".into());
            ui.set_math_typed("".into());
            ui.set_verify_typed("".into());
        }
    });
    let weak = ui.as_weak();
    let r = refresh.clone();
    ui.on_accept_confirm(move || {
        let Some(ui) = weak.upgrade() else { return };
        if ui.get_confirm_kind() == "delete-routine" {
            let id = ui.get_pending_routine_id().to_string();
            ui.set_confirm_kind("".into());
            ui.set_pending_routine_id("".into());
            if !id.is_empty() {
                pi_room::with(|room| room.remove_routine(&id));
            }
            r();
            return;
        }
        if ui.get_updating() || ui.get_power_busy() {
            return;
        }
        match ui.get_confirm_kind().as_str() {
            "restart" => {
                ui.set_confirm_kind("".into());
                begin_power_action(&ui, "reboot");
            }
            "shutdown" => {
                ui.set_confirm_kind("".into());
                begin_power_action(&ui, "poweroff");
            }
            "uninstall1" => {
                let (prompt, answer) = math_challenge();
                if let Ok(mut p) = PENDING.lock() {
                    p.math = answer;
                }
                ui.set_math_prompt(prompt.into());
                ui.set_math_typed("".into());
                ui.set_confirm_kind("uninstall2".into());
            }
            "uninstall2" => {
                let typed = ui.get_math_typed().to_string().replace(' ', "");
                let ok = PENDING.lock().ok().is_some_and(|p| typed.parse::<i32>().ok() == Some(p.math));
                if !ok {
                    return;
                }
                let code = verify_challenge();
                ui.set_verify_code(code.into());
                ui.set_verify_typed("".into());
                ui.set_confirm_kind("uninstall3".into());
            }
            "uninstall3" => {
                if ui.get_verify_typed() != ui.get_verify_code() {
                    return;
                }
                ui.set_confirm_kind("".into());
                begin_power_action(&ui, "uninstall");
            }
            "upgrade" | "downgrade" => {
                let tag = PENDING.lock().ok().map(|p| p.tag.clone()).unwrap_or_default();
                ui.set_confirm_kind("".into());
                ui.set_version_menu_open(false);
                if !tag.is_empty() {
                    begin_package_install(&ui, tag);
                }
            }
            _ => ui.set_confirm_kind("".into()),
        }
    });
    ui.on_uninstall_now(move || {});
    let weak = ui.as_weak();
    ui.on_pick_version(move |tag| {
        let Some(ui) = weak.upgrade() else { return };
        if ui.get_updating() || ui.get_power_busy() {
            return;
        }
        let tag = tag.to_string();
        let current = ui.get_version_text().to_string();
        if releases::same_version(&tag, &current) {
            ui.set_version_menu_open(false);
            ui.set_release_status("This version is already installed.".into());
            return;
        }
        if let Ok(mut p) = PENDING.lock() {
            p.tag = tag.clone();
        }
        ui.set_selected_release(tag.clone().into());
        ui.set_version_menu_open(false);
        let kind = releases::change_kind(&tag, &current);
        let target = releases::normalize_version(&tag);
        ui.set_confirm_title(if kind == "upgrade" {
            format!("Upgrade to {target}?").into()
        } else {
            format!("Downgrade to {target}?").into()
        });
        ui.set_confirm_body(releases::confirm_body(&current, &target).into());
        ui.set_confirm_kind(if kind == "upgrade" { "upgrade" } else { "downgrade" }.into());
    });
    let weak = ui.as_weak();
    ui.on_keyboard_command(move |cmd| {
        let Some(ui) = weak.upgrade() else { return };
        match cmd.as_str() {
            "back" | "delete" => ui.invoke_keyboard_back(),
            "word-back" => {
                let mut text = ui.get_kb_text().to_string();
                let trimmed = text.trim_end();
                let cut = trimmed.rfind(char::is_whitespace).map(|i| i + 1).unwrap_or(0);
                text.truncate(cut);
                ui.set_kb_text(text.clone().into());
                apply_kb_field(&ui, ui.get_kb_field().as_str(), &text);
            }
            "enter" => ui.invoke_keyboard_submit(),
            "esc" => ui.invoke_keyboard_close(),
            "tab" => {
                let mut text = ui.get_kb_text().to_string();
                text.push('\t');
                ui.set_kb_text(text.clone().into());
                apply_kb_field(&ui, ui.get_kb_field().as_str(), &text);
            }
            "clear" => {
                ui.set_kb_text("".into());
                apply_kb_field(&ui, ui.get_kb_field().as_str(), "");
            }
            _ => {}
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
    ui.set_reduced_motion(prefers_reduced_motion());
    ui.set_version_text(releases::display_version().into());
    ui.set_selected_release(format!("v{}", releases::display_version()).into());
    bind(&ui);
    push_ui(&ui);
    load_link(&ui);
    poll_latest(ui.as_weak());

    let weak = ui.as_weak();
    slint::Timer::default().start(TimerMode::Repeated, Duration::from_secs(1), move || {
        if let Some(ui) = weak.upgrade() {
            pi_room::with(|room| room.tick_media());
            push_ui(&ui);
        }
    });

    let weak = ui.as_weak();
    slint::Timer::default().start(TimerMode::Repeated, Duration::from_secs(5), move || {
        if let Some(ui) = weak.upgrade() {
            load_link(&ui);
            if ui.get_net_menu_open() && !ui.get_wifi_busy() {
                let weak = ui.as_weak();
                std::thread::spawn(move || {
                    let result = pi_ctl::wifi_scan();
                    let _ = slint::invoke_from_event_loop(move || {
                        let Some(ui) = weak.upgrade() else { return };
                        if !ui.get_net_menu_open() {
                            return;
                        }
                        if let Ok(nets) = result {
                            let model: Vec<WifiNet> = nets
                                .into_iter()
                                .map(|n| WifiNet {
                                    ssid: n.ssid.into(),
                                    signal: n.signal.to_string().into(),
                                    bars: n.bars,
                                    secured: n.secured,
                                    saved: n.saved,
                                    connected: n.connected,
                                })
                                .collect();
                            ui.set_wifi_nets(ModelRc::new(VecModel::from(model)));
                            load_link(&ui);
                        }
                    });
                });
            }
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
        if ui.get_updating() || ui.get_power_busy() {
            return;
        }
        ui.set_updating(true);
        ui.set_update_error("".into());
        ui.set_release_status("Downloading".into());
        let weak = ui.as_weak();
        std::thread::spawn(move || {
            let tag = match releases::check_latest() {
                Ok(n) if n.outdated => n.latest_tag,
                Ok(_) => {
                    let _ = slint::invoke_from_event_loop(move || {
                        if let Some(ui) = weak.upgrade() {
                            ui.set_updating(false);
                            ui.set_release_status("Already on the latest version".into());
                        }
                    });
                    return;
                }
                Err(err) => {
                    let _ = slint::invoke_from_event_loop(move || {
                        if let Some(ui) = weak.upgrade() {
                            ui.set_updating(false);
                            ui.set_release_status(err.clone().into());
                            ui.set_update_error(err.into());
                        }
                    });
                    return;
                }
            };
            let _ = slint::invoke_from_event_loop(move || {
                if let Some(ui) = weak.upgrade() {
                    ui.set_updating(false);
                    begin_package_install(&ui, tag);
                }
            });
        });
    });

    ui.run().expect("run");
}
