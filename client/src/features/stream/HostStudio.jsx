import { useEffect, useRef, useState } from "react";
import {
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
import { useStreamBroadcast } from "./useLiveStream";

function Preview({ stream, mirrored, className }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream || null;
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className={cn(className, mirrored && "-scale-x-100")}
    />
  );
}

/** Broadcast console shown to the stream's host instead of the viewer player. */
export default function HostStudio({ stream, onViewers, onEnd, ending = false }) {
  const b = useStreamBroadcast(stream._id, { enabled: stream.isLive });
  const [showDevices, setShowDevices] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  useEffect(() => {
    onViewers?.(b.viewers);
  }, [b.viewers, onViewers]);

  const onAir = b.status === "live";
  const main = b.preview.screen || (b.camOn ? b.preview.camera : null);
  const pip = b.preview.screen && b.camOn ? b.preview.camera : null;

  if (!mediaDevicesSupported()) {
    return (
      <Alert variant="warning" title="Camera access unavailable">
        Broadcasting needs a secure page (https:// or http://localhost) and a browser with camera support. Open PlayHub
        over HTTPS to go live from this device.
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-video overflow-hidden border border-border-strong bg-sidebar">
        {main && (
          <Preview
            stream={main}
            mirrored={main === b.preview.camera}
            className={cn("absolute inset-0 size-full", b.preview.screen ? "object-contain" : "object-cover")}
          />
        )}
        {pip && (
          <div className="absolute right-3 bottom-3 w-1/4 min-w-24 border border-primary/60 bg-sidebar shadow-float">
            <Preview stream={pip} mirrored className="aspect-video w-full object-cover" />
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
                Your camera and mic are sent once to the PlayHub SFU, which relays them to every viewer. Followers
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
          </span>
          <Badge variant="secondary" icon={Eye} className="bg-sidebar tabular-nums">
            {b.viewers}
          </Badge>
        </div>
      </div>

      {/* Control deck */}
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
