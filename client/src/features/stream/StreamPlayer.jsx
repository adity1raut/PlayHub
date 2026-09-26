import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, Loader2, Maximize, MicOff, RefreshCw, Volume2, VolumeX, WifiOff } from "lucide-react";
import { Avatar, Badge, Button, Corners, IconButton, ScanBars, StatusDot } from "../../components/ui";
import { cn } from "../../lib/cn";
import { useStreamWatch } from "./useLiveStream";

/** <video>/<audio> bound to a MediaStream built from the given tracks. */
function MediaView({ tracks, kind = "video", className, muted = true, mediaRef, onPlayBlocked }) {
  const localRef = useRef(null);
  const ref = mediaRef || localRef;
  const ids = tracks.map((t) => t.id).join(",");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = tracks.length ? new MediaStream(tracks) : null;
    if (tracks.length) {
      el.play().catch(() => onPlayBlocked?.());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  if (kind === "audio") return <audio ref={ref} autoPlay muted={muted} />;
  return <video ref={ref} autoPlay playsInline muted className={className} />;
}

/** Viewer side of a live stream — media arrives from the SFU. */
const StreamPlayer = ({ stream, viewerCount, onViewers, className = "" }) => {
  const live = Boolean(stream?.isLive);
  const [retryKey, setRetryKey] = useState(0);
  const { status, error, viewers, bySource } = useStreamWatch(stream?._id, { enabled: live, retryKey });
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [needsTap, setNeedsTap] = useState(false);
  const containerRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (viewers != null) onViewers?.(viewers);
  }, [viewers, onViewers]);

  const camera = bySource.camera;
  const screen = bySource.screen;
  const main = screen && !screen.paused ? screen : camera && !camera.paused ? camera : null;
  const pip = main === screen && camera && !camera.paused ? camera : null;
  const audioTracks = [bySource.mic, bySource["screen-audio"]]
    .filter((t) => t && !t.paused)
    .map((t) => t.track);
  const micMuted = bySource.mic?.paused;

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.muted = muted;
    el.volume = volume;
  }, [muted, volume, audioTracks.length]);

  const unlockAudio = useCallback(() => {
    setNeedsTap(false);
    setMuted(false);
    audioRef.current?.play().catch(() => setNeedsTap(true));
  }, []);

  const handleFullscreen = () => {
    const el = containerRef.current;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el?.requestFullscreen?.().catch?.(() => {});
  };

  const host = stream?.host || {};
  const hostName = host.profile?.name || host.username;
  const shownViewers = viewers ?? viewerCount ?? stream?.viewers?.length ?? 0;

  return (
    <div
      ref={containerRef}
      className={cn("group relative aspect-video overflow-hidden border border-border-strong bg-sidebar", className)}
    >
      {main && (
        <MediaView
          tracks={[main.track]}
          className={cn("absolute inset-0 size-full", main === screen ? "object-contain" : "object-cover")}
        />
      )}
      <MediaView kind="audio" tracks={audioTracks} muted={muted} mediaRef={audioRef} onPlayBlocked={() => setNeedsTap(true)} />

      {/* Camera picture-in-picture while the host shares their screen */}
      {pip && (
        <div className="absolute right-3 bottom-14 w-1/4 min-w-24 border border-primary/60 bg-sidebar shadow-float sm:right-4">
          <MediaView tracks={[pip.track]} className="aspect-video w-full object-cover" />
        </div>
      )}

      <div aria-hidden="true" className="pointer-events-none absolute inset-3 sm:inset-4">
        <Corners size="size-4" />
      </div>

      {/* States */}
      {live && status === "connecting" && (
        <Overlay>
          <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
          <p className="eyebrow text-faint">Acquiring signal…</p>
        </Overlay>
      )}
      {live && status === "waiting" && (
        <Overlay grid>
          <Avatar src={host.profile?.profileImage} name={hostName} size="lg" />
          <p className="text-xs font-bold tracking-[0.14em] text-foreground uppercase">Waiting for the host</p>
          <p className="max-w-xs text-[11px] text-muted-foreground">
            @{host.username} hasn&apos;t turned on their camera or mic yet. This page updates by itself.
          </p>
          <ScanBars />
        </Overlay>
      )}
      {live && status === "live" && !main && (
        <Overlay grid>
          <Avatar src={host.profile?.profileImage} name={hostName} size="lg" online />
          <p className="text-xs font-bold tracking-[0.14em] text-foreground uppercase">Camera off</p>
          <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {audioTracks.length ? (
              <>
                <ScanBars /> Audio only
              </>
            ) : (
              "The host paused their camera and mic"
            )}
          </p>
        </Overlay>
      )}
      {live && status === "error" && (
        <Overlay grid>
          <WifiOff className="size-7 text-destructive" aria-hidden="true" />
          <p className="text-xs font-bold tracking-[0.14em] text-foreground uppercase">No video signal</p>
          <p className="max-w-xs text-[11px] text-muted-foreground">{error || "Couldn't connect to the stream."}</p>
          <Button variant="outline" size="sm" icon={RefreshCw} onClick={() => setRetryKey((k) => k + 1)}>
            Retry
          </Button>
        </Overlay>
      )}
      {(!live || status === "ended") && (
        <Overlay grid>
          <p className="text-xs font-bold tracking-[0.14em] text-foreground uppercase">Stream has ended</p>
          {stream?.endedAt && (
            <p className="border border-border bg-card px-3 py-1.5 text-[11px] text-faint">
              Ended {new Date(stream.endedAt).toLocaleString()}
            </p>
          )}
        </Overlay>
      )}

      {/* Browsers block sound until the viewer taps once */}
      {live && needsTap && audioTracks.length > 0 && (
        <button
          type="button"
          onClick={unlockAudio}
          className="absolute inset-x-0 bottom-14 mx-auto flex w-fit items-center gap-2 border border-primary/60 bg-sidebar/90 px-4 py-2 text-[11px] font-bold tracking-[0.12em] text-primary uppercase hover:bg-primary/15"
        >
          <Volume2 className="size-4" aria-hidden="true" /> Tap to unmute
        </button>
      )}

      {/* Top HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-4 sm:p-5">
        {live ? (
          <span className="flex items-center gap-2">
            <Badge variant="destructive" className="bg-sidebar">
              <StatusDot tone="danger" pulse />
              Live
            </Badge>
            {micMuted && (
              <Badge variant="secondary" icon={MicOff} className="bg-sidebar">
                Mic off
              </Badge>
            )}
          </span>
        ) : (
          <Badge variant="secondary">Offline</Badge>
        )}
        <Badge variant="secondary" icon={Eye} className="bg-sidebar tabular-nums">
          {shownViewers}
        </Badge>
      </div>

      {/* Controls */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 border-t border-border bg-card/90 px-2 py-1.5">
        <div className="flex min-w-0 items-center gap-1">
          <IconButton
            icon={muted ? VolumeX : Volume2}
            label={muted ? "Unmute" : "Mute"}
            size="sm"
            onClick={() => (muted ? unlockAudio() : setMuted(true))}
          />
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={muted ? 0 : volume}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setVolume(v);
              setMuted(v === 0);
            }}
            aria-label="Volume"
            className="hidden h-1 w-20 cursor-pointer accent-primary sm:block"
          />
          <span className="ml-2 hidden text-[10px] font-bold tracking-[0.14em] text-faint uppercase sm:inline">
            SFU · <span className="text-muted-foreground">{main === screen && screen ? "Screen" : "Camera"}</span>
          </span>
        </div>
        <IconButton icon={Maximize} label="Fullscreen" size="sm" onClick={handleFullscreen} />
      </div>
    </div>
  );
};

function Overlay({ children, grid = false }) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center gap-3 bg-sidebar/85 px-6 text-center",
        grid && "bg-grid",
      )}
    >
      {children}
    </div>
  );
}

export default StreamPlayer;
