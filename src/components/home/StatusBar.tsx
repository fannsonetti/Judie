import { useEffect, useRef, useState } from "react";
import { useRoomStore } from "../../store/roomStore";
import { useAssistantStore } from "../../store/assistantStore";
import { useChromeStore } from "../../store/chromeStore";
import { formatClock, formatDateLong } from "../../lib/time";
import { JUDIE_VERSION } from "../../lib/version";
import { NetGlyph } from "../chrome/NetGlyph";
import { networkLink, type NetworkLink } from "../../lib/network";
import {
  beginSettingsDrag,
  canBeginOpen,
  inOpenZone,
  moveSettingsDrag,
  settleTarget,
  shouldCompleteSettings,
  type SettingsDrag,
} from "../../lib/settingsSheet";

export function StatusBar({ link }: { link: NetworkLink }) {
  const [now, setNow] = useState(() => new Date());
  const dnd = useRoomStore((s) => s.doNotDisturb);
  const setServerStatus = useRoomStore((s) => s.setServerStatus);
  const setServices = useRoomStore((s) => s.setServices);
  const pointer = useRef<{ y: number; x: number } | null>(null);
  const dragged = useRef(false);
  const openDrag = useRef<SettingsDrag | null>(null);

  useEffect(() => {
    let id = 0;
    const tick = () => setNow(new Date());
    const schedule = () => {
      const n = new Date();
      const ms = (60 - n.getSeconds()) * 1000 - n.getMilliseconds();
      id = window.setTimeout(() => {
        tick();
        schedule();
      }, Math.max(250, ms));
    };
    tick();
    schedule();
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
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
        /* vite */
      }
    };
    void ping();
    const id = window.setInterval(() => void ping(), 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [setServerStatus, setServices]);

  const inRightThird = (clientX: number) => {
    const w = typeof window !== "undefined" ? window.innerWidth : 1;
    return inOpenZone(clientX, w);
  };

  const finishOpenDrag = (y: number, cancelled: boolean) => {
    const drag = openDrag.current;
    openDrag.current = null;
    pointer.current = null;
    if (!drag?.locked) {
      useChromeStore.getState().setSettingsTracking(false);
      return;
    }
    const moved = moveSettingsDrag(drag, y, window.innerHeight || 1, performance.now());
    const target = settleTarget(moved.kind, shouldCompleteSettings(moved, cancelled));
    useChromeStore.getState().settleSettings(target);
    useAssistantStore.getState().setSettingsOpen(target === 1);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const chrome = useChromeStore.getState();
    const open = useAssistantStore.getState().settingsOpen;
    if (!canBeginOpen(open, chrome.settingsPull) || !inRightThird(e.clientX)) {
      pointer.current = null;
      openDrag.current = null;
      return;
    }
    dragged.current = false;
    pointer.current = { y: e.clientY, x: e.clientX };
    openDrag.current = beginSettingsDrag("open", e.clientY, chrome.settingsPull, performance.now());
    chrome.setSettingsTracking(false);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = openDrag.current;
    if (!drag) return;
    const next = moveSettingsDrag(drag, e.clientY, window.innerHeight || 1, performance.now());
    openDrag.current = next;
    if (!next.locked) return;
    dragged.current = true;
    const chrome = useChromeStore.getState();
    chrome.setSettingsTracking(true);
    chrome.setNetMenuOpen(false);
    chrome.setSettingsPull(next.pull);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    finishOpenDrag(e.clientY, false);
  };

  return (
    <header
      className="status-bar"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={(e) => finishOpenDrag(e.clientY, true)}
    >
      <div className="status-left">
        <span className="status-version" aria-hidden>
          v{JUDIE_VERSION}
        </span>
        {dnd && <span className="status-dnd">DND</span>}
      </div>
      <button
        type="button"
        className="status-center"
        onClick={() => {
          useChromeStore.getState().setNetMenuOpen(false);
          useAssistantStore.getState().setPaletteOpen(true);
        }}
      >
        <div className="status-time">{formatClock(now)}</div>
        <div className="status-date">{formatDateLong(now)}</div>
      </button>
      <div className="status-right">
        <button
          type="button"
          className="status-net"
          aria-label="Network"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (dragged.current || useChromeStore.getState().settingsTracking) return;
            useChromeStore.getState().setNetMenuOpen(!useChromeStore.getState().netMenuOpen);
          }}
        >
          <NetGlyph kind={link.kind} bars={link.bars} />
        </button>
      </div>
    </header>
  );
}

export function useNetworkLink() {
  const [link, setLink] = useState<NetworkLink>({
    kind: "wifi",
    ssid: "",
    bars: 0,
    state: "disconnected",
    ip: "",
  });
  useEffect(() => {
    let cancel = false;
    const tick = async () => {
      const next = await networkLink();
      if (!cancel) setLink(next);
    };
    void tick();
    const id = window.setInterval(() => void tick(), 5000);
    return () => {
      cancel = true;
      window.clearInterval(id);
    };
  }, []);
  return link;
}
