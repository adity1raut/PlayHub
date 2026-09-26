import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Clock,
  Facebook,
  Flag,
  Link2,
  MessageSquare,
  Twitter,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import StreamPlayer from "./StreamPlayer";
import HostStudio from "./HostStudio";
import StreamChat from "./StreamChat";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  LoadingBlock,
  Page,
  StatusDot,
} from "../../components/ui";
import { API_URL as backendUrl } from "../../lib/config";
import { toast } from "../../lib/toast";

const EMPTY = [];
const idOf = (v) => (v && typeof v === "object" ? v._id : v);

// Format duration
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
  const [hasJoined, setHasJoined] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
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

  // Fetch stream data if not provided as prop.
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
        setViewerCount(response.data.viewers?.length || 0);
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

  // Initialize stream data
  useEffect(() => {
    if (initialStream) {
      setStream(initialStream);
      setViewerCount(initialStream.viewers?.length || 0);
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

  // Join stream (viewer list) while live; leave on unmount / when it ends.
  const activeJoinRef = useRef(null);

  const handleJoinStream = useCallback(async (sid) => {
    try {
      const response = await axios.post(`${backendUrl}/api/stream/${sid}/join`);
      if (response.status === 200) {
        setHasJoined(true);
        setViewerCount(response.data.viewers);
      }
    } catch (err) {
      console.error("Error joining stream:", err);
    }
  }, []);

  const handleLeaveStream = useCallback(async (sid) => {
    try {
      const response = await axios.post(`${backendUrl}/api/stream/${sid}/leave`);
      if (response.status === 200) {
        setHasJoined(false);
      }
    } catch (err) {
      console.error("Error leaving stream:", err);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || isHost || !streamId || !stream?.isLive) return undefined;
    activeJoinRef.current = streamId;
    handleJoinStream(streamId);

    return () => {
      activeJoinRef.current = null;
      const sid = streamId;
      // Deferred so a StrictMode re-mount (which re-joins immediately) cancels the leave.
      setTimeout(() => {
        if (activeJoinRef.current !== sid) handleLeaveStream(sid);
      }, 0);
    };
  }, [streamId, stream?.isLive, isAuthenticated, isHost, handleJoinStream, handleLeaveStream]);

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

  // Refresh stream data periodically (viewer count, status)
  useEffect(() => {
    if (!streamId || !stream?.isLive) return undefined;
    const interval = setInterval(() => fetchStream(streamId, { silent: true }), 30000);
    return () => clearInterval(interval);
  }, [streamId, stream?.isLive, fetchStream]);

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

  // Share stream
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

  // Report stream
  const handleReport = () => {
    if (!isAuthenticated) {
      toast.info("Please log in to report content");
      return;
    }
    toast.info("Reporting isn't available yet");
  };

  // Handle back navigation
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

  // Loading state
  if (loading) {
    return (
      <Page wide>
        <LoadingBlock label="Loading stream" />
      </Page>
    );
  }

  // Error state
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
  const chatCount = stream.liveChat?.length || 0;

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
        {/* Left column: player + info */}
        <div className="min-w-0 space-y-6">
          {isHost && stream.isLive ? (
            <HostStudio stream={stream} onViewers={setViewerCount} onEnd={handleEndStream} ending={ending} />
          ) : (
            <StreamPlayer stream={stream} viewerCount={viewerCount} onViewers={setViewerCount} />
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
                    {hasJoined && <Badge variant="success">In room</Badge>}
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

              {/* Host row */}
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

              {/* Description */}
              <div>
                <h2 className="eyebrow mb-2 text-faint">About this stream</h2>
                <p className="text-xs leading-relaxed whitespace-pre-line text-muted-foreground sm:text-sm">
                  {stream.description || "No description provided for this stream."}
                </p>
              </div>
            </div>

            {/* Stats row */}
            <dl className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-4">
              {[
                { icon: Users, label: "Viewers", value: viewerCount },
                { icon: Clock, label: "Duration", value: formatDuration(stream.startedAt, stream.endedAt) },
                { icon: MessageSquare, label: "Messages", value: chatCount >= 50 ? "50+" : chatCount },
                {
                  icon: CalendarClock,
                  label: stream.endedAt ? "Ended" : "Started",
                  value: new Date(stream.endedAt || stream.startedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="bg-card px-5 py-4">
                  <dt className="eyebrow flex items-center gap-1.5 text-faint">
                    <Icon className="size-3.5" aria-hidden="true" />
                    {label}
                  </dt>
                  <dd className="mt-1.5 text-lg font-extrabold text-foreground tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {stream.startedAt && (
            <p className="text-[11px] text-faint">
              Started {new Date(stream.startedAt).toLocaleString()}
              {stream.endedAt && <> · Ended {new Date(stream.endedAt).toLocaleString()}</>}
            </p>
          )}
        </div>

        {/* Right column: chat */}
        <StreamChat
          streamId={stream._id}
          messages={stream.liveChat || EMPTY}
          isLive={stream.isLive}
          hostId={hostId}
          className="h-[32rem] lg:sticky lg:top-8 lg:h-[calc(100dvh-8rem)]"
        />
      </div>
    </Page>
  );
};

export default StreamViewer;
