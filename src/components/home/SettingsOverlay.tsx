import { useEffect, useState } from "react";
import { useAssistantStore } from "../../store/assistantStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useRoomStore } from "../../store/roomStore";
import { useLayoutStore } from "../../store/layoutStore";
import { useChromeStore } from "../../store/chromeStore";
import { relaunchJudie, quitJudie } from "../../lib/windowControls";
import {
  confirmInstallBody,
  generateMathChallenge,
  generateUninstallChallenge,
  isSameVersion,
  listInstallations,
  switchInstallation,
  uninstallJudie,
  versionChange,
  type ReleaseInfo,
} from "../../lib/install";
import { JUDIE_VERSION } from "../../lib/version";
import { ConfirmSheet } from "../chrome/ConfirmSheet";
import { FieldTap } from "../chrome/FieldTap";
import { networkReconnect, networkSetDhcp } from "../../lib/network";

type Tab = "general" | "network" | "power";
type Confirm =
  | null
  | { kind: "restart" }
  | { kind: "shutdown" }
  | { kind: "uninstall1" }
  | { kind: "uninstall2"; prompt: string; answer: number }
  | { kind: "uninstall3"; code: string }
  | { kind: "upgrade"; tag: string }
  | { kind: "downgrade"; tag: string };

export function SettingsOverlay() {
  const open = useAssistantStore((s) => s.settingsOpen);
  const setOpen = useAssistantStore((s) => s.setSettingsOpen);
  const pull = useChromeStore((s) => s.settingsPull);
  const tracking = useChromeStore((s) => s.settingsTracking);
  const setPull = useChromeStore((s) => s.setSettingsPull);
  const settings = useSettingsStore();
  const update = useSettingsStore((s) => s.update);
  const routines = useRoomStore((s) => s.routines);
  const addRoutine = useRoomStore((s) => s.addRoutine);
  const removeRoutine = useRoomStore((s) => s.removeRoutine);
  const [tab, setTab] = useState<Tab>("general");
  const [busy, setBusy] = useState(false);
  const [releases, setReleases] = useState<ReleaseInfo[] | null>(null);
  const [versionOpen, setVersionOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [typed, setTyped] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState("");
  const [routineName, setRoutineName] = useState("");
  const [routinePhrase, setRoutinePhrase] = useState("");
  const [routineCommand, setRoutineCommand] = useState("");

  const visible = open || pull > 0.01;
  const t = tracking ? pull : open ? 1 : pull;

  useEffect(() => {
    if (open) setPull(1);
  }, [open, setPull]);

  useEffect(() => {
    if (!visible) {
      setTab("general");
      setConfirm(null);
      setTyped("");
      setVersionOpen(false);
      setActionError(null);
      setRoutineName("");
      setRoutinePhrase("");
      setRoutineCommand("");
    }
  }, [visible]);

  const loadReleases = () => {
    void listInstallations()
      .then((list) => {
        setReleases(list);
        const current = list.find((r) => r.current);
        const latest = list[0];
        if (!latest) {
          setUpdateStatus("No compatible releases found.");
          return;
        }
        if (current && isSameVersion(latest.tag, current.tag)) {
          setUpdateStatus(`Current ${current.tag.replace(/^v/, "")} is the latest compatible release.`);
        } else {
          setUpdateStatus(
            `Current ${JUDIE_VERSION} is not latest. Latest is ${latest.tag.replace(/^v/, "")}.`,
          );
        }
      })
      .catch((err) => {
        setReleases([]);
        setUpdateStatus(err instanceof Error ? err.message : "Could not load releases");
      });
  };

  useEffect(() => {
    if (!visible || tab !== "power") return;
    loadReleases();
  }, [visible, tab]);

  const close = () => {
    setOpen(false);
    setPull(0);
  };

  const saveRoutine = () => {
    const phrase = routinePhrase.trim();
    const command = routineCommand.trim();
    if (!phrase || !command) return;
    addRoutine(phrase, command, routineName.trim() || phrase);
    setRoutineName("");
    setRoutinePhrase("");
    setRoutineCommand("");
  };

  const pickVersion = (tag: string) => {
    setVersionOpen(false);
    if (isSameVersion(tag, JUDIE_VERSION)) {
      setUpdateStatus("This version is already installed.");
      return;
    }
    const kind = versionChange(tag, JUDIE_VERSION);
    setConfirm({ kind: kind === "upgrade" ? "upgrade" : "downgrade", tag });
  };

  const runInstall = async (tag: string) => {
    setBusy(true);
    setActionError(null);
    try {
      await switchInstallation(tag);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not switch version");
      setBusy(false);
    }
  };

  const accept = async () => {
    if (!confirm) return;
    if (confirm.kind === "restart") {
      setConfirm(null);
      await relaunchJudie();
      return;
    }
    if (confirm.kind === "shutdown") {
      setConfirm(null);
      await quitJudie();
      return;
    }
    if (confirm.kind === "uninstall1") {
      const math = generateMathChallenge();
      setTyped("");
      setConfirm({ kind: "uninstall2", ...math });
      return;
    }
    if (confirm.kind === "uninstall2") {
      if (Number(typed) !== confirm.answer) return;
      const code = generateUninstallChallenge();
      setTyped("");
      setConfirm({ kind: "uninstall3", code });
      return;
    }
    if (confirm.kind === "uninstall3") {
      if (typed !== confirm.code) return;
      setBusy(true);
      try {
        await uninstallJudie();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Could not uninstall");
        setBusy(false);
        setConfirm(null);
      }
      return;
    }
    if (confirm.kind === "upgrade" || confirm.kind === "downgrade") {
      const tag = confirm.tag;
      setConfirm(null);
      await runInstall(tag);
    }
  };

  const setTemp = (tempUnit: "c" | "f" | "k") =>
    update({ tempUnit, units: tempUnit === "f" ? "imperial" : "metric" });

  if (!visible) return null;

  return (
    <div className="settings-backdrop" onClick={close}>
      <div
        className={`settings-sheet os-sheet${tracking ? " tracking" : ""}`}
        style={{ transform: `translate3d(0, ${(t - 1) * 100}%, 0)` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="settings-handle"
          onPointerDown={(e) => {
            const start = e.clientY;
            const base = t;
            const move = (ev: PointerEvent) => {
              const dy = ev.clientY - start;
              const next = Math.max(0, Math.min(1, base + dy / window.innerHeight));
              useChromeStore.getState().setSettingsTracking(true);
              setPull(next);
            };
            const up = (ev: PointerEvent) => {
              window.removeEventListener("pointermove", move);
              window.removeEventListener("pointerup", up);
              useChromeStore.getState().setSettingsTracking(false);
              const dy = ev.clientY - start;
              const next = Math.max(0, Math.min(1, base + dy / window.innerHeight));
              if (next < 0.68) close();
              else {
                setPull(1);
                setOpen(true);
              }
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
          }}
        />
        <header className="settings-header">
          <h2>Settings</h2>
        </header>
        <nav className="settings-tabs os-tabs" aria-label="Settings">
          {(["general", "network", "power"] as const).map((id) => (
            <button key={id} type="button" className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
              {id[0].toUpperCase() + id.slice(1)}
            </button>
          ))}
        </nav>
        <div className="settings-body os-body">
          {tab === "general" && (
            <>
              <p className="os-kicker">Profile</p>
              <FieldTap label="Username" field="room-name" value={settings.roomName} onCommit={(v) => update({ roomName: v.trim() || "Room" })} />
              <p className="os-kicker">Location</p>
              <FieldTap label="Location name" field="location" value={settings.locationName} onCommit={(v) => update({ locationName: v.trim() || settings.locationName })} />
              <div className="settings-field-row">
                <FieldTap label="Latitude" field="latitude" value={String(settings.latitude)} onCommit={(v) => {
                  const n = Number(v);
                  if (Number.isFinite(n)) update({ latitude: n });
                }} />
                <FieldTap label="Longitude" field="longitude" value={String(settings.longitude)} onCommit={(v) => {
                  const n = Number(v);
                  if (Number.isFinite(n)) update({ longitude: n });
                }} />
              </div>
              <p className="os-kicker">Units</p>
              <p className="os-sub">Temperature</p>
              <div className="os-pills">
                <button type="button" className={`os-pill${settings.tempUnit === "c" ? " on" : ""}`} onClick={() => setTemp("c")}>Celsius</button>
                <button type="button" className={`os-pill${settings.tempUnit === "f" ? " on" : ""}`} onClick={() => setTemp("f")}>Fahrenheit</button>
                <button type="button" className={`os-pill${settings.tempUnit === "k" ? " on" : ""}`} onClick={() => setTemp("k")}>Kelvin</button>
              </div>
              <p className="os-sub">Distance</p>
              <div className="os-pills">
                {([
                  ["km", "Kilometres"],
                  ["mi", "Miles"],
                  ["nm", "Nautical miles"],
                  ["fur", "Furlongs"],
                ] as const).map(([id, label]) => (
                  <button key={id} type="button" className={`os-pill${settings.distanceUnit === id ? " on" : ""}`} onClick={() => update({ distanceUnit: id })}>
                    {label}
                  </button>
                ))}
              </div>
              <p className="os-kicker">Voice</p>
              <div className="os-row">
                <span>Voice Response</span>
                <button type="button" className={`os-toggle${settings.speakReplies ? " on" : ""}`} aria-pressed={settings.speakReplies} onClick={() => update({ speakReplies: !settings.speakReplies })} />
              </div>
              <div className="os-row">
                <span>Microphone</span>
                <button type="button" className={`os-toggle${settings.voiceEnabled ? " on" : ""}`} aria-pressed={settings.voiceEnabled} onClick={() => update({ voiceEnabled: !settings.voiceEnabled })} />
              </div>
              <p className="os-kicker">Routines</p>
              <FieldTap label="Name" field="routine-name" value={routineName} onCommit={setRoutineName} live />
              <FieldTap label="When you say" field="routine-phrase" value={routinePhrase} onCommit={setRoutinePhrase} live />
              <FieldTap label="Judie should" field="routine-command" value={routineCommand} onCommit={setRoutineCommand} live />
              <button
                type="button"
                className="os-pill"
                disabled={!routinePhrase.trim() || !routineCommand.trim()}
                onClick={saveRoutine}
              >
                Save routine
              </button>
              {routines.map((r) => (
                <div key={r.id} className="os-row">
                  <div>
                    <div>{r.name}</div>
                    <div className="os-sub">
                      {r.builtin
                        ? `${r.phrases[0] ?? r.name} · built-in`
                        : r.command
                          ? `When you say “${r.phrases[0] ?? r.name}” → ${r.command}`
                          : r.phrases.join(", ")}
                    </div>
                  </div>
                  {!r.builtin && (
                    <button type="button" className="os-pill" onClick={() => removeRoutine(r.id)}>
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <div className="os-row">
                <div>
                  <div>Lock 16:10</div>
                  <div className="os-sub">Letterbox on 16:9 displays</div>
                </div>
                <button type="button" className={`os-toggle${settings.lockAspect1610 ? " on" : ""}`} aria-pressed={settings.lockAspect1610} onClick={() => update({ lockAspect1610: !settings.lockAspect1610 })} />
              </div>
              <button type="button" className="os-pill" onClick={() => { close(); useLayoutStore.getState().enterEditMode(); }}>
                Edit home screen
              </button>
            </>
          )}
          {tab === "network" && (
            <>
              <p className="os-kicker">Connection</p>
              <p className="os-sub">Preferred interface</p>
              <div className="os-pills">
                <button
                  type="button"
                  className={`os-pill${settings.preferredNet === "ethernet" ? " on" : ""}`}
                  onClick={() => update({ preferredNet: "ethernet" })}
                >
                  Ethernet
                </button>
                <button
                  type="button"
                  className={`os-pill${settings.preferredNet === "wifi" ? " on" : ""}`}
                  onClick={() => update({ preferredNet: "wifi" })}
                >
                  Wi-Fi
                </button>
              </div>
              <p className="settings-note">Wi-Fi join is on the network icon. This page only chooses the preferred interface.</p>
              <p className="os-kicker">Automatic Configuration</p>
              <div className="os-row">
                <span>DHCP</span>
                <button
                  type="button"
                  className={`os-toggle${settings.dhcp ? " on" : ""}`}
                  aria-pressed={settings.dhcp}
                  onClick={() => {
                    const next = !settings.dhcp;
                    update({ dhcp: next });
                    void networkSetDhcp(next);
                  }}
                />
              </div>
              <p className="os-kicker">Reconnect</p>
              <button type="button" className="os-pill on" onClick={() => void networkReconnect(settings.preferredNet)}>
                Reconnect
              </button>
            </>
          )}
          {tab === "power" && (
            <>
              <p className="os-kicker">Installed version</p>
              <div className="os-row">
                <span>v{JUDIE_VERSION}</span>
              </div>
              <div className="os-row">
                <span>Switch version</span>
                <button
                  type="button"
                  className="os-pill"
                  disabled={busy}
                  onClick={() => !busy && setVersionOpen(!versionOpen)}
                >
                  v{JUDIE_VERSION} ▼
                </button>
              </div>
              {versionOpen && !busy && (
                <div className="os-version-list">
                  {(releases ?? []).map((r) => (
                    <button
                      key={r.tag}
                      type="button"
                      className="os-row"
                      disabled={busy || r.current}
                      onClick={() => pickVersion(r.tag)}
                    >
                      <span>{r.tag}</span>
                      {r.current && <em>current</em>}
                    </button>
                  ))}
                  {releases?.length === 0 && <p className="settings-note">No compatible releases listed.</p>}
                </div>
              )}
              <button
                type="button"
                className="os-pill on"
                disabled={busy}
                onClick={() => {
                  setUpdateStatus("Checking GitHub…");
                  loadReleases();
                }}
              >
                Check for updates
              </button>
              {updateStatus && <p className="settings-note">{updateStatus}</p>}
              <button type="button" className="os-hit" disabled={busy} onClick={() => setConfirm({ kind: "restart" })}>
                Restart
              </button>
              <button type="button" className="os-hit" disabled={busy} onClick={() => setConfirm({ kind: "shutdown" })}>
                Shutdown
              </button>
              <button type="button" className="os-hit" disabled={busy} onClick={() => setConfirm({ kind: "uninstall1" })}>
                Uninstall
              </button>
              {actionError && <p className="settings-note">{actionError}</p>}
            </>
          )}
        </div>
      </div>

      {confirm?.kind === "restart" && (
        <ConfirmSheet title="Restart Judie?" body="The app will close and open again." onAccept={() => void accept()} onDismiss={() => setConfirm(null)} />
      )}
      {confirm?.kind === "shutdown" && (
        <ConfirmSheet title="Shut down Judie?" body="Judie will quit until you open it again." primary="Shutdown" onAccept={() => void accept()} onDismiss={() => setConfirm(null)} />
      )}
      {confirm?.kind === "uninstall1" && (
        <ConfirmSheet title="Are you sure?" body="This starts uninstall. Two more steps follow." onAccept={() => void accept()} onDismiss={() => setConfirm(null)} />
      )}
      {confirm?.kind === "uninstall2" && (
        <ConfirmSheet title={confirm.prompt} body="Follow normal order of operations." onAccept={() => void accept()} onDismiss={() => setConfirm(null)}>
          <FieldTap label="Answer" field="math" value={typed} onCommit={setTyped} />
        </ConfirmSheet>
      )}
      {confirm?.kind === "uninstall3" && (
        <ConfirmSheet title="Type this exactly" body={confirm.code} onAccept={() => void accept()} onDismiss={() => setConfirm(null)}>
          <FieldTap label="Verification" field="verify" value={typed} onCommit={setTyped} />
        </ConfirmSheet>
      )}
      {confirm?.kind === "upgrade" && (
        <ConfirmSheet
          title={`Upgrade to ${confirm.tag.replace(/^v/, "")}?`}
          body={confirmInstallBody(JUDIE_VERSION, confirm.tag.replace(/^v/, ""))}
          onAccept={() => void accept()}
          onDismiss={() => setConfirm(null)}
        />
      )}
      {confirm?.kind === "downgrade" && (
        <ConfirmSheet
          title={`Downgrade to ${confirm.tag.replace(/^v/, "")}?`}
          body={confirmInstallBody(JUDIE_VERSION, confirm.tag.replace(/^v/, ""))}
          onAccept={() => void accept()}
          onDismiss={() => setConfirm(null)}
        />
      )}
      {busy && <p className="settings-note os-busy">Working…</p>}
    </div>
  );
}
