import { X } from "lucide-react";
import { cn } from "../../lib/cn";
import { LIMITATION_LABELS, formatKbps } from "../../lib/rtcStats";

const QUALITY_META = {
  good: { label: "Good", tone: "text-success", bars: 3 },
  fair: { label: "Fair", tone: "text-warning", bars: 2 },
  poor: { label: "Poor", tone: "text-destructive", bars: 1 },
};

/** Three signal bars coloured by connection quality (from useRtcStats). */
export function ConnectionBadge({ quality, className }) {
  const meta = QUALITY_META[quality];
  if (!meta) return null;
  return (
    <span
      role="img"
      aria-label={`Connection ${meta.label.toLowerCase()}`}
      title={`Connection: ${meta.label}`}
      className={cn(
        "inline-flex h-[22px] items-end gap-[2px] border border-border bg-sidebar px-1.5 py-1",
        meta.tone,
        className,
      )}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn("w-[3px] bg-current", i >= meta.bars && "opacity-25")}
          style={{ height: `${5 + i * 4}px` }}
        />
      ))}
    </span>
  );
}

/** Live mic level (0-1 from the SFU's audio-level observer) as four bouncing bars. */
export function SpeakingIndicator({ level = 0, className, label = "Speaking" }) {
  const speaking = level > 0;
  return (
    <span
      role="img"
      aria-label={speaking ? label : "Silent"}
      className={cn("inline-flex h-4 items-end gap-[2px]", speaking ? "text-primary" : "text-faint", className)}
    >
      {[0.55, 1, 0.75, 0.4].map((weight, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="w-[3px] bg-current transition-[height] duration-150"
          style={{ height: `${Math.max(3, Math.round(16 * Math.min(1, level * weight * 1.4)))}px` }}
        />
      ))}
    </span>
  );
}

const Row = ({ label, children }) => (
  <div className="flex items-baseline justify-between gap-4">
    <dt className="shrink-0 whitespace-nowrap text-faint">{label}</dt>
    <dd className="text-right text-foreground tabular-nums">{children}</dd>
  </div>
);

const size = (v) => (v.width && v.height ? `${v.width}×${v.height}` : "—");
const fps = (v) => (v.fps != null ? `${Math.round(v.fps)} fps` : "");

/**
 * "Stats for nerds" panel over the player.
 * mode "viewer": what this browser receives from the SFU; mode "host": what it sends (per simulcast layer).
 */
export function StatsPanel({ stats, mode = "viewer", layerLabel, onClose, className }) {
  const quality = QUALITY_META[stats?.quality];
  return (
    <div
      className={cn(
        "absolute top-12 left-3 z-10 w-64 max-w-[calc(100%-1.5rem)] border border-border-strong bg-sidebar/95 p-3 text-[11px] shadow-float backdrop-blur-sm sm:left-4",
        className,
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="eyebrow text-primary">{mode === "host" ? "Upload stats" : "Stream stats"}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close stats"
          className="flex size-6 items-center justify-center text-faint hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>
      {!stats ? (
        <p className="text-faint">Measuring…</p>
      ) : (
        <dl className="space-y-1">
          <Row label="Connection">
            <span className={quality?.tone}>{quality?.label ?? "—"}</span>
          </Row>
          {mode === "viewer" ? (
            <>
              <Row label="Receiving">{formatKbps(stats.downKbps)}</Row>
              {stats.videoIn.slice(0, 2).map((v, i) => (
                <Row key={v.id} label={i === 0 ? "Video" : "Video 2"}>
                  {size(v)} {fps(v)}
                  {v.codec && <span className="text-faint"> · {v.codec}</span>}
                </Row>
              ))}
              {layerLabel && <Row label="SFU layer">{layerLabel}</Row>}
              <Row label="Packet loss">{stats.lossPct.toFixed(1)}%</Row>
              {stats.jitterMs != null && <Row label="Jitter">{stats.jitterMs} ms</Row>}
            </>
          ) : (
            <>
              <Row label="Sending">{formatKbps(stats.upKbps)}</Row>
              {stats.videoOut.map((v) => (
                <Row key={v.id} label={v.rid ? `Layer ${v.rid}` : "Video"}>
                  {size(v)} {fps(v)} <span className="text-faint">· {formatKbps(v.kbps)}</span>
                </Row>
              ))}
              <Row label="Limited by">{LIMITATION_LABELS[stats.limitation] ?? stats.limitation}</Row>
              <Row label="Loss at SFU">{stats.upLossPct.toFixed(1)}%</Row>
            </>
          )}
          {stats.rttMs != null && <Row label="Round trip">{stats.rttMs} ms</Row>}
        </dl>
      )}
    </div>
  );
}
