import { useEffect } from "react";
import { useChromeStore } from "../../store/chromeStore";

export function FieldTap({
  label,
  field,
  value,
  onCommit,
  live = false,
  error = "",
  readOnly = false,
}: {
  label: string;
  field: string;
  value: string;
  onCommit: (v: string) => void;
  live?: boolean;
  error?: string;
  readOnly?: boolean;
}) {
  const openKeyboard = useChromeStore((s) => s.openKeyboard);
  const kbField = useChromeStore((s) => s.kbField);
  const kbText = useChromeStore((s) => s.kbText);
  const kbOpen = useChromeStore((s) => s.kbOpen);
  const enterSeq = useChromeStore((s) => s.kbEnterSeq);
  const active = kbOpen && kbField === field;
  const shown = active ? kbText : value;

  useEffect(() => {
    if (!live || !active) return;
    onCommit(kbText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kbText, active, live]);

  useEffect(() => {
    if (!enterSeq) return;
    const s = useChromeStore.getState();
    if (s.kbField === field || (s.kbField === "" && active)) {
      onCommit(s.kbText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enterSeq]);

  return (
    <div className="field-tap-row">
      <button
        type="button"
        className={`field-tap${active ? " on" : ""}`}
        disabled={readOnly}
        onClick={() => {
          if (!readOnly) openKeyboard(field, value);
        }}
      >
        <span className="field-tap-label">{label}</span>
        <span className="field-tap-value">{shown || "Tap to type"}</span>
      </button>
      {error ? <span className="field-tap-error">{error}</span> : null}
    </div>
  );
}
