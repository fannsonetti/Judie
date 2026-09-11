import { useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLayoutStore } from "../../store/layoutStore";
import { useChromeStore } from "../../store/chromeStore";
import { LightsApp } from "../apps/LightsApp";
import { WeatherApp } from "../apps/WeatherApp";
import { MediaApp } from "../apps/MediaApp";
import { PurifierApp } from "../apps/PurifierApp";
import { CalendarApp } from "../apps/CalendarApp";
import { ClimateApp } from "../apps/ClimateApp";
import { PongApp } from "../apps/PongApp";
import { TerminalApp } from "../apps/TerminalApp";
import {
  beginSettingsDrag,
  inCloseEdge,
  moveSettingsDrag,
  settleTarget,
  shouldCompleteSettings,
  type SettingsDrag,
} from "../../lib/settingsSheet";

export function ExpandedOverlay() {
  const expandedId = useLayoutStore((s) => s.expandedId);
  const expandedType = useLayoutStore((s) => s.expandedType);
  const collapseWidget = useLayoutStore((s) => s.collapseWidget);
  const closeDrag = useRef<SettingsDrag | null>(null);

  const finishClose = (y: number, cancelled: boolean) => {
    const drag = closeDrag.current;
    closeDrag.current = null;
    if (!drag?.locked) return;
    const moved = moveSettingsDrag(drag, y, window.innerHeight || 1, performance.now());
    const target = settleTarget(moved.kind, shouldCompleteSettings(moved, cancelled));
    if (target === 0) collapseWidget();
  };

  return (
    <AnimatePresence>
      {expandedId && expandedType && (
        <motion.div
          className="expanded-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div className="expanded-app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ExpandedBody type={expandedType} />
            <div
              className="expanded-handle"
              onPointerDown={(e) => {
                closeDrag.current = beginSettingsDrag("close", e.clientY, 1, performance.now());
                const move = (ev: PointerEvent) => {
                  const drag = closeDrag.current;
                  if (!drag) return;
                  closeDrag.current = moveSettingsDrag(drag, ev.clientY, window.innerHeight || 1, performance.now());
                };
                const up = (ev: PointerEvent) => {
                  window.removeEventListener("pointermove", move);
                  window.removeEventListener("pointerup", up);
                  window.removeEventListener("pointercancel", cancel);
                  finishClose(ev.clientY, false);
                };
                const cancel = (ev: PointerEvent) => {
                  window.removeEventListener("pointermove", move);
                  window.removeEventListener("pointerup", up);
                  window.removeEventListener("pointercancel", cancel);
                  finishClose(ev.clientY, true);
                };
                window.addEventListener("pointermove", move, { passive: false });
                window.addEventListener("pointerup", up);
                window.addEventListener("pointercancel", cancel);
                if (!inCloseEdge(e.clientY, window.innerHeight || 1)) {
                  /* still allow the 28px handle */
                }
                useChromeStore.getState().setNetMenuOpen(false);
                useChromeStore.getState().setVolMenuOpen(false);
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ExpandedBody({ type }: { type: string }) {
  switch (type) {
    case "lights":
      return <LightsApp />;
    case "weather":
      return <WeatherApp />;
    case "media":
      return <MediaApp />;
    case "purifier":
      return <PurifierApp />;
    case "calendar":
      return <CalendarApp />;
    case "climate":
      return <ClimateApp />;
    case "pong":
      return <PongApp />;
    case "terminal":
      return <TerminalApp />;
    default:
      return null;
  }
}
