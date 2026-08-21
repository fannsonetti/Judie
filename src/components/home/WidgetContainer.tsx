import { ReactNode, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ExpandableWidgetType,
  PlacedWidget,
  SIZE_DIMS,
} from "../../types/widgets";
import { useLayoutStore } from "../../store/layoutStore";
import { WeatherWidget } from "../widgets/WeatherWidget";
import { LightsWidget } from "../widgets/LightsWidget";
import { MediaWidget } from "../widgets/MediaWidget";
import { CalendarWidget } from "../widgets/CalendarWidget";
import { ClimateWidget } from "../widgets/ClimateWidget";
import { PurifierWidget } from "../widgets/PurifierWidget";
import { QuickControlsWidget } from "../widgets/QuickControlsWidget";
import { ServerWidget } from "../widgets/ServerWidget";
import { ActivityWidget } from "../widgets/ActivityWidget";
import { TimersWidget } from "../widgets/TimersWidget";
import { SlopWidget } from "../widgets/SlopWidget";
import { overlayTransition, usePerformanceStore } from "../../lib/performance";

const EXPANDABLE = new Set<string>(["weather", "lights", "media", "purifier", "calendar"]);

interface Props {
  widget: PlacedWidget;
  cellW: number;
  cellH: number;
  gap: number;
}

export function WidgetContainer({ widget, cellW, cellH, gap }: Props) {
  const editMode = useLayoutStore((s) => s.editMode);
  const draggingId = useLayoutStore((s) => s.draggingId);
  const expandedId = useLayoutStore((s) => s.expandedId);
  const enterEditMode = useLayoutStore((s) => s.enterEditMode);
  const expandWidget = useLayoutStore((s) => s.expandWidget);
  const removeWidget = useLayoutStore((s) => s.removeWidget);
  const resizeWidget = useLayoutStore((s) => s.resizeWidget);
  const setDragging = useLayoutStore((s) => s.setDragging);
  const reorder = useLayoutStore((s) => s.reorder);
  const reduced = usePerformanceStore((s) => s.reduced);

  const longPressTimer = useRef<number | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const didLongPress = useRef(false);
  const movedEnough = useRef(false);
  const draggingRef = useRef(false);
  const lastTarget = useRef<string | null>(null);
  const [dragDelta, setDragDelta] = useState({ x: 0, y: 0 });

  const dims = SIZE_DIMS[widget.size];
  const width = dims.cols * cellW;
  const height = dims.rows * cellH;
  const left = widget.col * cellW;
  const top = widget.row * cellH;

  const isHidden = expandedId === widget.id;
  const isDragging = draggingId === widget.id;

  const clearLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const findTargetId = (x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const slot = el?.closest("[data-widget-id]") as HTMLElement | null;
    return slot?.dataset.widgetId ?? null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (expandedId) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, input, textarea, select, .toggle, .slider, .wx-slider, .icon-btn, .widget-remove, .widget-resize")) {
      return;
    }

    pressStart.current = { x: e.clientX, y: e.clientY };
    didLongPress.current = false;
    movedEnough.current = false;
    draggingRef.current = false;
    lastTarget.current = null;
    setDragDelta({ x: 0, y: 0 });

    if (!editMode) {
      longPressTimer.current = window.setTimeout(() => {
        didLongPress.current = true;
        enterEditMode();
        draggingRef.current = true;
        setDragging(widget.id);
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }, 500);
    } else {
      draggingRef.current = true;
      setDragging(widget.id);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pressStart.current) return;
    const dx = e.clientX - pressStart.current.x;
    const dy = e.clientY - pressStart.current.y;

    if (!draggingRef.current) {
      if (Math.hypot(dx, dy) > 10) {
        movedEnough.current = true;
        clearLongPress();
      }
      return;
    }

    setDragDelta({ x: dx, y: dy });

    const targetId = findTargetId(e.clientX, e.clientY);
    if (targetId && targetId !== widget.id && targetId !== lastTarget.current) {
      lastTarget.current = targetId;
      reorder(widget.id, targetId);
      pressStart.current = {
        x: e.clientX - dx,
        y: e.clientY - dy,
      };
    }
  };

  const onPointerUp = () => {
    clearLongPress();
    draggingRef.current = false;
    setDragging(null);
    setDragDelta({ x: 0, y: 0 });
    pressStart.current = null;
    lastTarget.current = null;
  };

  const onClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("input, button, .toggle, .slider, .icon-btn, .chip")) {
      return;
    }
    if (editMode || didLongPress.current || movedEnough.current) {
      didLongPress.current = false;
      movedEnough.current = false;
      return;
    }
    if (EXPANDABLE.has(widget.type)) {
      expandWidget(widget.id, widget.type as ExpandableWidgetType);
    }
  };

  return (
    <motion.div
      className="widget-slot"
      layout={!isDragging && !reduced}
      data-widget-id={widget.id}
      transition={overlayTransition(reduced)}
      style={{
        left,
        top,
        width,
        height,
        padding: gap / 2,
        opacity: isHidden ? 0 : 1,
        pointerEvents: isHidden ? "none" : "auto",
        zIndex: isDragging ? 40 : 1,
        transform: isDragging
          ? `translate3d(${dragDelta.x}px, ${dragDelta.y}px, 0)`
          : undefined,
      }}
    >
      <motion.div
        layoutId={reduced ? undefined : `widget-${widget.id}`}
        className={`widget-shell ${editMode ? "edit-jiggle" : ""} ${isDragging ? "dragging" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onClick}
      >
        {editMode && (
          <>
            <button
              type="button"
              className="widget-remove"
              aria-label="Remove widget"
              onClick={(e) => {
                e.stopPropagation();
                removeWidget(widget.id);
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              −
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
              {widget.size}
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
          <WidgetBody widget={widget} />
        </div>
      </motion.div>
    </motion.div>
  );
}

function WidgetBody({ widget }: { widget: PlacedWidget }): ReactNode {
  switch (widget.type) {
    case "weather":
      return <WeatherWidget size={widget.size} />;
    case "lights":
      return <LightsWidget size={widget.size} />;
    case "media":
      return <MediaWidget size={widget.size} />;
    case "calendar":
      return <CalendarWidget size={widget.size} />;
    case "climate":
      return <ClimateWidget size={widget.size} />;
    case "purifier":
      return <PurifierWidget size={widget.size} />;
    case "quickControls":
      return <QuickControlsWidget size={widget.size} />;
    case "server":
      return <ServerWidget size={widget.size} />;
    case "activity":
      return <ActivityWidget size={widget.size} />;
    case "timers":
      return <TimersWidget size={widget.size} />;
    case "custom":
      return <SlopWidget customId={widget.customId} size={widget.size} />;
    default:
      return null;
  }
}
