import { useLayoutStore } from "../../store/layoutStore";

export function EditModeControls() {
  const exitEditMode = useLayoutStore((s) => s.exitEditMode);
  const setGalleryOpen = useLayoutStore((s) => s.setGalleryOpen);

  return (
    <>
      <div className="edit-hint">Drag widgets anywhere on the grid · Triple-click or hold to edit</div>
      <div className="edit-bar">
        <button type="button" className="primary" onClick={() => setGalleryOpen(true)}>
          Add Widget
        </button>
        <button type="button" onClick={exitEditMode}>
          Done
        </button>
      </div>
    </>
  );
}
