import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAssistantStore } from "../../store/assistantStore";
import { useLayoutStore } from "../../store/layoutStore";
import { useRoomStore } from "../../store/roomStore";
import { SCENE_PRESETS } from "../../lib/mockData";
import { WIDGET_LABELS, WidgetType } from "../../types/widgets";

interface Hit {
  id: string;
  title: string;
  hint: string;
  run: () => void;
}

export function CommandPalette() {
  const open = useAssistantStore((s) => s.paletteOpen);
  const setOpen = useAssistantStore((s) => s.setPaletteOpen);
  const execute = useAssistantStore((s) => s.execute);
  const lastResponse = useAssistantStore((s) => s.lastResponse);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const lights = useRoomStore((s) => s.lights);
  const routines = useRoomStore((s) => s.routines);
  const setPage = useLayoutStore((s) => s.setPage);
  const addWidget = useLayoutStore((s) => s.addWidget);

  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const hits = useMemo<Hit[]>(() => {
    const n = q.trim().toLowerCase();
    const items: Hit[] = [
      {
        id: "ask",
        title: q.trim() ? `Ask Judie: ${q.trim()}` : "Type a command…",
        hint: "Enter",
        run: () => {
          if (!q.trim()) return;
          void execute(q.trim(), "assistant", false);
          setOpen(false);
        },
      },
      ...lights.map((l) => ({
        id: `light-${l.id}`,
        title: l.on ? `Turn off ${l.name}` : `Turn on ${l.name}`,
        hint: "Light",
        run: () => {
          void execute(`turn ${l.on ? "off" : "on"} ${l.name}`, "user", false);
          setOpen(false);
        },
      })),
      ...Object.keys(SCENE_PRESETS).map((scene) => ({
        id: `scene-${scene}`,
        title: `${scene} scene`,
        hint: "Scene",
        run: () => {
          useRoomStore.getState().setScene(scene as keyof typeof SCENE_PRESETS);
          setOpen(false);
        },
      })),
      ...routines.map((r) => ({
        id: `routine-${r.id}`,
        title: r.name,
        hint: "Routine",
        run: () => {
          void execute(r.phrases[0], "routine", false);
          setOpen(false);
        },
      })),
      {
        id: "undo",
        title: "Undo last action",
        hint: "Undo",
        run: () => {
          void execute("undo", "user", false);
          setOpen(false);
        },
      },
      ...(["weather", "lights", "media", "activity", "timers"] as WidgetType[]).map((type) => ({
        id: `add-${type}`,
        title: `Add ${WIDGET_LABELS[type]} widget`,
        hint: "Widget",
        run: () => {
          addWidget(type, "1x2");
          setOpen(false);
        },
      })),
      {
        id: "page-0",
        title: "Go to page 1",
        hint: "Nav",
        run: () => {
          setPage(0);
          setOpen(false);
        },
      },
      {
        id: "settings",
        title: "Open settings",
        hint: "Settings",
        run: () => {
          setOpen(false);
          useAssistantStore.getState().setSettingsOpen(true);
        },
      },
      {
        id: "widget-creator",
        title: "Open Widget Creator",
        hint: "Widget",
        run: () => {
          setOpen(false);
          useLayoutStore.getState().setCreatorOpen(true);
        },
      },
    ];
    if (!n) return items.slice(0, 12);
    return items.filter(
      (i) => i.title.toLowerCase().includes(n) || i.hint.toLowerCase().includes(n)
    );
  }, [q, lights, routines, execute, setOpen, addWidget, setPage]);

  if (!open) return null;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(hits.length - 1, s + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      (hits[sel] ?? hits[0])?.run();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="palette-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setOpen(false)}
      >
        <motion.div
          className="palette-panel"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            ref={inputRef}
            className="palette-input"
            placeholder="Hey Judie — lights off, dim, mute, 12 times 7…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={onKey}
            aria-label="Command"
          />
          {lastResponse && !q && (
            <div className="palette-reply">{lastResponse}</div>
          )}
          <div className="palette-list">
            {hits.map((h, i) => (
              <button
                key={h.id}
                type="button"
                className={`palette-item ${i === sel ? "active" : ""}`}
                onMouseEnter={() => setSel(i)}
                onClick={h.run}
              >
                <span>{h.title}</span>
                <span className="w-secondary">{h.hint}</span>
              </button>
            ))}
            {hits.length === 0 && <div className="palette-empty">No matches</div>}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
