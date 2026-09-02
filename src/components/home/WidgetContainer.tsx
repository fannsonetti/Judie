import { useEffect, useRef, type CSSProperties, type RefObject } from "react";
import { ExpandableWidgetType, PlacedWidget, SIZE_DIMS } from "../../types/widgets";
import { nearestPlace } from "../../lib/layout";
import { dropCell, leftoverDelta } from "../../lib/widgetDrag";
import { useLayoutStore } from "../../store/layoutStore";
import { WidgetFace } from "../widgets/WidgetFace";

const EXPANDABLE = new Set<string>(["weather", "lights", "media", "purifier", "calendar"]);
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
  dragLayerRef: RefObject<HTMLDivElement | null>;
}

export function WidgetContainer({
  widget,
  cellW,
  cellH,
  gap,
  offsetX = 0,
  offsetY = 0,
  dragLayerRef,
}: Props) {
  const editMode = useLayoutStore((s) => s.editMode);
  const expandedId = useLayoutStore((s) => s.expandedId);
  const pendingRemoveId = useLayoutStore((s) => s.pendingRemoveId);
  const expandWidget = useLayoutStore((s) => s.expandWidget);
  const setDragging = useLayoutStore((s) => s.setDragging);
  const placeWidget = useLayoutStore((s) => s.placeWidget);

  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const lastPtr = useRef<{ x: number; y: number } | null>(null);
  const movedEnough = useRef(false);
  const draggingRef = useRef(false);
  const settlingRef = useRef(false);
  const visualRef = useRef({ x: 0, y: 0 });
  const settleRaf = useRef(0);
  const shellRef = useRef<HTMLDivElement>(null);
  const cloneRef = useRef<HTMLElement | null>(null);

  const dims = SIZE_DIMS[widget.size];
  const width = dims.cols * cellW;
  const height = dims.rows * cellH;
  const left = offsetX + widget.col * cellW;
  const top = offsetY + widget.row * cellH;

  const isHidden = expandedId === widget.id;
  const isPendingRemove = pendingRemoveId === widget.id;

  useEffect(() => {
    return () => {
      if (settleRaf.current) cancelAnimationFrame(settleRaf.current);
      cloneRef.current?.remove();
      cloneRef.current = null;
    };
  }, []);

  const placeClone = (dx: number, dy: number) => {
    const clone = cloneRef.current;
    if (!clone) return;
    clone.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
  };

  const liftIntoLayer = () => {
    const shell = shellRef.current;
    const layer = dragLayerRef.current;
    const grid = layer?.parentElement;
    if (!shell || !layer || !grid || cloneRef.current) return;
    const gridRect = grid.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    const clone = shell.cloneNode(true) as HTMLElement;
    clone.classList.add("dragging");
    clone.setAttribute("aria-hidden", "true");
    clone.style.position = "absolute";
    clone.style.left = `${shellRect.left - gridRect.left}px`;
    clone.style.top = `${shellRect.top - gridRect.top}px`;
    clone.style.width = `${shellRect.width}px`;
    clone.style.height = `${shellRect.height}px`;
    clone.style.margin = "0";
    clone.style.right = "auto";
    clone.style.bottom = "auto";
    clone.style.transform = "none";
    clone.style.transition = "none";
    clone.style.animation = "none";
    clone.style.pointerEvents = "none";
    layer.replaceChildren(clone);
    cloneRef.current = clone;
    shell.style.visibility = "hidden";
  };

  const dropClone = () => {
    cloneRef.current?.remove();
    cloneRef.current = null;
    if (shellRef.current) shellRef.current.style.visibility = "";
  };

  const abortSettle = () => {
    if (settleRaf.current) cancelAnimationFrame(settleRaf.current);
    settleRaf.current = 0;
    if (!settlingRef.current) return;
    dropClone();
    visualRef.current = { x: 0, y: 0 };
    settlingRef.current = false;
  };

  const snapFromDelta = (dx: number, dy: number) => {
    const raw = dropCell(widget.col, widget.row, dx, dy, cellW, dims.cols, dims.rows);
    return nearestPlace(useLayoutStore.getState().widgets, widget.id, raw.col, raw.row);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (expandedId) return;
    abortSettle();
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
    lastPtr.current = { x: e.clientX, y: e.clientY };
    movedEnough.current = false;
    draggingRef.current = false;
    visualRef.current = { x: 0, y: 0 };

    if (editMode) {
      draggingRef.current = true;
      setDragging(widget.id);
      liftIntoLayer();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pressStart.current || settlingRef.current) return;
    const dx = e.clientX - pressStart.current.x;
    const dy = e.clientY - pressStart.current.y;
    lastPtr.current = { x: e.clientX, y: e.clientY };

    if (!draggingRef.current) {
      if (Math.hypot(dx, dy) > 10) movedEnough.current = true;
      return;
    }

    visualRef.current = { x: dx, y: dy };
    placeClone(dx, dy);
  };

  const glideClone = (from: { x: number; y: number }, then: () => void) => {
    if (Math.hypot(from.x, from.y) < 0.5) {
      then();
      return;
    }
    const started = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / SETTLE_MS);
      const k = easeOutCubic(t);
      const next = { x: lerp(from.x, 0, k), y: lerp(from.y, 0, k) };
      visualRef.current = next;
      placeClone(next.x, next.y);
      if (t < 1) {
        settleRaf.current = requestAnimationFrame(tick);
        return;
      }
      then();
    };
    settleRaf.current = requestAnimationFrame(tick);
  };

  const finishDrag = (cancelled: boolean) => {
    if (settlingRef.current) return;
    if (!draggingRef.current) {
      pressStart.current = null;
      return;
    }
    const from = visualRef.current;
    settlingRef.current = true;
    draggingRef.current = false;
    setDragging(null);
    pressStart.current = null;

    let leftover = from;
    if (!cancelled) {
      const snap = snapFromDelta(from.x, from.y);
      if (snap) {
        leftover = leftoverDelta(from.x, from.y, widget.col, widget.row, snap.col, snap.row, cellW);
        const clone = cloneRef.current;
        if (clone) {
          const nextLeft = parseFloat(clone.style.left) + (snap.col - widget.col) * cellW;
          const nextTop = parseFloat(clone.style.top) + (snap.row - widget.row) * cellH;
          clone.style.left = `${nextLeft}px`;
          clone.style.top = `${nextTop}px`;
        }
        if (snap.col !== widget.col || snap.row !== widget.row) {
          placeWidget(widget.id, snap.col, snap.row);
        }
      }
    }

    lastPtr.current = null;
    visualRef.current = leftover;
    placeClone(leftover.x, leftover.y);
    glideClone(leftover, () => {
      dropClone();
      visualRef.current = { x: 0, y: 0 };
      settlingRef.current = false;
    });
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
  };

  const shellClass = [
    "widget-shell",
    editMode ? "edit-jiggle" : "",
    isPendingRemove ? "pending-remove" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="widget-slot" data-widget-id={widget.id} style={slotStyle}>
      <div
        ref={shellRef}
        className={shellClass}
        style={editMode ? { animationDelay: `${(widget.order % 5) * 40}ms` } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => finishDrag(false)}
        onPointerCancel={() => finishDrag(true)}
        onClick={onClick}
      >
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
