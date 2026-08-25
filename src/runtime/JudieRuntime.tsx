import { useEffect, useRef } from "react";
import { fetchWeather } from "../lib/weather";
import { log } from "../lib/logger";
import { useRoomStore } from "../store/roomStore";
import { useSettingsStore } from "../store/settingsStore";
import { useAssistantStore } from "../store/assistantStore";
import { useActivityStore } from "../store/activityStore";
import { useJudieHotkeys } from "../hooks/useJudieHotkeys";

export function JudieRuntime() {
  useJudieHotkeys();
  const tickProgress = useRoomStore((s) => s.tickProgress);
  const notified = useRef(new Set<string>());

  useEffect(() => {
    const tickTimersAndMedia = () => {
      const room = useRoomStore.getState();
      if (room.media.playing) tickProgress();

      const latest = room.media.playing ? useRoomStore.getState() : room;
      const due = latest.dueTimers();
      for (const t of due) {
        latest.completeTimer(t.id);
        useActivityStore.getState().push({
          source: "timer",
          title: t.kind === "alarm" ? `Alarm: ${t.name}` : `${t.name} done`,
          outcome: "ok",
        });
        const settings = useSettingsStore.getState();
        if (settings.proactive.timers) {
          useAssistantStore.getState().pushToast({
            kind: "timer",
            title: t.kind === "alarm" ? t.name : "Timer done",
            body: t.name,
          });
        }
        if (t.fireText) {
          void useAssistantStore.getState().execute(t.fireText, "timer", true);
        }
      }
    };

    const tickCalendar = () => {
      const latest = useRoomStore.getState();
      const settings = useSettingsStore.getState();
      if (!settings.proactive.calendar || latest.doNotDisturb) return;
      const now = new Date();
      for (const ev of latest.events) {
        if (ev.dayOffset) continue;
        const [h, m] = ev.time.split(":").map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(m)) continue;
        const mins = h * 60 + m - (now.getHours() * 60 + now.getMinutes());
        const key = `cal-${ev.id}-${ev.time}`;
        if (mins <= 10 && mins >= 0 && !notified.current.has(key)) {
          notified.current.add(key);
          useAssistantStore.getState().pushToast({
            kind: "info",
            title: ev.title,
            body: `${ev.time}${ev.detail ? ` · ${ev.detail}` : ""}`,
          });
        }
      }
    };

    let fast: number | null = null;
    const syncFast = () => {
      const room = useRoomStore.getState();
      const need = room.media.playing || room.timers.length > 0;
      if (need && fast == null) {
        tickTimersAndMedia();
        fast = window.setInterval(tickTimersAndMedia, 1000);
      } else if (!need && fast != null) {
        window.clearInterval(fast);
        fast = null;
      }
    };

    syncFast();
    const unsub = useRoomStore.subscribe(syncFast);
    tickCalendar();
    const slow = window.setInterval(tickCalendar, 15_000);
    return () => {
      unsub();
      if (fast != null) window.clearInterval(fast);
      window.clearInterval(slow);
    };
  }, [tickProgress]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const cfg = useSettingsStore.getState();
      try {
        const weather = await fetchWeather(cfg);
        if (cancelled) return;
        useRoomStore.getState().setWeather(weather);
        const services = useRoomStore.getState().server.services.map((s) =>
          s.name === "Weather" ? { ...s, online: true, latency: 1 } : s
        );
        useRoomStore.getState().setServices(services);
        const rain = weather.hourly.find((h) => h.precip >= 70);
        if (rain && cfg.proactive.weather && !notified.current.has(`rain-${rain.hour}`)) {
          notified.current.add(`rain-${rain.hour}`);
          useAssistantStore.getState().pushToast({
            kind: "info",
            title: "Rain coming",
            body: `${rain.condition} around ${rain.hour}`,
          });
        }
      } catch (err) {
        log.warn("weather fetch failed", {
          component: "weather",
          action: "fetch",
          error: err instanceof Error ? err.message : "failed",
        });
        const s = useRoomStore.getState();
        useRoomStore.getState().setWeather({ ...s.weather, stale: true });
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 15 * 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const air = useRoomStore((s) => s.purifier.airQuality);
  useEffect(() => {
    const cfg = useSettingsStore.getState();
    if (cfg.proactive.air && air === "Poor") {
      useAssistantStore.getState().pushToast({
        kind: "warn",
        title: "Air quality is poor",
      });
    }
  }, [air]);

  return null;
}
