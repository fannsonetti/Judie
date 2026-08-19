import { useEffect, useRef, useState } from "react";
import { useLayoutStore } from "../../store/layoutStore";
import { PAGE_COUNT } from "../../types/widgets";
import { StatusBar } from "./StatusBar";
import { HomePage } from "./HomePage";
import { PageIndicator } from "./PageIndicator";
import { EditModeControls } from "./EditModeControls";
import { WidgetGallery } from "./WidgetGallery";
import { ExpandedOverlay } from "./ExpandedOverlay";
import { CommandPalette } from "./CommandPalette";
import { SettingsOverlay } from "./SettingsOverlay";
import { Toasts } from "./Toasts";
import { DebugPanel } from "./DebugPanel";
import { NovaRuntime } from "../../runtime/NovaRuntime";

export function HomeScreen() {
  const widgets = useLayoutStore((s) => s.widgets);
  const currentPage = useLayoutStore((s) => s.currentPage);
  const setPage = useLayoutStore((s) => s.setPage);
  const editMode = useLayoutStore((s) => s.editMode);
  const expandedId = useLayoutStore((s) => s.expandedId);

  const viewportRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const pointer = useRef<{ x: number; startX: number; active: boolean } | null>(null);

  const pageWidth = () => viewportRef.current?.clientWidth ?? 1;

  const onPointerDown = (e: React.PointerEvent) => {
    if (editMode || expandedId) return;
    const target = e.target as HTMLElement;
    if (target.closest("input, button, .toggle, .slider, .palette-backdrop, .gallery-backdrop")) {
      return;
    }

    pointer.current = { x: e.clientX, startX: e.clientX, active: true };
    dragOffsetRef.current = 0;
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointer.current?.active) return;
    const dx = e.clientX - pointer.current.startX;
    dragOffsetRef.current = dx;
    setDragOffset(dx);
  };

  const endDrag = () => {
    if (!pointer.current?.active) return;
    const dx = dragOffsetRef.current;
    const threshold = pageWidth() * 0.18;
    let next = currentPage;
    if (dx < -threshold && currentPage < PAGE_COUNT - 1) next = currentPage + 1;
    if (dx > threshold && currentPage > 0) next = currentPage - 1;
    setPage(next);
    dragOffsetRef.current = 0;
    setDragOffset(0);
    setIsDragging(false);
    pointer.current = null;
  };

  const translate =
    -currentPage * (100 / PAGE_COUNT) + (dragOffset / (pageWidth() * PAGE_COUNT)) * 100;

  useEffect(() => {
    const onContext = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(".widget-shell")) {
        e.preventDefault();
      }
    };
    window.addEventListener("contextmenu", onContext);
    return () => window.removeEventListener("contextmenu", onContext);
  }, []);

  return (
    <div className="app-shell">
      <NovaRuntime />
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
          style={{
            transform: `translate3d(${translate}%, 0, 0)`,
            transition: isDragging ? "none" : "transform 0.38s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {Array.from({ length: PAGE_COUNT }).map((_, page) => (
            <HomePage
              key={page}
              page={page}
              widgets={widgets.filter((w) => w.page === page)}
            />
          ))}
        </div>

        <PageIndicator page={currentPage} />
        {editMode && <EditModeControls />}
      </div>

      <ExpandedOverlay />
      <WidgetGallery />
      <CommandPalette />
      <SettingsOverlay />
      <Toasts />
      <DebugPanel />
    </div>
  );
}
