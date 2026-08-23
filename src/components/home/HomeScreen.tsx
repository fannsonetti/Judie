import { useEffect, useRef, useState } from "react";
import { useLayoutStore } from "../../store/layoutStore";
import { useAssistantStore } from "../../store/assistantStore";
import { visiblePageCount } from "../../lib/layout";
import { StatusBar } from "./StatusBar";
import { HomePage } from "./HomePage";
import { PageIndicator } from "./PageIndicator";
import { EditModeControls } from "./EditModeControls";
import { WidgetGallery } from "./WidgetGallery";
import { WidgetCreatorOverlay } from "./WidgetCreatorOverlay";
import { ExpandedOverlay } from "./ExpandedOverlay";
import { CommandPalette } from "./CommandPalette";
import { SettingsOverlay } from "./SettingsOverlay";
import { Toasts } from "./Toasts";
import { DebugPanel } from "./DebugPanel";
import { JudieRuntime } from "../../runtime/JudieRuntime";

export function HomeScreen() {
  const widgets = useLayoutStore((s) => s.widgets);
  const currentPage = useLayoutStore((s) => s.currentPage);
  const setPage = useLayoutStore((s) => s.setPage);
  const editMode = useLayoutStore((s) => s.editMode);
  const expandedId = useLayoutStore((s) => s.expandedId);

  const pageCount = visiblePageCount(widgets, editMode);
  const canSwipe = pageCount > 1 && !editMode && !expandedId;

  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const pointer = useRef<{ startX: number; startY: number; active: boolean } | null>(null);
  const holdTimer = useRef<number | null>(null);
  const currentPageRef = useRef(currentPage);
  const pageCountRef = useRef(pageCount);
  const editModeRef = useRef(editMode);
  const expandedRef = useRef(expandedId);
  const canSwipeRef = useRef(canSwipe);
  currentPageRef.current = currentPage;
  pageCountRef.current = pageCount;
  editModeRef.current = editMode;
  expandedRef.current = expandedId;
  canSwipeRef.current = canSwipe;

  const pageWidth = () => viewportRef.current?.clientWidth ?? 1;

  const clearHold = () => {
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const applyTrack = (page: number, offsetPx: number, animate: boolean) => {
    const track = trackRef.current;
    const n = Math.max(1, pageCountRef.current);
    if (!track) return;
    const pct = -page * (100 / n) + (offsetPx / (pageWidth() * n)) * 100;
    track.style.transition = animate ? "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)" : "none";
    track.style.transform = `translate3d(${pct}%, 0, 0)`;
  };

  const ignoreHoldTarget = (target: HTMLElement) =>
    Boolean(
      target.closest(
        "input, button, textarea, select, .toggle, .slider, .wx-slider, .palette-backdrop, .palette-panel, .settings-backdrop, .settings-sheet, .edit-bar, .wg-backdrop, .wg-panel, .widget-remove, .widget-resize, .expanded-overlay"
      )
    );

  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (ignoreHoldTarget(target) || expandedRef.current) return;
    const overlay =
      useAssistantStore.getState().paletteOpen ||
      useAssistantStore.getState().settingsOpen ||
      useLayoutStore.getState().galleryOpen ||
      useLayoutStore.getState().creatorOpen;
    if (overlay) return;

    pointer.current = { startX: e.clientX, startY: e.clientY, active: false };
    dragOffsetRef.current = 0;

    if (!editModeRef.current) {
      const holdTarget = target;
      holdTimer.current = window.setTimeout(() => {
        holdTimer.current = null;
        pointer.current = null;
        useLayoutStore.getState().enterEditMode();
        const slot = holdTarget.closest("[data-widget-id]") as HTMLElement | null;
        if (slot?.dataset.widgetId) {
          useLayoutStore.getState().setDragging(slot.dataset.widgetId);
        }
      }, 450);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointer.current) return;
    const dx = e.clientX - pointer.current.startX;
    const dy = e.clientY - pointer.current.startY;
    if (Math.hypot(dx, dy) > 10) clearHold();

    if (!canSwipeRef.current) return;
    if (!pointer.current.active) {
      if (Math.abs(dx) < 12) return;
      pointer.current.active = true;
      setIsDragging(true);
      applyTrack(currentPageRef.current, 0, false);
      viewportRef.current?.setPointerCapture(e.pointerId);
    }
    dragOffsetRef.current = dx;
    applyTrack(currentPageRef.current, dx, false);
  };

  const endDrag = () => {
    clearHold();
    if (!pointer.current?.active) {
      pointer.current = null;
      return;
    }
    const dx = dragOffsetRef.current;
    const n = pageCountRef.current;
    const threshold = pageWidth() * 0.18;
    let next = currentPageRef.current;
    if (dx < -threshold && next < n - 1) next += 1;
    if (dx > threshold && next > 0) next -= 1;
    setPage(next);
    dragOffsetRef.current = 0;
    setIsDragging(false);
    pointer.current = null;
    applyTrack(next, 0, true);
  };

  useEffect(() => {
    if (!isDragging) applyTrack(currentPage, 0, true);
  }, [currentPage, pageCount, isDragging]);

  useEffect(() => {
    const onContext = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(".widget-shell")) {
        e.preventDefault();
      }
    };
    window.addEventListener("contextmenu", onContext);
    return () => window.removeEventListener("contextmenu", onContext);
  }, []);

  const pageWidthPct = `${100 / pageCount}%`;

  return (
    <div
      className="app-shell"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <JudieRuntime />
      <StatusBar />
      <div
        className={`home-viewport${pageCount > 1 ? " multi" : ""}`}
        ref={viewportRef}
      >
        <div
          className={`home-track${isDragging ? " swiping" : ""}`}
          ref={trackRef}
          style={{ width: `${pageCount * 100}%` }}
        >
          {Array.from({ length: pageCount }).map((_, page) => {
            const nearby =
              page === currentPage || (isDragging && Math.abs(page - currentPage) <= 1);
            return nearby ? (
              <HomePage
                key={page}
                page={page}
                widgets={widgets.filter((w) => w.page === page)}
                width={pageWidthPct}
              />
            ) : (
              <section
                key={page}
                className="home-page"
                style={{ width: pageWidthPct }}
                aria-hidden
              />
            );
          })}
        </div>

        {pageCount > 1 && <PageIndicator page={currentPage} count={pageCount} />}
        {editMode && <EditModeControls />}
      </div>

      <ExpandedOverlay />
      <WidgetGallery />
      <WidgetCreatorOverlay />
      <CommandPalette />
      <SettingsOverlay />
      <Toasts />
      <DebugPanel />
    </div>
  );
}
