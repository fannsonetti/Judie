import type { PointerEvent } from "react";
import { useRoomStore } from "../../store/roomStore";
import { DEMO_MEDIA } from "../../lib/demoStats";
import { IconNext, IconPause, IconPlay, IconPrev, IconSpeaker } from "./chrome";
import { SceneArt, SceneIcon } from "./art";
import type { SceneId } from "./art";
import { useWidgetDemo } from "./demo";

interface Props {
  size: string;
}

const SCENES: SceneId[] = ["rain", "ocean", "forest", "cafe", "fire", "night"];

export function MediaWidget({ size }: Props) {
  const demo = useWidgetDemo();
  const live = useRoomStore((s) => s.media);
  const togglePlay = useRoomStore((s) => s.togglePlay);
  const nextTrack = useRoomStore((s) => s.nextTrack);
  const prevTrack = useRoomStore((s) => s.prevTrack);
  const setVolume = useRoomStore((s) => s.setVolume);
  const playTrack = useRoomStore((s) => s.playTrack);
  const media = demo ? DEMO_MEDIA : live;
  const track = media.queue[media.trackIndex];
  const scene = track.scene ?? "ocean";
  const small = size === "1x1";
  const large = size === "2x2";
  const stop = (e: PointerEvent) => e.stopPropagation();
  const act = (fn: () => void) => {
    if (!demo) fn();
  };

  const controls = (
    <div className="media-controls">
      <button type="button" className="wx-ctrl ghost" onClick={() => act(prevTrack)}><IconPrev /></button>
      <button type="button" className="wx-ctrl play" onClick={() => act(togglePlay)}>
        {media.playing ? <IconPause /> : <IconPlay />}
      </button>
      <button type="button" className="wx-ctrl ghost" onClick={() => act(nextTrack)}><IconNext /></button>
    </div>
  );

  if (small) {
    return (
      <div className="wx media fill" onPointerDown={stop}>
        <div className="wx-head">
          <span className="wx-muted">{media.playing ? "Playing" : "Paused"}</span>
        </div>
        <SceneArt scene={scene} className="sq grow" />
        <div className="media-title center">{track.title}</div>
        {controls}
      </div>
    );
  }

  if (!large) {
    return (
      <div className="wx media fill" onPointerDown={stop}>
        <div className="wx-head">
          <span className="wx-muted">{media.playing ? "Playing" : "Paused"}</span>
        </div>
        <div className="media-mid">
          <SceneArt scene={scene} className="sq" />
          <div className="media-copy">
            <div className="media-title">{track.title}</div>
            <div className="media-sub">{track.artist}</div>
            <div className="media-vol">
              <input
                className="wx-slider"
                type="range"
                min={0}
                max={100}
                value={media.volume}
                onChange={(e) => act(() => setVolume(Number(e.target.value)))}
                style={{ ["--pct" as string]: `${media.volume}%` }}
              />
              <IconSpeaker size={13} />
            </div>
            {controls}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wx media fill large" onPointerDown={stop}>
      <div className="wx-head">
        <span className="wx-muted">{media.playing ? "Playing" : "Paused"}</span>
      </div>
      <SceneArt scene={scene} className="wide grow" />
      <div className="media-row">
        <div>
          <div className="media-title">{track.title}</div>
          <div className="media-sub">{track.artist}</div>
        </div>
        <div className="media-controls">
          <button type="button" className="wx-ctrl play" onClick={() => act(togglePlay)}>
            {media.playing ? <IconPause /> : <IconPlay />}
          </button>
          <button type="button" className="wx-ctrl ghost" onClick={() => act(nextTrack)}><IconNext /></button>
        </div>
      </div>
      <div className="media-queue">
        {SCENES.map((s) => {
          const idx = media.queue.findIndex((t) => t.scene === s);
          return (
            <button key={s} type="button" className="scene-btn" onClick={() => act(() => idx >= 0 && playTrack(idx))}>
              <SceneIcon scene={s} active={scene === s} />
            </button>
          );
        })}
      </div>
      <div className="media-vol wide">
        <IconSpeaker size={13} />
        <input
          className="wx-slider"
          type="range"
          min={0}
          max={100}
          value={media.volume}
          onChange={(e) => act(() => setVolume(Number(e.target.value)))}
          style={{ ["--pct" as string]: `${media.volume}%` }}
        />
        <IconSpeaker size={16} />
      </div>
    </div>
  );
}
