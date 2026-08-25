import { useRef, useState, type CSSProperties } from "react";
import {
  ExpandableWidgetType,
  GRID_COLS,
  GRID_ROWS,
  PlacedWidget,
  SIZE_DIMS,
} from "../../types/widgets";
import { canPlaceWidget } from "../../lib/layout";
import { useLayoutStore } from "../../store/layoutStore";
import { WidgetFace } from "../widgets/WidgetFace";

const EXPANDABLE = new Set<string>(["weather", "lights", "media", "purifier", "calendar"]);

interface Props {
  widget: PlacedWidget;
  cellW: number;
  cellH: number;
  gap: number;
  offsetX?: number;
  offsetY?: number;
}

export function WidgetContainer({
  widget,
  cellW,
  cellH,
  gap,
  offsetX = 0,
  offsetY = 0,
}: Props) {
  const editMode = useLayoutStore((s) => s.editMode);
  const draggingId = useLayoutStore((s) => s.draggingId);
  const expandedId = useLayoutStore((s) => s.expandedId);
  const pendingRemoveId = useLayoutStore((s) => s.pendingRemoveId);
  const expandWidget = useLayoutStore((s) => s.expandWidget);
  const requestRemoveWidget = useLayoutStore((s) => s.requestRemoveWidget);
  const resizeWidget = useLayoutStore((s) => s.resizeWidget);
  const setDragging = useLayoutStore((s) => s.setDragging);
  const placeWidget = useLayoutStore((s) => s.placeWidget);

  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const grabOffset = useRef({ x: 0, y: 0 });
  const movedEnough = useRef(false);
  const draggingRef = useRef(false);
  const snapRef = useRef<{ col: number; row: number } | null>(null);
  const [dragDelta, setDragDelta] = useState({ x: 0, y: 0 });
  const [snapPreview, setSnapPreview] = useState<{ col: number; row: number } | null>(null);

  const dims = SIZE_DIMS[widget.size];
  const width = dims.cols * cellW;
  const height = dims.rows * cellH;
  const left = offsetX + widget.col * cellW;
  const top = offsetY + widget.row * cellH;

  const isHidden = expandedId === widget.id;
  const isDragging = draggingId === widget.id;
  const isPendingRemove = pendingRemoveId === widget.id;
  if (isDragging) draggingRef.current = true;

  const snapFromPoint = (clientX: number, clientY: number) => {
    const grid = document.querySelector(".widget-grid") as HTMLElement | null;
    if (!grid) return null;
    const rect = grid.getBoundingClientRect();
    const originX = clientX - grabOffset.current.x - rect.left - offsetX;
    const originY = clientY - grabOffset.current.y - rect.top - offsetY;
    const col = Math.max(0, Math.min(GRID_COLS - dims.cols, Math.round(originX / cellW)));
    const row = Math.max(0, Math.min(GRID_ROWS - dims.rows, Math.round(originY / cellH)));
    return { col, row };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (expandedId) return;
    const target = e.target as HTMLElement;
    if (
      target.closest(
        "button, input, textarea, select, .toggle, .slider, .wx-slider, .icon-btn, .widget-remove, .widget-resize"
      )
    ) {
      return;
    }

    pressStart.current = { x: e.clientX, y: e.clientY };
    movedEnough.current = false;
    draggingRef.current = false;
    snapRef.current = null;
    setSnapPreview(null);
    setDragDelta({ x: 0, y: 0 });

    const slot = e.currentTarget.parentElement as HTMLElement | null;
    if (slot) {
      const rect = slot.getBoundingClientRect();
      grabOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    if (editMode || draggingId === widget.id) {
      draggingRef.current = true;
      setDragging(widget.id);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pressStart.current) return;
    const dx = e.clientX - pressStart.current.x;
    const dy = e.clientY - pressStart.current.y;

    const draggingNow =
      draggingRef.current || useLayoutStore.getState().draggingId === widget.id;
    if (!draggingNow) {
      if (Math.hypot(dx, dy) > 10) movedEnough.current = true;
      return;
    }

    setDragDelta({ x: dx, y: dy });
    const snap = snapFromPoint(e.clientX, e.clientY);
    if (snap) {
      const ok = canPlaceWidget(useLayoutStore.getState().widgets, widget.id, snap.col, snap.row);
      snapRef.current = ok ? snap : null;
      setSnapPreview(ok ? snap : null);
    }
  };

  const onPointerUp = () => {
    const snap = snapRef.current;
    if (
      draggingRef.current &&
      snap &&
      (snap.col !== widget.col || snap.row !== widget.row)
    ) {
      placeWidget(widget.id, snap.col, snap.row);
    }
    draggingRef.current = false;
    setDragging(null);
    setDragDelta({ x: 0, y: 0 });
    setSnapPreview(null);
    snapRef.current = null;
    pressStart.current = null;
  };

  const onClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("input, button, .toggle, .slider, .icon-btn, .chip")) {
      return;
    }
    if (useLayoutStore.getState().editMode || movedEnough.current) {
      movedEnough.current = false;
      return;
    }
    if (EXPANDABLE.has(widget.type)) {
      expandWidget(widget.id, widget.type as ExpandableWidgetType);
    }
  };

  const slotStyle: CSSProperties = {
    left,
    top,
    width,
    height,
    padding: gap / 2,
    opacity: isHidden ? 0 : 1,
    pointerEvents: isHidden ? "none" : "auto",
    zIndex: isDragging ? 40 : isPendingRemove ? 35 : 1,
    transform: isDragging ? `translate3d(${dragDelta.x}px, ${dragDelta.y}px, 0)` : undefined,
  };

  const shellClass = [
    "widget-shell",
    editMode ? "edit-jiggle" : "",
    isDragging ? "dragging" : "",
    isPendingRemove ? "pending-remove" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const face = (
    <>
      {editMode && (
        <>
          <button
            type="button"
            className="widget-remove"
            aria-label="Remove widget"
            onClick={(e) => {
              e.stopPropagation();
              requestRemoveWidget(widget.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
              <path
                d="M2 2l6 6M8 2L2 8"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className="widget-resize"
            aria-label="Resize widget"
            onClick={(e) => {
              e.stopPropagation();
              resizeWidget(widget.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M16 21h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </>
      )}
      <div
        className="widget-face"
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          animationDelay: editMode ? `${(widget.order % 5) * 40}ms` : undefined,
        }}
      >
        <WidgetFace type={widget.type} size={widget.size} customId={widget.customId} />
      </div>
    </>
  );

  return (
    <>
      {isDragging && snapPreview && (snapPreview.col !== widget.col || snapPreview.row !== widget.row) && (
        <div
          className="widget-drop-ghost"
          style={{
            left: offsetX + snapPreview.col * cellW + gap / 2,
            top: offsetY + snapPreview.row * cellH + gap / 2,
            width: width - gap,
            height: height - gap,
          }}
          aria-hidden
        />
      )}
      <div className="widget-slot" data-widget-id={widget.id} style={slotStyle}>
        <div
          className={shellClass}
          style={editMode ? { animationDelay: `${(widget.order % 5) * 40}ms` } : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={onClick}
        >
          {face}
        </div>
      </div>
    </>
  );
}
