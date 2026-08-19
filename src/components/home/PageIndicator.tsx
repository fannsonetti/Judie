import { PAGE_COUNT } from "../../types/widgets";
import { useLayoutStore } from "../../store/layoutStore";

interface Props {
  page: number;
}

export function PageIndicator({ page }: Props) {
  const setPage = useLayoutStore((s) => s.setPage);

  return (
    <div className="page-indicator">
      {Array.from({ length: PAGE_COUNT }).map((_, i) => (
        <button
          key={i}
          type="button"
          className={`page-dot ${i === page ? "active" : ""}`}
          aria-label={`Page ${i + 1}`}
          onClick={() => setPage(i)}
        />
      ))}
    </div>
  );
}
