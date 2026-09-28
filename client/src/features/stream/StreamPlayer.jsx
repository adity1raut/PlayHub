import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  Check,
  Eye,
  Loader2,
  Maximize,
  MicOff,
  MonitorUp,
  PictureInPicture2,
  RefreshCw,
  Settings2,
  Volume2,
  VolumeX,
  WifiOff,
} from "lucide-react";
import { Avatar, Badge, Button, Corners, IconButton, ScanBars, StatusDot } from "../../components/ui";
import { cn } from "../../lib/cn";
import { LAYER_LABELS, QUALITY_OPTIONS } from "../../lib/sfu";
import { useRtcStats } from "../../lib/rtcStats";
import { ConnectionBadge, SpeakingIndicator, StatsPanel } from "./StreamStats";
import { ReactionsOverlay } from "./Reactions";
import { AudioOut, StageTile, VideoView } from "./media";

const QUALITY_KEY = "streamQuality";

const readQuality = () => {
  try {
    const saved = localStorage.getItem(QUALITY_KEY);
    return QUALITY_OPTIONS.some((o) => o.value === saved) ? saved : "auto";
  } catch {
    return "auto";
  }
};

const MAX_TILES = 3;
const nameOf = (user) => user?.name || user?.username || "Guest";

/** Close a popover on outside click / Escape. */
function useDismiss(ref, open, close) {
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && close();
    const onKey = (e) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, open, close]);
}

/**
 * Viewer side of a live stream — media arrives from the SFU through `watch` (useStreamWatch, owned by
 * StreamViewer so the stage controls can publish through the same session). Shows one video large —
 * the host's screen, else a guest's screen, else the host's camera — and the rest as tiles to click.
 * `localScreen` is a guest's own screen share, shown back to them as a tile.
 */
const StreamPlayer = ({
  stream,
  watch,
  onRetry,
  viewerCount,
  onViewers,
  reactions = [],
  localScreen = null,
  className = "",
}) => {
  const live = Boolean(stream?.isLive);
  const {
    status,
    error,
    viewers,
    viewerList,
    audioLevel,
    speakerId,
    selfId,
    layers,
    mediaState,
    bySource,
    guests,
    setQuality,
    getStats,
  } = watch;
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [needsTap, setNeedsTap] = useState(false);
  const [unlockKey, setUnlockKey] = useState(0);
  const [pinnedId, setPinnedId] = useState(null);
  const [quality, setQualityChoice] = useState(readQuality);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [inPip, setInPip] = useState(false);
  const containerRef = useRef(null);
  const mainVideoRef = useRef(null);
  const menuRef = useRef(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useDismiss(menuRef, menuOpen, closeMenu);

  useEffect(() => {
    if (viewers != null) onViewers?.(viewers, viewerList);
  }, [viewers, viewerList, onViewers]);

  const host = stream?.host || {};
  const hostName = host.profile?.name || host.username;
  const hostId = String(host._id ?? host ?? "");
  const camera = bySource.camera;
  const screen = bySource.screen;
  const guestList = Object.values(guests);

  // Everything that can be shown as video, most important first; the viewer can pin any of them
  const videos = [
    screen && !screen.paused && { id: screen.producerId, track: screen.track, label: `${hostName} · screen`, contain: true, userId: hostId },
    ...guestList
      .filter((g) => g.screen && !g.screen.paused)
      .map((g) => ({ id: g.screen.producerId, track: g.screen.track, label: `${nameOf(g.user)} · screen`, contain: true, userId: g.userId })),
    camera && !camera.paused && { id: camera.producerId, track: camera.track, label: hostName, camera: true, userId: hostId },
  ].filter(Boolean);
  const main = videos.find((v) => v.id === pinnedId) || videos[0] || null;
  const tiles = videos.filter((v) => v !== main);
  if (localScreen) tiles.unshift({ id: "local-screen", stream: localScreen, label: "Your screen (live)", local: true });

  const audioTracks = [bySource.mic, bySource["screen-audio"], ...guestList.flatMap((g) => [g.mic, g["screen-audio"]])]
    .filter((t) => t && !t.paused)
    .map((t) => t.track);
  const micMuted = bySource.mic?.paused;

  // Who's talking (loudest mic in the room, from the SFU)
  const speakerName =
    audioLevel > 0 && speakerId
      ? String(speakerId) === hostId
        ? hostName
        : String(speakerId) === String(selfId)
          ? "You"
          : nameOf(guests[speakerId]?.user)
      : null;

  // Quality: the viewer's choice caps the camera's simulcast layer. While the camera is only a
  // small tile (something else is large), ask for the low layer and save the bandwidth.
  const cameraId = camera?.producerId;
  const cameraSimulcast = Boolean(camera?.simulcast);
  const cameraSmall = Boolean(camera && !main?.camera);
  const effectiveQuality = cameraSmall ? "low" : quality;
  useEffect(() => {
    if (cameraId && cameraSimulcast) setQuality(cameraId, effectiveQuality).catch(() => {});
  }, [cameraId, cameraSimulcast, effectiveQuality, setQuality]);

  const chooseQuality = (value) => {
    setQualityChoice(value);
    try {
      localStorage.setItem(QUALITY_KEY, value);
    } catch {
      /* the choice still applies for this visit */
    }
  };

  const layer = cameraId ? layers[cameraId] : undefined;
  const layerLabel =
    cameraSimulcast && layer != null ? `${LAYER_LABELS[layer] ?? layer}${quality === "auto" ? " (auto)" : ""}` : null;

  // Sampled slowly for the connection badge, every second while the stats panel is open
  const stats = useRtcStats(getStats, { enabled: live && status === "live", interval: showStats ? 1000 : 4000 });
  const reconnecting = live && (mediaState === "disconnected" || mediaState === "failed");

  const unlockAudio = useCallback(() => {
    setNeedsTap(false);
    setMuted(false);
    setUnlockKey((k) => k + 1);
  }, []);

  const handleFullscreen = () => {
    const el = containerRef.current;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el?.requestFullscreen?.().catch?.(() => {});
  };

  // Browser picture-in-picture: keep watching the main video while browsing the rest of the app
  const pipSupported = typeof document !== "undefined" && document.pictureInPictureEnabled;
  useEffect(() => {
    const el = mainVideoRef.current;
    if (!el) return undefined;
    const enter = () => setInPip(true);
    const leave = () => setInPip(false);
    el.addEventListener("enterpictureinpicture", enter);
    el.addEventListener("leavepictureinpicture", leave);
    return () => {
      el.removeEventListener("enterpictureinpicture", enter);
      el.removeEventListener("leavepictureinpicture", leave);
    };
  }, [main?.id]);
  const togglePip = async () => {
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await mainVideoRef.current?.requestPictureInPicture();
    } catch {
      /* not allowed right now (e.g. no video frames yet) */
    }
  };

  const shownViewers = viewers ?? viewerCount ?? 0;

  return (
    <div
      ref={containerRef}
      className={cn("group relative aspect-video overflow-hidden border border-border-strong bg-sidebar", className)}
    >
      {main && (
        <VideoView
          track={main.track}
          videoRef={mainVideoRef}
          className={cn("absolute inset-0 size-full", main.contain ? "object-contain" : "object-cover")}
        />
      )}
      <AudioOut
        tracks={audioTracks}
        muted={muted}
        volume={volume}
        unlockKey={unlockKey}
        onBlocked={() => setNeedsTap(true)}
      />

      {/* Stage strip: everything not shown large (host camera, other screens, your own share) */}
      {tiles.length > 0 && (
        <div className="absolute top-12 right-3 bottom-14 z-[1] flex w-1/4 min-w-24 flex-col justify-end gap-2 sm:right-4">
          {tiles.slice(0, MAX_TILES).map((t) => (
            <StageTile
              key={t.id}
              track={t.track}
              stream={t.stream}
              label={t.label}
              speaking={Boolean(speakerName && t.userId && String(t.userId) === String(speakerId))}
              onClick={t.local ? undefined : () => setPinnedId(t.id)}
            />
          ))}
          {tiles.length > MAX_TILES && (
            <span className="self-end border border-border bg-sidebar px-1.5 py-0.5 text-[10px] text-faint">
              +{tiles.length - MAX_TILES} more
            </span>
          )}
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
                <SpeakingIndicator level={audioLevel} label={`${speakerName || hostName} is speaking`} />
                {speakerName ? `${speakerName} is speaking` : "Audio only"}
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
          <Button variant="outline" size="sm" icon={RefreshCw} onClick={onRetry}>
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

      {live && <ReactionsOverlay floating={reactions} />}

      {/* Browsers block sound until the viewer taps once */}
      {live && needsTap && audioTracks.length > 0 && (
        <button
          type="button"
          onClick={unlockAudio}
          className="absolute bottom-14 left-3 z-[2] flex w-fit items-center gap-2 border border-primary/60 bg-sidebar/90 px-4 py-2 text-[11px] font-bold tracking-[0.12em] text-primary uppercase hover:bg-primary/15 sm:inset-x-0 sm:mx-auto"
        >
          <Volume2 className="size-4" aria-hidden="true" /> Tap to unmute
        </button>
      )}

      {showStats && live && (
        <StatsPanel stats={stats} mode="viewer" layerLabel={layerLabel} onClose={() => setShowStats(false)} />
      )}

      {/* Top HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-4 sm:p-5">
        {live ? (
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant="destructive" className="bg-sidebar">
              <StatusDot tone="danger" pulse />
              Live
            </Badge>
            {micMuted ? (
              <Badge variant="secondary" icon={MicOff} className="bg-sidebar">
                Mic off
              </Badge>
            ) : null}
            {speakerName && (
              <span className="flex h-[22px] max-w-40 items-center gap-1.5 border border-border bg-sidebar px-1.5 text-[10px] font-bold text-foreground">
                <SpeakingIndicator level={audioLevel} label={`${speakerName} is speaking`} className="h-3" />
                <span className="truncate">{speakerName}</span>
              </span>
            )}
            {main && main.userId !== hostId && (
              <Badge variant="info" icon={MonitorUp} className="max-w-44 bg-sidebar">
                <span className="truncate">{main.label}</span>
              </Badge>
            )}
            {reconnecting && (
              <Badge variant="warning" className="bg-sidebar">
                <Loader2 className="animate-spin" aria-hidden="true" /> Reconnecting
              </Badge>
            )}
          </span>
        ) : (
          <Badge variant="secondary">Offline</Badge>
        )}
        <span className="flex items-center gap-2">
          {live && stats && <ConnectionBadge quality={stats.quality} />}
          <Badge variant="secondary" icon={Eye} className="bg-sidebar tabular-nums">
            {shownViewers}
          </Badge>
        </span>
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
          <span className="ml-2 hidden truncate text-[10px] font-bold tracking-[0.14em] text-faint uppercase sm:inline">
            SFU · <span className="text-muted-foreground">{main ? (main.camera ? "Camera" : main.label) : "Audio"}</span>
            {layerLabel && main?.camera && <span className="text-muted-foreground"> · {LAYER_LABELS[layer]}</span>}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {pinnedId && main?.id === pinnedId && (
            <Button size="sm" variant="ghost" onClick={() => setPinnedId(null)} title="Let the stream choose what's shown large">
              Unpin
            </Button>
          )}
          {pipSupported && main && (
            <IconButton
              icon={PictureInPicture2}
              label={inPip ? "Exit picture-in-picture" : "Picture-in-picture"}
              size="sm"
              active={inPip}
              onClick={togglePip}
            />
          )}
          <div ref={menuRef} className="relative">
            <IconButton
              icon={Settings2}
              label="Quality and stats"
              size="sm"
              active={menuOpen}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            />
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 bottom-full z-20 mb-2 w-56 border border-border-strong bg-popover p-1 text-xs shadow-float animate-slide-up"
              >
                <p className="eyebrow flex items-center justify-between px-2.5 py-1.5 text-faint">
                  Quality
                  {layerLabel && <span className="normal-case tracking-normal text-muted-foreground">Now: {LAYER_LABELS[layer]}</span>}
                </p>
                {QUALITY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={quality === option.value}
                    disabled={!cameraSimulcast}
                    onClick={() => chooseQuality(option.value)}
                    className="flex w-full items-center justify-between gap-2 border border-transparent px-2.5 py-2 text-left hover:border-border hover:bg-accent disabled:opacity-50"
                  >
                    {option.label}
                    {quality === option.value && <Check className="size-3.5 text-primary" aria-hidden="true" />}
                  </button>
                ))}
                {cameraSmall && (
                  <p className="px-2.5 pb-1 text-[10px] leading-relaxed text-faint">
                    The camera is on low while something else is showing large.
                  </p>
                )}
                <div className="-mx-1 my-1 h-px bg-border" />
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={showStats}
                  onClick={() => {
                    setShowStats((s) => !s);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 border border-transparent px-2.5 py-2 text-left hover:border-border hover:bg-accent"
                >
                  <Activity className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  {showStats ? "Hide stream stats" : "Show stream stats"}
                </button>
              </div>
            )}
          </div>
          <IconButton icon={Maximize} label="Fullscreen" size="sm" onClick={handleFullscreen} />
        </div>
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
