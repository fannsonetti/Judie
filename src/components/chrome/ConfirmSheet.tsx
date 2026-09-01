import type { ReactNode } from "react";

export function ConfirmSheet({
  title,
  body,
  primary = "Continue",
  secondary = "Cancel",
  onAccept,
  onDismiss,
  children,
}: {
  title: string;
  body?: string;
  primary?: string;
  secondary?: string;
  onAccept: () => void;
  onDismiss: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="confirm-backdrop" onClick={onDismiss}>
      <div className="confirm-sheet os-confirm" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <h2>{title}</h2>
        {body ? <p>{body}</p> : null}
        {children}
        <div className="confirm-actions">
          <button type="button" className="os-pill" onClick={onDismiss}>
            {secondary}
          </button>
          <button type="button" className="os-pill on" onClick={onAccept}>
            {primary}
          </button>
        </div>
      </div>
    </div>
  );
}
