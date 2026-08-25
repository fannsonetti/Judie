import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAssistantStore } from "../../store/assistantStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useRoomStore } from "../../store/roomStore";
import { useLayoutStore } from "../../store/layoutStore";
import { getConversationLogPath } from "../../lib/conversationLog";
import { enterFullscreen, leaveFullscreen, minimizeJudie, quitJudie } from "../../lib/windowControls";
import { overlayTransition } from "../../lib/performance";
import {
  listInstallations,
  releaseLabel,
  switchInstallation,
  uninstallJudie,
  type ReleaseInfo,
} from "../../lib/install";
import { JUDIE_VERSION } from "../../lib/version";

type Tab = "room" | "voice" | "notices" | "routines" | "app";

const TABS: { id: Tab; label: string }[] = [
  { id: "room", label: "Room" },
  { id: "voice", label: "Voice" },
  { id: "notices", label: "Notices" },
  { id: "routines", label: "Routines" },
  { id: "app", label: "Judie" },
];

export function SettingsOverlay() {
  const open = useAssistantStore((s) => s.settingsOpen);
  const setOpen = useAssistantStore((s) => s.setSettingsOpen);
  const settings = useSettingsStore();
  const update = useSettingsStore((s) => s.update);
  const routines = useRoomStore((s) => s.routines);
  const removeRoutine = useRoomStore((s) => s.removeRoutine);
  const [tab, setTab] = useState<Tab>("room");
  const [logPath, setLogPath] = useState<string | null>(null);
  const [busy, setBusy] = useState<"min" | "quit" | "install" | "uninstall" | null>(null);
  const [releases, setReleases] = useState<ReleaseInfo[] | null>(null);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState("");
  const [confirmUninstall, setConfirmUninstall] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTab("room");
    setBusy(null);
    setConfirmUninstall(false);
    setActionError(null);
    void getConversationLogPath().then(setLogPath);
  }, [open]);

  useEffect(() => {
    if (!open || tab !== "app") return;
    let cancelled = false;
    void listInstallations()
      .then((list) => {
        if (cancelled) return;
        setReleases(list);
        setReleaseError(null);
        setSelectedTag((prev) => {
          if (prev && list.some((r) => r.tag === prev)) return prev;
          return list.find((r) => r.current)?.tag ?? list[0]?.tag ?? "";
        });
      })
      .catch(() => {
        if (cancelled) return;
        setReleases([]);
        setReleaseError("Open the desktop app to see GitHub installations.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, tab]);

  const close = () => setOpen(false);

  const openEditMode = () => {
    close();
    useLayoutStore.getState().enterEditMode();
  };

  const onMinimize = async () => {
    setBusy("min");
    close();
    try {
      await minimizeJudie();
    } catch {
      /* ignore */
    }
    setBusy(null);
  };

  const onLeaveFullscreen = async () => {
    try {
      await leaveFullscreen();
    } catch {
      /* ignore */
    }
  };

  const onQuit = async () => {
    setBusy("quit");
    try {
      await quitJudie();
    } catch {
      setBusy(null);
    }
  };

  const onSwitchInstall = async () => {
    if (!selectedTag) return;
    setBusy("install");
    setActionError(null);
    try {
      await switchInstallation(selectedTag);
    } catch (err) {
      setActionError(typeof err === "string" ? err : err instanceof Error ? err.message : "Could not switch installation");
      setBusy(null);
    }
  };

  const onUninstall = async () => {
    if (!confirmUninstall) {
      setConfirmUninstall(true);
      return;
    }
    setBusy("uninstall");
    setActionError(null);
    try {
      await uninstallJudie();
    } catch (err) {
      setActionError(typeof err === "string" ? err : err instanceof Error ? err.message : "Could not uninstall");
      setBusy(null);
      setConfirmUninstall(false);
    }
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={overlayTransition()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="settings-grab" aria-hidden />
            <header className="settings-header">
              <h2>Settings</h2>
              <button type="button" className="settings-close" onClick={close} aria-label="Done">
                Done
              </button>
            </header>
            <nav className="settings-tabs" aria-label="Settings">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={tab === t.id ? "on" : ""}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </nav>

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
                      <div className="settings-switch-hint">
                        Swipe down from the top, then Listen
                      </div>
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
                    <p className="settings-note">
                      No routines yet. Teach one by saying “teach routine …”.
                    </p>
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

              {tab === "app" && (
                <>
                  <p className="settings-kicker">Installation</p>
                  <div className="settings-group">
                    <div className="settings-field">
                      <span className="settings-label">This copy</span>
                      <div className="settings-switch-title">Judie {JUDIE_VERSION}</div>
                    </div>
                    <label className="settings-field">
                      <span className="settings-label">Change installation</span>
                      <select
                        className="settings-input"
                        value={selectedTag}
                        disabled={busy !== null || !releases || releases.length === 0}
                        onChange={(e) => setSelectedTag(e.target.value)}
                      >
                        {(releases ?? []).map((r) => (
                          <option key={r.tag} value={r.tag} disabled={!r.installable}>
                            {releaseLabel(r)}
                            {r.installable ? "" : " (no package for this computer)"}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="settings-btn"
                      disabled={
                        busy !== null
                        || !selectedTag
                        || !!releases?.find((r) => r.tag === selectedTag && r.current)
                      }
                      onClick={() => void onSwitchInstall()}
                    >
                      {busy === "install" ? "Installing…" : "Switch to this version"}
                    </button>
                    {releaseError && <p className="settings-note">{releaseError}</p>}
                    <p className="settings-note">
                      Picks a GitHub release for this computer and installs it. The app will close
                      and reopen.
                    </p>
                  </div>

                  <p className="settings-kicker">Window</p>
                  <div className="settings-group">
                    <div className="settings-switch-row">
                      <div>
                        <div className="settings-switch-title">Lock 16:10</div>
                        <div className="settings-switch-hint">
                          Letterbox on 16:9 so the home grid is not stretched
                        </div>
                      </div>
                      <button
                        type="button"
                        className={`settings-toggle ${settings.lockAspect1610 ? "on" : ""}`}
                        aria-pressed={settings.lockAspect1610}
                        onClick={() => update({ lockAspect1610: !settings.lockAspect1610 })}
                      >
                        <span className="settings-toggle-knob" />
                      </button>
                    </div>
                  </div>
                  <div className="settings-power">
                    <button type="button" className="settings-power-card" onClick={onMinimize} disabled={busy !== null}>
                      <span className="settings-power-ico" aria-hidden>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M5 12h14" />
                        </svg>
                      </span>
                      <strong>Minimize</strong>
                      <span>Hide Judie and show the desktop</span>
                    </button>
                    <button
                      type="button"
                      className="settings-power-card"
                      onClick={() => void enterFullscreen()}
                      disabled={busy !== null}
                    >
                      <span className="settings-power-ico" aria-hidden>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M16 21h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                        </svg>
                      </span>
                      <strong>Fullscreen</strong>
                      <span>Cover the screen again</span>
                    </button>
                    <button
                      type="button"
                      className="settings-power-card"
                      onClick={() => void onLeaveFullscreen()}
                      disabled={busy !== null}
                    >
                      <span className="settings-power-ico" aria-hidden>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M16 21v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                        </svg>
                      </span>
                      <strong>Unfullscreen</strong>
                      <span>Windowed, with the desktop around it</span>
                    </button>
                    <button
                      type="button"
                      className="settings-power-card danger"
                      onClick={onQuit}
                      disabled={busy !== null}
                    >
                      <span className="settings-power-ico" aria-hidden>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </span>
                      <strong>{busy === "quit" ? "Closing…" : "Close Judie"}</strong>
                      <span>Quit the app until you open it again</span>
                    </button>
                    <button
                      type="button"
                      className="settings-power-card danger"
                      onClick={() => void onUninstall()}
                      disabled={busy !== null}
                    >
                      <span className="settings-power-ico" aria-hidden>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                        </svg>
                      </span>
                      <strong>
                        {busy === "uninstall"
                          ? "Removing…"
                          : confirmUninstall
                            ? "Tap again to uninstall"
                            : "Uninstall"}
                      </strong>
                      <span>
                        {confirmUninstall
                          ? "Removes Judie from this computer"
                          : "Remove Judie from this computer"}
                      </span>
                    </button>
                  </div>
                  {actionError && <p className="settings-note">{actionError}</p>}
                  <p className="settings-note">
                    Autostart opens one Judie window at login. Unfullscreen is remembered the next
                    time you launch.
                  </p>
                </>
              )}
            </div>

            <footer className="settings-footer">
              <button type="button" className="settings-btn" onClick={openEditMode}>
                Edit home screen
              </button>
              <button type="button" className="settings-btn primary" onClick={close}>
                Done
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
