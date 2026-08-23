import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAssistantStore } from "../../store/assistantStore";
import { useLayoutStore } from "../../store/layoutStore";
import { useRoomStore } from "../../store/roomStore";
import { SCENE_PRESETS } from "../../lib/mockData";
import { WIDGET_LABELS, WidgetType } from "../../types/widgets";
import { overlayTransition, usePerformanceStore } from "../../lib/performance";

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
  const status = useAssistantStore((s) => s.status);
  const startListening = useAssistantStore((s) => s.startListening);
  const stopListening = useAssistantStore((s) => s.stopListening);
  const reduced = usePerformanceStore((s) => s.reduced);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const swipe = useRef<{ y: number } | null>(null);
  const lights = useRoomStore((s) => s.lights);
  const routines = useRoomStore((s) => s.routines);
  const setPage = useLayoutStore((s) => s.setPage);
  const addWidget = useLayoutStore((s) => s.addWidget);
  const listening = status === "listening";

  useEffect(() => {
    if (!open) return;
    setQ("");
    setSel(0);
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
      ...(["weather", "lights", "media", "activity", "timers", "system"] as WidgetType[]).map(
        (type) => ({
          id: `add-${type}`,
          title: `Add ${WIDGET_LABELS[type]} widget`,
          hint: "Widget",
          run: () => {
            addWidget(type, "1x2");
            setOpen(false);
          },
        })
      ),
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
        id: "widget-creator",
        title: "Open Widget Creator",
        hint: "Widget",
        run: () => {
          setOpen(false);
          useLayoutStore.getState().setCreatorOpen(true);
        },
      },
    ];
    if (!n) return items.slice(0, 8);
    return items.filter(
      (i) => i.title.toLowerCase().includes(n) || i.hint.toLowerCase().includes(n)
    );
  }, [q, lights, routines, execute, setOpen, addWidget, setPage]);

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

  const onSheetPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("input, button, .palette-list")) return;
    swipe.current = { y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onSheetPointerUp = (e: React.PointerEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    if (start.y - e.clientY > 40) setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="palette-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            className="palette-panel"
            initial={{ opacity: 0, y: reduced ? -8 : -28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? -6 : -20 }}
            transition={overlayTransition(reduced)}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={onSheetPointerDown}
            onPointerUp={onSheetPointerUp}
          >
            <div className="cc-grab" aria-hidden />
            <div className="cc-tiles">
              <button
                type="button"
                className={`cc-tile ${listening ? "on" : ""}`}
                onClick={() => (listening ? stopListening() : startListening())}
              >
                <span className={`judie-orb ${status}`} />
                {listening ? "Listening" : "Listen"}
              </button>
              <button
                type="button"
                className="cc-tile"
                onClick={() => {
                  setOpen(false);
                  useAssistantStore.getState().setSettingsOpen(true);
                }}
              >
                Settings
              </button>
              <button
                type="button"
                className="cc-tile"
                onClick={() => {
                  setOpen(false);
                  useLayoutStore.getState().enterEditMode();
                }}
              >
                Edit Home
              </button>
            </div>
            <input
              ref={inputRef}
              className="palette-input"
              placeholder="Search or ask Judie"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setSel(0);
              }}
              onKeyDown={onKey}
              aria-label="Search"
            />
            {lastResponse && !q && <div className="palette-reply">{lastResponse}</div>}
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
      )}
    </AnimatePresence>
  );
}
