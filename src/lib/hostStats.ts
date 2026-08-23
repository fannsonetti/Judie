import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

export interface HostProcess {
  name: string;
  cpu: number;
  memoryMb: number;
  memoryPct: number;
}

export interface HostStats {
  cpu: number;
  memory: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  swap: number;
  swapUsedMb: number;
  swapTotalMb: number;
  cores: number[];
  load1: number;
  load5: number;
  load15: number;
  uptimeSec: number;
  processCount: number;
  temperature: number | null;
  cpuHistory: number[];
  memoryHistory: number[];
  top: HostProcess[];
}

const EMPTY: HostStats = {
  cpu: 0,
  memory: 0,
  memoryUsedMb: 0,
  memoryTotalMb: 0,
  swap: 0,
  swapUsedMb: 0,
  swapTotalMb: 0,
  cores: [],
  load1: 0,
  load5: 0,
  load15: 0,
  uptimeSec: 0,
  processCount: 0,
  temperature: null,
  cpuHistory: [],
  memoryHistory: [],
  top: [],
};

export function useHostStats(intervalMs = 2000) {
  const [stats, setStats] = useState<HostStats>(EMPTY);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      try {
        const next = await invoke<HostStats>("get_host_stats");
        if (!cancelled) {
          setStats(next);
          setAvailable(true);
        }
      } catch {
        if (!cancelled) setAvailable(false);
      }
    };
    void pull();
    const id = window.setInterval(() => void pull(), intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [intervalMs]);

  return { stats, available };
}

export function formatGb(mb: number): string {
  if (mb < 1024) return `${Math.round(mb)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

export function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
