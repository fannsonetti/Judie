import { useChromeStore } from "../../store/chromeStore";

function Key({
  label,
  sub,
  u = 1,
  on,
  icon,
  onPress,
}: {
  label: string;
  sub?: string;
  u?: number;
  on?: boolean;
  icon?: string;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      className={`osk-key${on ? " on" : ""}`}
      style={{ flex: u }}
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
    >
      {icon ? <img src={icon} alt="" width={22} height={22} /> : label}
      {sub ? <span className="osk-sub">{sub}</span> : null}
    </button>
  );
}

export function AnsiKeyboard() {
  const open = useChromeStore((s) => s.kbOpen);
  const field = useChromeStore((s) => s.kbField);
  const preview = useChromeStore((s) => s.kbText);
  const shift = useChromeStore((s) => s.kbShift);
  const caps = useChromeStore((s) => s.kbCaps);
  const fn = useChromeStore((s) => s.kbFn);
  const ctrl = useChromeStore((s) => s.kbCtrl);
  const alt = useChromeStore((s) => s.kbAlt);
  const typeKey = useChromeStore((s) => s.typeKey);
  const kbCommand = useChromeStore((s) => s.kbCommand);
  const closeKeyboard = useChromeStore((s) => s.closeKeyboard);

  if (!open) return null;

  const upper = shift || caps;
  const emit = (ch: string) => {
    typeKey(ch);
    if (shift) useChromeStore.setState({ kbShift: false });
  };
  const letter = (low: string) => emit(upper ? low.toUpperCase() : low);
  const digit = (d: string, shifted: string, f?: string) => {
    if (fn && f) return;
    emit(shift ? shifted : d);
  };

  return (
    <div className="osk">
      <div className="osk-bar">
        <span className="osk-field">{field}</span>
        <span className="osk-preview">{preview}</span>
        <button type="button" onClick={closeKeyboard}>
          Hide
        </button>
      </div>
      <div className="osk-row">
        <Key label="Esc" u={1.25} onPress={() => kbCommand("esc")} />
        {(["1!F1","2@F2","3#F3","4$F4","5%F5","6^F6","7&F7","8*F8","9(F9","0)F10","-_F11","=+F12"] as const).map((pack) => {
          const d = pack[0];
          const s = pack[1];
          const f = pack.slice(2);
          return (
            <Key
              key={d}
              label={fn ? f : shift ? s : d}
              sub={fn ? "" : f}
              onPress={() => digit(d, s, f)}
            />
          );
        })}
        <Key label={fn ? "Del" : "⌫"} u={2} onPress={() => kbCommand(fn ? "delete" : ctrl ? "word-back" : "back")} />
      </div>
      <div className="osk-row">
        <Key label="Tab" u={1.5} onPress={() => kbCommand("tab")} />
        {"qwertyuiop".split("").map((c, i) => (
          <Key
            key={c}
            label={upper ? c.toUpperCase() : c}
            sub={fn && i === 6 ? "PgUp" : fn && i === 7 ? "↑" : fn && i === 8 ? "PgDn" : ""}
            onPress={() => letter(c)}
          />
        ))}
        <Key label={shift ? "{" : "["} onPress={() => emit(shift ? "{" : "[")} />
        <Key label={shift ? "}" : "]"} onPress={() => emit(shift ? "}" : "]")} />
        <Key label={shift ? "|" : "\\"} u={1.5} onPress={() => emit(shift ? "|" : "\\")} />
      </div>
      <div className="osk-row">
        <Key label="Caps" u={1.75} on={caps} onPress={() => useChromeStore.setState({ kbCaps: !caps })} />
        {"asdfghjkl".split("").map((c, i) => (
          <Key
            key={c}
            label={upper ? c.toUpperCase() : c}
            sub={fn && i === 6 ? "←" : fn && i === 7 ? "↓" : fn && i === 8 ? "→" : ""}
            onPress={() => letter(c)}
          />
        ))}
        <Key label={shift ? ":" : ";"} onPress={() => emit(shift ? ":" : ";")} />
        <Key label={shift ? "\"" : "'"} onPress={() => emit(shift ? "\"" : "'")} />
        <Key label="Enter" u={2.25} onPress={() => kbCommand("enter")} />
      </div>
      <div className="osk-row">
        <Key label="Shift" u={2.25} on={shift} onPress={() => useChromeStore.setState({ kbShift: !shift })} />
        {"zxcvbnm".split("").map((c) => (
          <Key key={c} label={upper ? c.toUpperCase() : c} onPress={() => letter(c)} />
        ))}
        <Key label={shift ? "<" : ","} onPress={() => emit(shift ? "<" : ",")} />
        <Key label={shift ? ">" : "."} onPress={() => emit(shift ? ">" : ".")} />
        <Key label={shift ? "?" : "/"} onPress={() => emit(shift ? "?" : "/")} />
        <Key label="Shift" u={2.75} on={shift} onPress={() => useChromeStore.setState({ kbShift: !shift })} />
      </div>
      <div className="osk-row">
        <Key label="Ctrl" u={1.25} on={ctrl} onPress={() => useChromeStore.setState({ kbCtrl: !ctrl })} />
        <Key label="" u={1.25} icon="/raspberry.png" onPress={() => undefined} />
        <Key label="Alt" u={1.25} on={alt} onPress={() => useChromeStore.setState({ kbAlt: !alt })} />
        <Key label="" u={6.25} onPress={() => emit(" ")} />
        <Key label="Alt" u={1.25} on={alt} onPress={() => useChromeStore.setState({ kbAlt: !alt })} />
        <Key label="Fn" u={1.25} on={fn} onPress={() => useChromeStore.setState({ kbFn: !fn })} />
        <Key label="Ctrl" u={1.25} on={ctrl} onPress={() => useChromeStore.setState({ kbCtrl: !ctrl })} />
      </div>
    </div>
  );
}
