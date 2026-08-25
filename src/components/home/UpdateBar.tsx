import { useUpdateStore } from "../../lib/lifecycle";

export function UpdateBar() {
  const notice = useUpdateStore((s) => s.notice);
  const dismissed = useUpdateStore((s) => s.dismissed);
  const installing = useUpdateStore((s) => s.installing);
  const error = useUpdateStore((s) => s.error);
  const dismiss = useUpdateStore((s) => s.dismiss);
  const installLatest = useUpdateStore((s) => s.installLatest);

  if (!notice?.outdated || dismissed) return null;

  return (
    <div className="update-bar" role="status">
      <span className="update-bar-msg">
        {error
          ? error
          : installing
            ? `Installing Judie ${notice.latest}…`
            : `Judie ${notice.latest} is available`}
      </span>
      <span className="update-bar-actions">
        {!installing && (
          <button type="button" className="update-bar-btn" onClick={() => void installLatest()}>
            Update
          </button>
        )}
        <button type="button" className="update-bar-btn ghost" onClick={dismiss}>
          Later
        </button>
      </span>
    </div>
  );
}
