import { useEffect, useRef, useState } from "react";
import { useLayoutStore } from "../../store/layoutStore";
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
import { usePerformanceStore } from "../../lib/performance";

export function HomeScreen() {
  const widgets = useLayoutStore((s) => s.widgets);
  const currentPage = useLayoutStore((s) => s.currentPage);
  const setPage = useLayoutStore((s) => s.setPage);
  const editMode = useLayoutStore((s) => s.editMode);
  const expandedId = useLayoutStore((s) => s.expandedId);
  const reduced = usePerformanceStore((s) => s.reduced);

  const pageCount = visiblePageCount(widgets, editMode);
  const canSwipe = pageCount > 1 && !editMode && !expandedId;

  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const pointer = useRef<{ startX: number; active: boolean } | null>(null);
  const currentPageRef = useRef(currentPage);
  const pageCountRef = useRef(pageCount);
  const reducedRef = useRef(reduced);
  currentPageRef.current = currentPage;
  pageCountRef.current = pageCount;
  reducedRef.current = reduced;

  const pageWidth = () => viewportRef.current?.clientWidth ?? 1;

  const applyTrack = (page: number, offsetPx: number, animate: boolean) => {
    const track = trackRef.current;
    const n = Math.max(1, pageCountRef.current);
    if (!track) return;
    const pct = -page * (100 / n) + (offsetPx / (pageWidth() * n)) * 100;
    track.style.transition = animate
      ? reducedRef.current
        ? "transform 0.16s ease-out"
        : "transform 0.38s cubic-bezier(0.22, 1, 0.36, 1)"
      : "none";
    track.style.transform = `translate3d(${pct}%, 0, 0)`;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!canSwipe) return;
    const target = e.target as HTMLElement;
    if (target.closest("input, button, .toggle, .slider, .palette-backdrop, .settings-backdrop")) {
      return;
    }

    pointer.current = { startX: e.clientX, active: true };
    dragOffsetRef.current = 0;
    setIsDragging(true);
    applyTrack(currentPageRef.current, 0, false);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointer.current?.active) return;
    const dx = e.clientX - pointer.current.startX;
    dragOffsetRef.current = dx;
    applyTrack(currentPageRef.current, dx, false);
  };

  const endDrag = () => {
    if (!pointer.current?.active) return;
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
  }, [currentPage, pageCount, reduced, isDragging]);

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
    <div className="app-shell">
      <JudieRuntime />
      <StatusBar />
      <div
        className="home-viewport"
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="home-track"
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
