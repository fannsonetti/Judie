type Severity = "debug" | "info" | "warn" | "error";

interface LogFields {
  component: string;
  action?: string;
  requestId?: string;
  durationMs?: number;
  outcome?: string;
  error?: string;
  [key: string]: unknown;
}

function emit(severity: Severity, message: string, fields: LogFields) {
  const row = {
    ts: new Date().toISOString(),
    severity,
    message,
    ...fields,
  };
  const line = JSON.stringify(row);
  if (severity === "error") console.error(line);
  else if (severity === "warn") console.warn(line);
  else if (import.meta.env.DEV) console.debug(line);
}

export const log = {
  debug: (message: string, fields: LogFields) => emit("debug", message, fields),
  info: (message: string, fields: LogFields) => emit("info", message, fields),
  warn: (message: string, fields: LogFields) => emit("warn", message, fields),
  error: (message: string, fields: LogFields) => emit("error", message, fields),
};
