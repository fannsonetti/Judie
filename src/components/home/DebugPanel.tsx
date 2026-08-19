import { useAssistantStore } from "../../store/assistantStore";

export function DebugPanel() {
  const open = useAssistantStore((s) => s.debugOpen);
  const result = useAssistantStore((s) => s.lastResult);
  const status = useAssistantStore((s) => s.status);
  if (!open || !import.meta.env.DEV) return null;

  const pct = result ? Math.round(result.confidence * 100) : 0;
  const route = result?.debug.route ?? "—";
  const best = result?.debug.bestCandidate;

  return (
    <div className="debug-panel">
      <div className="w-label">Debug · {status}</div>
      {!result && <div className="w-secondary">No command yet</div>}
      {result && (
        <pre>
          {`Detected:
${result.intent ?? "no reliable deterministic intent"}

Confidence:
${pct}%

Route:
${route}${best && route !== "capability" ? `\n\nBest candidate:\n${best.name} — ${Math.round(best.confidence * 100)}%` : ""}

Entities:
${formatEntities(result.entities)}

Latency:
${Math.round(result.debug.ms)}ms

${result.response}`}
        </pre>
      )}
    </div>
  );
}

function formatEntities(entities: Record<string, unknown>) {
  const bits = Object.entries(entities)
    .filter(([, v]) => v != null && v !== false && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${k} = ${Array.isArray(v) ? v.join(", ") : String(v)}`);
  return bits.length ? bits.join("\n") : "(none)";
}
