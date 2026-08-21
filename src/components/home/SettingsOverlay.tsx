import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAssistantStore } from "../../store/assistantStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useRoomStore } from "../../store/roomStore";
import { useLayoutStore } from "../../store/layoutStore";
import { getConversationLogPath } from "../../lib/conversationLog";
import {
  overlayTransition,
  PerformanceMode,
  usePerformanceStore,
} from "../../lib/performance";

type Tab = "room" | "voice" | "notices" | "routines";

export function SettingsOverlay() {
  const open = useAssistantStore((s) => s.settingsOpen);
  const setOpen = useAssistantStore((s) => s.setSettingsOpen);
  const settings = useSettingsStore();
  const update = useSettingsStore((s) => s.update);
  const routines = useRoomStore((s) => s.routines);
  const removeRoutine = useRoomStore((s) => s.removeRoutine);
  const perfMode = usePerformanceStore((s) => s.mode);
  const reduced = usePerformanceStore((s) => s.reduced);
  const setPerfMode = usePerformanceStore((s) => s.setMode);
  const [tab, setTab] = useState<Tab>("room");
  const [logPath, setLogPath] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTab("room");
    void getConversationLogPath().then(setLogPath);
  }, [open]);

  const close = () => setOpen(false);

  const openEditMode = () => {
    close();
    useLayoutStore.getState().enterEditMode();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="settings-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            className="settings-sheet"
            initial={{ opacity: 0, y: reduced ? 8 : 24, scale: reduced ? 1 : 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduced ? 4 : 16, scale: reduced ? 1 : 0.98 }}
            transition={overlayTransition(reduced)}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="settings-header">
              <h2>Settings</h2>
              <button type="button" className="settings-close" onClick={close} aria-label="Close">
                ✕
              </button>
            </header>

            <div className="settings-tabs" role="tablist">
              {(
                [
                  ["room", "Room"],
                  ["voice", "Voice"],
                  ["notices", "Notices"],
                  ["routines", "Routines"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className={tab === id ? "on" : ""}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="settings-body">
              {tab === "room" && (
                <>
                  <div className="settings-group">
                    <label className="settings-field">
                      <span className="settings-label">Room name</span>
                      <input
                        className="settings-input"
                        value={settings.roomName}
                        onChange={(e) => update({ roomName: e.target.value })}
                        onBlur={(e) => update({ roomName: e.target.value.trim() || "Room" })}
                      />
                    </label>
                    <label className="settings-field">
                      <span className="settings-label">Location label</span>
                      <input
                        className="settings-input"
                        value={settings.locationName}
                        onChange={(e) => update({ locationName: e.target.value })}
                        onBlur={(e) =>
                          update({ locationName: e.target.value.trim() || settings.locationName })
                        }
                      />
                    </label>
                    <div className="settings-field-row">
                      <label className="settings-field">
                        <span className="settings-label">Latitude</span>
                        <input
                          className="settings-input"
                          inputMode="decimal"
                          value={settings.latitude}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (Number.isFinite(n)) update({ latitude: n });
                          }}
                        />
                      </label>
                      <label className="settings-field">
                        <span className="settings-label">Longitude</span>
                        <input
                          className="settings-input"
                          inputMode="decimal"
                          value={settings.longitude}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (Number.isFinite(n)) update({ longitude: n });
                          }}
                        />
                      </label>
                    </div>
                    <label className="settings-field">
                      <span className="settings-label">Judie Assistant URL</span>
                      <input
                        className="settings-input"
                        value={settings.assistantBaseUrl}
                        onChange={(e) => update({ assistantBaseUrl: e.target.value })}
                        onBlur={(e) => update({ assistantBaseUrl: e.target.value.trim() })}
                        placeholder="http://127.0.0.1:8742"
                      />
                    </label>
                    <div className="settings-field">
                      <span className="settings-label">Performance</span>
                      <div className="settings-seg">
                        {(
                          [
                            ["auto", "Auto"],
                            ["desktop", "Desktop"],
                            ["pi", "Pi"],
                          ] as const
                        ).map(([id, label]) => (
                          <button
                            key={id}
                            type="button"
                            className={perfMode === id ? "on" : ""}
                            onClick={() => setPerfMode(id as PerformanceMode)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <p className="settings-switch-hint">
                        {reduced
                          ? "Pi mode on — lighter motion, no blur (good for Raspberry Pi 3)."
                          : "Desktop mode — full motion and effects."}
                      </p>
                    </div>
                  </div>
                  <p className="settings-note">
                    Weather uses Open-Meteo from your coordinates. Indoor climate and playback stay
                    local until hardware is connected.
                  </p>
                  <div className="settings-group">
                    <div className="settings-label">Conversation log</div>
                    <p className="settings-note settings-log-path">
                      {logPath ??
                        "Available in the desktop app. Not stored in the browser-only build."}
                    </p>
                    {logPath && (
                      <button
                        type="button"
                        className="settings-btn"
                        onClick={async () => {
                          try {
                            const { openPath } = await import("@tauri-apps/plugin-opener");
                            await openPath(logPath);
                          } catch {
                            /* ignore */
                          }
                        }}
                      >
                        Open log file
                      </button>
                    )}
                  </div>
                </>
              )}

              {tab === "voice" && (
                <div className="settings-group">
                  <div className="settings-switch-row">
                    <div>
                      <div className="settings-switch-title">Voice replies</div>
                      <div className="settings-switch-hint">Judie speaks answers aloud</div>
                    </div>
                    <button
                      type="button"
                      className={`settings-toggle ${settings.speakReplies ? "on" : ""}`}
                      aria-pressed={settings.speakReplies}
                      onClick={() => update({ speakReplies: !settings.speakReplies })}
                    >
                      <span className="settings-toggle-knob" />
                    </button>
                  </div>
                  <div className="settings-switch-row">
                    <div>
                      <div className="settings-switch-title">Microphone</div>
                      <div className="settings-switch-hint">Tap Judie in the status bar to talk</div>
                    </div>
                    <button
                      type="button"
                      className={`settings-toggle ${settings.voiceEnabled ? "on" : ""}`}
                      aria-pressed={settings.voiceEnabled}
                      onClick={() => update({ voiceEnabled: !settings.voiceEnabled })}
                    >
                      <span className="settings-toggle-knob" />
                    </button>
                  </div>
                  <div className="settings-switch-row">
                    <div>
                      <div className="settings-switch-title">Units</div>
                      <div className="settings-switch-hint">Temperature and wind speed</div>
                    </div>
                    <button
                      type="button"
                      className="settings-btn"
                      onClick={() =>
                        update({ units: settings.units === "metric" ? "imperial" : "metric" })
                      }
                    >
                      {settings.units === "metric" ? "°C / km/h" : "°F / mph"}
                    </button>
                  </div>
                </div>
              )}

              {tab === "notices" && (
                <div className="settings-group">
                  {(
                    [
                      ["timers", "Timers", "Finished timers and alarms"],
                      ["calendar", "Calendar", "Upcoming events"],
                      ["weather", "Weather", "Rain and forecast shifts"],
                      ["air", "Air quality", "AQI and purifier nudges"],
                      ["devices", "Device issues", "Offline or slow services"],
                    ] as const
                  ).map(([key, title, hint]) => (
                    <div className="settings-switch-row" key={key}>
                      <div>
                        <div className="settings-switch-title">{title}</div>
                        <div className="settings-switch-hint">{hint}</div>
                      </div>
                      <button
                        type="button"
                        className={`settings-toggle ${settings.proactive[key] ? "on" : ""}`}
                        aria-pressed={settings.proactive[key]}
                        onClick={() =>
                          update({
                            proactive: { ...settings.proactive, [key]: !settings.proactive[key] },
                          })
                        }
                      >
                        <span className="settings-toggle-knob" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {tab === "routines" && (
                <div className="settings-group settings-routines">
                  {routines.length === 0 ? (
                    <p className="settings-note">No routines yet. Teach one by saying “teach routine …”.</p>
                  ) : (
                    routines.map((r) => (
                      <div key={r.id} className="settings-routine-card">
                        <div>
                          <div className="settings-switch-title">{r.name}</div>
                          <div className="settings-switch-hint">
                            {r.phrases.join(", ")}
                            {r.command ? ` → ${r.command}` : ""}
                            {r.builtin ? " · built-in" : ""}
                          </div>
                        </div>
                        {!r.builtin && (
                          <button
                            type="button"
                            className="settings-btn danger"
                            onClick={() => removeRoutine(r.id)}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <footer className="settings-footer">
              <button type="button" className="settings-btn primary" onClick={openEditMode}>
                Edit home screen
              </button>
              <button type="button" className="settings-btn" onClick={close}>
                Done
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
