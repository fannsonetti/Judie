import { useEffect, useState } from "react";
import { useChromeStore } from "../../store/chromeStore";
import { NetGlyph } from "./NetGlyph";
import {
  wifiConnect,
  wifiDisconnect,
  wifiScan,
  type NetworkLink,
  type WifiNet,
} from "../../lib/network";

export function WifiMenu({ link }: { link: NetworkLink }) {
  const open = useChromeStore((s) => s.netMenuOpen);
  const setOpen = useChromeStore((s) => s.setNetMenuOpen);
  const openKeyboard = useChromeStore((s) => s.openKeyboard);
  const kbField = useChromeStore((s) => s.kbField);
  const kbText = useChromeStore((s) => s.kbText);
  const [nets, setNets] = useState<WifiNet[]>([]);
  const [detail, setDetail] = useState("");
  const [status, setStatus] = useState("");
  const [auto, setAuto] = useState(true);
  const [busy, setBusy] = useState(false);

  const scan = async (quiet = false) => {
    if (!quiet) setStatus("Scanning…");
    try {
      const list = await wifiScan();
      setNets(list);
      if (!quiet) setStatus(`${list.length} networks`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Scan failed");
    }
  };

  useEffect(() => {
    if (!open) {
      setDetail("");
      return;
    }
    void scan(false);
    const id = window.setInterval(() => void scan(true), 5000);
    return () => window.clearInterval(id);
  }, [open]);

  const pick = nets.find((n) => n.ssid === detail);
  const connected = pick?.connected || (detail !== "" && detail === link.ssid);

  const connect = async () => {
    if (!detail) return;
    const pass = kbField === "wifi-pass" ? kbText : "";
    if (pick?.secured && !pass && !pick.saved) {
      openKeyboard("wifi-pass", "");
      setStatus("Password");
      return;
    }
    setBusy(true);
    setStatus(`Connecting to ${detail}…`);
    try {
      await wifiConnect(detail, pass);
      setStatus("Connected");
      void scan(true);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not connect");
    }
    setBusy(false);
  };

  const enterSeq = useChromeStore((s) => s.kbEnterSeq);
  useEffect(() => {
    if (!enterSeq) return;
    if (useChromeStore.getState().kbField === "wifi-pass") void connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enterSeq]);

  if (!open) return null;

  return (
    <div className="wifi-menu-backdrop" onClick={() => setOpen(false)}>
      <div className="wifi-menu" onClick={(e) => e.stopPropagation()}>
        {link.kind === "ethernet" && !detail && <div className="wifi-menu-title">Ethernet</div>}
        {!detail ? (
          <div className="wifi-menu-list">
            {nets.map((net) => (
              <button
                key={net.ssid}
                type="button"
                className="wifi-menu-row"
                onClick={() => setDetail(net.ssid)}
              >
                <NetGlyph kind="wifi" bars={net.bars} />
                <span>
                  <strong>{net.ssid}</strong>
                  <em>{net.connected ? "Connected" : net.saved ? "Saved" : "Available network"}</em>
                </span>
              </button>
            ))}
            {nets.length === 0 && <p className="wifi-menu-empty">{status || "No Wi-Fi networks"}</p>}
          </div>
        ) : (
          <div className="wifi-menu-detail">
            <button type="button" className="wifi-back" onClick={() => setDetail("")}>
              ←  Networks
            </button>
            <div className="wifi-menu-title">{detail}</div>
            <p>{connected ? "Connected" : "Available network"}</p>
            {connected ? (
              <button
                type="button"
                className="os-pill"
                disabled={busy}
                onClick={() => void wifiDisconnect().then(() => scan(true))}
              >
                Disconnect
              </button>
            ) : (
              <>
                <label className="wifi-auto">
                  <span>Automatically connect</span>
                  <button
                    type="button"
                    className={`os-toggle ${auto ? "on" : ""}`}
                    aria-pressed={auto}
                    onClick={() => setAuto(!auto)}
                  />
                </label>
                <button type="button" className="os-pill on" disabled={busy} onClick={() => void connect()}>
                  Connect
                </button>
              </>
            )}
            <p className="wifi-status">{status}</p>
          </div>
        )}
      </div>
    </div>
  );
}
