import { SLOP_KINDS, SlopNode } from "./schema";

interface Props {
  nodes: SlopNode[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onFront: () => void;
  onBack: () => void;
  onDelete: () => void;
  disabled?: boolean;
}

function labelFor(node: SlopNode) {
  const kind = SLOP_KINDS.find((k) => k.kind === node.kind)?.label ?? node.kind;
  const extra = node.text?.trim() || node.descriptor?.trim();
  if (!extra) return kind;
  return extra.length > 22 ? `${kind} · ${extra.slice(0, 20)}…` : `${kind} · ${extra}`;
}

export function SlopExplorer({
  nodes,
  selectedId,
  onSelect,
  onFront,
  onBack,
  onDelete,
  disabled,
}: Props) {
  const listed = [...nodes].reverse();

  return (
    <div className="slop-block slop-explorer">
      <div className="slop-block-title">Elements</div>
      {listed.length === 0 ? (
        <p className="slop-hint" style={{ margin: 0 }}>
          Nothing on this size yet. Use Add.
        </p>
      ) : (
        <div className="slop-explorer-list">
          {listed.map((node) => (
            <button
              key={node.id}
              type="button"
              className={`slop-explorer-item ${node.id === selectedId ? "on" : ""}`}
              disabled={disabled}
              onClick={() => onSelect(node.id)}
            >
              {labelFor(node)}
            </button>
          ))}
        </div>
      )}
      <div className="slop-explorer-actions">
        <button type="button" disabled={disabled || !selectedId} onClick={onFront}>
          Front
        </button>
        <button type="button" disabled={disabled || !selectedId} onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="danger"
          disabled={disabled || !selectedId}
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
