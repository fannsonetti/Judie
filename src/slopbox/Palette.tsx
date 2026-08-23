import { SLOP_KINDS, SlopKind } from "./schema";
import { KIND_GLYPH } from "./glyphs";

interface Props {
  onAdd: (kind: SlopKind) => void;
}

export function SlopPalette({ onAdd }: Props) {
  return (
    <div className="slop-palette">
      {SLOP_KINDS.map((item) => (
        <button key={item.kind} type="button" onClick={() => onAdd(item.kind)}>
          {KIND_GLYPH[item.kind]}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
