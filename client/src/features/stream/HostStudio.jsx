import { useEffect, useState } from "react";
import {
  Activity,
  Camera,
  CameraOff,
  Eye,
  Mic,
  MicOff,
  MonitorOff,
  MonitorUp,
  Radio,
  Settings2,
  Square,
  TriangleAlert,
} from "lucide-react";
import { Alert, Badge, Button, Corners, IconButton, Modal, ScanBars, Select, StatusDot } from "../../components/ui";
import { cn } from "../../lib/cn";
import { mediaDevicesSupported, screenShareSupported } from "../../lib/sfu";
import { useRtcStats } from "../../lib/rtcStats";
import { groupGuests } from "./useLiveStream";
import { ConnectionBadge, SpeakingIndicator, StatsPanel } from "./StreamStats";
import { ReactionsOverlay } from "./Reactions";
import { AudioOut, StageTile, VideoView } from "./media";

const nameOf = (user) => user?.name || user?.username || "Guest";

/**
 * Broadcast console shown to the stream's host instead of the viewer player. `broadcast` is
 * useStreamBroadcast (owned by StreamViewer, which also runs the stage). Guests on stage appear as
 * tiles the host can click to see large; their mic and screen audio play here too.
 */
export default function HostStudio({ broadcast: b, onViewers, onEnd, ending = false, reactions = [] }) {
  const [showDevices, setShowDevices] = useState(false);
  const [pinnedId, setPinnedId] = useState(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    onViewers?.(b.viewers, b.viewerList);
  }, [b.viewers, b.viewerList, onViewers]);

  const onAir = b.status === "live";
  // Upload health: sampled slowly for the badge, every second while the stats panel is open
  const stats = useRtcStats(b.getStats, { enabled: onAir, interval: showStats ? 1000 : 4000 });
  const guests = Object.values(groupGuests(b.remoteTracks));
  const videos = [
    b.preview.screen && { id: "my-screen", stream: b.preview.screen, label: "Your screen", contain: true },
    ...guests
      .filter((g) => g.screen && !g.screen.paused)
      .map((g) => ({ id: g.screen.producerId, track: g.screen.track, label: `${nameOf(g.user)} · screen`, contain: true, userId: g.userId })),
    b.camOn && b.preview.camera && { id: "my-camera", stream: b.preview.camera, label: "You", mirrored: true, userId: b.selfId },
  ].filter(Boolean);
  const main = videos.find((v) => v.id === pinnedId) || videos[0] || null;
  const tiles = videos.filter((v) => v !== main);
  const guestAudio = guests
    .flatMap((g) => [g.mic, g["screen-audio"]])
    .filter((t) => t && !t.paused)
    .map((t) => t.track);
  const speaking = b.audioLevel > 0 ? String(b.speakerId) : null;
  const myLevel = speaking && speaking === String(b.selfId) ? b.audioLevel : 0;

  if (!mediaDevicesSupported()) {
    return (
      <Alert variant="warning" title="Camera access unavailable">
        Broadcasting needs a secure page (https:// or http://localhost) and a browser with camera support. Open Spawnpoint
        over HTTPS to go live from this device.
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-video overflow-hidden border border-border-strong bg-sidebar">
        {main && (
          <VideoView
            track={main.track}
            stream={main.stream}
            mirrored={main.mirrored}
            className={cn("absolute inset-0 size-full", main.contain ? "object-contain" : "object-cover")}
          />
        )}
        <AudioOut tracks={guestAudio} />
        {tiles.length > 0 && (
          <div className="absolute top-12 right-3 bottom-3 z-[1] flex w-1/4 min-w-24 flex-col justify-end gap-2">
            {tiles.slice(0, 3).map((t) => (
              <StageTile
                key={t.id}
                track={t.track}
                stream={t.stream}
                label={t.label}
                mirrored={t.mirrored}
                speaking={Boolean(speaking && t.userId && speaking === String(t.userId))}
                onClick={() => setPinnedId(t.id)}
              />
            ))}
          </div>
        )}
        <div aria-hidden="true" className="pointer-events-none absolute inset-3 sm:inset-4">
          <Corners size="size-4" />
        </div>

        {!onAir && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-sidebar/85 bg-grid px-6 text-center">
            <Radio className="size-8 text-primary" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold tracking-[0.14em] text-foreground uppercase">Ready to broadcast</p>
              <p className="mt-2 max-w-sm text-[11px] leading-relaxed text-muted-foreground">
                Your camera and mic are sent once to the Spawnpoint SFU, which relays them to every viewer. Followers
                get a &quot;live now&quot; alert as soon as you start.
              </p>
            </div>
            <Button
              variant="solid"
              size="lg"
              icon={Camera}
              className="glow"
              loading={b.status === "starting"}
              disabled={!b.linkUp}
              onClick={b.start}
            >
              {b.linkUp ? "Start camera & mic" : "Connecting…"}
            </Button>
          </div>
        )}

        <ReactionsOverlay floating={reactions} />

        {onAir && !main && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-grid text-center">
            <CameraOff className="size-7 text-faint" aria-hidden="true" />
            <p className="eyebrow text-faint">Camera off — viewers {b.micOn ? "hear you" : "see a paused stream"}</p>
            {b.micOn && <ScanBars />}
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-4 sm:p-5">
          <span className="flex items-center gap-2">
            {onAir ? (
              <Badge variant="destructive" className="bg-sidebar">
                <StatusDot tone="danger" pulse /> On air
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-sidebar">
                Off air
              </Badge>
            )}
            {onAir && !b.micOn && (
              <Badge variant="warning" icon={MicOff} className="bg-sidebar">
                Muted
              </Badge>
            )}
            {main?.track && (
              <Badge variant="info" icon={MonitorUp} className="max-w-44 bg-sidebar">
                <span className="truncate">{main.label}</span>
              </Badge>
            )}
          </span>
          <span className="flex items-center gap-2">
            {onAir && stats && <ConnectionBadge quality={stats.quality} />}
            <Badge variant="secondary" icon={Eye} className="bg-sidebar tabular-nums">
              {b.viewers}
            </Badge>
          </span>
        </div>

        {showStats && onAir && <StatsPanel stats={stats} mode="host" onClose={() => setShowStats(false)} />}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border border-border bg-card px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <IconButton
            icon={b.micOn ? Mic : MicOff}
            label={b.micOn ? "Mute mic" : "Unmute mic"}
            variant={b.micOn ? "secondary" : "destructive"}
            active={b.micOn && onAir}
            disabled={!onAir}
            onClick={b.toggleMic}
          />
          <IconButton
            icon={b.camOn ? Camera : CameraOff}
            label={b.camOn ? "Turn camera off" : "Turn camera on"}
            variant={b.camOn ? "secondary" : "destructive"}
            active={b.camOn && onAir}
            disabled={!onAir}
            onClick={b.toggleCamera}
          />
          {screenShareSupported() && (
            <IconButton
              icon={b.screenOn ? MonitorOff : MonitorUp}
              label={b.screenOn ? "Stop sharing screen" : "Share screen"}
              variant="secondary"
              active={b.screenOn}
              disabled={!onAir}
              onClick={b.toggleScreen}
            />
          )}
          <IconButton
            icon={Settings2}
            label="Camera & mic settings"
            variant="secondary"
            disabled={!onAir}
            onClick={() => setShowDevices(true)}
          />
          <IconButton
            icon={Activity}
            label={showStats ? "Hide upload stats" : "Show upload stats"}
            variant="secondary"
            active={showStats}
            disabled={!onAir}
            onClick={() => setShowStats((v) => !v)}
          />
          {onAir && b.micOn && (
            <span className="ml-1 flex h-10 items-center border border-border px-2" title="Your mic level, as viewers hear it">
              <SpeakingIndicator level={myLevel} label="You're speaking" />
            </span>
          )}
          <span className="ml-1 hidden items-center gap-2 text-[10px] font-bold tracking-[0.14em] text-faint uppercase sm:flex">
            <StatusDot tone={b.linkUp ? "success" : "danger"} pulse={!b.linkUp} />
            {b.linkUp ? "SFU linked" : "Reconnecting"}
          </span>
        </div>
        <Button variant="destructive" size="sm" icon={Square} loading={ending} onClick={() => setConfirmEnd(true)}>
          End stream
        </Button>
      </div>

      {b.error && (
        <Alert variant="destructive" title="Broadcast problem">
          <span className="flex items-start justify-between gap-3">
            {b.error}
            <button type="button" className="shrink-0 underline" onClick={b.clearError}>
              Dismiss
            </button>
          </span>
        </Alert>
      )}

      <Modal
        open={showDevices}
        onClose={() => setShowDevices(false)}
        title="Camera & mic"
        description="Switch devices without interrupting the stream."
        size="sm"
      >
        <div className="space-y-4">
          <Select label="Camera" value={b.devices.cameraId} onChange={(e) => b.switchDevice("camera", e.target.value)}>
            {b.devices.cameras.map((d, i) => (
              <option key={d.deviceId || i} value={d.deviceId}>
                {d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </Select>
          <Select label="Microphone" value={b.devices.micId} onChange={(e) => b.switchDevice("mic", e.target.value)}>
            {b.devices.mics.map((d, i) => (
              <option key={d.deviceId || i} value={d.deviceId}>
                {d.label || `Microphone ${i + 1}`}
              </option>
            ))}
          </Select>
        </div>
      </Modal>

      <Modal
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        title="End stream?"
        description="Viewers are disconnected and the stream moves to your past streams."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmEnd(false)}>
              Keep streaming
            </Button>
            <Button
              variant="destructive"
              icon={TriangleAlert}
              loading={ending}
              onClick={async () => {
                setConfirmEnd(false);
                b.stopAll();
                await onEnd?.();
              }}
            >
              End stream
            </Button>
          </>
        }
      >
        <p className="text-xs text-muted-foreground">Your camera and mic will be released.</p>
      </Modal>
    </div>
  );
}
