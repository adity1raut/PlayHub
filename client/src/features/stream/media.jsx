import { useEffect, useRef } from "react";
import { cn } from "../../lib/cn";

/** <video> showing a remote MediaStreamTrack or a local MediaStream (always muted — audio is separate). */
export function VideoView({ track, stream, className, mirrored = false, videoRef }) {
  const localRef = useRef(null);
  const ref = videoRef || localRef;
  const key = track?.id || stream?.id || "";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream || (track ? new MediaStream([track]) : null);
    el.play?.().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return <video ref={ref} autoPlay playsInline muted className={cn(className, mirrored && "-scale-x-100")} />;
}

function AudioTrack({ track, muted, volume, unlockKey, onBlocked }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = new MediaStream([track]);
    el.play().catch(() => onBlocked?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.id]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = muted;
    el.volume = volume;
  }, [muted, volume]);

  // A click elsewhere unlocked audio: try playing again
  useEffect(() => {
    if (unlockKey) ref.current?.play().catch(() => onBlocked?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlockKey]);

  return <audio ref={ref} autoPlay />;
}

/**
 * Plays every remote audio track (host mic, screen audio, guests' mics…). One <audio> per track:
 * a single media element only reliably plays one audio track of a MediaStream.
 */
export function AudioOut({ tracks, muted = false, volume = 1, unlockKey = 0, onBlocked }) {
  return tracks.map((track) => (
    <AudioTrack key={track.id} track={track} muted={muted} volume={volume} unlockKey={unlockKey} onBlocked={onBlocked} />
  ));
}

/** Small labelled video in the stage strip; clicking shows it large. */
export function StageTile({ track, stream, label, speaking = false, mirrored = false, onClick }) {
  const body = (
    <>
      <VideoView track={track} stream={stream} mirrored={mirrored} className="aspect-video w-full bg-sidebar object-cover" />
      <span className="absolute inset-x-0 bottom-0 truncate bg-sidebar/85 px-1.5 py-0.5 text-left text-[10px] font-bold text-foreground">
        {label}
      </span>
    </>
  );
  const frame = cn(
    "relative block w-full overflow-hidden border shadow-float transition-colors",
    speaking ? "border-primary ring-1 ring-primary" : "border-primary/40",
  );
  return onClick ? (
    <button type="button" onClick={onClick} title={`Show ${label} large`} className={cn(frame, "hover:border-primary")}>
      {body}
    </button>
  ) : (
    <div className={frame}>{body}</div>
  );
}
