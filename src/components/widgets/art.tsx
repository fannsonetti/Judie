import { useId } from "react";
import type { MediaTrack } from "../../lib/mockData";

export type SceneId = MediaTrack["scene"];

export function SceneArt({
  scene,
  className = "",
}: {
  scene: SceneId;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  return (
    <div className={`scene ${className}`}>
      {scene === "ocean" && <Ocean id={uid} />}
      {scene === "forest" && <Forest id={uid} />}
      {scene === "rain" && <Rain id={uid} />}
      {scene === "cafe" && <Cafe id={uid} />}
      {scene === "fire" && <Fire id={uid} />}
      {scene === "night" && <Night />}
    </div>
  );
}

function Ocean({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#061018" />
          <stop offset="45%" stopColor="#0c2438" />
          <stop offset="100%" stopColor="#07131c" />
        </linearGradient>
        <radialGradient id={`${id}m`} cx="70%" cy="22%">
          <stop offset="0%" stopColor="#f4f0d8" />
          <stop offset="40%" stopColor="#c9d6a8" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#c9d6a8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="200" height="200" fill={`url(#${id}s)`} />
      <circle cx="148" cy="42" r="16" fill="#f3edd0" />
      <circle cx="148" cy="42" r="38" fill={`url(#${id}m)`} />
      <path d="M0 118c22 12 38-8 58 2 24 12 36-10 58 4 20 12 36-6 54 4 12 6 22 4 30 2v80H0V118z" fill="#0b2a3d" />
      <path d="M0 138c26 10 40-10 62 0 28 12 40-8 64 4 20 10 34-8 50 2 10 6 16 4 24 2v70H0V138z" fill="#12394f" />
      <path d="M0 156c20 8 42-6 64 2s40-10 62 2 36-6 50 4c8 4 16 4 24 2v50H0V156z" fill="#1b4d66" opacity="0.9" />
      <path d="M0 170c30 6 48-8 78 0 24 6 40-8 62 2 18 8 32-2 60 2v40H0V170z" fill="#8fb8c9" opacity="0.18" />
    </svg>
  );
}

function Forest({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a2430" />
          <stop offset="55%" stopColor="#163022" />
          <stop offset="100%" stopColor="#0b1610" />
        </linearGradient>
      </defs>
      <rect width="200" height="200" fill={`url(#${id}s)`} />
      <circle cx="160" cy="36" r="18" fill="#d7e4f0" opacity="0.35" />
      <polygon points="30,170 70,40 110,170" fill="#0f2a1c" />
      <polygon points="70,180 118,28 168,180" fill="#143524" />
      <polygon points="120,190 168,55 210,190" fill="#0c2418" />
      <polygon points="10,190 48,80 88,190" fill="#1b4630" />
      <rect x="0" y="168" width="200" height="32" fill="#0a1812" />
      <ellipse cx="100" cy="150" rx="90" ry="18" fill="#9ec3b0" opacity="0.08" />
    </svg>
  );
}

function Rain({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 280 140" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0d1524" />
          <stop offset="100%" stopColor="#1b2740" />
        </linearGradient>
      </defs>
      <rect width="280" height="140" fill={`url(#${id}s)`} />
      <rect x="18" y="58" width="8" height="28" rx="1" fill="#f6c15b" opacity="0.7" />
      <rect x="42" y="48" width="6" height="38" rx="1" fill="#f0d38a" opacity="0.45" />
      <rect x="70" y="62" width="10" height="24" rx="1" fill="#7eb6ff" opacity="0.35" />
      <rect x="200" y="50" width="9" height="36" rx="1" fill="#ffd27a" opacity="0.5" />
      <rect x="230" y="40" width="12" height="46" rx="1" fill="#9ad0ff" opacity="0.28" />
      <g stroke="#9ec9ea" strokeWidth="1.4" opacity="0.55">
        <line x1="20" y1="10" x2="8" y2="40" />
        <line x1="50" y1="0" x2="38" y2="36" />
        <line x1="86" y1="8" x2="72" y2="44" />
        <line x1="120" y1="2" x2="108" y2="38" />
        <line x1="160" y1="12" x2="146" y2="46" />
        <line x1="198" y1="0" x2="186" y2="34" />
        <line x1="236" y1="10" x2="222" y2="44" />
        <line x1="268" y1="4" x2="256" y2="36" />
      </g>
      <ellipse cx="140" cy="118" rx="120" ry="18" fill="#6ea0c8" opacity="0.12" />
    </svg>
  );
}

function Cafe({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a2418" />
          <stop offset="100%" stopColor="#1a100c" />
        </linearGradient>
      </defs>
      <rect width="200" height="200" fill={`url(#${id}s)`} />
      <rect x="20" y="40" width="70" height="80" rx="4" fill="#f0c27a" opacity="0.18" />
      <rect x="110" y="30" width="60" height="90" rx="4" fill="#e8b86a" opacity="0.12" />
      <ellipse cx="100" cy="150" rx="34" ry="10" fill="#2a1a12" />
      <path d="M78 150c0-22 10-40 22-40s22 18 22 40" fill="#d7b48a" />
      <rect x="92" y="108" width="16" height="8" rx="3" fill="#c4a07a" />
    </svg>
  );
}

function Fire({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <radialGradient id={`${id}g`} cx="50%" cy="70%">
          <stop offset="0%" stopColor="#ffd27a" />
          <stop offset="40%" stopColor="#ff7a3a" />
          <stop offset="100%" stopColor="#1a0c08" />
        </radialGradient>
      </defs>
      <rect width="200" height="200" fill="#140a08" />
      <ellipse cx="100" cy="150" rx="70" ry="24" fill={`url(#${id}g)`} />
      <path d="M100 50c18 28-8 38 0 62 22-10 40 8 28 38-18 28-56 28-74 8-22-24-8-52 10-70 8 16 24 18 36-38z" fill="#ff9a4a" />
      <path d="M100 78c10 16-4 22 2 36 12-6 22 6 14 22-10 16-32 16-42 4-12-14-4-30 8-40 4 10 14 10 18-22z" fill="#ffe08a" />
    </svg>
  );
}

function Night() {
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="200" height="200" fill="#070814" />
      <circle cx="40" cy="36" r="1.4" fill="#fff" />
      <circle cx="80" cy="22" r="1" fill="#fff" />
      <circle cx="130" cy="40" r="1.2" fill="#fff" />
      <circle cx="170" cy="28" r="1" fill="#fff" />
      <circle cx="60" cy="70" r="0.8" fill="#fff" />
      <circle cx="150" cy="80" r="1.1" fill="#fff" />
      <circle cx="148" cy="48" r="18" fill="#e7e1c4" />
      <circle cx="156" cy="44" r="16" fill="#070814" />
    </svg>
  );
}

export function SceneIcon({ scene, active }: { scene: SceneId; active?: boolean }) {
  return (
    <span className={`scene-ico ${active ? "on" : ""}`}>
      {scene === "rain" && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M8 18c0 0 1 3 0 4M12 17c0 0 1 3 0 4M16 18c0 0 1 3 0 4" /><path d="M6 13a6 6 0 1 1 10.5-4A4.5 4.5 0 1 1 18 13H6z" /></svg>
      )}
      {scene === "ocean" && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /><path d="M3 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /></svg>
      )}
      {scene === "forest" && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3l5 8H7l5-8z" /><path d="M12 9l6 9H6l6-9z" /><path d="M12 18v3" /></svg>
      )}
      {scene === "cafe" && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 8h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8z" /><path d="M16 10h2.5a2.5 2.5 0 0 1 0 5H16" /></svg>
      )}
      {scene === "fire" && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3c3 5-2 6 0 10 4-2 7 2 5 6-2 4-8 4-10 1-3-4 0-8 2-10 1 3 3 3 3-7z" /></svg>
      )}
      {scene === "night" && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M15 3a8 8 0 1 0 6 13A8 8 0 0 1 15 3z" /><path d="M18 6l.4 1.2L19.6 7.6 18.4 8l-.4 1.2L17.6 8 16.4 7.6 17.6 6.8 18 6z" /></svg>
      )}
    </span>
  );
}
