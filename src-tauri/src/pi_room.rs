//! Room state for the native Pi UI — same defaults as the live Windows home screen.

use chrono::Datelike;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

#[derive(Clone, Serialize, Deserialize)]
pub struct Light {
    pub id: String,
    pub name: String,
    pub on: bool,
    pub brightness: u8,
    pub color: String,
}

#[derive(Clone)]
pub struct Track {
    pub title: String,
    pub artist: String,
    pub duration: u32,
}

#[derive(Clone)]
pub struct Event {
    pub time: String,
    pub title: String,
    pub detail: String,
    pub day_offset: i32,
}

#[derive(Clone)]
pub struct Hour {
    pub hour: String,
    pub temp: i32,
    pub precip: u8,
}

#[derive(Clone)]
pub struct Activity {
    pub title: String,
    pub source: String,
    pub time: String,
}

#[derive(Clone)]
pub struct TimerItem {
    pub label: String,
    pub remain: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Slot {
    pub id: String,
    pub kind: String,
    pub size: String,
    pub col: i32,
    pub row: i32,
    #[serde(default)]
    pub page: i32,
    #[serde(default)]
    pub label: String,
    #[serde(default)]
    pub custom_id: String,
}

#[derive(Clone)]
pub struct CalCell {
    pub label: String,
    pub today: bool,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct SlopNode {
    pub id: String,
    pub kind: String,
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
    #[serde(default)]
    pub text: String,
    #[serde(default = "default_color")]
    pub color: String,
    #[serde(default)]
    pub value: f32,
}

fn default_color() -> String {
    "#f4f5f7".into()
}

#[derive(Clone, Serialize, Deserialize)]
pub struct CustomWidget {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub sizes: Vec<String>,
    #[serde(default)]
    pub layouts: std::collections::BTreeMap<String, Vec<SlopNode>>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Routine {
    pub id: String,
    pub name: String,
    pub phrases: Vec<String>,
    pub builtin: bool,
    #[serde(default)]
    pub command: String,
}

#[derive(Serialize, Deserialize, Default)]
struct Persist {
    #[serde(default)]
    slots: Vec<Slot>,
    #[serde(default)]
    custom: Vec<CustomWidget>,
    #[serde(default)]
    room_name: String,
    #[serde(default)]
    weather_loc: String,
    #[serde(default)]
    latitude: String,
    #[serde(default)]
    longitude: String,
    #[serde(default)]
    temp_unit: String,
    #[serde(default)]
    distance_unit: String,
    #[serde(default)]
    voice: Option<bool>,
    #[serde(default)]
    speak: Option<bool>,
    #[serde(default)]
    routines: Vec<Routine>,
}

pub const GRID_COLS: i32 = 6;
pub const GRID_ROWS: i32 = 4;
pub const MAX_PAGES: i32 = 6;

fn size_dims(size: &str) -> (i32, i32) {
    match size {
        "1x2" => (2, 1),
        "2x2" => (2, 2),
        _ => (1, 1),
    }
}

fn slot(id: &str, kind: &str, size: &str, col: i32, row: i32) -> Slot {
    Slot {
        id: id.into(),
        kind: kind.into(),
        size: size.into(),
        col,
        row,
        page: 0,
        label: String::new(),
        custom_id: String::new(),
    }
}

/// Same 6×4 placement as the live Windows home (PID 24608).
fn default_slots() -> Vec<Slot> {
    vec![
        slot("quick-1", "quickControls", "1x1", 0, 0),
        slot("climate-1", "climate", "1x1", 1, 0),
        slot("calendar-1", "calendar", "1x2", 2, 0),
        slot("purifier-1", "purifier", "2x2", 4, 0),
        slot("activity-1", "activity", "1x1", 0, 1),
        slot("server-1", "server", "1x2", 1, 1),
        slot("weather-1", "weather", "1x1", 3, 1),
        slot("lights-1", "lights", "2x2", 0, 2),
        slot("activity-2", "activity", "2x2", 2, 2),
    ]
}

pub fn supported_sizes(kind: &str) -> &'static [&'static str] {
    match kind {
        "climate" | "quickControls" | "server" | "timers" => &["1x1", "1x2"],
        _ => &["1x1", "1x2", "2x2"],
    }
}

pub fn gallery_kinds() -> &'static [(&'static str, &'static str, &'static str)] {
    &[
        ("activity", "Activity", "A live feed of what Judie and your automations have been doing."),
        ("calendar", "Calendar", "Upcoming events and the month at a glance."),
        ("climate", "Climate", "Indoor temperature, humidity, and outdoor air."),
        ("lights", "Lights", "Toggles, brightness, and colour for the room."),
        ("media", "Media", "Now playing, volume, and skip."),
        ("purifier", "Air Purifier", "Air quality, filter, and purifier mode."),
        ("quickControls", "Quick Controls", "One-tap scenes and room presets."),
        ("server", "Server Status", "Health and latency of local services."),
        ("system", "System", "CPU, memory, and top processes."),
        ("timers", "Timers", "Running timers and reminders."),
        ("weather", "Weather", "Local conditions and the next few hours."),
    ]
}

fn occupied_grid(slots: &[Slot], page: i32, skip: Option<&str>) -> Vec<Vec<bool>> {
    let mut grid = vec![vec![false; GRID_COLS as usize]; GRID_ROWS as usize];
    for s in slots {
        if s.page != page {
            continue;
        }
        if skip.is_some_and(|id| s.id == id) {
            continue;
        }
        let (w, h) = size_dims(&s.size);
        for r in s.row..s.row + h {
            for c in s.col..s.col + w {
                if r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS {
                    grid[r as usize][c as usize] = true;
                }
            }
        }
    }
    grid
}

fn first_free_on_page(slots: &[Slot], size: &str, page: i32) -> Option<(i32, i32)> {
    let (w, h) = size_dims(size);
    let grid = occupied_grid(slots, page, None);
    for row in 0..=GRID_ROWS - h {
        for col in 0..=GRID_COLS - w {
            let mut ok = true;
            'cells: for r in row..row + h {
                for c in col..col + w {
                    if grid[r as usize][c as usize] {
                        ok = false;
                        break 'cells;
                    }
                }
            }
            if ok {
                return Some((col, row));
            }
        }
    }
    None
}

fn first_free(slots: &[Slot], size: &str, prefer_page: i32) -> Option<(i32, i32, i32)> {
    let start = prefer_page.clamp(0, MAX_PAGES - 1);
    for page in start..MAX_PAGES {
        if let Some((col, row)) = first_free_on_page(slots, size, page) {
            return Some((col, row, page));
        }
    }
    for page in 0..start {
        if let Some((col, row)) = first_free_on_page(slots, size, page) {
            return Some((col, row, page));
        }
    }
    None
}

fn can_place(slots: &[Slot], size: &str, page: i32, col: i32, row: i32, skip: Option<&str>) -> bool {
    let (w, h) = size_dims(size);
    if col < 0 || row < 0 || col + w > GRID_COLS || row + h > GRID_ROWS {
        return false;
    }
    if page < 0 || page >= MAX_PAGES {
        return false;
    }
    let grid = occupied_grid(slots, page, skip);
    for r in row..row + h {
        for c in col..col + w {
            if grid[r as usize][c as usize] {
                return false;
            }
        }
    }
    true
}

fn month_cells() -> Vec<CalCell> {
    let now = chrono::Local::now().date_naive();
    let today = now.day();
    let start = now.with_day(1).unwrap_or(now);
    let weekday = start.weekday().num_days_from_sunday();
    let days = days_in_month(now.year(), now.month());
    let mut cells = Vec::new();
    for _ in 0..weekday {
        cells.push(CalCell {
            label: String::new(),
            today: false,
        });
    }
    for d in 1..=days {
        cells.push(CalCell {
            label: d.to_string(),
            today: d == today,
        });
    }
    while cells.len() < 42 {
        cells.push(CalCell {
            label: String::new(),
            today: false,
        });
    }
    cells.truncate(42);
    cells
}

fn days_in_month(year: i32, month: u32) -> u32 {
    let next = if month == 12 {
        chrono::NaiveDate::from_ymd_opt(year + 1, 1, 1)
    } else {
        chrono::NaiveDate::from_ymd_opt(year, month + 1, 1)
    };
    let this = chrono::NaiveDate::from_ymd_opt(year, month, 1);
    match (this, next) {
        (Some(a), Some(b)) => (b - a).num_days() as u32,
        _ => 31,
    }
}

fn data_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/home/fannsonetti".into());
    PathBuf::from(home).join(".local/share/judie")
}

fn persist_path() -> PathBuf {
    data_dir().join("layout.json")
}

pub fn migrate_units_preset(temp: &str, distance: &str) -> &'static str {
    let t = temp.to_ascii_lowercase();
    let d = distance.to_ascii_lowercase();
    if (t == "c" || t == "celsius") && (d == "km" || d == "kilometres" || d == "kilometers") {
        return "c-km";
    }
    if (t == "f" || t == "fahrenheit") && (d == "mi" || d == "mile" || d == "miles") {
        return "f-mi";
    }
    if (t == "k" || t == "kelvin") && (d == "fur" || d == "furlong" || d == "furlongs") {
        return "k-fur";
    }
    if t == "f" || t == "fahrenheit" {
        return "f-mi";
    }
    if t == "k" || t == "kelvin" {
        return "k-fur";
    }
    if t == "c" || t == "celsius" {
        return "c-km";
    }
    if d == "mi" || d == "nm" || d == "mile" || d == "miles" || d == "nautical" {
        return "f-mi";
    }
    if d == "fur" || d == "furlong" || d == "furlongs" {
        return "k-fur";
    }
    "c-km"
}

fn load_persist() -> Persist {
    let path = persist_path();
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_persist(room: &Room) {
    let dir = data_dir();
    let _ = std::fs::create_dir_all(&dir);
    let persist = Persist {
        slots: room.slots.clone(),
        custom: room.custom.clone(),
        room_name: room.room_name.clone(),
        weather_loc: room.weather_loc.clone(),
        latitude: room.latitude.clone(),
        longitude: room.longitude.clone(),
        temp_unit: room.temp_unit.clone(),
        distance_unit: room.distance_unit.clone(),
        voice: Some(room.voice),
        speak: Some(room.speak),
        routines: room.routines.iter().filter(|r| !r.builtin).cloned().collect(),
    };
    if let Ok(json) = serde_json::to_string_pretty(&persist) {
        let _ = std::fs::write(persist_path(), json);
    }
}

fn parse_hex(color: &str) -> (i32, i32, i32) {
    let s = color.trim().trim_start_matches('#');
    if s.len() >= 6 {
        let r = i32::from_str_radix(&s[0..2], 16).unwrap_or(244);
        let g = i32::from_str_radix(&s[2..4], 16).unwrap_or(245);
        let b = i32::from_str_radix(&s[4..6], 16).unwrap_or(247);
        (r, g, b)
    } else {
        (244, 245, 247)
    }
}

fn n(kind: &str, x: f32, y: f32, w: f32, h: f32, text: &str, color: &str) -> SlopNode {
    SlopNode {
        id: format!("{kind}-{}-{}", x as i32, y as i32),
        kind: kind.into(),
        x,
        y,
        w,
        h,
        text: text.into(),
        color: color.into(),
        value: 0.62,
    }
}

fn creator_kind_label(kind: &str) -> &'static str {
    match kind {
        "text" => "Text",
        "metric" => "Value",
        "icon" => "Icon",
        "bar" => "Bar",
        "gauge" => "Status",
        "button" => "Button",
        "chip" => "Chip",
        "list" => "List",
        "pair" => "Pair",
        "toggle" => "Control",
        "chart" => "Graph",
        "divider" => "Divider",
        "box" => "Container",
        _ => "Part",
    }
}

fn template_nodes(template: &str, size: &str) -> Vec<SlopNode> {
    match (template, size) {
        ("stat", "1x2") => vec![
            n("text", 5.0, 10.0, 30.0, 12.0, "INDOOR", "#8b909d"),
            n("metric", 5.0, 32.0, 40.0, 40.0, "21°", "#f4f5f7"),
            n("text", 50.0, 18.0, 45.0, 14.0, "Humidity 42%", "#8b909d"),
            n("text", 50.0, 40.0, 45.0, 14.0, "Outdoor 9°", "#8b909d"),
            n("text", 5.0, 78.0, 80.0, 14.0, "Comfortable", "#8b909d"),
        ],
        ("stat", "2x2") => vec![
            n("text", 8.0, 8.0, 40.0, 10.0, "INDOOR", "#8b909d"),
            n("metric", 8.0, 22.0, 50.0, 28.0, "21°", "#f4f5f7"),
            n("text", 8.0, 54.0, 80.0, 10.0, "Comfortable", "#8b909d"),
            n("bar", 8.0, 70.0, 84.0, 10.0, "", "#ffffff"),
            n("text", 8.0, 84.0, 80.0, 10.0, "Humidity 42%", "#8b909d"),
        ],
        ("status", _) => vec![
            n("text", 8.0, 8.0, 70.0, 12.0, "STATUS", "#8b909d"),
            n("chip", 8.0, 28.0, 36.0, 16.0, "Online", "#ffffff"),
            n("text", 8.0, 52.0, 80.0, 14.0, "Core 122 ms", "#f4f5f7"),
            n("text", 8.0, 70.0, 80.0, 14.0, "4 / 5 up", "#8b909d"),
        ],
        ("controls", _) => vec![
            n("text", 8.0, 8.0, 70.0, 12.0, "SCENE", "#8b909d"),
            n("button", 8.0, 28.0, 40.0, 22.0, "Night", "#ffffff"),
            n("button", 52.0, 28.0, 40.0, 22.0, "Movie", "#22252f"),
            n("toggle", 8.0, 60.0, 28.0, 16.0, "On", "#ffffff"),
            n("text", 40.0, 62.0, 50.0, 12.0, "Master", "#f4f5f7"),
        ],
        ("list", _) => vec![
            n("text", 8.0, 8.0, 80.0, 12.0, "ACTIVITY", "#8b909d"),
            n("list", 8.0, 24.0, 84.0, 68.0, "Do Not Disturb\nGood Night\nMovie Mode", "#f4f5f7"),
        ],
        ("blank", _) => vec![],
        _ => vec![
            n("text", 8.0, 8.0, 70.0, 10.0, "INDOOR", "#8b909d"),
            n("metric", 8.0, 28.0, 84.0, 36.0, "21°", "#f4f5f7"),
            n("text", 8.0, 72.0, 80.0, 12.0, "Comfortable", "#8b909d"),
        ],
    }
}

fn default_routines() -> Vec<Routine> {
    vec![
        Routine {
            id: "goodNight".into(),
            name: "Good Night".into(),
            phrases: vec!["good night".into(), "bedtime".into()],
            builtin: true,
            command: String::new(),
        },
        Routine {
            id: "movie".into(),
            name: "Movie".into(),
            phrases: vec!["movie mode".into(), "movie time".into()],
            builtin: true,
            command: String::new(),
        },
        Routine {
            id: "away".into(),
            name: "Away".into(),
            phrases: vec!["away mode".into(), "i am leaving".into()],
            builtin: true,
            command: String::new(),
        },
        Routine {
            id: "morning".into(),
            name: "Morning".into(),
            phrases: vec!["good morning".into(), "start the day".into()],
            builtin: true,
            command: String::new(),
        },
        Routine {
            id: "home".into(),
            name: "Home".into(),
            phrases: vec!["i am home".into(), "i am back".into()],
            builtin: true,
            command: String::new(),
        },
    ]
}

pub struct Room {
    pub lights: Vec<Light>,
    pub scene: String,
    pub dnd: bool,
    pub playing: bool,
    pub volume: u8,
    pub track: usize,
    pub queue: Vec<Track>,
    pub progress: f32,
    pub indoor: f32,
    pub outdoor: i32,
    pub humidity: u8,
    pub weather_loc: String,
    pub weather_temp: i32,
    pub weather_cond: String,
    pub weather_high: i32,
    pub weather_low: i32,
    pub weather_feel: String,
    pub weather_note: String,
    pub hours: Vec<Hour>,
    pub events: Vec<Event>,
    pub purifier_on: bool,
    pub purifier_mode: String,
    pub purifier_aq: String,
    pub purifier_filter: u8,
    pub room_name: String,
    pub assistant_url: String,
    pub latitude: String,
    pub longitude: String,
    pub voice: bool,
    pub speak: bool,
    pub units_metric: bool,
    pub temp_unit: String,
    pub distance_unit: String,
    pub notice_timers: bool,
    pub notice_calendar: bool,
    pub notice_weather: bool,
    pub notice_air: bool,
    pub notice_devices: bool,
    pub overlay: Overlay,
    pub settings_tab: i32,
    pub palette_query: String,
    pub palette_reply: String,
    pub edit_mode: bool,
    pub page: i32,
    pub slots: Vec<Slot>,
    pub custom: Vec<CustomWidget>,
    pub gallery_kind: String,
    pub gallery_size: String,
    pub gallery_query: String,
    pub gallery_custom_id: String,
    pub creator_name: String,
    pub creator_template: String,
    pub creator_size: String,
    pub creator_nodes: Vec<SlopNode>,
    pub creator_selected: String,
    pub pending_remove: String,
    pub cal_cells: Vec<CalCell>,
    pub activity: Vec<Activity>,
    pub timers: Vec<TimerItem>,
    pub routines: Vec<Routine>,
    pub expanded: Expanded,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Overlay {
    None,
    Settings,
    Palette,
    Gallery,
    Creator,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Expanded {
    None,
    Weather,
    Lights,
    Media,
    Calendar,
    Purifier,
}

impl Default for Room {
    fn default() -> Self {
        let persist = load_persist();
        let slots = if persist.slots.is_empty() {
            default_slots()
        } else {
            persist.slots
        };
        let custom = persist.custom;
        let mut room = Self {
            lights: vec![
                Light { id: "bed".into(), name: "Bed LEDs".into(), on: true, brightness: 8, color: "#FF8C42".into() },
                Light { id: "sofa".into(), name: "Sofa LEDs".into(), on: true, brightness: 8, color: "#2D7BFF".into() },
                Light { id: "shelf".into(), name: "Shelf LEDs".into(), on: true, brightness: 8, color: "#FF8C42".into() },
                Light { id: "ceiling".into(), name: "Ceiling Light".into(), on: true, brightness: 8, color: "#2D7BFF".into() },
                Light { id: "desk".into(), name: "Desk Light".into(), on: true, brightness: 8, color: "#FF8C42".into() },
            ],
            scene: "Night".into(),
            dnd: false,
            playing: false,
            volume: 62,
            track: 0,
            queue: vec![
                Track { title: "Rain on Window".into(), artist: "Steady rain and distant thunder".into(), duration: 248 },
                Track { title: "Ocean Waves".into(), artist: "Soft tide and night air".into(), duration: 212 },
                Track { title: "Forest".into(), artist: "Gentle rain and distant birds".into(), duration: 196 },
                Track { title: "Cafe".into(), artist: "Quiet chatter and cups".into(), duration: 231 },
                Track { title: "Fireplace".into(), artist: "Low crackle and warmth".into(), duration: 240 },
                Track { title: "Night".into(), artist: "Wind and a distant city".into(), duration: 255 },
            ],
            progress: 0.22,
            indoor: 21.4,
            outdoor: 9,
            humidity: 42,
            weather_loc: if persist.weather_loc.is_empty() { "Hafnarfjörður".into() } else { persist.weather_loc.clone() },
            weather_temp: 9,
            weather_cond: "Clear".into(),
            weather_high: 11,
            weather_low: 8,
            weather_feel: "Cool and clear".into(),
            weather_note: "Clear skies overnight".into(),
            hours: vec![
                Hour { hour: "20".into(), temp: 10, precip: 5 },
                Hour { hour: "21".into(), temp: 9, precip: 5 },
                Hour { hour: "22".into(), temp: 9, precip: 8 },
                Hour { hour: "23".into(), temp: 8, precip: 10 },
                Hour { hour: "00".into(), temp: 8, precip: 8 },
                Hour { hour: "01".into(), temp: 8, precip: 5 },
            ],
            events: vec![
                Event { time: "09:00".into(), title: "Coffee & planning".into(), detail: "Kitchen".into(), day_offset: 0 },
                Event { time: "11:15".into(), title: "Group project".into(), detail: "Desk".into(), day_offset: 0 },
                Event { time: "14:00".into(), title: "School pickup".into(), detail: "Drive".into(), day_offset: 0 },
                Event { time: "17:30".into(), title: "Gym".into(), detail: "Strength".into(), day_offset: 0 },
                Event { time: "20:00".into(), title: "Project deep work".into(), detail: "Desk".into(), day_offset: 0 },
            ],
            purifier_on: true,
            purifier_mode: "Auto".into(),
            purifier_aq: "Good".into(),
            purifier_filter: 76,
            room_name: if persist.room_name.is_empty() { "Room".into() } else { persist.room_name.clone() },
            assistant_url: "http://127.0.0.1:8742".into(),
            latitude: if persist.latitude.is_empty() { "64.07".into() } else { persist.latitude.clone() },
            longitude: if persist.longitude.is_empty() { "-21.95".into() } else { persist.longitude.clone() },
            voice: persist.voice.unwrap_or(true),
            speak: persist.speak.unwrap_or(true),
            units_metric: true,
            temp_unit: "c".into(),
            distance_unit: "km".into(),
            notice_timers: true,
            notice_calendar: true,
            notice_weather: true,
            notice_air: true,
            notice_devices: true,
            overlay: Overlay::None,
            settings_tab: 0,
            palette_query: String::new(),
            palette_reply: String::new(),
            edit_mode: false,
            page: 0,
            slots,
            custom,
            gallery_kind: "activity".into(),
            gallery_size: "1x1".into(),
            gallery_query: String::new(),
            gallery_custom_id: String::new(),
            creator_name: "Untitled".into(),
            creator_template: "stat".into(),
            creator_size: "1x1".into(),
            creator_nodes: template_nodes("stat", "1x1"),
            creator_selected: String::new(),
            pending_remove: String::new(),
            cal_cells: month_cells(),
            activity: vec![
                Activity { title: "Do Not Disturb".into(), source: "Manual".into(), time: "17:24".into() },
                Activity { title: "Good Night".into(), source: "Routine".into(), time: "17:24".into() },
                Activity { title: "Good Night".into(), source: "Routine".into(), time: "22:03".into() },
                Activity { title: "Movie Mode".into(), source: "Routine".into(), time: "22:03".into() },
            ],
            timers: vec![
                TimerItem { label: "Tea".into(), remain: "3:20".into() },
                TimerItem { label: "Laundry".into(), remain: "18:00".into() },
            ],
            routines: {
                let mut list = default_routines();
                for r in persist.routines {
                    if !r.builtin && !list.iter().any(|x| x.id == r.id) {
                        list.push(r);
                    }
                }
                list
            },
            expanded: Expanded::None,
        };
        let preset = migrate_units_preset(&persist.temp_unit, &persist.distance_unit);
        room.apply_units_preset(preset);
        room.import_json_files();
        if persist.temp_unit != room.temp_unit || persist.distance_unit != room.distance_unit {
            room.save();
        }
        room
    }
}

impl Room {
    fn persist(&self) {
        save_persist(self);
    }

    pub fn save(&self) {
        self.persist();
    }

    pub fn apply_units_preset(&mut self, preset: &str) {
        match preset {
            "f" | "f-mi" => {
                self.temp_unit = "f".into();
                self.distance_unit = "mi".into();
                self.units_metric = false;
            }
            "k" | "k-fur" => {
                self.temp_unit = "k".into();
                self.distance_unit = "fur".into();
                self.units_metric = true;
            }
            _ => {
                self.temp_unit = "c".into();
                self.distance_unit = "km".into();
                self.units_metric = true;
            }
        }
    }

    pub fn used_page_count(&self) -> i32 {
        self.slots.iter().map(|s| s.page).max().unwrap_or(0) + 1
    }

    pub fn visible_page_count(&self) -> i32 {
        let used = self.used_page_count().max(1);
        if self.edit_mode && used < MAX_PAGES {
            used + 1
        } else {
            used
        }
    }

    pub fn master_on(&self) -> bool {
        self.lights.iter().any(|l| l.on)
    }

    pub fn master_brightness(&self) -> u8 {
        let on: Vec<_> = self.lights.iter().filter(|l| l.on).collect();
        if on.is_empty() {
            0
        } else {
            (on.iter().map(|l| l.brightness as u32).sum::<u32>() / on.len() as u32) as u8
        }
    }

    pub fn master_color(&self) -> String {
        self.lights
            .iter()
            .find(|l| l.on)
            .map(|l| l.color.clone())
            .unwrap_or_else(|| "#FFB366".into())
    }

    pub fn set_master_power(&mut self, on: bool) {
        for light in &mut self.lights {
            light.on = on;
        }
        self.push("Lights", if on { "All on" } else { "All off" });
    }

    pub fn set_master_brightness(&mut self, v: u8) {
        let v = v.min(100);
        for light in &mut self.lights {
            light.brightness = v;
            if v > 0 {
                light.on = true;
            }
        }
        if v == 0 {
            self.set_master_power(false);
        }
    }

    pub fn set_master_color(&mut self, color: &str) {
        for light in &mut self.lights {
            light.color = color.into();
            light.on = true;
        }
    }

    pub fn toggle_light(&mut self, id: &str) {
        if let Some(light) = self.lights.iter_mut().find(|l| l.id == id) {
            light.on = !light.on;
            let name = light.name.clone();
            let on = light.on;
            self.push(&name, if on { "On" } else { "Off" });
        }
    }

    pub fn set_scene(&mut self, scene: &str) {
        let (b, color) = match scene {
            "Cozy" => (45, "#FFB366"),
            "Movie" => (18, "#6B8CFF"),
            "Night" => (8, "#FF8C42"),
            "Bright" => (95, "#FFF5E6"),
            "Gaming" => (60, "#2D7BFF"),
            _ => (50, "#FFB366"),
        };
        self.scene = scene.into();
        self.set_master_power(true);
        self.set_master_brightness(b);
        self.set_master_color(color);
        self.push("Scene", scene);
    }

    pub fn current_track(&self) -> &Track {
        &self.queue[self.track.min(self.queue.len() - 1)]
    }

    pub fn toggle_play(&mut self) {
        self.playing = !self.playing;
        self.push("Media", if self.playing { "Playing" } else { "Paused" });
    }

    pub fn next_track(&mut self) {
        self.track = (self.track + 1) % self.queue.len();
        self.progress = 0.0;
        self.playing = true;
    }

    pub fn prev_track(&mut self) {
        self.track = if self.track == 0 { self.queue.len() - 1 } else { self.track - 1 };
        self.progress = 0.0;
        self.playing = true;
    }

    pub fn tick_media(&mut self) {
        if !self.playing {
            return;
        }
        let dur = self.current_track().duration.max(1) as f32;
        self.progress = (self.progress + 1.0 / dur).min(1.0);
        if self.progress >= 1.0 {
            self.next_track();
        }
    }

    pub fn toggle_dnd(&mut self) {
        self.dnd = !self.dnd;
        self.push("DND", if self.dnd { "On" } else { "Off" });
    }

    pub fn toggle_purifier(&mut self) {
        self.purifier_on = !self.purifier_on;
        self.push("Purifier", if self.purifier_on { "On" } else { "Off" });
    }

    pub fn cycle_purifier_mode(&mut self) {
        self.purifier_mode = match self.purifier_mode.as_str() {
            "Auto" => "Manual".into(),
            "Manual" => "Sleep".into(),
            _ => "Auto".into(),
        };
    }

    pub fn set_purifier_mode(&mut self, mode: &str) {
        self.purifier_mode = match mode.to_lowercase().as_str() {
            "sleep" => "Sleep".into(),
            "manual" | "boost" => "Manual".into(),
            _ => "Auto".into(),
        };
    }

    pub fn quick(&mut self, action: &str) {
        match action {
            "dnd" => self.toggle_dnd(),
            "lightsOff" => self.set_master_power(false),
            "goodNight" => {
                self.set_scene("Night");
                self.volume = 12;
                self.playing = false;
                self.dnd = true;
                self.push("Routine", "Good Night");
            }
            "movie" => {
                self.set_scene("Movie");
                self.volume = 35;
                self.push("Routine", "Movie");
            }
            "away" => {
                self.set_master_power(false);
                self.playing = false;
                self.set_purifier_mode("auto");
                self.push("Routine", "Away");
            }
            "morning" => {
                self.set_scene("Bright");
                self.dnd = false;
                self.set_purifier_mode("auto");
                self.push("Routine", "Morning");
            }
            "home" => {
                self.set_master_power(true);
                self.dnd = false;
                self.set_purifier_mode("auto");
                self.push("Routine", "Home");
            }
            _ => {}
        }
    }

    pub fn comfort(&self) -> &'static str {
        if self.indoor < 17.0 {
            "Cool"
        } else if self.indoor > 25.0 {
            "Warm"
        } else if self.humidity > 70 {
            "Humid"
        } else {
            "Comfortable"
        }
    }

    pub fn push(&mut self, source: &str, title: &str) {
        self.activity.insert(
            0,
            Activity {
                title: title.into(),
                source: source.into(),
                time: chrono::Local::now().format("%H:%M").to_string(),
            },
        );
        self.activity.truncate(8);
    }

    pub fn run_command(&mut self, raw: &str) -> String {
        let q = raw.trim().to_lowercase();
        if q.is_empty() {
            return "Type a command…".into();
        }
        if q.contains("good night") || q.contains("bedtime") {
            self.quick("goodNight");
            return "Night scene, playback paused, DND on.".into();
        }
        if q.contains("movie") {
            self.quick("movie");
            return "Movie scene.".into();
        }
        if q.contains("good morning") || q.contains("morning") {
            self.quick("morning");
            return "Bright scene. DND off.".into();
        }
        if q.contains("away") || q.contains("leaving") {
            self.quick("away");
            return "Away: lights off, playback paused.".into();
        }
        if q.contains("i am home") || q.contains("i'm home") || q == "home" {
            self.quick("home");
            return "Welcome home.".into();
        }
        if q.contains("dnd") || q.contains("do not disturb") {
            self.toggle_dnd();
            return if self.dnd {
                "Do not disturb on.".into()
            } else {
                "Do not disturb off.".into()
            };
        }
        if (q.contains("light") || q.contains("lights")) && (q.contains("off") || q.contains("kill")) {
            self.set_master_power(false);
            return "Lights off.".into();
        }
        if q.contains("light") && q.contains("on") {
            self.set_master_power(true);
            return "Lights on.".into();
        }
        if q.contains("pause") || q.contains("stop") {
            self.playing = false;
            return "Paused.".into();
        }
        if q.contains("play") || q.contains("music") {
            self.playing = true;
            return format!("Playing {}.", self.current_track().title);
        }
        if q.contains("next") {
            self.next_track();
            return format!("Next: {}.", self.current_track().title);
        }
        if q.contains("weather") || q.contains("outside") || q.contains("forecast") {
            return format!(
                "{} in {} — L{}° H{}°. {}",
                self.weather_cond, self.weather_loc, self.weather_low, self.weather_high, self.weather_note
            );
        }
        if q.contains("temp") || q.contains("climate") || q.contains("humidity") {
            return format!(
                "Indoor {:.1}°, humidity {}%, {}.",
                self.indoor, self.humidity, self.comfort()
            );
        }
        if q.contains("desk") {
            self.toggle_light("desk");
            return "Toggled desk light.".into();
        }
        if q.contains("cozy") {
            self.set_scene("Cozy");
            return "Cozy scene.".into();
        }
        if q.contains("night") {
            self.set_scene("Night");
            return "Night scene.".into();
        }
        if q.contains("creator") {
            self.overlay = Overlay::Creator;
            self.apply_template();
            return "Opened Widget Creator.".into();
        }
        if q.starts_with("add ") {
            let kind = q.trim_start_matches("add ").trim();
            let map = [
                ("weather", "weather"),
                ("lights", "lights"),
                ("media", "media"),
                ("activity", "activity"),
                ("timers", "timers"),
                ("system", "system"),
                ("calendar", "calendar"),
                ("climate", "climate"),
                ("purifier", "purifier"),
            ];
            if let Some((_, kind)) = map.iter().find(|(k, _)| kind.contains(k)) {
                match self.add_widget(kind, "1x1") {
                    Ok(()) => return format!("Added {kind}."),
                    Err(e) => return e,
                }
            }
        }
        if q.contains("page 1") || q.contains("page one") || q.contains("go to page 1") {
            self.page = 0;
            return "Page 1.".into();
        }
        if q.contains("page 2") || q.contains("go to page 2") {
            self.page = 1.min(self.visible_page_count() - 1);
            return "Page 2.".into();
        }
        if q.contains("help") || q.contains("what can") {
            return "Try: lights off, movie mode, good night, play, weather, DND.".into();
        }
        let custom: Vec<Routine> = self
            .routines
            .iter()
            .filter(|r| !r.builtin)
            .cloned()
            .collect();
        for r in custom {
            if r.phrases.iter().any(|p| {
                let p = p.to_lowercase();
                !p.is_empty() && (q == p || q.contains(&p))
            }) {
                let cmd = r.command.trim().to_string();
                if cmd.is_empty() {
                    return format!("{} has no command yet.", r.name);
                }
                if cmd.to_lowercase() == q {
                    return format!("Running {}.", r.name);
                }
                return self.run_command(&cmd);
            }
        }
        format!("I heard “{}”. Try lights, weather, play, or good night.", raw.trim())
    }

    pub fn palette_hits(&self) -> Vec<(String, String, String)> {
        let n = self.palette_query.trim().to_lowercase();
        let mut items: Vec<(String, String, String)> = Vec::new();
        let ask = if self.palette_query.trim().is_empty() {
            "Type a command…".into()
        } else {
            format!("Ask Judie: {}", self.palette_query.trim())
        };
        items.push(("ask".into(), ask, "Enter".into()));
        for l in &self.lights {
            let title = if l.on {
                format!("Turn off {}", l.name.replace(" LEDs", "").replace(" Light", ""))
            } else {
                format!("Turn on {}", l.name.replace(" LEDs", "").replace(" Light", ""))
            };
            items.push((format!("light-{}", l.id), title, "Light".into()));
        }
        for scene in ["Cozy", "Movie", "Night", "Bright", "Gaming"] {
            items.push((format!("scene-{scene}"), format!("{scene} scene"), "Scene".into()));
        }
        for r in &self.routines {
            items.push((format!("routine-{}", r.id), r.name.clone(), "Routine".into()));
        }
        items.push(("undo".into(), "Undo last action".into(), "Undo".into()));
        for (kind, label, _) in gallery_kinds() {
            if matches!(*kind, "weather" | "lights" | "media" | "activity" | "timers" | "system") {
                items.push((format!("add-{kind}"), format!("Add {label} widget"), "Widget".into()));
            }
        }
        items.push(("page-0".into(), "Go to page 1".into(), "Nav".into()));
        items.push(("creator".into(), "Open Widget Creator".into(), "Widget".into()));
        if n.is_empty() {
            items.truncate(8);
            return items;
        }
        items
            .into_iter()
            .filter(|(id, title, hint)| {
                title.to_lowercase().contains(&n) || hint.to_lowercase().contains(&n) || id.contains(&n)
            })
            .collect()
    }

    pub fn run_palette_hit(&mut self, id: &str) {
        if id == "ask" {
            let q = self.palette_query.clone();
            self.palette_reply = self.run_command(&q);
            return;
        }
        if let Some(light_id) = id.strip_prefix("light-") {
            self.toggle_light(light_id);
            self.overlay = Overlay::None;
            return;
        }
        if let Some(scene) = id.strip_prefix("scene-") {
            self.set_scene(scene);
            self.overlay = Overlay::None;
            return;
        }
        if let Some(rid) = id.strip_prefix("routine-") {
            self.run_routine(rid);
            self.overlay = Overlay::None;
            return;
        }
        if let Some(kind) = id.strip_prefix("add-") {
            let _ = self.add_widget(kind, "1x1");
            self.overlay = Overlay::None;
            return;
        }
        if id == "page-0" {
            self.page = 0;
            self.overlay = Overlay::None;
            return;
        }
        if id == "creator" {
            self.overlay = Overlay::Creator;
            self.apply_template();
            return;
        }
        if id == "undo" {
            self.palette_reply = "Nothing to undo.".into();
        }
    }

    pub fn add_widget(&mut self, kind: &str, size: &str) -> Result<(), String> {
        self.add_widget_on(kind, size, self.page, "")
    }

    fn add_widget_on(&mut self, kind: &str, size: &str, page: i32, custom_id: &str) -> Result<(), String> {
        let sizes = if kind == "custom" {
            &["1x1", "1x2", "2x2"][..]
        } else {
            supported_sizes(kind)
        };
        let size = if sizes.contains(&size) { size } else { sizes[0] };
        let Some((col, row, page)) = first_free(&self.slots, size, page) else {
            return Err("No space on this page".into());
        };
        let id = format!("{kind}-{}", self.slots.len() + 1);
        let label = if kind == "custom" {
            self.custom
                .iter()
                .find(|c| c.id == custom_id)
                .map(|c| c.name.clone())
                .unwrap_or_else(|| "Custom".into())
        } else {
            String::new()
        };
        self.slots.push(Slot {
            id,
            kind: kind.into(),
            size: size.into(),
            col,
            row,
            page,
            label,
            custom_id: custom_id.into(),
        });
        self.page = page;
        self.overlay = Overlay::None;
        self.persist();
        Ok(())
    }

    pub fn request_remove(&mut self, id: &str) {
        self.pending_remove = id.into();
    }

    pub fn confirm_remove(&mut self) {
        let id = std::mem::take(&mut self.pending_remove);
        if !id.is_empty() {
            self.slots.retain(|s| s.id != id);
            self.persist();
        }
    }

    pub fn cancel_remove(&mut self) {
        self.pending_remove.clear();
    }

    pub fn remove_slot(&mut self, id: &str) {
        self.request_remove(id);
    }

    pub fn cycle_slot_size(&mut self, id: &str) {
        let Some(idx) = self.slots.iter().position(|s| s.id == id) else {
            return;
        };
        let kind = self.slots[idx].kind.clone();
        let custom_id = self.slots[idx].custom_id.clone();
        let current = self.slots[idx].size.clone();
        let sizes: Vec<String> = if kind == "custom" {
            self.custom
                .iter()
                .find(|c| c.id == custom_id)
                .map(|c| {
                    if c.sizes.is_empty() {
                        vec!["1x1".into(), "1x2".into(), "2x2".into()]
                    } else {
                        c.sizes.clone()
                    }
                })
                .unwrap_or_else(|| vec!["1x1".into(), "1x2".into(), "2x2".into()])
        } else {
            supported_sizes(&kind).iter().map(|s| (*s).to_string()).collect()
        };
        if sizes.len() <= 1 {
            return;
        }
        let i = sizes.iter().position(|s| *s == current).unwrap_or(0);
        let next = sizes[(i + 1) % sizes.len()].clone();
        let page = self.slots[idx].page;
        let col = self.slots[idx].col;
        let row = self.slots[idx].row;
        if can_place(&self.slots, &next, page, col, row, Some(id)) {
            self.slots[idx].size = next;
            self.persist();
            return;
        }
        let others: Vec<Slot> = self.slots.iter().filter(|s| s.id != id).cloned().collect();
        if let Some((c, r)) = first_free_on_page(&others, &next, page) {
            self.slots[idx].size = next;
            self.slots[idx].col = c;
            self.slots[idx].row = r;
            self.persist();
        }
    }

    pub fn place_slot(&mut self, id: &str, col: i32, row: i32) {
        let Some(idx) = self.slots.iter().position(|s| s.id == id) else {
            return;
        };
        let size = self.slots[idx].size.clone();
        let page = self.slots[idx].page;
        let (w, h) = size_dims(&size);
        let col = col.clamp(0, GRID_COLS - w);
        let row = row.clamp(0, GRID_ROWS - h);
        if can_place(&self.slots, &size, page, col, row, Some(id)) {
            self.slots[idx].col = col;
            self.slots[idx].row = row;
            self.persist();
            return;
        }
        let mut best = None;
        let mut best_d = i32::MAX;
        for r in 0..=GRID_ROWS - h {
            for c in 0..=GRID_COLS - w {
                if can_place(&self.slots, &size, page, c, r, Some(id)) {
                    let d = (c - col).abs() + (r - row).abs();
                    if d < best_d {
                        best_d = d;
                        best = Some((c, r));
                    }
                }
            }
        }
        if let Some((c, r)) = best {
            self.slots[idx].col = c;
            self.slots[idx].row = r;
            self.persist();
        }
    }

    pub fn apply_template(&mut self) {
        self.creator_nodes = template_nodes(&self.creator_template, &self.creator_size);
        self.creator_selected = self.creator_nodes.first().map(|n| n.id.clone()).unwrap_or_default();
    }

    pub fn add_creator_kind(&mut self, kind: &str) {
        let kind = match kind {
            "label" => "text",
            "value" => "metric",
            "graph" => "chart",
            "status" => "chip",
            "image" => "box",
            "control" => "toggle",
            other => other,
        };
        let id = format!("{kind}-{}", self.creator_nodes.len() + 1);
        self.creator_nodes.push(SlopNode {
            id: id.clone(),
            kind: kind.into(),
            x: 8.0,
            y: 8.0 + (self.creator_nodes.len() as f32 * 8.0).min(60.0),
            w: if kind == "metric" { 50.0 } else { 40.0 },
            h: if kind == "metric" { 22.0 } else { 14.0 },
            text: match kind {
                "metric" => "42".into(),
                "button" => "Action".into(),
                "chip" => "Chip".into(),
                "toggle" => "On".into(),
                _ => kind.to_uppercase(),
            },
            color: if kind == "metric" { "#f4f5f7".into() } else { "#8b909d".into() },
            value: 0.5,
        });
        self.creator_selected = id;
    }

    pub fn select_creator_node(&mut self, id: &str) {
        self.creator_selected = id.into();
    }

    pub fn set_creator_node_text(&mut self, text: &str) {
        if let Some(n) = self.creator_nodes.iter_mut().find(|n| n.id == self.creator_selected) {
            n.text = text.into();
        }
    }

    pub fn delete_creator_node(&mut self) {
        let id = self.creator_selected.clone();
        self.creator_nodes.retain(|n| n.id != id);
        self.creator_selected = self.creator_nodes.first().map(|n| n.id.clone()).unwrap_or_default();
    }

    pub fn save_creator(&mut self) -> Result<(), String> {
        let mut name = self.creator_name.trim().to_string();
        if name.is_empty() {
            name = "Untitled".into();
        }
        let size = if ["1x1", "1x2", "2x2"].contains(&self.creator_size.as_str()) {
            self.creator_size.clone()
        } else {
            "1x1".into()
        };
        let page = self.page;
        let template = self.creator_template.clone();
        let nodes = self.creator_nodes.clone();
        let id = format!("slop-{}", chrono::Local::now().timestamp_millis());
        let mut layouts = std::collections::BTreeMap::new();
        layouts.insert(size.clone(), nodes);
        if size != "1x1" {
            layouts.entry("1x1".into()).or_insert_with(|| template_nodes(&template, "1x1"));
        }
        self.custom.push(CustomWidget {
            id: id.clone(),
            name,
            sizes: vec!["1x1".into(), "1x2".into(), "2x2".into()],
            layouts,
        });
        self.add_widget_on("custom", &size, page, &id)?;
        self.edit_mode = true;
        self.persist();
        Ok(())
    }

    pub fn cycle_gallery_size(&mut self, dir: i32) {
        let sizes = if self.gallery_kind == "custom" {
            &["1x1", "1x2", "2x2"][..]
        } else {
            supported_sizes(&self.gallery_kind)
        };
        if sizes.is_empty() {
            return;
        }
        let i = sizes
            .iter()
            .position(|s| *s == self.gallery_size)
            .unwrap_or(0) as i32;
        let n = sizes.len() as i32;
        let next = (i + dir).rem_euclid(n) as usize;
        self.gallery_size = sizes[next].to_string();
    }

    pub fn gallery_add_selected(&mut self) -> Result<(), String> {
        if self.gallery_kind == "custom" {
            let id = self.gallery_custom_id.clone();
            self.add_widget_on("custom", &self.gallery_size.clone(), self.page, &id)
        } else {
            let kind = self.gallery_kind.clone();
            let size = self.gallery_size.clone();
            self.add_widget(&kind, &size)
        }
    }

    pub fn filtered_gallery(&self) -> Vec<(String, String, bool, String)> {
        let q = self.gallery_query.trim().to_lowercase();
        let mut out = Vec::new();
        for (k, label, _) in gallery_kinds() {
            if q.is_empty() || label.to_lowercase().contains(&q) || k.contains(&q) {
                out.push(((*k).into(), (*label).into(), false, String::new()));
            }
        }
        for c in &self.custom {
            if q.is_empty() || c.name.to_lowercase().contains(&q) {
                out.push(("custom".into(), c.name.clone(), true, c.id.clone()));
            }
        }
        out
    }

    pub fn import_json_files(&mut self) {
        for dir in [data_dir().join("import"), data_dir().join("widgets")] {
            let Ok(entries) = std::fs::read_dir(dir) else { continue };
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) != Some("json") {
                    continue;
                }
                self.import_widget_file(&path);
            }
        }
    }

    fn import_widget_file(&mut self, path: &Path) {
        let Ok(text) = std::fs::read_to_string(path) else { return };
        let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) else { return };
        let name = v
            .get("name")
            .and_then(|x| x.as_str())
            .unwrap_or("Imported")
            .to_string();
        let id = v
            .get("id")
            .and_then(|x| x.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("import-{}", path.file_stem().and_then(|s| s.to_str()).unwrap_or("w")));
        if self.custom.iter().any(|c| c.id == id) {
            return;
        }
        let mut layouts = std::collections::BTreeMap::new();
        if let Some(obj) = v.get("layouts").and_then(|x| x.as_object()) {
            for (size, nodes) in obj {
                if let Ok(parsed) = serde_json::from_value::<Vec<SlopNode>>(nodes.clone()) {
                    layouts.insert(size.clone(), parsed);
                }
            }
        }
        if layouts.is_empty() {
            layouts.insert("1x1".into(), template_nodes("stat", "1x1"));
        }
        self.custom.push(CustomWidget {
            id,
            name,
            sizes: layouts.keys().cloned().collect(),
            layouts,
        });
        self.persist();
    }

    pub fn home_slop_nodes(&self) -> Vec<(String, SlopNode)> {
        let mut out = Vec::new();
        for s in &self.slots {
            if s.kind != "custom" {
                continue;
            }
            if let Some(def) = self.custom.iter().find(|c| c.id == s.custom_id) {
                let nodes = def
                    .layouts
                    .get(&s.size)
                    .or_else(|| def.layouts.values().next())
                    .cloned()
                    .unwrap_or_default();
                for n in nodes {
                    out.push((s.id.clone(), n));
                }
            }
        }
        out
    }

    pub fn node_rgb(node: &SlopNode) -> (i32, i32, i32) {
        parse_hex(&node.color)
    }

    pub fn selected_creator_text(&self) -> String {
        self.creator_nodes
            .iter()
            .find(|n| n.id == self.creator_selected)
            .map(|n| n.text.clone())
            .unwrap_or_default()
    }

    pub fn selected_creator_kind_label(&self) -> String {
        let kind = self
            .creator_nodes
            .iter()
            .find(|n| n.id == self.creator_selected)
            .map(|n| n.kind.as_str())
            .unwrap_or("");
        creator_kind_label(kind).into()
    }

    pub fn run_routine(&mut self, id: &str) {
        let Some(r) = self.routines.iter().find(|r| r.id == id).cloned() else {
            return;
        };
        if r.builtin {
            self.quick(&r.id);
            return;
        }
        if !r.command.is_empty() {
            let reply = self.run_command(&r.command);
            self.palette_reply = reply;
            self.push("Routine", &r.name);
        }
    }

    pub fn add_routine(&mut self, name: &str, phrase: &str, command: &str) {
        let phrase = phrase.trim();
        let command = command.trim();
        if phrase.is_empty() || command.is_empty() {
            return;
        }
        let name = name.trim();
        let name = if name.is_empty() { phrase } else { name };
        let id = format!("r-{}", chrono::Local::now().timestamp_millis());
        self.routines.push(Routine {
            id,
            name: name.into(),
            phrases: vec![phrase.to_lowercase()],
            builtin: false,
            command: command.into(),
        });
        self.persist();
    }

    pub fn remove_routine(&mut self, id: &str) {
        self.routines.retain(|r| r.builtin || r.id != id);
        self.persist();
    }

    pub fn gallery_preview_nodes(&self) -> Vec<(String, SlopNode)> {
        if self.gallery_kind != "custom" {
            return Vec::new();
        }
        let Some(def) = self.custom.iter().find(|c| c.id == self.gallery_custom_id) else {
            return Vec::new();
        };
        let nodes = def
            .layouts
            .get(&self.gallery_size)
            .or_else(|| def.layouts.values().next())
            .cloned()
            .unwrap_or_default();
        nodes
            .into_iter()
            .map(|n| (self.gallery_custom_id.clone(), n))
            .collect()
    }
}

pub static ROOM: Mutex<Option<Room>> = Mutex::new(None);

pub fn with<R>(f: impl FnOnce(&mut Room) -> R) -> R {
    let mut g = ROOM.lock().expect("room");
    if g.is_none() {
        *g = Some(Room::default());
    }
    f(g.as_mut().unwrap())
}
