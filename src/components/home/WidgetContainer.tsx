import { useEffect, useRef, useState, type CSSProperties } from "react";
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
const PULL = 0.46;
const SETTLE_MS = 280;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

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
  const setDragging = useLayoutStore((s) => s.setDragging);
  const placeWidget = useLayoutStore((s) => s.placeWidget);

  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const originCenter = useRef({ x: 0, y: 0 });
  const movedEnough = useRef(false);
  const draggingRef = useRef(false);
  const settlingRef = useRef(false);
  const centeredRef = useRef(false);
  const snapRef = useRef<{ col: number; row: number } | null>(null);
  const visualRef = useRef({ x: 0, y: 0 });
  const settleRaf = useRef(0);
  const [dragDelta, setDragDelta] = useState({ x: 0, y: 0 });

  const dims = SIZE_DIMS[widget.size];
  const width = dims.cols * cellW;
  const height = dims.rows * cellH;
  const left = offsetX + widget.col * cellW;
  const top = offsetY + widget.row * cellH;

  const isHidden = expandedId === widget.id;
  const isDragging = draggingId === widget.id;
  const isPendingRemove = pendingRemoveId === widget.id;
  if (isDragging) draggingRef.current = true;

  useEffect(() => {
    return () => {
      if (settleRaf.current) cancelAnimationFrame(settleRaf.current);
    };
  }, []);

  const snapFromPoint = (clientX: number, clientY: number) => {
    const grid = document.querySelector(".widget-grid") as HTMLElement | null;
    if (!grid) return null;
    const rect = grid.getBoundingClientRect();
    const originX = clientX - width / 2 - rect.left - offsetX;
    const originY = clientY - height / 2 - rect.top - offsetY;
    const col = Math.max(0, Math.min(GRID_COLS - dims.cols, Math.round(originX / cellW)));
    const row = Math.max(0, Math.min(GRID_ROWS - dims.rows, Math.round(originY / cellH)));
    return { col, row };
  };

  const snapDeltaFor = (snap: { col: number; row: number } | null) => {
    if (!snap) return { x: 0, y: 0 };
    return {
      x: (snap.col - widget.col) * cellW,
      y: (snap.row - widget.row) * cellH,
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (expandedId || settlingRef.current) return;
    const target = e.target as HTMLElement;
    if (target.closest(".widget-remove")) return;
    if (
      !editMode &&
      target.closest(
        "button, input, textarea, select, .toggle, .slider, .wx-slider, .icon-btn"
      )
    ) {
      return;
    }

    pressStart.current = { x: e.clientX, y: e.clientY };
    movedEnough.current = false;
    draggingRef.current = false;
    centeredRef.current = false;
    snapRef.current = null;
    setDragDelta({ x: 0, y: 0 });

    const slot = e.currentTarget.parentElement as HTMLElement | null;
    if (slot) {
      const rect = slot.getBoundingClientRect();
      originCenter.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }

    if (editMode || draggingId === widget.id) {
      draggingRef.current = true;
      setDragging(widget.id);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pressStart.current || settlingRef.current) return;
    const dx = e.clientX - pressStart.current.x;
    const dy = e.clientY - pressStart.current.y;

    const draggingNow =
      draggingRef.current || useLayoutStore.getState().draggingId === widget.id;
    if (!draggingNow) {
      if (Math.hypot(dx, dy) > 10) movedEnough.current = true;
      return;
    }

    if (!centeredRef.current) {
      if (Math.hypot(dx, dy) < 8) {
        visualRef.current = { x: dx, y: dy };
        setDragDelta({ x: dx, y: dy });
        return;
      }
      centeredRef.current = true;
    }

    const finger = {
      x: e.clientX - originCenter.current.x,
      y: e.clientY - originCenter.current.y,
    };
    const snap = snapFromPoint(e.clientX, e.clientY);
    const ok =
      snap && canPlaceWidget(useLayoutStore.getState().widgets, widget.id, snap.col, snap.row);
    snapRef.current = ok ? snap : null;
    const magnet = snapDeltaFor(ok ? snap : null);
    const visual = ok
      ? { x: lerp(finger.x, magnet.x, PULL), y: lerp(finger.y, magnet.y, PULL) }
      : finger;
    visualRef.current = visual;
    setDragDelta(visual);
  };

  const finishDrag = (toSnap: { col: number; row: number } | null) => {
    const from = visualRef.current;
    const magnet = snapDeltaFor(toSnap);
    if (toSnap && (toSnap.col !== widget.col || toSnap.row !== widget.row)) {
      placeWidget(widget.id, toSnap.col, toSnap.row);
    }
    const leftover = { x: from.x - magnet.x, y: from.y - magnet.y };
    settlingRef.current = true;
    draggingRef.current = false;
    setDragging(null);
    visualRef.current = leftover;
    setDragDelta(leftover);
    snapRef.current = null;
    pressStart.current = null;
    if (Math.hypot(leftover.x, leftover.y) < 0.5) {
      setDragDelta({ x: 0, y: 0 });
      visualRef.current = { x: 0, y: 0 };
      settlingRef.current = false;
      return;
    }
    const started = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / SETTLE_MS);
      const k = easeOutCubic(t);
      const next = { x: lerp(leftover.x, 0, k), y: lerp(leftover.y, 0, k) };
      visualRef.current = next;
      setDragDelta(next);
      if (t < 1) {
        settleRaf.current = requestAnimationFrame(tick);
        return;
      }
      setDragDelta({ x: 0, y: 0 });
      visualRef.current = { x: 0, y: 0 };
      settlingRef.current = false;
    };
    settleRaf.current = requestAnimationFrame(tick);
  };

  const onPointerUp = () => {
    if (settlingRef.current) return;
    if (!draggingRef.current && useLayoutStore.getState().draggingId !== widget.id) {
      pressStart.current = null;
      return;
    }
    finishDrag(snapRef.current);
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
    zIndex: isDragging || settlingRef.current ? 40 : isPendingRemove ? 35 : 1,
    transform:
      isDragging || dragDelta.x !== 0 || dragDelta.y !== 0
        ? `translate3d(${dragDelta.x}px, ${dragDelta.y}px, 0)`
        : undefined,
  };

  const shellClass = [
    "widget-shell",
    editMode ? "edit-jiggle" : "",
    isDragging ? "dragging" : "",
    isPendingRemove ? "pending-remove" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
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
        {editMode && (
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
      </div>
    </div>
  );
}
