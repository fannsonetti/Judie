import { AnimatePresence, motion } from "framer-motion";
import { useLayoutStore } from "../../store/layoutStore";
import { LightsApp } from "../apps/LightsApp";
import { WeatherApp } from "../apps/WeatherApp";
import { MediaApp } from "../apps/MediaApp";
import { PurifierApp } from "../apps/PurifierApp";
import { CalendarApp } from "../apps/CalendarApp";

export function ExpandedOverlay() {
  const expandedId = useLayoutStore((s) => s.expandedId);
  const expandedType = useLayoutStore((s) => s.expandedType);
  const collapseWidget = useLayoutStore((s) => s.collapseWidget);

  return (
    <AnimatePresence>
      {expandedId && expandedType && (
        <motion.div
          className="expanded-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={collapseWidget}
        >
          <motion.div
            layoutId={`widget-${expandedId}`}
            className="expanded-app"
            onClick={(e) => e.stopPropagation()}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
          >
            <button
              type="button"
              className="expanded-close"
              aria-label="Close"
              onClick={collapseWidget}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
            <ExpandedBody type={expandedType} />
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
    default:
      return null;
  }
}
