import { useEffect, useRef, useState, type ReactNode } from "react";

export interface DropItem {
  id: string;
  label: string;
  disabled?: boolean;
  danger?: boolean;
}

interface Props {
  label: string;
  items?: DropItem[];
  onPick?: (id: string) => void;
  primary?: boolean;
  disabled?: boolean;
  children?: ReactNode;
}

export function SlopDropMenu({
  label,
  items,
  onPick,
  primary,
  disabled,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="slop-drop" ref={wrap}>
      <button
        type="button"
        className={primary ? "primary" : ""}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {label}
        <span className="slop-drop-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div className="slop-drop-panel" onClick={() => setOpen(false)}>
          {children ??
            items?.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={item.disabled}
                className={item.danger ? "danger" : ""}
                onClick={() => {
                  onPick?.(item.id);
                  setOpen(false);
                }}
              >
                {item.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
