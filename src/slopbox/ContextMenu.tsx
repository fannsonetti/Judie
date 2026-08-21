import { useEffect } from "react";

export interface MenuItem {
  id: string;
  label: string;
  disabled?: boolean;
  danger?: boolean;
  separator?: boolean;
}

interface Props {
  x: number;
  y: number;
  items: MenuItem[];
  onPick: (id: string) => void;
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onPick, onClose }: Props) {
  useEffect(() => {
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const left = Math.min(x, window.innerWidth - 220);
  const top = Math.min(y, window.innerHeight - 16 - items.length * 32);

  return (
    <div
      className="slop-ctx"
      style={{ left, top }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {items.map((item) =>
        item.separator ? (
          <div key={item.id} className="slop-ctx-sep" />
        ) : (
          <button
            key={item.id}
            type="button"
            disabled={item.disabled}
            className={item.danger ? "danger" : ""}
            onClick={() => {
              onPick(item.id);
              onClose();
            }}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  );
}
