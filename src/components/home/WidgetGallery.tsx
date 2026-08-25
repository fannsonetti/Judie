import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  WidgetType,
  WidgetSize,
  WIDGET_LABELS,
  WIDGET_SUPPORTED_SIZES,
} from "../../types/widgets";
import { useLayoutStore } from "../../store/layoutStore";
import { useCustomWidgetStore } from "../../store/customWidgetStore";
import { parseWidgetFile } from "../../slopbox/export";
import { filledSizes } from "../../slopbox/schema";
import { useSlopStore } from "../../slopbox/store";
import { overlayTransition } from "../../lib/performance";
import { liveFrame, liveShellSize } from "../../lib/widgetGrid";
import { WidgetFace } from "../widgets/WidgetFace";
import { WidgetDemoProvider } from "../widgets/demo";

const DESCRIPTIONS: Record<Exclude<WidgetType, "custom">, string> = {
  activity: "See a live feed of what Judie and your automations have been doing.",
  calendar: "Keep track of your upcoming events and schedule at a glance.",
  climate: "Monitor indoor temperature, humidity, and comfort levels in real time.",
  lights: "Control your room lighting with quick toggles, brightness, and colour temperature.",
  media: "See what's playing, adjust volume, and skip tracks without leaving the home screen.",
  purifier: "Check air quality, AQI readings, and manage your air purifier settings.",
  quickControls: "One-tap access to your favourite scenes and room presets.",
  server: "Monitor the health and latency of local services and backend connections.",
  timers: "View and manage running timers, alarms, and reminders.",
  system: "Live CPU and memory from this computer, plus the processes using the most.",
  weather: "Stay ahead of the forecast with real-time local weather conditions and upcoming predictions.",
};

const SIZE_LABEL: Record<WidgetSize, string> = {
  "1x1": "Small",
  "1x2": "Medium",
  "2x2": "Large",
};

type Sel = { kind: "builtin"; type: Exclude<WidgetType, "custom"> } | { kind: "custom"; id: string };

export function WidgetGallery() {
  const open = useLayoutStore((s) => s.galleryOpen);
  const setGalleryOpen = useLayoutStore((s) => s.setGalleryOpen);
  const setCreatorOpen = useLayoutStore((s) => s.setCreatorOpen);
  const addWidget = useLayoutStore((s) => s.addWidget);
  const customWidgets = useCustomWidgetStore((s) => s.widgets);
  const importOne = useCustomWidgetStore((s) => s.importOne);
  const fileRef = useRef<HTMLInputElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const [dragX, setDragX] = useState(0);

  const types = useMemo(
    () =>
      (Object.keys(WIDGET_LABELS) as WidgetType[])
        .filter((t): t is Exclude<WidgetType, "custom"> => t !== "custom")
        .sort((a, b) => WIDGET_LABELS[a].localeCompare(WIDGET_LABELS[b])),
    []
  );

  const [selected, setSelected] = useState<Sel>({ kind: "builtin", type: types[0] });
  const [sizeIndex, setSizeIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [frame, setFrame] = useState(() => liveFrame());
  const q = query.trim().toLowerCase();

  const visible = types.filter((t) => WIDGET_LABELS[t].toLowerCase().includes(q));
  const visibleCustom = customWidgets.filter((w) => w.name.toLowerCase().includes(q));

  const current: Sel =
    selected.kind === "builtin" && visible.includes(selected.type)
      ? selected
      : selected.kind === "custom" && visibleCustom.some((w) => w.id === selected.id)
        ? selected
        : visible[0]
          ? { kind: "builtin", type: visible[0] }
          : visibleCustom[0]
            ? { kind: "custom", id: visibleCustom[0].id }
            : { kind: "builtin", type: types[0] };

  const custom = current.kind === "custom" ? customWidgets.find((w) => w.id === current.id) : null;
  const sizes =
    current.kind === "custom"
      ? custom
        ? filledSizes(custom)
        : []
      : WIDGET_SUPPORTED_SIZES[current.type];
  const activeSize = sizes[Math.min(sizeIndex, Math.max(0, sizes.length - 1))] ?? sizes[0];
  const name = current.kind === "custom" ? (custom?.name ?? "Custom") : WIDGET_LABELS[current.type];
  const desc =
    current.kind === "custom"
      ? "Custom widget from Widget Creator. Swipe to pick a size, then add it to Home."
      : DESCRIPTIONS[current.type];
  const selKey = current.kind === "custom" ? `c:${current.id}` : `b:${current.type}`;

  useEffect(() => {
    setSizeIndex(0);
    setDragX(0);
  }, [selKey]);

  useEffect(() => {
    if (!open) return;
    const sync = () => setFrame(liveFrame());
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [open]);

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const def = parseWidgetFile(await file.text());
      const id = importOne(def);
      setSelected({ kind: "custom", id });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not import that file.");
    }
  };

  const openCreator = (editId?: string) => {
    if (editId) {
      const def = customWidgets.find((w) => w.id === editId);
      if (def) {
        useSlopStore.getState().importOne(def);
        useSlopStore.getState().select(def.id);
      }
    }
    setCreatorOpen(true);
  };

  const go = (next: number) => {
    if (sizes.length === 0) return;
    setSizeIndex(Math.max(0, Math.min(sizes.length - 1, next)));
    setDragX(0);
  };

  const addCurrent = () => {
    if (!activeSize) return;
    if (current.kind === "custom") addWidget("custom", activeSize, undefined, current.id);
    else addWidget(current.type, activeSize);
    setGalleryOpen(false);
  };

  const onSwipeDown = (e: React.PointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onSwipeMove = (e: React.PointerEvent) => {
    if (!swipe.current || sizes.length < 2) return;
    setDragX(e.clientX - swipe.current.x);
  };

  const onSwipeUp = (e: React.PointerEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start || sizes.length < 2) {
      setDragX(0);
      return;
    }
    const dx = e.clientX - start.x;
    const dy = Math.abs(e.clientY - start.y);
    if (Math.abs(dx) > 48 && Math.abs(dx) > dy) {
      go(sizeIndex + (dx < 0 ? 1 : -1));
    } else {
      setDragX(0);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="wg-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setGalleryOpen(false)}
        >
          <motion.div
            className="wg-panel"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={overlayTransition()}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json,.judie-widget.json,.nova-widget.json"
              hidden
              onChange={(e) => {
                void importFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <div className="wg-sidebar">
              <h2 className="wg-title">Add Widget</h2>
              <div className="wg-search-box">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search"
                  aria-label="Search widgets"
                />
              </div>
              <div className="wg-list">
                <button
                  type="button"
                  className="wg-list-item"
                  onClick={() => openCreator()}
                >
                  <span className="wg-list-name">Open Widget Creator…</span>
                </button>
                <button
                  type="button"
                  className="wg-list-item"
                  onClick={() => fileRef.current?.click()}
                >
                  <span className="wg-list-name">Import widget file…</span>
                </button>
                {visibleCustom.length > 0 && (
                  <>
                    <div className="wg-list-heading">Custom</div>
                    {visibleCustom.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        className={`wg-list-item ${current.kind === "custom" && current.id === w.id ? "active" : ""}`}
                        onClick={() => setSelected({ kind: "custom", id: w.id })}
                      >
                        <span className="wg-list-name">{w.name}</span>
                      </button>
                    ))}
                  </>
                )}
                {visible.length > 0 && (
                  <>
                    <div className="wg-list-heading">Built-in</div>
                    {visible.map((type) => (
                      <button
                        key={type}
                        type="button"
                        className={`wg-list-item ${current.kind === "builtin" && type === current.type ? "active" : ""}`}
                        onClick={() => setSelected({ kind: "builtin", type })}
                      >
                        <span className="wg-list-name">{WIDGET_LABELS[type]}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>

            <div className="wg-detail">
              <button
                type="button"
                className="wg-close"
                onClick={() => setGalleryOpen(false)}
              >
                ✕
              </button>

              <div className="wg-detail-top">
                <h3 className="wg-detail-name">{name}</h3>
                <p className="wg-detail-desc">{desc}</p>
              </div>

              {sizes.length === 0 ? (
                <p className="wg-hint">
                  This widget has no completed sizes. Open Widget Creator and lay out at least one size.
                </p>
              ) : (
                <>
                  <div
                    className="wg-carousel"
                    onPointerDown={onSwipeDown}
                    onPointerMove={onSwipeMove}
                    onPointerUp={onSwipeUp}
                    onPointerCancel={() => {
                      swipe.current = null;
                      setDragX(0);
                    }}
                  >
                    <div
                      className="wg-track"
                      style={{
                        transform: `translate3d(calc(${-Math.min(sizeIndex, Math.max(0, sizes.length - 1)) * 100}% + ${dragX}px), 0, 0)`,
                        transition: swipe.current ? "none" : "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
                      }}
                    >
                      {sizes.map((s) => {
                        const box = liveShellSize(s, frame);
                        return (
                          <div key={s} className="wg-slide">
                            <div
                              className="widget-shell wg-preview-shell"
                              style={{
                                width: box.w,
                                height: box.h,
                              }}
                            >
                              <div className="widget-face">
                                <WidgetDemoProvider>
                                  <WidgetFace
                                    type={current.kind === "custom" ? "custom" : current.type}
                                    size={s}
                                    customId={current.kind === "custom" ? current.id : undefined}
                                  />
                                </WidgetDemoProvider>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="wg-dots" role="tablist" aria-label="Widget sizes">
                    {sizes.map((s, i) => (
                      <button
                        key={s}
                        type="button"
                        role="tab"
                        aria-selected={i === sizeIndex}
                        className={`wg-dot ${i === sizeIndex ? "on" : ""}`}
                        onClick={() => go(i)}
                      />
                    ))}
                  </div>
                  <p className="wg-size-caption">{activeSize ? SIZE_LABEL[activeSize] : ""}</p>
                  <button type="button" className="wg-add" onClick={addCurrent}>
                    Add to Home
                  </button>
                </>
              )}

              {current.kind === "custom" && (
                <button
                  type="button"
                  className="wg-hint-btn"
                  onClick={() => openCreator(current.id)}
                >
                  Edit in Widget Creator
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
