import { invoke } from "@tauri-apps/api/core";
import { log } from "./logger";

export interface ConversationLogEntry {
  timestamp: string;
  role: "you" | "judie";
  text: string;
  source: string;
  intent?: string | null;
}

let cachedPath: string | null = null;

function stamp() {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export async function appendConversationLog(entry: Omit<ConversationLogEntry, "timestamp">) {
  const row: ConversationLogEntry = { timestamp: stamp(), ...entry };
  try {
    const path = await invoke<string>("append_conversation_log", { entry: row });
    cachedPath = path;
    return path;
  } catch (err) {
    log.warn("conversation log write skipped", {
      component: "log",
      action: "append",
      error: err instanceof Error ? err.message : "not tauri",
    });
    return null;
  }
}

export async function getConversationLogPath() {
  if (cachedPath) return cachedPath;
  try {
    cachedPath = await invoke<string>("conversation_log_path");
    return cachedPath;
  } catch {
    return null;
  }
}
