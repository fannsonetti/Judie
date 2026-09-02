import { FieldTap } from "../chrome/FieldTap";
import {
  draftFromRoutine,
  isRoutineDirty,
  routineFieldsValid,
  routineStatusLabel,
  validateRoutineFields,
  type RoutineDraft,
} from "../../lib/routineEditor";
import type { RoutineSnap } from "../../assistant/types";

export function RoutineEditorCard({
  draft,
  saved,
  onChange,
  onSave,
  onCancel,
  onDuplicate,
  onToggle,
  onDelete,
}: {
  draft: RoutineDraft;
  saved?: RoutineSnap;
  onChange: (patch: Partial<RoutineDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
  onDuplicate: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const errors = draft.builtin
    ? { name: "", phrase: "", command: "" }
    : validateRoutineFields(draft.name, draft.phrase, draft.command);
  const valid = draft.builtin || routineFieldsValid(errors);
  const dirty = isRoutineDirty(draft, saved);
  const status = routineStatusLabel(draft, saved);
  const title = draft.name.trim() || (draft.isNew ? "New routine" : "Routine");

  return (
    <section className="routine-editor" aria-label={title}>
      <div className="routine-editor-head">
        <div className="routine-editor-title">{title}</div>
        <div className="routine-editor-status">{status}</div>
      </div>
      <FieldTap
        label="Routine name"
        field={`routine-name:${draft.id}`}
        value={draft.name}
        error={errors.name}
        readOnly={draft.builtin}
        live
        onCommit={(v) => onChange({ name: v })}
      />
      <FieldTap
        label="When you say"
        field={`routine-phrase:${draft.id}`}
        value={draft.phrase}
        error={errors.phrase}
        readOnly={draft.builtin}
        live
        onCommit={(v) => onChange({ phrase: v })}
      />
      <FieldTap
        label="Judie should"
        field={`routine-command:${draft.id}`}
        value={draft.command}
        error={errors.command}
        readOnly={draft.builtin}
        live
        onCommit={(v) => onChange({ command: v })}
      />
      <div className="routine-editor-actions">
        <button type="button" className="os-pill on" disabled={!dirty || !valid} onClick={onSave}>
          Save
        </button>
        <button type="button" className="os-pill" disabled={!dirty && !draft.isNew} onClick={onCancel}>
          Cancel
        </button>
      </div>
      <div className="routine-editor-tools">
        <button type="button" className="os-pill" onClick={onDuplicate}>
          Duplicate
        </button>
        <button type="button" className="os-pill" onClick={onToggle}>
          {draft.enabled ? "Disable" : "Enable"}
        </button>
        {!draft.builtin ? (
          <button type="button" className="os-pill" onClick={onDelete}>
            Delete
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function draftsFromRoutines(routines: RoutineSnap[], drafts: RoutineDraft[]): RoutineDraft[] {
  const news = drafts.filter((d) => d.isNew);
  const byId = new Map(drafts.map((d) => [d.id, d]));
  const existing = routines.map((r) => {
    const current = byId.get(r.id);
    if (current && !current.isNew && isRoutineDirty(current, r)) return current;
    return draftFromRoutine(r);
  });
  return [...news, ...existing];
}
