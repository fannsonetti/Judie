import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useRoomStore } from "../../store/roomStore";
import { useAssistantStore } from "../../store/assistantStore";
import { formatClock, formatDateLong } from "../../lib/time";
import { usePerformanceStore } from "../../lib/performance";

const STATUS_LABEL: Record<string, string> = {
  idle: "",
  listening: "Listening",
  thinking: "Thinking",
  executing: "Working",
  speaking: "Speaking",
  error: "Error",
};

export function StatusBar() {
  const [now, setNow] = useState(() => new Date());
  const server = useRoomStore((s) => s.server);
  const dnd = useRoomStore((s) => s.doNotDisturb);
  const setServerStatus = useRoomStore((s) => s.setServerStatus);
  const setServices = useRoomStore((s) => s.setServices);
  const status = useAssistantStore((s) => s.status);
  const reduced = usePerformanceStore((s) => s.reduced);
  const pointer = useRef<{ y: number; x: number } | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      try {
        const t0 = performance.now();
        const result = await invoke<{
          serverOnline: boolean;
          latency: number;
          assistantOnline?: boolean;
        }>("get_system_status");
        const latency = Math.max(1, Math.round(performance.now() - t0));
        if (cancelled) return;
        setServerStatus(result.serverOnline, result.latency || latency);
        const current = useRoomStore.getState().server.services;
        setServices(
          current.map((svc) => {
            if (svc.name === "Core") return { ...svc, online: result.serverOnline, latency };
            if (svc.name === "Assistant") {
              return {
                ...svc,
                online: !!result.assistantOnline,
                latency: result.assistantOnline ? latency : 0,
              };
            }
            return svc;
          })
        );
      } catch {
        // Vite-only: keep local defaults
      }
    };
    void ping();
    const id = window.setInterval(() => void ping(), reduced ? 45_000 : 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [setServerStatus, setServices, reduced]);

  const openCenter = () => useAssistantStore.getState().setPaletteOpen(true);

  const onPointerDown = (e: React.PointerEvent) => {
    pointer.current = { y: e.clientY, x: e.clientX };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const start = pointer.current;
    pointer.current = null;
    if (!start) return;
    const dy = e.clientY - start.y;
    const dx = Math.abs(e.clientX - start.x);
    if (dy > 36 && dy > dx * 1.2) openCenter();
  };

  const statusLabel = STATUS_LABEL[status];

  return (
    <header
      className="status-bar"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        pointer.current = null;
      }}
    >
      <div className="status-left">
        <span className={`judie-orb ${status}`} aria-hidden />
        {statusLabel && <span className="status-state">{statusLabel}</span>}
        {dnd && <span className="status-dnd">DND</span>}
      </div>
      <div className="status-center">
        <div className="status-time">{formatClock(now)}</div>
        <div className="status-date">{formatDateLong(now)}</div>
      </div>
      <div className="status-right">
        <span className={`status-dot ${server.online ? "" : "offline"}`} />
      </div>
    </header>
  );
}
