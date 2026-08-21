import { AnimatePresence, motion } from "framer-motion";
import { useLayoutStore } from "../../store/layoutStore";
import { WidgetCreatorApp } from "../../slopbox/SlopboxApp";

export function WidgetCreatorOverlay() {
  const open = useLayoutStore((s) => s.creatorOpen);
  const setCreatorOpen = useLayoutStore((s) => s.setCreatorOpen);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="slop-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <WidgetCreatorApp onClose={() => setCreatorOpen(false)} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
