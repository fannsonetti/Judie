use serde::Serialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use sysinfo::{
    CpuRefreshKind, MemoryRefreshKind, ProcessRefreshKind, ProcessesToUpdate, RefreshKind, System,
};

const HISTORY: usize = 32;
const TOP_N: usize = 8;
const SAMPLE_MS: u64 = 2000;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HostProcess {
    pub name: String,
    pub cpu: f32,
    pub memory_mb: f32,
    pub memory_pct: f32,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HostStats {
    pub cpu: f32,
    pub memory: f32,
    pub memory_used_mb: f32,
    pub memory_total_mb: f32,
    pub swap: f32,
    pub swap_used_mb: f32,
    pub swap_total_mb: f32,
    pub cores: Vec<f32>,
    pub load1: f32,
    pub load5: f32,
    pub load15: f32,
    pub uptime_sec: u64,
    pub process_count: u32,
    pub temperature: Option<f32>,
    pub cpu_history: Vec<f32>,
    pub memory_history: Vec<f32>,
    pub top: Vec<HostProcess>,
}

impl HostStats {
    fn empty() -> Self {
        Self {
            cpu: 0.0,
            memory: 0.0,
            memory_used_mb: 0.0,
            memory_total_mb: 0.0,
            swap: 0.0,
            swap_used_mb: 0.0,
            swap_total_mb: 0.0,
            cores: Vec::new(),
            load1: 0.0,
            load5: 0.0,
            load15: 0.0,
            uptime_sec: 0,
            process_count: 0,
            temperature: None,
            cpu_history: Vec::new(),
            memory_history: Vec::new(),
            top: Vec::new(),
        }
    }
}

struct HostState {
    sys: System,
    cpu_history: Vec<f32>,
    memory_history: Vec<f32>,
    ticks: u32,
    last_temp: Option<f32>,
    last_temp_at: Instant,
}

fn cpu_kind() -> CpuRefreshKind {
    CpuRefreshKind::nothing().with_cpu_usage()
}

fn mem_kind() -> MemoryRefreshKind {
    MemoryRefreshKind::nothing().with_ram().with_swap()
}

fn proc_kind() -> ProcessRefreshKind {
    ProcessRefreshKind::nothing().with_cpu().with_memory()
}

impl HostState {
    fn new() -> Self {
        let mut sys = System::new_with_specifics(
            RefreshKind::nothing()
                .with_cpu(cpu_kind())
                .with_memory(mem_kind())
                .with_processes(proc_kind()),
        );
        sys.refresh_cpu_specifics(cpu_kind());
        sys.refresh_memory_specifics(mem_kind());
        Self {
            sys,
            cpu_history: Vec::with_capacity(HISTORY),
            memory_history: Vec::with_capacity(HISTORY),
            ticks: 0,
            last_temp: None,
            last_temp_at: Instant::now()
                .checked_sub(Duration::from_secs(30))
                .unwrap_or_else(Instant::now),
        }
    }
}

static STARTED: AtomicBool = AtomicBool::new(false);
static LAST: Mutex<Option<HostStats>> = Mutex::new(None);

fn push_hist(buf: &mut Vec<f32>, value: f32) {
    if buf.len() >= HISTORY {
        buf.remove(0);
    }
    buf.push(value.clamp(0.0, 100.0));
}

fn clean_name(raw: &str) -> String {
    let base = raw
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or(raw)
        .trim()
        .trim_end_matches(".exe")
        .trim_end_matches(".EXE");
    if base.len() <= 22 {
        base.to_string()
    } else {
        format!("{}…", &base[..21])
    }
}

fn skip_process(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "" | "idle"
            | "system idle process"
            | "system"
            | "swapper"
            | "[kthreadd]"
    )
}

fn cpu_temp() -> Option<f32> {
    #[cfg(target_os = "linux")]
    {
        if let Ok(raw) = std::fs::read_to_string("/sys/class/thermal/thermal_zone0/temp") {
            if let Ok(n) = raw.trim().parse::<f32>() {
                let t = if n > 200.0 { n / 1000.0 } else { n };
                if t > 0.0 && t < 120.0 {
                    return Some(t);
                }
            }
        }
    }

    #[cfg(not(target_os = "linux"))]
    {
        use sysinfo::Components;
        let mut components = Components::new();
        components.refresh(true);
        let mut best: Option<f32> = None;
        for c in components.iter() {
            let label = c.label().to_ascii_lowercase();
            let Some(t) = c.temperature() else { continue };
            if t <= 0.0 || t > 120.0 {
                continue;
            }
            let prefer = label.contains("cpu")
                || label.contains("package")
                || label.contains("tdie")
                || label.contains("soc")
                || label.contains("thermal");
            if prefer {
                return Some(t);
            }
            if best.map(|b| t > b).unwrap_or(true) {
                best = Some(t);
            }
        }
        return best;
    }

    #[cfg(target_os = "linux")]
    None
}

fn sample(state: &mut HostState) -> HostStats {
    state.sys.refresh_cpu_specifics(cpu_kind());
    state.sys.refresh_memory_specifics(mem_kind());

    // Process list is the expensive part — every other tick is enough for the UI.
    if state.ticks % 2 == 0 {
        state
            .sys
            .refresh_processes_specifics(ProcessesToUpdate::All, true, proc_kind());
    }
    state.ticks = state.ticks.wrapping_add(1);

    let cpu = state.sys.global_cpu_usage().clamp(0.0, 100.0);
    let total_mem = state.sys.total_memory().max(1);
    let used_mem = state.sys.used_memory();
    let memory = (used_mem as f64 / total_mem as f64 * 100.0) as f32;
    let swap_total = state.sys.total_swap();
    let swap_used = state.sys.used_swap();
    let swap = if swap_total == 0 {
        0.0
    } else {
        (swap_used as f64 / swap_total as f64 * 100.0) as f32
    };

    push_hist(&mut state.cpu_history, cpu);
    push_hist(&mut state.memory_history, memory);

    let ncpus = state.sys.cpus().len().max(1) as f32;
    let cores: Vec<f32> = state
        .sys
        .cpus()
        .iter()
        .map(|c| c.cpu_usage().clamp(0.0, 100.0))
        .collect();

    let mut grouped: HashMap<String, (f32, u64)> = HashMap::new();
    let mut process_count = 0u32;
    for proc in state.sys.processes().values() {
        process_count += 1;
        let name = clean_name(&proc.name().to_string_lossy());
        if skip_process(&name) {
            continue;
        }
        let cpu_pct = (proc.cpu_usage() / ncpus).clamp(0.0, 100.0);
        let mem = proc.memory();
        let entry = grouped.entry(name).or_insert((0.0, 0));
        entry.0 += cpu_pct;
        entry.1 += mem;
    }

    let mut top: Vec<HostProcess> = grouped
        .into_iter()
        .map(|(name, (cpu, memory))| HostProcess {
            name,
            cpu: cpu.clamp(0.0, 100.0),
            memory_mb: memory as f32 / (1024.0 * 1024.0),
            memory_pct: (memory as f64 / total_mem as f64 * 100.0) as f32,
        })
        .collect();
    top.sort_by(|a, b| b.cpu.partial_cmp(&a.cpu).unwrap_or(std::cmp::Ordering::Equal));
    top.truncate(TOP_N);

    if state.last_temp_at.elapsed() >= Duration::from_secs(4) {
        state.last_temp = cpu_temp();
        state.last_temp_at = Instant::now();
    }

    let load = System::load_average();

    HostStats {
        cpu,
        memory: memory.clamp(0.0, 100.0),
        memory_used_mb: used_mem as f32 / (1024.0 * 1024.0),
        memory_total_mb: total_mem as f32 / (1024.0 * 1024.0),
        swap: swap.clamp(0.0, 100.0),
        swap_used_mb: swap_used as f32 / (1024.0 * 1024.0),
        swap_total_mb: swap_total as f32 / (1024.0 * 1024.0),
        cores,
        load1: load.one as f32,
        load5: load.five as f32,
        load15: load.fifteen as f32,
        uptime_sec: System::uptime(),
        process_count,
        temperature: state.last_temp,
        cpu_history: state.cpu_history.clone(),
        memory_history: state.memory_history.clone(),
        top,
    }
}

/// Start the background sampler so UI invokes never sleep or walk /proc.
pub fn warm() {
    if STARTED.swap(true, Ordering::SeqCst) {
        return;
    }
    let _ = std::thread::Builder::new()
        .name("judie-host".into())
        .spawn(|| {
            let mut state = HostState::new();
            std::thread::sleep(Duration::from_millis(160));
            loop {
                let stats = sample(&mut state);
                if let Ok(mut slot) = LAST.lock() {
                    *slot = Some(stats);
                }
                std::thread::sleep(Duration::from_millis(SAMPLE_MS));
            }
        });
}

pub fn snapshot() -> HostStats {
    warm();
    LAST.lock()
        .ok()
        .and_then(|g| g.clone())
        .unwrap_or_else(HostStats::empty)
}
