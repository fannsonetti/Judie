import { filledSizes } from "./schema";
import { useSlopStore } from "./store";
import { TEMPLATES } from "./templates";
import { useState } from "react";

interface Props {
  onPick: (id: string) => void;
  onImport: () => void;
  onClose?: () => void;
}

export function SlopSidebar({ onPick, onImport, onClose }: Props) {
  const widgets = useSlopStore((s) => s.widgets);
  const selectedId = useSlopStore((s) => s.selectedId);
  const create = useSlopStore((s) => s.create);
  const duplicate = useSlopStore((s) => s.duplicate);
  const remove = useSlopStore((s) => s.remove);
  const [menu, setMenu] = useState(false);

  return (
    <aside className="slop-sidebar">
      <div className="slop-sidebar-head">
        <div>
          <div className="slop-brand">Widget Creator</div>
          <div className="slop-brand-sub">Design in Judie</div>
        </div>
        <div className="slop-new-wrap">
          {onClose && (
            <button type="button" className="slop-done" onClick={onClose} title="Back to home">
              Done
            </button>
          )}
          <button type="button" className="slop-new" onClick={() => setMenu((v) => !v)}>
            New
          </button>
          {menu && (
            <div className="slop-new-menu">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    const id = create(t.id);
                    onPick(id);
                    setMenu(false);
                  }}
                >
                  <strong>{t.label}</strong>
                  <span>{t.hint}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="slop-widget-list">
        {widgets.length === 0 && (
          <p className="slop-hint">No widgets yet. Hit New, or import a .json export.</p>
        )}
        {widgets.map((w) => {
          const available = filledSizes(w);
          return (
            <div
              key={w.id}
              className={`slop-widget-item ${w.id === selectedId ? "active" : ""}`}
            >
              <button type="button" className="slop-widget-main" onClick={() => onPick(w.id)}>
                <strong>{w.name}</strong>
                <span>
                  {available.length ? available.join(" · ") : "not on home screen"}
                </span>
              </button>
              <div className="slop-widget-actions">
                <button type="button" onClick={() => duplicate(w.id)} title="Duplicate">
                  ⧉
                </button>
                <button type="button" onClick={() => remove(w.id)} title="Delete">
                  −
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="slop-sidebar-foot">
        <button type="button" className="slop-import-btn" onClick={onImport}>
          Import JSON
        </button>
      </div>
    </aside>
  );
}
