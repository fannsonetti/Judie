//! Arcade page: Tetris and Snake (Pong lives in judie-pi.rs), plus Xbox
//! controller input from the Linux joystick API (/dev/input/js0, js1).

use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, AtomicI32, AtomicU8, Ordering};
use std::sync::Mutex;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Btn {
    Left,
    Right,
    Up,
    Down,
    A,
    B,
    Start,
}

impl Btn {
    /// Matches the `arcade-key(int)` codes in main.slint.
    pub fn from_code(c: i32) -> Option<Btn> {
        Some(match c {
            0 => Btn::Left,
            1 => Btn::Right,
            2 => Btn::Up,
            3 => Btn::Down,
            4 => Btn::A,
            5 => Btn::B,
            6 => Btn::Start,
            _ => return None,
        })
    }
}

/// One filled cell for the board model: colour index 1–7 pieces, 8 body, 9 head, 10 food.
pub type Cell = (i32, i32, i32);

struct Rng(u32);

impl Rng {
    fn next(&mut self) -> u32 {
        // xorshift32
        let mut x = self.0.max(1);
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.0 = x;
        x
    }
}

fn seed() -> u32 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.subsec_nanos() | 1)
        .unwrap_or(1)
}

// ---------------------------------------------------------------- Tetris

pub const T_COLS: i32 = 10;
pub const T_ROWS: i32 = 20;

/// 4x4 bitmasks, bit 15 = top-left; four rotations per piece (I J L O S T Z).
const PIECES: [[u16; 4]; 7] = [
    [0x0F00, 0x2222, 0x00F0, 0x4444],
    [0x44C0, 0x8E00, 0x6440, 0x0E20],
    [0x4460, 0x0E80, 0xC440, 0x2E00],
    [0xCC00, 0xCC00, 0xCC00, 0xCC00],
    [0x06C0, 0x8C40, 0x6C00, 0x4620],
    [0x0E40, 0x4C40, 0x4E00, 0x4640],
    [0x0C60, 0x4C80, 0xC600, 0x2640],
];

fn piece_cells(p: usize, rot: usize) -> impl Iterator<Item = (i32, i32)> {
    let m = PIECES[p][rot % 4];
    (0..16).filter(move |b| m & (0x8000 >> b) != 0).map(|b| (b % 4, b / 4))
}

pub struct Tetris {
    board: [[u8; T_COLS as usize]; T_ROWS as usize],
    piece: usize,
    next: usize,
    rot: usize,
    x: i32,
    y: i32,
    pub score: i32,
    pub lines: i32,
    pub running: bool,
    pub over: bool,
    fall: u32,
    rng: Rng,
}

impl Tetris {
    pub const fn new() -> Self {
        Self {
            board: [[0; T_COLS as usize]; T_ROWS as usize],
            piece: 0,
            next: 5,
            rot: 0,
            x: 3,
            y: 0,
            score: 0,
            lines: 0,
            running: false,
            over: false,
            fall: 0,
            rng: Rng(1),
        }
    }

    pub fn start(&mut self) {
        *self = Self::new();
        self.rng = Rng(seed());
        self.next = (self.rng.next() % 7) as usize;
        self.spawn();
        self.running = true;
    }

    fn fits(&self, rot: usize, x: i32, y: i32) -> bool {
        piece_cells(self.piece, rot).all(|(cx, cy)| {
            let (bx, by) = (x + cx, y + cy);
            (0..T_COLS).contains(&bx) && (0..T_ROWS).contains(&by) && self.board[by as usize][bx as usize] == 0
        })
    }

    fn spawn(&mut self) {
        self.piece = self.next;
        self.next = (self.rng.next() % 7) as usize;
        self.rot = 0;
        self.x = 3;
        self.y = 0;
        if !self.fits(0, 3, 0) {
            self.over = true;
            self.running = false;
        }
    }

    /// Lock the piece, clear rows, spawn the next one. Returns rows cleared.
    fn lock(&mut self) -> usize {
        for (cx, cy) in piece_cells(self.piece, self.rot) {
            self.board[(self.y + cy) as usize][(self.x + cx) as usize] = self.piece as u8 + 1;
        }
        let kept: Vec<_> = self.board.iter().copied().filter(|r| r.contains(&0)).collect();
        let cleared = T_ROWS as usize - kept.len();
        let mut board = [[0; T_COLS as usize]; T_ROWS as usize];
        board[cleared..].copy_from_slice(&kept);
        self.board = board;
        self.score += [0, 100, 300, 500, 800][cleared] * (self.lines / 10 + 1);
        self.lines += cleared as i32;
        self.spawn();
        cleared
    }

    /// Moves down one row; locks if it can't. Returns Some(rows cleared) on lock.
    fn drop1(&mut self) -> Option<usize> {
        if self.fits(self.rot, self.x, self.y + 1) {
            self.y += 1;
            None
        } else {
            Some(self.lock())
        }
    }

    pub fn press(&mut self, b: Btn, beep: &dyn Fn(u32, u32)) {
        if !self.running {
            if b == Btn::Start || b == Btn::A {
                self.start();
                beep(660, 100);
            }
            return;
        }
        match b {
            Btn::Left if self.fits(self.rot, self.x - 1, self.y) => self.x -= 1,
            Btn::Right if self.fits(self.rot, self.x + 1, self.y) => self.x += 1,
            Btn::Up | Btn::A => {
                // Rotate, with a one-cell wall kick either way.
                let r = (self.rot + 1) % 4;
                if let Some(dx) = [0, -1, 1, -2, 2].into_iter().find(|dx| self.fits(r, self.x + dx, self.y)) {
                    self.rot = r;
                    self.x += dx;
                    beep(700, 30);
                }
            }
            Btn::Down => {
                self.score += 1;
                let lock = self.drop1();
                self.landed(lock, beep);
            }
            Btn::B => {
                let mut n = 0;
                let cleared = loop {
                    n += 1;
                    if let Some(c) = self.drop1() {
                        break c;
                    }
                };
                self.score += 2 * n;
                self.landed(Some(cleared), beep);
            }
            Btn::Start => self.start(),
            _ => {}
        }
    }

    fn landed(&self, lock: Option<usize>, beep: &dyn Fn(u32, u32)) {
        match lock {
            Some(0) => beep(300, 40),
            Some(_) => beep(990, 140),
            None => {}
        }
        if self.over {
            beep(160, 400);
        }
    }

    /// One 16 ms frame.
    pub fn step(&mut self, beep: &dyn Fn(u32, u32)) -> bool {
        if !self.running {
            return false;
        }
        self.fall += 1;
        let frames = (48 - self.lines / 10 * 5).max(6) as u32;
        if self.fall < frames {
            return false;
        }
        self.fall = 0;
        let lock = self.drop1();
        self.landed(lock, beep);
        true
    }

    pub fn cells(&self) -> Vec<Cell> {
        let mut out: Vec<Cell> = (0..T_ROWS)
            .flat_map(|y| (0..T_COLS).map(move |x| (x, y)))
            .filter_map(|(x, y)| match self.board[y as usize][x as usize] {
                0 => None,
                c => Some((x, y, c as i32)),
            })
            .collect();
        if self.running {
            out.extend(piece_cells(self.piece, self.rot).map(|(cx, cy)| (self.x + cx, self.y + cy, self.piece as i32 + 1)));
        }
        out
    }

    pub fn next_cells(&self) -> Vec<Cell> {
        piece_cells(self.next, 0).map(|(x, y)| (x, y, self.next as i32 + 1)).collect()
    }
}

// ---------------------------------------------------------------- Snake

pub const S_COLS: i32 = 22;
pub const S_ROWS: i32 = 14;

pub struct Snake {
    body: VecDeque<(i32, i32)>,
    dir: (i32, i32),
    want: (i32, i32),
    food: (i32, i32),
    pub score: i32,
    pub running: bool,
    pub over: bool,
    tick: u32,
    rng: Rng,
}

impl Snake {
    pub const fn new() -> Self {
        Self {
            body: VecDeque::new(),
            dir: (1, 0),
            want: (1, 0),
            food: (15, 7),
            score: 0,
            running: false,
            over: false,
            tick: 0,
            rng: Rng(1),
        }
    }

    pub fn start(&mut self) {
        *self = Self::new();
        self.rng = Rng(seed());
        self.body.extend([(6, 7), (5, 7), (4, 7)]);
        self.place_food();
        self.running = true;
    }

    fn place_food(&mut self) {
        loop {
            let f = ((self.rng.next() % S_COLS as u32) as i32, (self.rng.next() % S_ROWS as u32) as i32);
            if !self.body.contains(&f) {
                self.food = f;
                return;
            }
        }
    }

    pub fn press(&mut self, b: Btn, beep: &dyn Fn(u32, u32)) {
        if !self.running {
            if b == Btn::Start || b == Btn::A {
                self.start();
                beep(660, 100);
            }
            return;
        }
        let d = match b {
            Btn::Left => (-1, 0),
            Btn::Right => (1, 0),
            Btn::Up => (0, -1),
            Btn::Down => (0, 1),
            Btn::Start => return self.start(),
            _ => return,
        };
        // No reversing into yourself.
        if d != (-self.dir.0, -self.dir.1) {
            self.want = d;
        }
    }

    pub fn step(&mut self, beep: &dyn Fn(u32, u32)) -> bool {
        if !self.running {
            return false;
        }
        self.tick += 1;
        // ponytail: fixed ~110 ms pace; speed up with length if it gets boring.
        if self.tick < 7 {
            return false;
        }
        self.tick = 0;
        self.dir = self.want;
        let (hx, hy) = self.body[0];
        let head = (hx + self.dir.0, hy + self.dir.1);
        let eat = head == self.food;
        if !eat {
            self.body.pop_back();
        }
        let wall = !(0..S_COLS).contains(&head.0) || !(0..S_ROWS).contains(&head.1);
        if wall || self.body.contains(&head) {
            self.running = false;
            self.over = true;
            beep(160, 400);
            return true;
        }
        self.body.push_front(head);
        if eat {
            self.score += 10;
            beep(880, 60);
            self.place_food();
        }
        true
    }

    pub fn cells(&self) -> Vec<Cell> {
        let mut out: Vec<Cell> = self.body.iter().enumerate().map(|(i, &(x, y))| (x, y, if i == 0 { 9 } else { 8 })).collect();
        if !out.is_empty() {
            out.push((self.food.0, self.food.1, 10));
        }
        out
    }
}

// ---------------------------------------------------------------- Pads

/// Button presses from the pads, drained by the arcade frame timer.
pub static PAD_QUEUE: Mutex<Vec<(usize, Btn)>> = Mutex::new(Vec::new());
/// Latest vertical stick / d-pad value per pad, -32767..32767 (Pong paddles).
pub static PAD_Y: [AtomicI32; 2] = [AtomicI32::new(0), AtomicI32::new(0)];
/// Held directions per pad (bit = Btn as u8) for auto-repeat.
pub static PAD_HELD: [AtomicU8; 2] = [AtomicU8::new(0), AtomicU8::new(0)];
pub static PAD_ON: [AtomicBool; 2] = [AtomicBool::new(false), AtomicBool::new(false)];

const STICK: i16 = 16000;

/// Joystick-API button number → Btn. xpad (USB / xpadneo) puts Start at 7;
/// the generic Bluetooth HID driver puts it at 11 (and X/Y at 3/4).
// ponytail: fixed table; read the evdev BTN_* codes if a pad maps oddly.
fn map_button(n: u8) -> Option<Btn> {
    match n {
        0 | 2 | 3 | 4 => Some(Btn::A),
        1 => Some(Btn::B),
        7 | 9 | 11 => Some(Btn::Start),
        _ => None,
    }
}

/// Reads one 8-byte `js_event` stream until the device goes away.
fn read_pad(i: usize, mut f: impl std::io::Read, on_input: fn()) {
    let mut ev = [0u8; 8];
    let mut axis_dir = [0i8; 8];
    while f.read_exact(&mut ev).is_ok() {
        let value = i16::from_le_bytes([ev[4], ev[5]]);
        let init = ev[6] & 0x80 != 0;
        let num = ev[7];
        let mut press = None;
        match ev[6] & 0x7f {
            1 if value == 1 && !init => press = map_button(num),
            2 if (num as usize) < axis_dir.len() => {
                // Axes 0/1 = left stick, 6/7 = d-pad, on both drivers.
                let vertical = match num {
                    0 | 6 => false,
                    1 | 7 => true,
                    _ => continue,
                };
                if vertical {
                    PAD_Y[i].store(value as i32, Ordering::Relaxed);
                }
                let dir = if value < -STICK { -1 } else if value > STICK { 1 } else { 0 };
                let prev = std::mem::replace(&mut axis_dir[num as usize], dir);
                let (neg, pos) = if vertical { (Btn::Up, Btn::Down) } else { (Btn::Left, Btn::Right) };
                let bits = (1u8 << neg as u8) | (1u8 << pos as u8);
                let held = match dir {
                    -1 => 1u8 << neg as u8,
                    1 => 1u8 << pos as u8,
                    _ => 0,
                };
                let old = PAD_HELD[i].load(Ordering::Relaxed);
                PAD_HELD[i].store((old & !bits) | held, Ordering::Relaxed);
                if dir != 0 && dir != prev && !init {
                    press = Some(if dir < 0 { neg } else { pos });
                }
            }
            _ => {}
        }
        if let Some(b) = press {
            PAD_QUEUE.lock().unwrap().push((i, b));
            on_input();
        }
    }
}

/// One reader thread per pad slot; reopens after unplug / Bluetooth drop.
#[cfg(target_os = "linux")]
pub fn start_pads(on_input: fn()) {
    for i in 0..2 {
        std::thread::spawn(move || loop {
            if let Ok(f) = std::fs::File::open(format!("/dev/input/js{i}")) {
                PAD_ON[i].store(true, Ordering::Relaxed);
                read_pad(i, f, on_input);
                PAD_ON[i].store(false, Ordering::Relaxed);
                PAD_HELD[i].store(0, Ordering::Relaxed);
                PAD_Y[i].store(0, Ordering::Relaxed);
            }
            std::thread::sleep(std::time::Duration::from_secs(2));
        });
    }
}

#[cfg(not(target_os = "linux"))]
pub fn start_pads(_on_input: fn()) {}

pub fn pad_status() -> String {
    match PAD_ON.iter().filter(|p| p.load(Ordering::Relaxed)).count() {
        0 => "No pad".into(),
        1 => "1 pad".into(),
        n => format!("{n} pads"),
    }
}

/// Scans for an Xbox controller in pairing mode, then pairs, trusts and connects it.
pub fn pair_xbox() -> Result<String, String> {
    use std::process::Command;
    let bt = |args: &[&str]| -> Result<String, String> {
        let out = Command::new("bluetoothctl").args(args).output().map_err(|_| "Bluetooth isn't installed.".to_string())?;
        Ok(String::from_utf8_lossy(&out.stdout).into_owned() + &String::from_utf8_lossy(&out.stderr))
    };
    bt(&["power", "on"])?;
    bt(&["--timeout", "20", "scan", "on"])?;
    let devices = bt(&["devices"])?;
    let mac = devices
        .lines()
        .filter(|l| l.to_lowercase().contains("xbox"))
        .filter_map(|l| l.split_whitespace().nth(1))
        .find(|m| m.len() == 17 && m.chars().all(|c| c.is_ascii_hexdigit() || c == ':'))
        .ok_or("No controller found. Hold its pair button until the logo flashes fast, then try again.")?
        .to_string();
    bt(&["--timeout", "15", "pair", &mac])?;
    bt(&["trust", &mac])?;
    let out = bt(&["--timeout", "10", "connect", &mac])?;
    if out.contains("Connection successful") || out.contains("AlreadyConnected") {
        Ok("Controller connected".into())
    } else {
        Err("Found the controller but it wouldn't connect. Try again.".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tetris_clears_full_row() {
        let mut t = Tetris::new();
        t.start();
        for x in 0..T_COLS as usize - 4 {
            t.board[19][x] = 1;
        }
        t.piece = 0; // I, flat, fills the last four columns
        t.rot = 0;
        t.x = T_COLS - 4;
        t.y = 0;
        t.press(Btn::B, &|_, _| {});
        assert_eq!(t.lines, 1);
        assert!(t.board[19].iter().all(|&c| c == 0));
    }

    #[test]
    fn snake_dies_on_wall_and_cannot_reverse() {
        let mut s = Snake::new();
        s.start();
        s.press(Btn::Left, &|_, _| {}); // reverse ignored
        for _ in 0..7 * S_COLS {
            s.step(&|_, _| {});
        }
        assert!(s.over);
    }

    #[test]
    fn pad_events_become_presses() {
        let ev = |v: i16, kind: u8, n: u8| {
            let mut e = [0u8; 8];
            e[4..6].copy_from_slice(&v.to_le_bytes());
            e[6] = kind;
            e[7] = n;
            e
        };
        let stream: Vec<u8> = [ev(1, 1, 0), ev(-32767, 2, 6), ev(0, 2, 6), ev(1, 1, 11), ev(1, 0x81, 0)].concat();
        PAD_QUEUE.lock().unwrap().clear();
        read_pad(1, &stream[..], || {});
        let q: Vec<_> = PAD_QUEUE.lock().unwrap().drain(..).map(|(_, b)| b).collect();
        assert_eq!(q, [Btn::A, Btn::Left, Btn::Start]);
    }
}
