export const SLOP_ICONS = [
  "spark",
  "sun",
  "cloud",
  "bolt",
  "drop",
  "thermo",
  "bulb",
  "play",
  "pause",
  "speaker",
  "wifi",
  "clock",
  "home",
  "heart",
  "star",
  "moon",
  "check",
  "warn",
  "leaf",
  "activity",
] as const;

export type SlopIconName = (typeof SLOP_ICONS)[number];

export function SlopIcon({
  name,
  size = 18,
}: {
  name?: string;
  size?: number;
}) {
  const n = (SLOP_ICONS as readonly string[]).includes(name ?? "")
    ? (name as SlopIconName)
    : "spark";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {iconPaths(n)}
    </svg>
  );
}

function iconPaths(name: SlopIconName) {
  switch (name) {
    case "sun":
      return (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>
      );
    case "cloud":
      return <path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.2-1.6A3.5 3.5 0 0 0 7 18z" />;
    case "bolt":
      return <path d="M13 2L4 14h7l-1 8 10-14h-7l0-6z" />;
    case "drop":
      return <path d="M12 3s7 8 7 12a7 7 0 1 1-14 0c0-4 7-12 7-12z" />;
    case "thermo":
      return (
        <>
          <path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0z" />
          <path d="M12 16v3" />
        </>
      );
    case "bulb":
      return (
        <>
          <path d="M9 18h6M10 22h4" />
          <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
        </>
      );
    case "play":
      return <path d="M8 5v14l12-7L8 5z" fill="currentColor" stroke="none" />;
    case "pause":
      return (
        <>
          <rect x="6" y="5" width="4.5" height="14" rx="1.2" fill="currentColor" stroke="none" />
          <rect x="13.5" y="5" width="4.5" height="14" rx="1.2" fill="currentColor" stroke="none" />
        </>
      );
    case "speaker":
      return (
        <>
          <polygon points="11 5 6 9 3 9 3 15 6 15 11 19 11 5" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        </>
      );
    case "wifi":
      return (
        <>
          <path d="M5 12.5a10 10 0 0 1 14 0" />
          <path d="M8.5 16a5.5 5.5 0 0 1 7 0" />
          <circle cx="12" cy="20" r="1.2" fill="currentColor" stroke="none" />
        </>
      );
    case "clock":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v6l4 2" />
        </>
      );
    case "home":
      return <path d="M4 11.5L12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5z" />;
    case "heart":
      return (
        <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.6-7 10-7 10z" />
      );
    case "star":
      return (
        <path d="M12 3l2.4 5.6L20 9.5l-4.4 3.8L16.8 20 12 16.8 7.2 20l1.2-6.7L4 9.5l5.6-.9L12 3z" />
      );
    case "moon":
      return <path d="M15 3a8 8 0 1 0 6 13A7 7 0 0 1 15 3z" />;
    case "check":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12.5l2.6 2.6L16.5 9" />
        </>
      );
    case "warn":
      return (
        <>
          <path d="M12 4l9 16H3L12 4z" />
          <path d="M12 10v5M12 17.5v.5" />
        </>
      );
    case "leaf":
      return <path d="M5 19c8-1 14-8 14-16-8 0-15 6-16 14 3-2 6-3 8-3" />;
    case "activity":
      return <path d="M3 12h4l2.5-7 5 14L17 12h4" />;
    default:
      return (
        <>
          <path d="M12 3l1.6 5.2H19l-4.3 3.2 1.6 5.2L12 13.4 7.7 16.6 9.3 11.4 5 8.2h5.4L12 3z" />
        </>
      );
  }
}
