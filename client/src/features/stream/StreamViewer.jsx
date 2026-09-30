import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Eye,
  Facebook,
  Flag,
  Heart,
  Link2,
  MessageSquare,
  TrendingUp,
  Twitter,
  UserCheck,
  UserPlus,
} from "lucide-react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import StreamPlayer from "./StreamPlayer";
import HostStudio from "./HostStudio";
import StreamChat from "./StreamChat";
import { ReactionBar } from "./Reactions";
import { useStreamReactions } from "./useStreamReactions";
import StagePanel from "./StagePanel";
import { useStage } from "./useStage";
import { groupGuests, useGuestMedia, useStreamBroadcast, useStreamWatch } from "./useLiveStream";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBar,
  EmptyState,
  IconButton,
  LoadingBlock,
  Page,
  StatusDot,
} from "../../components/ui";
import { API_URL as backendUrl } from "../../lib/config";
import { cn } from "../../lib/cn";
import { toast } from "../../lib/toast";
import { useSocketEvent } from "../../lib/useSocketEvent";

const EMPTY = [];
const idOf = (v) => (v && typeof v === "object" ? v._id : v);

const formatDuration = (start, end) => {
  if (!start) return "0m";
  const duration = end ? new Date(end) - new Date(start) : Date.now() - new Date(start);
  const minutes = Math.max(0, Math.floor(duration / 1000 / 60));
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
};

const StreamViewer = ({ stream: initialStream, onBack }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [stream, setStream] = useState(initialStream || null);
  const [viewerCount, setViewerCount] = useState(0);
  const [watchers, setWatchers] = useState([]); // who's in the SFU room right now
  // Whole-stream counters, pushed live by the server (`stream:stats`)
  const [counters, setCounters] = useState({ peakViewers: 0, messages: 0, reactions: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [loading, setLoading] = useState(!initialStream);
  const [error, setError] = useState(null);
  const [ending, setEnding] = useState(false);
  const { user, isAuthenticated, refreshUser } = useAuth();
  const { socket, isConnected } = useSocket();

  const streamId = stream?._id;
  const hostId = idOf(stream?.host);
  const isHost = Boolean(user?._id && hostId && String(user._id) === String(hostId));

  // GET /api/stream/:id returns the populated stream document directly (not wrapped).
  const fetchStream = useCallback(async (sid, { silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      const response = await axios.get(`${backendUrl}/api/stream/${sid}`);
      if (response.status === 200) {
        setStream(response.data);
        setViewerCount(response.data.liveViewers ?? 0);
        setCounters({
          peakViewers: response.data.peakViewers ?? 0,
          messages: response.data.messagesCount ?? response.data.liveChat?.length ?? 0,
          reactions: response.data.reactionsCount ?? 0,
        });
      }
    } catch (err) {
      console.error("Error fetching stream:", err);
      if (!silent) {
        setError(
          err.response?.status === 404
            ? "The stream you're looking for doesn't exist or has been removed."
            : "Failed to load stream",
        );
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialStream) {
      setStream(initialStream);
      setViewerCount(initialStream.liveViewers ?? 0);
      setLoading(false);
    } else if (id) {
      fetchStream(id);
    }
  }, [id, initialStream, fetchStream]);

  // Following state comes from the signed-in user's `following` id list.
  useEffect(() => {
    if (!hostId) return;
    const following = Array.isArray(user?.following) ? user.following : [];
    setIsFollowing(following.some((f) => String(idOf(f)) === String(hostId)));
  }, [hostId, user?.following]);

  // Realtime room: chat messages + stream-ended arrive on `stream_<id>`.
  useEffect(() => {
    if (!socket || !isConnected || !streamId) return undefined;
    socket.emit("join-stream", streamId);

    const onEnded = (data) => {
      if (String(data?.streamId) !== String(streamId)) return;
      setStream((prev) =>
        prev ? { ...prev, isLive: false, endedAt: data?.timestamp || new Date().toISOString() } : prev,
      );
      toast.info(data?.message || "Stream has ended");
    };
    socket.on("stream-ended", onEnded);

    return () => {
      socket.off("stream-ended", onEnded);
      if (socket.connected) socket.emit("leave-stream", streamId);
    };
  }, [socket, isConnected, streamId]);

  // Live counters (viewers, peak, messages, reactions). After a reconnect, refetch in case
  // anything (e.g. the stream ending) was missed while offline.
  useSocketEvent(
    "stream:stats",
    (stats = {}) => {
      if (String(stats.streamId) !== String(streamId)) return;
      setViewerCount(stats.viewers ?? 0);
      setCounters({ peakViewers: stats.peakViewers ?? 0, messages: stats.messages ?? 0, reactions: stats.reactions ?? 0 });
    },
    { onReconnect: () => streamId && fetchStream(streamId, { silent: true }) },
  );

  const reactions = useStreamReactions(streamId, { enabled: Boolean(stream?.isLive) });

  // Media sessions live here (not in the player/studio) so the stage can publish through them:
  // the host broadcasts, everyone else watches — and guests on stage share their screen and mic
  const live = Boolean(stream?.isLive);
  const [retryKey, setRetryKey] = useState(0);
  const broadcast = useStreamBroadcast(streamId, { enabled: live && isHost });
  const watch = useStreamWatch(streamId, { enabled: live && !isHost, retryKey });
  const media = isHost ? broadcast : watch;
  const stage = useStage(streamId, { initial: media.stage, isHost, streamTitle: stream?.title });
  const guestMedia = useGuestMedia(watch, { onStage: live && !isHost && stage.status === "approved" });

  // What each guest is sharing right now (for the stage list)
  const stageMedia = useMemo(() => {
    const groups = isHost ? groupGuests(broadcast.remoteTracks) : watch.guests;
    const out = {};
    for (const [userId, g] of Object.entries(groups)) {
      out[userId] = { mic: Boolean(g.mic && !g.mic.paused), screen: Boolean(g.screen && !g.screen.paused) };
    }
    return out;
  }, [isHost, broadcast.remoteTracks, watch.guests]);

  const handleViewers = useCallback((count, list) => {
    setViewerCount(count);
    if (Array.isArray(list)) setWatchers(list);
  }, []);

  // Follow / unfollow the host (toggle endpoint)
  const handleFollowToggle = async () => {
    if (!isAuthenticated) {
      toast.info("Please log in to follow streamers");
      return;
    }
    const username = stream?.host?.username;
    if (!username) return;

    setFollowLoading(true);
    try {
      // POST /api/auth/profile/:username/follow → { success, followed, followersCount }
      const response = await axios.post(`${backendUrl}/api/auth/profile/${encodeURIComponent(username)}/follow`);
      if (response.data?.success) {
        const followed = Boolean(response.data.followed);
        setIsFollowing(followed);
        if (followed) {
          toast.success(`Following @${username}`);
        } else {
          toast(`Unfollowed @${username}`);
        }
        refreshUser?.();
      }
    } catch (err) {
      console.error("Error toggling follow:", err);
      toast.error(err.response?.data?.message || "Couldn't update follow status");
    } finally {
      setFollowLoading(false);
    }
  };

  // Host ends the broadcast (also closes the SFU room for every viewer)
  const handleEndStream = async () => {
    setEnding(true);
    try {
      await axios.put(`${backendUrl}/api/stream/${stream._id}/end`);
      setStream((prev) => (prev ? { ...prev, isLive: false, endedAt: new Date().toISOString() } : prev));
      toast.success("Stream ended");
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't end the stream");
    } finally {
      setEnding(false);
    }
  };

  const handleShare = async (platform) => {
    const streamUrl = `${window.location.origin}/stream/${stream._id}`;
    const shareText = `Check out "${stream.title}" by ${stream.host?.username}`;

    switch (platform) {
      case "copy":
        try {
          await navigator.clipboard.writeText(streamUrl);
          toast.success("Link copied to clipboard");
        } catch (err) {
          console.error("Failed to copy:", err);
          toast.error("Couldn't copy the link");
        }
        break;
      case "twitter":
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(streamUrl)}`,
          "_blank",
          "noopener,noreferrer",
        );
        break;
      case "facebook":
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(streamUrl)}`,
          "_blank",
          "noopener,noreferrer",
        );
        break;
      default:
        break;
    }
  };

  const handleReport = () => {
    if (!isAuthenticated) {
      toast.info("Please log in to report content");
      return;
    }
    toast.info("Reporting isn't available yet");
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate("/streams");
    }
  };

  const backButton = (
    <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={handleBack} className="-ml-3">
      All streams
    </Button>
  );

  if (loading) {
    return (
      <Page wide>
        <LoadingBlock label="Loading stream" />
      </Page>
    );
  }

  if (error || !stream) {
    return (
      <Page wide>
        {backButton}
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="Stream not found"
            description={error || "The stream you're looking for doesn't exist or has been removed."}
            action={
              <Button variant="outline" icon={ArrowLeft} onClick={handleBack}>
                Back to streams
              </Button>
            }
          />
        </Card>
      </Page>
    );
  }

  const host = stream.host || {};
  const hostName = host.profile?.name || host.username;
  const uniqueViewers = Array.isArray(stream.viewers) ? stream.viewers.length : 0;

  return (
    <Page wide>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {backButton}
        <p className="eyebrow flex items-center gap-2 text-faint">
          <StatusDot tone={stream.isLive ? "danger" : "idle"} pulse={stream.isLive} />
          Broadcast / {stream.isLive ? "On air" : "Ended"}
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          {isHost && stream.isLive ? (
            <HostStudio
              broadcast={broadcast}
              onViewers={handleViewers}
              onEnd={handleEndStream}
              ending={ending}
              reactions={reactions.floating}
            />
          ) : (
            <StreamPlayer
              stream={stream}
              watch={watch}
              onRetry={() => setRetryKey((k) => k + 1)}
              viewerCount={viewerCount}
              onViewers={handleViewers}
              reactions={reactions.floating}
              localScreen={guestMedia.screenPreview}
            />
          )}

          {stream.isLive && isAuthenticated && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ReactionBar onReact={reactions.send} disabled={!reactions.canSend} />
              <p className="text-[11px] text-faint">Reactions float over the stream for everyone watching.</p>
            </div>
          )}

          {stream.isLive && (
            <StagePanel
              stage={stage}
              isHost={isHost}
              hostUsername={stream.host?.username}
              selfId={user?._id}
              media={stageMedia}
              speakerId={media.audioLevel > 0 ? media.speakerId : null}
              guestMedia={isHost ? null : guestMedia}
              ready={isHost ? broadcast.linkUp : watch.status === "live" || watch.status === "waiting"}
            />
          )}

          <Card corners>
            <div className="space-y-5 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {stream.isLive ? (
                      <Badge variant="destructive">
                        <StatusDot tone="danger" pulse />
                        Live
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Ended</Badge>
                    )}
                  </div>
                  <h1 className="text-lg font-extrabold tracking-[0.08em] break-words text-foreground uppercase sm:text-xl">
                    {stream.title}
                  </h1>
                </div>
                <div className="flex items-center gap-1">
                  <IconButton icon={Link2} label="Copy link" size="sm" onClick={() => handleShare("copy")} />
                  <IconButton icon={Twitter} label="Share on X / Twitter" size="sm" onClick={() => handleShare("twitter")} />
                  <IconButton icon={Facebook} label="Share on Facebook" size="sm" onClick={() => handleShare("facebook")} />
                  <IconButton icon={Flag} label="Report stream" size="sm" onClick={handleReport} />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-y border-dashed border-border py-4">
                <button
                  type="button"
                  onClick={() => host.username && navigate(`/profile/${host.username}`)}
                  className="flex min-w-0 items-center gap-3 text-left"
                >
                  <Avatar src={host.profile?.profileImage} name={hostName} size="md" online={stream.isLive} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-foreground">{hostName}</span>
                    <span className="block truncate text-[11px] text-primary">@{host.username}</span>
                  </span>
                </button>

                {isAuthenticated && !isHost && host.username && (
                  <Button
                    size="sm"
                    variant={isFollowing ? "outline" : "solid"}
                    icon={isFollowing ? UserCheck : UserPlus}
                    loading={followLoading}
                    onClick={handleFollowToggle}
                    aria-pressed={isFollowing}
                  >
                    {isFollowing ? "Following" : "Follow"}
                  </Button>
                )}
              </div>

              <div>
                <h2 className="eyebrow mb-2 text-faint">About this stream</h2>
                <p className="text-xs leading-relaxed whitespace-pre-line text-muted-foreground sm:text-sm">
                  {stream.description || "No description provided for this stream."}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-5">
              {[
                { icon: Eye, label: stream.isLive ? "Watching" : "Viewers", value: stream.isLive ? viewerCount : uniqueViewers },
                { icon: TrendingUp, label: "Peak", value: counters.peakViewers },
                { icon: MessageSquare, label: "Messages", value: counters.messages },
                { icon: Heart, label: "Reactions", value: counters.reactions },
                { icon: Clock, label: "Duration", value: formatDuration(stream.startedAt, stream.endedAt) },
              ].map(({ icon: Icon, label, value }, i) => (
                <div key={label} className={cn("bg-card px-5 py-4", i === 4 && "col-span-2 sm:col-span-1")}>
                  <dt className="eyebrow flex items-center gap-1.5 text-faint">
                    <Icon className="size-3.5" aria-hidden="true" />
                    {label}
                  </dt>
                  <dd className="mt-1.5 text-lg font-extrabold text-foreground tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {stream.isLive && (
            <Card>
              <CardBar
                title="Watching now"
                right={<span className="text-[11px] text-faint tabular-nums">{viewerCount}</span>}
              />
              {watchers.length ? (
                <ul className="flex flex-wrap gap-2 p-4">
                  {watchers.map((w) => (
                    <li key={w._id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/profile/${w.username}`)}
                        title={`@${w.username}`}
                        className="flex items-center gap-2 border border-border bg-background/60 py-1 pr-2.5 pl-1 text-[11px] transition-colors hover:border-primary/50 hover:bg-accent"
                      >
                        <Avatar src={w.profileImage} name={w.name || w.username} size="xs" />
                        <span className="max-w-32 truncate font-bold text-foreground">{w.name || w.username}</span>
                      </button>
                    </li>
                  ))}
                  {viewerCount > watchers.length && (
                    <li className="self-center text-[11px] text-faint">+{viewerCount - watchers.length} more</li>
                  )}
                </ul>
              ) : (
                <p className="px-5 py-4 text-[11px] text-faint">
                  <span className="text-primary">&gt;</span> Nobody else is watching yet.
                </p>
              )}
            </Card>
          )}

          {stream.startedAt && (
            <p className="text-[11px] text-faint">
              Started {new Date(stream.startedAt).toLocaleString()}
              {stream.endedAt && <> · Ended {new Date(stream.endedAt).toLocaleString()}</>}
            </p>
          )}
        </div>

        <StreamChat
          streamId={stream._id}
          messages={stream.liveChat || EMPTY}
          isLive={stream.isLive}
          hostId={hostId}
          slowMode={stream.chatSlowMode || 0}
          mutes={stream.chatMutes}
          className="h-[32rem] lg:sticky lg:top-8 lg:h-[calc(100dvh-8rem)]"
        />
      </div>
    </Page>
  );
};

export default StreamViewer;
