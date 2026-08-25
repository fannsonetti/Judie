import { AnimatePresence, motion } from "framer-motion";
import { useLayoutStore } from "../../store/layoutStore";
import { WIDGET_LABELS } from "../../types/widgets";
import { overlayTransition } from "../../lib/performance";

export function RemoveConfirm() {
  const pendingId = useLayoutStore((s) => s.pendingRemoveId);
  const widgets = useLayoutStore((s) => s.widgets);
  const confirm = useLayoutStore((s) => s.confirmRemoveWidget);
  const cancel = useLayoutStore((s) => s.cancelRemoveWidget);

  const widget = pendingId ? widgets.find((w) => w.id === pendingId) : null;
  const label = widget ? WIDGET_LABELS[widget.type] : "Widget";

  return (
    <AnimatePresence>
      {pendingId && (
        <motion.div
          className="confirm-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={cancel}
        >
          <motion.div
            className="confirm-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-remove-title"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={overlayTransition()}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-remove-title">Delete {label}?</h2>
            <p>This removes the widget from your home screen. You can add it again later.</p>
            <div className="confirm-actions">
              <button type="button" className="settings-btn" onClick={cancel}>
                Cancel
              </button>
              <button type="button" className="settings-btn danger" onClick={confirm}>
                Delete
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
