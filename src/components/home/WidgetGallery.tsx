import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  WidgetType,
  WIDGET_LABELS,
} from "../../types/widgets";
import { useLayoutStore } from "../../store/layoutStore";
import { useCustomWidgetStore } from "../../store/customWidgetStore";
import { parseWidgetFile } from "../../slopbox/export";
import { filledSizes } from "../../slopbox/schema";
import { useSlopStore } from "../../slopbox/store";
import { overlayTransition } from "../../lib/performance";
import {
  GALLERY_SIZE_ORDER,
  galleryIndexForSize,
  galleryPreviewBox,
  gallerySizeAt,
  gallerySizeCaption,
  gallerySwipeIndex,
} from "../../lib/gallerySizes";
import { WidgetFace } from "../widgets/WidgetFace";
import { WidgetDemoProvider } from "../widgets/demo";
import { FieldTap } from "../chrome/FieldTap";
import { ConfirmSheet } from "../chrome/ConfirmSheet";
import { useChromeStore } from "../../store/chromeStore";

const PREVIEW_SOURCE: "live" | "image" = "live";

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
  const [notice, setNotice] = useState<string | null>(null);
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
  const sizes = GALLERY_SIZE_ORDER;
  const activeSize = gallerySizeAt(sizeIndex);
  const name = current.kind === "custom" ? (custom?.name ?? "Custom") : WIDGET_LABELS[current.type];
  const selKey = current.kind === "custom" ? `c:${current.id}` : `b:${current.type}`;
  const canAdd =
    current.kind === "builtin" || (custom ? filledSizes(custom).includes(activeSize) : false);

  useEffect(() => {
    setSizeIndex(0);
    setDragX(0);
  }, [selKey]);

  useEffect(() => {
    if (!open) {
      setNotice(null);
      if (useChromeStore.getState().kbField === "gallery-query") {
        useChromeStore.getState().closeKeyboard();
      }
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (typing) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(sizeIndex - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(sizeIndex + 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        addCurrent();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, sizeIndex, canAdd, current, activeSize]);

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const def = parseWidgetFile(await file.text());
      const id = importOne(def);
      setSelected({ kind: "custom", id });
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not import that file.");
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
    setSizeIndex(galleryIndexForSize(gallerySizeAt(next)));
    setDragX(0);
  };

  const addCurrent = () => {
    if (!canAdd || !activeSize) return;
    if (current.kind === "custom") addWidget("custom", activeSize, undefined, current.id);
    else addWidget(current.type, activeSize);
    setGalleryOpen(false);
  };

  const onSwipeDown = (e: React.PointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onSwipeMove = (e: React.PointerEvent) => {
    if (!swipe.current) return;
    setDragX(e.clientX - swipe.current.x);
  };

  const onSwipeUp = (e: React.PointerEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start) {
      setDragX(0);
      return;
    }
    const dx = e.clientX - start.x;
    const dy = Math.abs(e.clientY - start.y);
    if (Math.abs(dx) > Math.abs(dy)) {
      go(gallerySwipeIndex(sizeIndex, dx));
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
            role="dialog"
            aria-modal="true"
            aria-label="Add Widget"
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
              <FieldTap label="Search" field="gallery-query" value={query} onCommit={setQuery} live />
              <div className="wg-list">
                <button type="button" className="wg-list-item" onClick={() => openCreator()}>
                  <span className="wg-list-name">Creator</span>
                </button>
                <button type="button" className="wg-list-item" onClick={() => fileRef.current?.click()}>
                  <span className="wg-list-name">Import</span>
                </button>
                {visibleCustom.length > 0 &&
                  visibleCustom.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      className={`wg-list-item ${current.kind === "custom" && current.id === w.id ? "active" : ""}`}
                      onClick={() => setSelected({ kind: "custom", id: w.id })}
                    >
                      <span className="wg-list-name">{w.name}</span>
                    </button>
                  ))}
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
              </div>
            </div>

            <div className="wg-detail">
              <h3 className="wg-detail-name">{name}</h3>
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
                    transform: `translate3d(calc(${-sizeIndex * 100}% + ${dragX}px), 0, 0)`,
                    transition: swipe.current ? "none" : "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
                  }}
                >
                  {sizes.map((s) => {
                    const box = galleryPreviewBox(s);
                    return (
                      <div key={s} className="wg-slide">
                        <div
                          className="widget-shell wg-preview-shell"
                          style={{ width: box.w, height: box.h }}
                        >
                          <div className="widget-face">
                            {PREVIEW_SOURCE === "live" ? (
                              <WidgetDemoProvider>
                                <WidgetFace
                                  type={current.kind === "custom" ? "custom" : current.type}
                                  size={s}
                                  customId={current.kind === "custom" ? current.id : undefined}
                                />
                              </WidgetDemoProvider>
                            ) : (
                              <img
                                className="wg-thumb"
                                alt=""
                                src={`/previews/${current.kind === "custom" ? current.id : current.type}-${s}.png`}
                              />
                            )}
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
                    aria-label={gallerySizeCaption(s)}
                    className={`wg-dot ${i === sizeIndex ? "on" : ""}`}
                    onClick={() => go(i)}
                  />
                ))}
              </div>
              <p className="wg-size-caption">{gallerySizeCaption(activeSize)}</p>
              <div className="wg-actions">
                <button type="button" className="wg-cancel" onClick={() => setGalleryOpen(false)}>
                  Cancel
                </button>
                <button type="button" className="wg-add" onClick={addCurrent} disabled={!canAdd}>
                  Add Widget
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
      {notice && (
        <ConfirmSheet
          title="Could not import"
          body={notice}
          primary="OK"
          secondary="Close"
          onAccept={() => setNotice(null)}
          onDismiss={() => setNotice(null)}
        />
      )}
    </AnimatePresence>
  );
}
