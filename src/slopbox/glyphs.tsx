import { ReactNode } from "react";
import { SlopKind } from "./schema";
import { SlopIcon } from "./icons";

export const KIND_GLYPH: Record<SlopKind, ReactNode> = {
  text: <span className="slop-glyph-letter">A</span>,
  metric: <span className="slop-glyph-letter lg">42</span>,
  icon: <SlopIcon name="spark" size={16} />,
  bar: <span className="slop-glyph-bar" />,
  gauge: <SlopIcon name="activity" size={16} />,
  button: <span className="slop-glyph-btn" />,
  chip: <span className="slop-glyph-chip" />,
  divider: <span className="slop-glyph-line" />,
  box: <span className="slop-glyph-box" />,
  list: (
    <span className="slop-glyph-list" aria-hidden>
      <span />
      <span />
      <span />
    </span>
  ),
  pair: (
    <span className="slop-glyph-pair" aria-hidden>
      <span className="slop-glyph-pair-k" />
      <span className="slop-glyph-pair-v" />
    </span>
  ),
  toggle: <span className="slop-glyph-toggle" aria-hidden />,
};
