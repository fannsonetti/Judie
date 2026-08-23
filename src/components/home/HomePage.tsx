import { WidgetInstance } from "../../types/widgets";
import { useLayoutStore } from "../../store/layoutStore";
import { WidgetGrid } from "./WidgetGrid";

interface Props {
  page: number;
  widgets: WidgetInstance[];
  width?: string;
}

export function HomePage({ widgets, width }: Props) {
  const enterEditMode = useLayoutStore((s) => s.enterEditMode);
  const setGalleryOpen = useLayoutStore((s) => s.setGalleryOpen);

  return (
    <section className="home-page" style={width ? { width } : undefined}>
      {widgets.length === 0 ? (
        <div className="empty-page">
          <div className="empty-plus">+</div>
          <h3>Add widgets to this page</h3>
          <p>Hold any widget to rearrange, or add a new one from the gallery.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="chip" onClick={enterEditMode}>
              Edit Home Screen
            </button>
            <button
              type="button"
              className="chip active"
              onClick={() => {
                enterEditMode();
                setGalleryOpen(true);
              }}
            >
              Add Widget
            </button>
          </div>
        </div>
      ) : (
        <WidgetGrid widgets={widgets} />
      )}
    </section>
  );
}
