import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAssistantStore } from "../../store/assistantStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useRoomStore } from "../../store/roomStore";
import { useLayoutStore } from "../../store/layoutStore";
import { getConversationLogPath } from "../../lib/conversationLog";

export function SettingsOverlay() {
  const open = useAssistantStore((s) => s.settingsOpen);
  const setOpen = useAssistantStore((s) => s.setSettingsOpen);
  const settings = useSettingsStore();
  const routines = useRoomStore((s) => s.routines);
  const removeRoutine = useRoomStore((s) => s.removeRoutine);
  const [form, setForm] = useState({
    roomName: settings.roomName,
    locationName: settings.locationName,
    latitude: String(settings.latitude),
    longitude: String(settings.longitude),
    assistantBaseUrl: settings.assistantBaseUrl,
  });

  const [logPath, setLogPath] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm({
      roomName: settings.roomName,
      locationName: settings.locationName,
      latitude: String(settings.latitude),
      longitude: String(settings.longitude),
      assistantBaseUrl: settings.assistantBaseUrl,
    });
    void getConversationLogPath().then(setLogPath);
  }, [open, settings.roomName, settings.locationName, settings.latitude, settings.longitude, settings.assistantBaseUrl]);

  if (!open) return null;

  const save = () => {
    settings.update({
      roomName: form.roomName.trim() || "Room",
      locationName: form.locationName.trim() || settings.locationName,
      latitude: Number(form.latitude) || settings.latitude,
      longitude: Number(form.longitude) || settings.longitude,
      assistantBaseUrl: form.assistantBaseUrl.trim(),
    });
    setOpen(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        className="gallery-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setOpen(false)}
      >
        <motion.div
          className="gallery-panel settings-panel"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="gallery-header">
            <h2>Settings</h2>
            <button type="button" className="icon-btn" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>

          <div className="ch-section">Room</div>
          <div className="ch-group">
          <div className="settings-grid">
            <label className="settings-field">
              <span className="w-label">Room name</span>
              <input
                value={form.roomName}
                onChange={(e) => setForm({ ...form, roomName: e.target.value })}
              />
            </label>
            <label className="settings-field">
              <span className="w-label">Location</span>
              <input
                value={form.locationName}
                onChange={(e) => setForm({ ...form, locationName: e.target.value })}
              />
            </label>
            <label className="settings-field">
              <span className="w-label">Latitude</span>
              <input
                value={form.latitude}
                onChange={(e) => setForm({ ...form, latitude: e.target.value })}
              />
            </label>
            <label className="settings-field">
              <span className="w-label">Longitude</span>
              <input
                value={form.longitude}
                onChange={(e) => setForm({ ...form, longitude: e.target.value })}
              />
            </label>
            <label className="settings-field">
              <span className="w-label">Nova Assistant URL</span>
              <input
                value={form.assistantBaseUrl}
                onChange={(e) => setForm({ ...form, assistantBaseUrl: e.target.value })}
                placeholder="http://127.0.0.1:8742"
              />
            </label>
          </div>
          </div>

          <div className="ch-section">Voice & units</div>
          <div className="ch-group">
          <div className="settings-row">
            <span>Voice replies</span>
            <button
              type="button"
              className={`toggle ${settings.speakReplies ? "on" : ""}`}
              onClick={() => settings.update({ speakReplies: !settings.speakReplies })}
            >
              <span className="toggle-knob" />
            </button>
          </div>
          <div className="settings-row">
            <span>Microphone</span>
            <button
              type="button"
              className={`toggle ${settings.voiceEnabled ? "on" : ""}`}
              onClick={() => settings.update({ voiceEnabled: !settings.voiceEnabled })}
            >
              <span className="toggle-knob" />
            </button>
          </div>
          <div className="settings-row">
            <span>Units</span>
            <button
              type="button"
              className="chip active"
              onClick={() =>
                settings.update({ units: settings.units === "metric" ? "imperial" : "metric" })
              }
            >
              {settings.units === "metric" ? "°C / km/h" : "°F / mph"}
            </button>
          </div>
          </div>

          <div className="ch-section">Proactive notices</div>
          <div className="ch-group">
          {(
            [
              ["timers", "Timers"],
              ["calendar", "Calendar"],
              ["weather", "Weather"],
              ["air", "Air quality"],
              ["devices", "Device issues"],
            ] as const
          ).map(([key, label]) => (
            <div className="settings-row" key={key}>
              <span>{label}</span>
              <button
                type="button"
                className={`toggle ${settings.proactive[key] ? "on" : ""}`}
                onClick={() =>
                  settings.update({
                    proactive: { ...settings.proactive, [key]: !settings.proactive[key] },
                  })
                }
              >
                <span className="toggle-knob" />
              </button>
            </div>
          ))}
          </div>

          <div className="ch-section">Routines</div>
          <div className="ch-group">
          <div className="settings-routines">
            {routines.map((r) => (
              <div key={r.id} className="settings-routine">
                <div>
                  <div style={{ fontWeight: 550 }}>{r.name}</div>
                  <div className="w-secondary" style={{ fontSize: 12 }}>
                    {r.phrases.join(", ")}
                    {r.command ? ` → ${r.command}` : ""}
                    {r.builtin ? " · built-in" : ""}
                  </div>
                </div>
                {!r.builtin && (
                  <button type="button" className="chip" onClick={() => removeRoutine(r.id)}>
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          </div>

          <p className="w-secondary" style={{ marginTop: 18, fontSize: 13 }}>
            Indoor climate and playback are local to this tablet until a sensor or media
            integration is connected. Weather comes from Open-Meteo.
          </p>

          <div className="w-label" style={{ margin: "18px 0 8px" }}>
            Conversation log
          </div>
          <p className="w-secondary" style={{ fontSize: 13, margin: "0 0 10px", wordBreak: "break-all" }}>
            {logPath ?? "Available in the desktop app (npm run tauri dev). Not stored in the browser."}
          </p>
          {logPath && (
            <button
              type="button"
              className="chip"
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

          <div className="settings-actions">
            <button
              type="button"
              className="chip"
              onClick={() => useLayoutStore.getState().enterEditMode()}
            >
              Edit home screen
            </button>
            <button type="button" className="chip active" onClick={save}>
              Save
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
