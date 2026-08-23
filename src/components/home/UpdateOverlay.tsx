export function UpdateOverlay() {
  return (
    <div className="update-overlay" role="status" aria-live="polite" aria-label="Updating">
      <div className="update-spinner" />
    </div>
  );
}
