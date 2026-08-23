import { useEffect } from "react";
import { useAssistantStore } from "../store/assistantStore";
import { useLayoutStore } from "../store/layoutStore";
import { visiblePageCount } from "../lib/layout";

export function useJudieHotkeys() {
  const execute = useAssistantStore((s) => s.execute);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        useAssistantStore.getState().setPaletteOpen(true);
        return;
      }

      if (e.key === "Escape") {
        const a = useAssistantStore.getState();
        const l = useLayoutStore.getState();
        if (a.paletteOpen) {
          a.setPaletteOpen(false);
          return;
        }
        if (a.settingsOpen) {
          a.setSettingsOpen(false);
          return;
        }
        if (l.galleryOpen) {
          l.setGalleryOpen(false);
          return;
        }
        if (l.expandedId) {
          l.collapseWidget();
          return;
        }
        if (l.editMode) {
          l.exitEditMode();
          return;
        }
        a.stopListening();
        a.bargeIn();
        return;
      }

      if (typing) return;

      if (e.key === " ") {
        const a = useAssistantStore.getState();
        if (a.status === "listening") a.stopListening();
        else a.startListening();
        e.preventDefault();
        return;
      }

      if (e.key === "ArrowRight") {
        const l = useLayoutStore.getState();
        const max = visiblePageCount(l.widgets, l.editMode) - 1;
        if (!l.editMode && !l.expandedId) l.setPage(Math.min(max, l.currentPage + 1));
      }
      if (e.key === "ArrowLeft") {
        const l = useLayoutStore.getState();
        if (!l.editMode && !l.expandedId) l.setPage(Math.max(0, l.currentPage - 1));
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        const a = useAssistantStore.getState();
        a.setDebugOpen(!a.debugOpen);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        void execute("undo", "user", false);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [execute]);
}
