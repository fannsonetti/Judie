import type { WidgetSize } from "../../types/widgets";

export function PongWidget({ size }: { size: WidgetSize }) {
  return (
    <div className={`wx pong-preview fill size-${size}`}>
      <div className="pong-net" />
      <div className="pong-paddle left" style={{ top: "42%" }} />
      <div className="pong-paddle right" style={{ top: "42%" }} />
      <div className="pong-ball" style={{ left: "50%", top: "50%" }} />
    </div>
  );
}
