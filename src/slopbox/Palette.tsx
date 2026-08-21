import { ReactNode } from "react";
import { SLOP_KINDS, SlopKind } from "./schema";
import { SlopIcon } from "./icons";

interface Props {
  onAdd: (kind: SlopKind) => void;
}

const GLYPH: Record<SlopKind, ReactNode> = {
  text: <span className="slop-glyph-letter">A</span>,
  metric: <span className="slop-glyph-letter lg">42</span>,
  icon: <SlopIcon name="spark" size={16} />,
  bar: <span className="slop-glyph-bar" />,
  gauge: <SlopIcon name="activity" size={16} />,
  button: <span className="slop-glyph-btn" />,
  chip: <span className="slop-glyph-chip" />,
  divider: <span className="slop-glyph-line" />,
  box: <span className="slop-glyph-box" />,
};

export function SlopPalette({ onAdd }: Props) {
  return (
    <div className="slop-palette">
      {SLOP_KINDS.map((item) => (
        <button key={item.kind} type="button" onClick={() => onAdd(item.kind)}>
          {GLYPH[item.kind]}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
