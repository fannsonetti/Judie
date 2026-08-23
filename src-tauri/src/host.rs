use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use sysinfo::{
    Components, CpuRefreshKind, MemoryRefreshKind, ProcessRefreshKind, ProcessesToUpdate,
    RefreshKind, System,
};

const HISTORY: usize = 32;
const TOP_N: usize = 8;

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

struct HostState {
    sys: System,
    primed: bool,
    last: Instant,
    cpu_history: Vec<f32>,
    memory_history: Vec<f32>,
}

impl HostState {
    fn new() -> Self {
        let mut sys = System::new_with_specifics(
            RefreshKind::nothing()
                .with_cpu(CpuRefreshKind::everything())
                .with_memory(MemoryRefreshKind::everything())
                .with_processes(ProcessRefreshKind::everything()),
        );
        sys.refresh_cpu_all();
        sys.refresh_memory();
        Self {
            sys,
            primed: false,
            last: Instant::now(),
            cpu_history: Vec::with_capacity(HISTORY),
            memory_history: Vec::with_capacity(HISTORY),
        }
    }
}

static HOST: Mutex<Option<HostState>> = Mutex::new(None);

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
    best
}

pub fn snapshot() -> HostStats {
    let mut slot = HOST.lock().unwrap_or_else(|e| e.into_inner());
    let state = slot.get_or_insert_with(HostState::new);

    if !state.primed {
        std::thread::sleep(Duration::from_millis(140));
        state.primed = true;
    } else if state.last.elapsed() < Duration::from_millis(400) {
        // Reuse last sample if the UI polls faster than a useful CPU delta.
    }
    state.last = Instant::now();

    state.sys.refresh_cpu_all();
    state.sys.refresh_memory();
    state
        .sys
        .refresh_processes(ProcessesToUpdate::All, true);

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
        temperature: cpu_temp(),
        cpu_history: state.cpu_history.clone(),
        memory_history: state.memory_history.clone(),
        top,
    }
}
