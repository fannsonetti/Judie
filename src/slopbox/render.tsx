import { CSSProperties } from "react";
import { WidgetSize } from "../types/widgets";
import { Gauge } from "../components/widgets/chrome";
import { SlopIcon } from "./icons";
import { CANONICAL, nodesFor, scaleFor, SlopDef, SlopNode } from "./schema";

interface LayerProps {
  def: SlopDef;
  size: WidgetSize;
  width: number;
  height: number;
}

export function SlopLayer({ def, size, width, height }: LayerProps) {
  const nodes = nodesFor(def, size);
  const scale = scaleFor(size, width, height);
  return (
    <div
      className="slop-face"
      style={{
        width: "100%",
        height: "100%",
      }}
    >
      {nodes.map((node) => (
        <SlopNodeView key={node.id} node={node} scale={scale} size={size} />
      ))}
    </div>
  );
}

export function SlopNodeView({
  node,
  scale,
  size,
}: {
  node: SlopNode;
  scale: number;
  size: WidgetSize;
}) {
  const font = (node.fontSize ?? 13) * scale;
  const radius = (node.radius ?? 0) * scale;
  const align = node.align ?? "left";
  const valign = node.valign ?? "middle";
  const justify =
    valign === "top" ? "flex-start" : valign === "bottom" ? "flex-end" : "center";
  const textAlign = align;
  const color = node.color ?? "var(--text)";
  const common: CSSProperties = {
    position: "absolute",
    left: `${node.x}%`,
    top: `${node.y}%`,
    width: `${node.w}%`,
    height: `${node.h}%`,
    opacity: node.opacity ?? 1,
    color,
    overflow: "hidden",
    pointerEvents: "none",
    userSelect: "none",
  };
  const hook = node.descriptor?.trim();
  const hookProps = {
    "data-kind": node.kind,
    ...(hook ? { "data-hook": hook } : {}),
  };

  if (node.kind === "bar") {
    return (
      <div style={common} {...hookProps}>
        <div
          className="slop-bar"
          style={{
            background: node.fill ?? "rgba(255,255,255,0.08)",
            borderRadius: radius || 99,
          }}
        >
          <div
            className="slop-bar-fill"
            style={{
              width: `${Math.max(0, Math.min(100, node.value ?? 0))}%`,
              background: node.accent ?? "var(--accent)",
              borderRadius: "inherit",
            }}
          />
        </div>
      </div>
    );
  }

  if (node.kind === "gauge") {
    const px = Math.min(
      (node.w / 100) * CANONICAL[size].w * scale,
      (node.h / 100) * CANONICAL[size].h * scale
    );
    return (
      <div style={{ ...common, display: "grid", placeItems: "center" }} {...hookProps}>
        <Gauge pct={(node.value ?? 0) / 100} color={node.accent ?? "var(--accent)"} size={px}>
          <strong style={{ fontSize: Math.max(11, font) }}>{node.text ?? node.value}</strong>
        </Gauge>
      </div>
    );
  }

  if (node.kind === "icon") {
    const px = Math.min(
      (node.w / 100) * CANONICAL[size].w * scale,
      (node.h / 100) * CANONICAL[size].h * scale
    );
    return (
      <div style={{ ...common, display: "grid", placeItems: "center", color }} {...hookProps}>
        {node.svg ? (
          <div
            className="slop-custom-svg"
            style={{ width: Math.max(12, px), height: Math.max(12, px) }}
            dangerouslySetInnerHTML={{ __html: node.svg }}
          />
        ) : (
          <SlopIcon name={node.icon} size={Math.max(12, px * 0.72)} />
        )}
      </div>
    );
  }

  if (node.kind === "divider" || node.kind === "box") {
    return (
      <div
        style={{
          ...common,
          background: node.fill ?? (node.kind === "divider" ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)"),
          borderRadius: radius || (node.kind === "box" ? 16 * scale : 99),
        }}
        {...hookProps}
      />
    );
  }

  if (node.kind === "button" || node.kind === "chip") {
    return (
      <div
        style={{
          ...common,
          display: "flex",
          alignItems: justify === "flex-start" || justify === "flex-end" ? justify : "center",
          justifyContent:
            align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
          background: node.fill ?? (node.kind === "button" ? "var(--accent)" : "rgba(255,255,255,0.08)"),
          borderRadius: radius || (node.kind === "chip" ? 99 : 12 * scale),
          padding: `0 ${8 * scale}px`,
          fontSize: font,
          fontWeight: node.fontWeight ?? 600,
          letterSpacing: (node.letterSpacing ?? 0) * scale,
          textAlign,
          whiteSpace: "nowrap",
        }}
        {...hookProps}
      >
        {node.text}
      </div>
    );
  }

  return (
    <div
      style={{
        ...common,
        display: "flex",
        alignItems: justify,
        justifyContent:
          align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
        fontSize: font,
        fontWeight: node.fontWeight ?? (node.kind === "metric" ? 650 : 500),
        letterSpacing: (node.letterSpacing ?? (node.kind === "metric" ? -1.2 : 0)) * scale,
        textAlign,
        whiteSpace: node.kind === "metric" ? "nowrap" : "pre-wrap",
        lineHeight: node.kind === "metric" ? 0.95 : 1.2,
      }}
      {...hookProps}
    >
      {node.text}
    </div>
  );
}
