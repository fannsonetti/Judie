import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { DEMO_HOST_STATS } from "./demoStats";

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
  swapHistory: number[];
  loadHistory: number[];
  tempHistory: number[];
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
  swapHistory: [],
  loadHistory: [],
  tempHistory: [],
  top: [],
};

const INTERVAL_MS = 2000;
const listeners = new Set<() => void>();
let cached: HostStats = EMPTY;
let available = false;
let timer: number | null = null;
let refs = 0;
let inflight = false;

function notify() {
  for (const fn of listeners) fn();
}

async function pull() {
  if (inflight) return;
  inflight = true;
  try {
    const next = await invoke<HostStats>("get_host_stats");
    cached = {
      ...EMPTY,
      ...next,
      cpuHistory: next.cpuHistory ?? [],
      memoryHistory: next.memoryHistory ?? [],
      swapHistory: next.swapHistory ?? [],
      loadHistory: next.loadHistory ?? [],
      tempHistory: next.tempHistory ?? [],
      top: next.top ?? [],
      cores: next.cores ?? [],
    };
    available = true;
    notify();
  } catch {
    available = false;
    notify();
  } finally {
    inflight = false;
  }
}

function retain() {
  refs += 1;
  if (timer != null) return;
  void pull();
  timer = window.setInterval(() => void pull(), INTERVAL_MS);
}

function release() {
  refs = Math.max(0, refs - 1);
  if (refs > 0 || timer == null) return;
  window.clearInterval(timer);
  timer = null;
}

/** One shared poller so every System widget shows the same numbers. */
export function useHostStats(demo = false) {
  const [, bump] = useState(0);

  useEffect(() => {
    if (demo) return;
    const onChange = () => bump((n) => n + 1);
    listeners.add(onChange);
    retain();
    return () => {
      listeners.delete(onChange);
      release();
    };
  }, [demo]);

  if (demo) return { stats: DEMO_HOST_STATS, available: true };
  return { stats: cached, available };
}

export function formatGb(mb: number): string {
  if (mb < 1024) return `${Math.round(mb)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}
