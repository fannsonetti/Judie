import { useRoomStore } from "../../store/roomStore";
import { DEMO_SERVER } from "../../lib/demoStats";
import { useWidgetDemo } from "./demo";

interface Props {
  size: string;
}

export function ServerWidget({ size }: Props) {
  const demo = useWidgetDemo();
  const live = useRoomStore((s) => s.server);
  const server = demo ? DEMO_SERVER : live;
  const medium = size === "1x2";
  const up = server.services.filter((s) => s.online).length;

  return (
    <div className="wx server fill">
      <div className="wx-metric sm">{server.online ? `${server.latency} ms` : "Offline"}</div>
      <div className="wx-muted">{up}/{server.services.length} up</div>
      <div className="svc-list grow">
        {(medium ? server.services : server.services.slice(0, 3)).map((svc) => (
          <div key={svc.name} className="svc-row">
            <span className={`status-dot ${svc.online ? "" : "offline"}`} />
            <span>{svc.name}</span>
            <em>{svc.online ? `${svc.latency} ms` : "Down"}</em>
          </div>
        ))}
      </div>
    </div>
  );
}
