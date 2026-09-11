import { useAssistantStore } from "../../store/assistantStore";
import { useLayoutStore } from "../../store/layoutStore";
import type { ExpandableWidgetType } from "../../types/widgets";

const TABS: { id: string; label: string; glyph: string; kind?: ExpandableWidgetType }[] = [
  { id: "home", label: "HOME", glyph: "⌂" },
  { id: "lights", label: "LIGHTS", glyph: "💡", kind: "lights" },
  { id: "climate", label: "CLIMATE", glyph: "🌡", kind: "climate" },
  { id: "calendar", label: "CALENDAR", glyph: "📅", kind: "calendar" },
  { id: "weather", label: "WEATHER", glyph: "☁", kind: "weather" },
  { id: "media", label: "MEDIA", glyph: "♪", kind: "media" },
  { id: "purifier", label: "PURIFIER", glyph: "◌", kind: "purifier" },
  { id: "terminal", label: "TERMINAL", glyph: ">_", kind: "terminal" },
  { id: "pong", label: "PONG", glyph: "▬", kind: "pong" },
  { id: "settings", label: "SETTINGS", glyph: "⚙" },
];

export function SideRail() {
  const expandedType = useLayoutStore((s) => s.expandedType);
  const settingsOpen = useAssistantStore((s) => s.settingsOpen);

  const active = settingsOpen ? "settings" : expandedType ?? "home";

  const go = (tab: (typeof TABS)[number]) => {
    if (tab.id === "home") {
      useLayoutStore.getState().collapseWidget();
      useAssistantStore.getState().setSettingsOpen(false);
      useAssistantStore.getState().setPaletteOpen(false);
      return;
    }
    if (tab.id === "settings") {
      useLayoutStore.getState().collapseWidget();
      useAssistantStore.getState().setSettingsOpen(true);
      return;
    }
    if (tab.kind) {
      useAssistantStore.getState().setSettingsOpen(false);
      useLayoutStore.getState().expandKind(tab.kind);
    }
  };

  return (
    <aside className="side-rail" aria-label="Panel">
      <div className="side-rail-brand">
        <PiMark />
        <span>PANEL</span>
      </div>
      <div className="side-rail-rule" />
      <nav className="side-rail-tabs">
        {TABS.map((tab) => {
          const on = active === tab.id || (tab.id === "home" && active === "home");
          return (
            <button
              key={tab.id}
              type="button"
              className={`side-rail-tab${on ? " on" : ""}`}
              onClick={() => go(tab)}
            >
              <span className="side-rail-glyph" aria-hidden>
                {tab.glyph}
              </span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function PiMark() {
  return (
    <svg className="pi-mark" viewBox="0 0 160 120" width={64} height={48} aria-hidden>
      <rect x={6} y={18} width={148} height={14} fill="#fff" />
      <rect x={6} y={18} width={14} height={40} fill="#fff" />
      <rect x={144} y={18} width={10} height={26} fill="#fff" />
      <rect x={52} y={18} width={22} height={92} fill="#fff" />
      <rect x={102} y={18} width={12} height={76} fill="#fff" />
    </svg>
  );
}
