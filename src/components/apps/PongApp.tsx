import { useEffect, useRef, useState } from "react";

type Mode = 0 | 1 | 2 | 3;

const MODE_LABEL: Record<Mode, string> = {
  0: "Easy",
  1: "Medium",
  2: "Hard",
  3: "2P",
};

function beep(freq: number, ms: number) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    window.setTimeout(() => {
      osc.stop();
      void ctx.close();
    }, ms);
  } catch {
    /* no audio */
  }
}

export function PongApp() {
  const court = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>(0);
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState({ l: 0, r: 0 });
  const state = useRef({
    ly: 42,
    ry: 42,
    bx: 50,
    by: 50,
    vx: 1.15,
    vy: 0.85,
    ls: 0,
    rs: 0,
    mode: 0 as Mode,
    running: false,
  });
  const [, tick] = useState(0);

  useEffect(() => {
    state.current.mode = mode;
  }, [mode]);

  useEffect(() => {
    let raf = 0;
    const step = () => {
      const g = state.current;
      if (g.running) {
        g.bx += g.vx;
        g.by += g.vy;
        if (g.by <= 3) {
          g.by = 3;
          g.vy = Math.abs(g.vy);
          beep(520, 35);
        }
        if (g.by >= 97) {
          g.by = 97;
          g.vy = -Math.abs(g.vy);
          beep(520, 35);
        }
        if (g.bx <= 7) {
          if (Math.abs(g.by - g.ly) < 14) {
            g.bx = 7;
            g.vx = Math.abs(g.vx);
            g.vy += (g.by - g.ly) * 0.04;
            beep(880, 40);
          } else {
            g.rs += 1;
            g.bx = 50;
            g.by = 50;
            g.vx = 1.1;
            beep(180, 140);
            setScore({ l: g.ls, r: g.rs });
          }
        }
        if (g.bx >= 93) {
          if (Math.abs(g.by - g.ry) < 14) {
            g.bx = 93;
            g.vx = -Math.abs(g.vx);
            g.vy += (g.by - g.ry) * 0.04;
            beep(880, 40);
          } else {
            g.ls += 1;
            g.bx = 50;
            g.by = 50;
            g.vx = -1.1;
            beep(180, 140);
            setScore({ l: g.ls, r: g.rs });
          }
        }
        if (g.mode < 3) {
          const lag = g.mode === 0 ? 0.28 : g.mode === 1 ? 0.5 : 0.82;
          const jitter = g.mode === 0 ? 7 : g.mode === 1 ? 2.5 : 0.4;
          const n = Math.random() * 20 - 10;
          const target = g.by + (n * jitter) / 10;
          g.ry += (target - g.ry) * lag;
        }
      }
      tick((n) => n + 1);
      raf = window.requestAnimationFrame(step);
    };
    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = state.current;
      if (e.key === "w" || e.key === "W") g.ly = Math.max(8, g.ly - 5);
      if (e.key === "s" || e.key === "S") g.ly = Math.min(92, g.ly + 5);
      if (e.key === "ArrowUp") g.ry = Math.max(8, g.ry - 5);
      if (e.key === "ArrowDown") g.ry = Math.min(92, g.ry + 5);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const move = (clientX: number, clientY: number) => {
    const el = court.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const y = ((clientY - r.top) / r.height) * 100;
    const x = clientX - r.left;
    const g = state.current;
    if (x < r.width / 2) g.ly = Math.max(8, Math.min(92, y));
    else if (g.mode === 3) g.ry = Math.max(8, Math.min(92, y));
  };

  const start = () => {
    const g = state.current;
    g.running = true;
    g.bx = 50;
    g.by = 50;
    g.ls = 0;
    g.rs = 0;
    g.vx = 1.15;
    g.vy = 0.85;
    setScore({ l: 0, r: 0 });
    setRunning(true);
    beep(660, 80);
  };

  const g = state.current;

  return (
    <div className="expanded-body pong-app">
      <div className="pong-score">
        <strong>{score.l}</strong>
        <span>PONG</span>
        <strong>{score.r}</strong>
      </div>
      <div className="pong-modes">
        {([0, 1, 2, 3] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            className={`os-pill${mode === m ? " on" : ""}`}
            onClick={() => setMode(m)}
          >
            {MODE_LABEL[m]}
          </button>
        ))}
        <button type="button" className="os-pill on" onClick={start}>
          {running ? "RESET" : "START"}
        </button>
      </div>
      <div
        className="pong-court"
        ref={court}
        onPointerDown={(e) => move(e.clientX, e.clientY)}
        onPointerMove={(e) => e.buttons && move(e.clientX, e.clientY)}
      >
        <div className="pong-net" />
        <div className="pong-paddle left" style={{ top: `${g.ly}%` }} />
        <div className="pong-paddle right" style={{ top: `${g.ry}%` }} />
        <div className="pong-ball" style={{ left: `${g.bx}%`, top: `${g.by}%` }} />
      </div>
    </div>
  );
}
