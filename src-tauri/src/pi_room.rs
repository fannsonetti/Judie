//! Room state for the native Pi UI — same defaults as the web home screen.

use std::sync::Mutex;

#[derive(Clone)]
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
}

#[derive(Clone)]
pub struct TimerItem {
    pub label: String,
    pub remain: String,
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
    pub voice: bool,
    pub speak: bool,
    pub units_metric: bool,
    pub overlay: Overlay,
    pub settings_tab: i32,
    pub palette_query: String,
    pub palette_reply: String,
    pub edit_mode: bool,
    pub page: i32,
    pub activity: Vec<Activity>,
    pub timers: Vec<TimerItem>,
    pub expanded: Expanded,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Overlay {
    None,
    Settings,
    Palette,
    Gallery,
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
        Self {
            lights: vec![
                Light { id: "bed".into(), name: "Bed LEDs".into(), on: true, brightness: 72, color: "#FFB366".into() },
                Light { id: "sofa".into(), name: "Sofa LEDs".into(), on: true, brightness: 65, color: "#FFB366".into() },
                Light { id: "shelf".into(), name: "Shelf LEDs".into(), on: true, brightness: 55, color: "#FFC98A".into() },
                Light { id: "ceiling".into(), name: "Ceiling Light".into(), on: true, brightness: 80, color: "#FFF0E0".into() },
                Light { id: "desk".into(), name: "Desk Light".into(), on: false, brightness: 70, color: "#E8F0FF".into() },
            ],
            scene: "Cozy".into(),
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
            outdoor: 11,
            humidity: 42,
            weather_loc: "Hafnarfjörður".into(),
            weather_temp: 11,
            weather_cond: "Cloudy".into(),
            weather_high: 13,
            weather_low: 9,
            weather_feel: "Cool and damp".into(),
            weather_note: "Rain around 22:00".into(),
            hours: vec![
                Hour { hour: "20".into(), temp: 11, precip: 20 },
                Hour { hour: "21".into(), temp: 10, precip: 35 },
                Hour { hour: "22".into(), temp: 9, precip: 70 },
                Hour { hour: "23".into(), temp: 9, precip: 65 },
                Hour { hour: "00".into(), temp: 8, precip: 40 },
                Hour { hour: "01".into(), temp: 8, precip: 25 },
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
            purifier_filter: 38,
            room_name: "Room".into(),
            voice: true,
            speak: true,
            units_metric: true,
            overlay: Overlay::None,
            settings_tab: 0,
            palette_query: String::new(),
            palette_reply: String::new(),
            edit_mode: false,
            page: 0,
            activity: vec![
                Activity { title: "Judie started".into(), source: "system".into() },
                Activity { title: "Cozy scene".into(), source: "lights".into() },
            ],
            timers: vec![
                TimerItem { label: "Tea".into(), remain: "3:20".into() },
                TimerItem { label: "Laundry".into(), remain: "18:00".into() },
            ],
            expanded: Expanded::None,
        }
    }
}

impl Room {
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
            self.set_scene("Bright");
            self.dnd = false;
            return "Bright scene. DND off.".into();
        }
        if q.contains("dnd") || q.contains("do not disturb") {
            self.toggle_dnd();
            return if self.dnd { "Do not disturb on.".into() } else { "Do not disturb off.".into() };
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
        if q.contains("help") || q.contains("what can") {
            return "Try: lights off, movie mode, good night, play, weather, DND.".into();
        }
        format!("I heard “{}”. Try lights, weather, play, or good night.", raw.trim())
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
