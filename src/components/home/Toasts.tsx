import { useAssistantStore } from "../../store/assistantStore";

export function Toasts() {
  const toasts = useAssistantStore((s) => s.toasts);
  const dismiss = useAssistantStore((s) => s.dismissToast);

  if (!toasts.length) return null;

  return (
    <div className="toast-stack" role="status">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`toast toast-${t.kind}`}
          onClick={() => dismiss(t.id)}
        >
          <strong>{t.title}</strong>
          {t.body && <span>{t.body}</span>}
        </button>
      ))}
    </div>
  );
}
