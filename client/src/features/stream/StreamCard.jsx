import { BarChart3, Clock, Eye, Radio, Square } from "lucide-react";
import { Avatar, Badge, Button, Card, Corners, StatusDot } from "../../components/ui";
import { cn } from "../../lib/cn";
import { mediaUrl } from "../../lib/config";

const formatDuration = (start, end) => {
  if (!start) return "0m";
  const duration = end ? new Date(end) - new Date(start) : Date.now() - new Date(start);
  const minutes = Math.max(0, Math.floor(duration / 1000 / 60));
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
};

const formatViewerCount = (count = 0) => {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
};

/** Live count from `stream:viewers` when we have one, else the REST viewers list. */
const viewerCountOf = (stream) =>
  typeof stream?.viewerCount === "number" ? stream.viewerCount : stream?.viewers?.length || 0;

const formatStarted = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Stream tile. Place inside a `grid border-t border-l border-border` wrapper —
 * the card draws only its right/bottom borders so tiles share 1px rules.
 * `fresh` briefly highlights a stream that just went live (socket `stream:started`).
 */
const StreamCard = ({
  stream,
  onClick,
  showAnalytics = false,
  showEndButton = false,
  onEndStream,
  onShowAnalytics,
  fresh = false,
  className,
}) => {
  const viewers = viewerCountOf(stream);
  const hostName = stream.host?.username || "unknown";
  const tags = [stream.category, ...(Array.isArray(stream.tags) ? stream.tags : [])].filter(Boolean);

  const handleEndStream = (e) => {
    e.stopPropagation();
    onEndStream?.(stream._id);
  };

  const handleAnalytics = (e) => {
    e.stopPropagation();
    onShowAnalytics?.(stream._id);
  };

  const open = () => onClick?.(stream);

  return (
    <Card
      interactive
      corners={fresh}
      className={cn("group flex flex-col border-t-0 border-l-0", fresh && "animate-slide-up", className)}
    >
      {fresh && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 border border-primary/60 bg-primary/[0.04]" />
      )}
      {/* Thumbnail */}
      <button
        type="button"
        onClick={open}
        aria-label={`Watch ${stream.title}`}
        className="relative block aspect-video w-full overflow-hidden border-b border-border bg-muted bg-grid text-left outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--primary)]"
      >
        {stream.thumbnail ? (
          <img
            src={mediaUrl(stream.thumbnail)}
            alt=""
            loading="lazy"
            className="size-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="relative flex size-12 items-center justify-center border border-border-strong bg-card/80 text-primary transition-colors group-hover:border-primary/60">
              <Corners size="size-2" />
              <Radio className="size-5" aria-hidden="true" />
            </span>
          </span>
        )}

        <span className="absolute top-3 left-3 flex items-center gap-1.5">
          {stream.isLive ? (
            <span className="bg-card">
              <Badge variant="destructive">
                <StatusDot tone="danger" pulse />
                Live
              </Badge>
            </span>
          ) : (
            <Badge variant="secondary">Ended</Badge>
          )}
          {fresh && (
            <span className="bg-card">
              <Badge>Just started</Badge>
            </span>
          )}
        </span>

        <span className="absolute right-3 bottom-3 flex items-center gap-1.5">
          <Badge variant="secondary" icon={Eye} className="tabular-nums">
            {formatViewerCount(viewers)}
            <span className="sr-only"> watching</span>
          </Badge>
          {stream.startedAt && (
            <Badge variant="secondary" icon={Clock} className="tabular-nums">
              {formatDuration(stream.startedAt, stream.endedAt)}
            </Badge>
          )}
        </span>
      </button>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <button type="button" onClick={open} className="min-w-0 text-left outline-none">
          <h3 className="truncate text-sm font-bold tracking-[0.1em] text-foreground uppercase transition-colors group-hover:text-primary">
            {stream.title}
          </h3>
          {stream.description && (
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {stream.description}
            </p>
          )}
        </button>

        <div className="flex min-w-0 items-center gap-2">
          <Avatar
            src={stream.host?.profile?.profileImage}
            name={stream.host?.profile?.name || hostName}
            size="xs"
          />
          <span className="truncate text-xs text-muted-foreground">@{hostName}</span>
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <Badge key={t} variant="outline">
                {t}
              </Badge>
            ))}
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-border pt-3">
          <span className="text-[11px] text-faint">
            {stream.isLive ? "Started" : "Aired"} {formatStarted(stream.startedAt)}
          </span>
          {(showAnalytics || (showEndButton && stream.isLive)) && (
            <div className="flex items-center gap-2">
              {showAnalytics && (
                <Button variant="ghost" size="sm" icon={BarChart3} onClick={handleAnalytics}>
                  Analytics
                </Button>
              )}
              {showEndButton && stream.isLive && (
                <Button variant="destructive" size="sm" icon={Square} onClick={handleEndStream}>
                  End stream
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default StreamCard;
