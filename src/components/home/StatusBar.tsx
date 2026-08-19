import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useRoomStore } from "../../store/roomStore";
import { useAssistantStore } from "../../store/assistantStore";
import { useSettingsStore } from "../../store/settingsStore";
import { formatClock, formatDateLong } from "../../lib/time";

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
  const startListening = useAssistantStore((s) => s.startListening);
  const stopListening = useAssistantStore((s) => s.stopListening);
  const setSettingsOpen = useAssistantStore((s) => s.setSettingsOpen);
  const setPaletteOpen = useAssistantStore((s) => s.setPaletteOpen);
  const roomName = useSettingsStore((s) => s.roomName);

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
    const id = window.setInterval(() => void ping(), 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [setServerStatus, setServices]);

  const listening = status === "listening";
  const statusLabel = STATUS_LABEL[status];

  return (
    <header className="status-bar">
      <div className="status-left">
        <button
          type="button"
          className={`status-brand ${listening ? "listening" : ""}`}
          onClick={() => (listening ? stopListening() : startListening())}
          aria-label={listening ? "Stop listening" : "Talk to Nova"}
        >
          <span className={`nova-orb ${status}`} />
          Nova
        </button>
        {statusLabel && <span className="status-state">{statusLabel}</span>}
        {dnd && <span className="status-dnd">DND</span>}
      </div>
      <div className="status-center">
        <div className="status-time">{formatClock(now)}</div>
        <div className="status-date">{formatDateLong(now)}</div>
      </div>
      <div className="status-right">
        <span className="status-pill">{roomName}</span>
        <span className="status-pill">
          <span className={`status-dot ${server.online ? "" : "offline"}`} />
          {server.online ? `${server.latency} ms` : "Offline"}
        </span>
        <button
          type="button"
          className="status-icon-btn"
          aria-label="Commands"
          onClick={() => setPaletteOpen(true)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.2-3.2" /></svg>
        </button>
        <button
          type="button"
          className="status-icon-btn"
          aria-label="Settings"
          onClick={() => setSettingsOpen(true)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3" /><path d="M12 3v2M12 19v2M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M3 12h2M19 12h2M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5" /></svg>
        </button>
      </div>
    </header>
  );
}
