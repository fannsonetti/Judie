import { useLayoutStore } from "../../store/layoutStore";

interface Props {
  page: number;
  count: number;
}

export function PageIndicator({ page, count }: Props) {
  const setPage = useLayoutStore((s) => s.setPage);

  return (
    <div className="page-indicator">
      {Array.from({ length: count }).map((_, i) => (
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
