import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  WidgetType,
  WidgetSize,
  WIDGET_LABELS,
  WIDGET_SUPPORTED_SIZES,
} from "../../types/widgets";
import { useLayoutStore } from "../../store/layoutStore";

const DESCRIPTIONS: Record<WidgetType, string> = {
  activity: "See a live feed of what Nova and your automations have been doing.",
  calendar: "Keep track of your upcoming events and schedule at a glance.",
  climate: "Monitor indoor temperature, humidity, and comfort levels in real time.",
  lights: "Control your room lighting with quick toggles, brightness, and colour temperature.",
  media: "See what's playing, adjust volume, and skip tracks without leaving the home screen.",
  purifier: "Check air quality, AQI readings, and manage your air purifier settings.",
  quickControls: "One-tap access to your favourite scenes and room presets.",
  server: "Monitor the health and latency of local services and backend connections.",
  timers: "View and manage running timers, alarms, and reminders.",
  weather: "Stay ahead of the forecast with real-time local weather conditions and upcoming predictions.",
};

const SIZE_LABEL: Record<WidgetSize, string> = {
  "1x1": "Small",
  "1x2": "Medium",
  "2x2": "Large",
};

const SIZE_ASPECT: Record<WidgetSize, { w: number; h: number }> = {
  "1x1": { w: 80, h: 80 },
  "1x2": { w: 140, h: 80 },
  "2x2": { w: 140, h: 140 },
};

export function WidgetGallery() {
  const open = useLayoutStore((s) => s.galleryOpen);
  const setGalleryOpen = useLayoutStore((s) => s.setGalleryOpen);
  const addWidget = useLayoutStore((s) => s.addWidget);

  const types = useMemo(
    () =>
      (Object.keys(WIDGET_LABELS) as WidgetType[]).sort((a, b) =>
        WIDGET_LABELS[a].localeCompare(WIDGET_LABELS[b])
      ),
    []
  );

  const [selected, setSelected] = useState<WidgetType>(types[0]);
  const [hoveredSize, setHoveredSize] = useState<WidgetSize | null>(null);
  const [query, setQuery] = useState("");

  const visible = types.filter((t) =>
    WIDGET_LABELS[t].toLowerCase().includes(query.trim().toLowerCase())
  );
  const current = visible.includes(selected) ? selected : visible[0] ?? types[0];
  const sizes = WIDGET_SUPPORTED_SIZES[current];
  const activeSize = hoveredSize && sizes.includes(hoveredSize) ? hoveredSize : null;

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
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sidebar */}
            <div className="wg-sidebar">
              <h2 className="wg-title">Add Widget</h2>
              <div className="wg-search-box">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search"
                  aria-label="Search widgets"
                />
              </div>
              <div className="wg-list">
                {visible.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`wg-list-item ${type === current ? "active" : ""}`}
                    onClick={() => {
                      setSelected(type);
                      setHoveredSize(null);
                    }}
                  >
                    <span className="wg-list-name">{WIDGET_LABELS[type]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Detail pane */}
            <div className="wg-detail">
              <button
                type="button"
                className="wg-close"
                onClick={() => setGalleryOpen(false)}
              >
                ✕
              </button>

              <div className="wg-detail-top">
                <h3 className="wg-detail-name">{WIDGET_LABELS[current]}</h3>
                <p className="wg-detail-desc">{DESCRIPTIONS[current]}</p>
              </div>

              <div className="wg-divider" />

              <p className="wg-size-label">Choose a Size</p>

              <div className="wg-sizes">
                {sizes.map((s) => {
                  const dim = SIZE_ASPECT[s];
                  return (
                    <button
                      key={s}
                      type="button"
                      className={`wg-size-card ${activeSize === s ? "active" : ""}`}
                      onMouseEnter={() => setHoveredSize(s)}
                      onMouseLeave={() => setHoveredSize(null)}
                      onClick={() => {
                        addWidget(current, s);
                        setGalleryOpen(false);
                      }}
                    >
                      <div
                        className="wg-size-preview"
                        style={{ width: dim.w, height: dim.h }}
                      />
                      <span className="wg-size-name">{SIZE_LABEL[s]}</span>
                    </button>
                  );
                })}
              </div>

              <p className="wg-hint">Select a size to add this widget.</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
