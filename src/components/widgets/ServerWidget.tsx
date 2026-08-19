import { useRoomStore } from "../../store/roomStore";

interface Props {
  size: string;
}

export function ServerWidget({ size }: Props) {
  const server = useRoomStore((s) => s.server);
  const medium = size === "1x2";

  return (
    <div className="wx server fill">
      <div className="wx-head">
        <span className="wx-app-name">Server</span>
        <span className="wx-muted">{server.online ? "Online" : "Offline"}</span>
      </div>
      <div className="wx-metric sm">{server.online ? "Online" : "Offline"}</div>
      <div className="wx-muted">{server.latency} ms latency</div>
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
