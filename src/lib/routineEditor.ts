import { RoutineSnap } from "../assistant/types";

export type RoutineField = "name" | "phrase" | "command";

export type RoutineDraft = {
  id: string;
  name: string;
  phrase: string;
  command: string;
  enabled: boolean;
  builtin: boolean;
  isNew: boolean;
};

export type RoutineFieldErrors = {
  name: string;
  phrase: string;
  command: string;
};

export function migrateRoutine(routine: RoutineSnap): RoutineSnap {
  return {
    ...routine,
    enabled: routine.enabled !== false,
    phrases: routine.phrases ?? [],
    command: routine.command ?? "",
  };
}

export function phraseOf(routine: Pick<RoutineSnap, "phrases">): string {
  return routine.phrases[0] ?? "";
}

export function builtinActionLabel(id: string): string {
  switch (id) {
    case "goodNight":
      return "Night scene, quiet volume, pause, do not disturb";
    case "movie":
      return "Movie scene and volume 35";
    case "away":
      return "Lights off, pause, purifier auto";
    case "morning":
      return "Bright scene, clear do not disturb, purifier auto";
    case "home":
      return "Lights on, clear do not disturb, purifier auto";
    default:
      return "Built-in room actions";
  }
}

export function draftFromRoutine(routine: RoutineSnap): RoutineDraft {
  const migrated = migrateRoutine(routine);
  return {
    id: migrated.id,
    name: migrated.name,
    phrase: phraseOf(migrated),
    command: migrated.builtin ? builtinActionLabel(migrated.id) : migrated.command ?? "",
    enabled: migrated.enabled !== false,
    builtin: !!migrated.builtin,
    isNew: false,
  };
}

export function emptyRoutineDraft(): RoutineDraft {
  return {
    id: `draft-${Date.now().toString(36)}`,
    name: "",
    phrase: "",
    command: "",
    enabled: true,
    builtin: false,
    isNew: true,
  };
}

export function validateRoutineFields(name: string, phrase: string, command: string): RoutineFieldErrors {
  return {
    name: name.trim() ? "" : "Enter a name",
    phrase: phrase.trim() ? "" : "Enter a trigger",
    command: command.trim() ? "" : "Enter an action",
  };
}

export function routineFieldsValid(errors: RoutineFieldErrors): boolean {
  return !errors.name && !errors.phrase && !errors.command;
}

export function isRoutineDirty(draft: RoutineDraft, saved?: RoutineSnap): boolean {
  if (draft.isNew || !saved) return true;
  const phrase = phraseOf(saved);
  const command = saved.builtin ? builtinActionLabel(saved.id) : saved.command ?? "";
  return (
    draft.name.trim() !== saved.name.trim() ||
    draft.phrase.trim() !== phrase.trim() ||
    draft.command.trim() !== command.trim()
  );
}

export function routineStatusLabel(draft: RoutineDraft, saved?: RoutineSnap): string {
  const errors = validateRoutineFields(draft.name, draft.phrase, draft.command);
  const valid = draft.builtin || routineFieldsValid(errors);
  const dirty = isRoutineDirty(draft, saved);
  const parts: string[] = [];
  if (draft.isNew) parts.push("New");
  else if (dirty) parts.push("Modified");
  else parts.push("Saved");
  if (!draft.enabled) parts.push("Disabled");
  if (!valid) parts.push("Invalid");
  return parts.join(" · ");
}

export function duplicateRoutineDraft(source: RoutineDraft): RoutineDraft {
  return {
    id: `draft-${Date.now().toString(36)}`,
    name: source.name.trim() ? `Copy of ${source.name.trim()}` : "",
    phrase: source.phrase,
    command: source.builtin ? "" : source.command,
    enabled: true,
    builtin: false,
    isNew: true,
  };
}
