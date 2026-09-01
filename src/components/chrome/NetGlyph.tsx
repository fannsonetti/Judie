export function NetGlyph({
  kind,
  bars,
}: {
  kind: string;
  bars: number;
}) {
  if (kind === "ethernet") {
    return (
      <svg className="net-glyph" width="28" height="22" viewBox="0 0 28 22" aria-hidden>
        <rect x="9" y="1.5" width="10" height="7" rx="1" fill="#fff" />
        <rect x="3" y="8" width="22" height="3.5" fill="#fff" />
        <rect x="5" y="12" width="3.5" height="8.5" fill="#fff" />
        <rect x="12.25" y="12" width="3.5" height="8.5" fill="#fff" />
        <rect x="19.5" y="12" width="3.5" height="8.5" fill="#fff" />
      </svg>
    );
  }
  if (bars <= 0) {
    return (
      <svg className="net-glyph" width="28" height="22" viewBox="0 0 28 22" aria-hidden>
        <path d="M5 9.2c5.2-4.6 12.8-4.6 18 0" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <path d="M8.5 13.2c3.3-2.8 7.7-2.8 11 0" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <circle cx="14" cy="17.6" r="1.7" fill="#fff" />
        <path d="M20.2 14.2l6 6M26.2 14.2l-6 6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }
  const on = (n: number) => (bars >= n ? "#fff" : "#3a3a3a");
  return (
    <svg className="net-glyph" width="28" height="22" viewBox="0 0 28 22" aria-hidden>
      <rect x="2" y="16" width="5" height="4" fill={on(1)} />
      <rect x="8" y="12" width="5" height="8" fill={on(2)} />
      <rect x="14" y="7" width="5" height="13" fill={on(3)} />
      <rect x="20" y="2" width="5" height="18" fill={on(4)} />
    </svg>
  );
}
