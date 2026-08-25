import { useRoomStore } from "../../store/roomStore";
import { useActivityStore } from "../../store/activityStore";
import { Ico } from "./chrome";
import { useWidgetDemo } from "./demo";

const ACTIONS = [
  { id: "goodNight" as const, label: "Good Night", icon: "night" },
  { id: "lightsOff" as const, label: "Lights Off", icon: "bulb" },
  { id: "dnd" as const, label: "Do Not Disturb", icon: "dnd" },
  { id: "movie" as const, label: "Movie Mode", icon: "play" },
];

function ActionIcon({ name }: { name: string }) {
  if (name === "night") return <Ico size={18}><path d="M15 3a8 8 0 1 0 6 13A7 7 0 0 1 15 3z" /></Ico>;
  if (name === "bulb") return <Ico size={18}><path d="M9 18h6M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" /></Ico>;
  if (name === "dnd") return <Ico size={18}><circle cx="12" cy="12" r="9" /><path d="M6 6l12 12" /></Ico>;
  return <Ico size={18}><path d="M8 5v14l12-7L8 5z" /></Ico>;
}

interface Props {
  size?: string;
}

export function QuickControlsWidget({ size = "1x2" }: Props) {
  const demo = useWidgetDemo();
  const applyQuickControl = useRoomStore((s) => s.applyQuickControl);
  const liveDnd = useRoomStore((s) => s.doNotDisturb);
  const doNotDisturb = demo ? false : liveDnd;
  const small = size === "1x1";

  return (
    <div className="wx quick fill" onPointerDown={(e) => e.stopPropagation()}>
      <div className={`quick-grid grow ${small ? "tiny" : ""}`}>
        {ACTIONS.map((a) => {
          const active = a.id === "dnd" && doNotDisturb;
          return (
            <button
              key={a.id}
              type="button"
              className={`quick-btn ${active ? "on" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                if (demo) return;
                applyQuickControl(a.id);
                useActivityStore.getState().push({
                  source: a.id === "goodNight" || a.id === "movie" ? "routine" : "user",
                  title: a.label,
                  outcome: "ok",
                });
              }}
            >
              <span className="quick-glyph"><ActionIcon name={a.icon} /></span>
              <span>{a.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
