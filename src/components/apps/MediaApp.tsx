import { useRoomStore } from "../../store/roomStore";
import { SceneArt, SceneIcon, type SceneId } from "../widgets/art";
import { IconNext, IconPause, IconPlay, IconPrev, IconSpeaker } from "../widgets/chrome";

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const SCENES: SceneId[] = ["rain", "ocean", "forest", "cafe", "fire", "night"];

export function MediaApp() {
  const media = useRoomStore((s) => s.media);
  const togglePlay = useRoomStore((s) => s.togglePlay);
  const nextTrack = useRoomStore((s) => s.nextTrack);
  const prevTrack = useRoomStore((s) => s.prevTrack);
  const setVolume = useRoomStore((s) => s.setVolume);
  const setProgress = useRoomStore((s) => s.setProgress);
  const playTrack = useRoomStore((s) => s.playTrack);
  const track = media.queue[media.trackIndex];
  const scene = track.scene ?? "ocean";

  return (
    <div className="expanded-body">
      <p className="app-kicker">Ambient Noise</p>
      <div className="app-grid two">
        <div className="app-art">
          <SceneArt scene={scene} className="wide" />
        </div>
        <div>
          <h1 className="expanded-title">{track.title}</h1>
          <p className="expanded-sub">{track.artist}</p>
          <div className="app-controls">
            <button type="button" className="icon-btn" onClick={prevTrack} aria-label="Previous"><IconPrev size={18} /></button>
            <button type="button" className="app-play" onClick={togglePlay} aria-label={media.playing ? "Pause" : "Play"}>
              {media.playing ? <IconPause size={22} /> : <IconPlay size={22} />}
            </button>
            <button type="button" className="icon-btn" onClick={nextTrack} aria-label="Next"><IconNext size={18} /></button>
          </div>
          <input className="wx-slider" type="range" min={0} max={track.duration} value={media.progress} onChange={(e) => setProgress(Number(e.target.value))} style={{ ["--pct" as string]: `${(media.progress / track.duration) * 100}%` }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", margin: "6px 0 18px" }}>
            <span>{formatTime(media.progress)}</span>
            <span>{formatTime(track.duration)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <IconSpeaker size={14} />
            <input className="wx-slider" type="range" min={0} max={100} value={media.volume} onChange={(e) => setVolume(Number(e.target.value))} style={{ ["--pct" as string]: `${media.volume}%` }} />
            <span className="app-muted">{media.volume}</span>
          </div>
          <div className="app-scenes">
            {SCENES.map((s) => {
              const idx = media.queue.findIndex((t) => t.scene === s);
              return (
                <button key={s} type="button" className={`app-scene ${scene === s ? "on" : ""}`} onClick={() => idx >= 0 && playTrack(idx)}>
                  <SceneIcon scene={s} active={scene === s} />
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="app-muted" style={{ margin: "28px 0 10px" }}>Library</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {media.queue.map((t, i) => (
          <button key={t.id} type="button" className={`app-track ${i === media.trackIndex ? "on" : ""}`} onClick={() => playTrack(i)}>
            <div className="app-thumb"><SceneArt scene={t.scene ?? "ocean"} /></div>
            <div>
              <div style={{ fontWeight: 600 }}>{t.title}</div>
              <div className="app-muted">{t.artist}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
