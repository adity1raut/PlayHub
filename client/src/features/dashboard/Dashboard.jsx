import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  Clock,
  FileText,
  Heart,
  MessageCircle,
  MessagesSquare,
  Newspaper,
  PenSquare,
  Radio,
  RefreshCw,
  Store,
  UserPlus,
  Users,
  Video,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardBar,
  EmptyState,
  IconButton,
  LoadingBlock,
  Page,
  PageHeader,
  StatTile,
  StatusDot,
} from "../../components/ui";
import { API_URL as backendUrl, mediaUrl } from "../../lib/config";
import { useSocketEvent } from "../../lib/useSocketEvent";
import DeviceAlertsBanner from "../notifications/DeviceAlertsBanner";

const POSTS_PER_PAGE = 6;
// Socket events keep "Live now" current; this slow refetch is only a safety net.
const LIVE_SAFETY_REFRESH_MS = 2 * 60 * 1000;
const FRESH_MS = 6000;

const idOf = (v) => String(v?._id ?? v ?? "");
const sameId = (a, b) => a != null && b != null && String(a) === String(b);

/** Live count from `stream:viewers` when we have one, else the REST viewers list. */
const viewerCountOf = (stream) =>
  typeof stream?.viewerCount === "number" ? stream.viewerCount : stream?.viewers?.length || 0;

/** Apply `fn` to the item with `id`; returns the same array when it isn't there (no re-render). */
const patchById = (list, id, fn) =>
  list.some((x) => sameId(x._id, id)) ? list.map((x) => (sameId(x._id, id) ? fn(x) : x)) : list;

const QUICK_ACTIONS = [
  { label: "New post", to: "/post", icon: PenSquare },
  { label: "Messages", to: "/chat", icon: MessagesSquare },
  { label: "Go live", to: "/streams", icon: Video },
  { label: "Browse stores", to: "/stores", icon: Store },
];

const timeAgo = (date) => {
  if (!date) return "";
  const s = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
};

const formatDuration = (startedAt) => {
  if (!startedAt) return "–";
  const mins = Math.max(0, Math.floor((Date.now() - new Date(startedAt)) / 1000 / 60));
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

const greetingFor = (hour) => (hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");

function Home() {
  const [posts, setPosts] = useState([]);
  const [liveStreams, setLiveStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamsLoaded, setStreamsLoaded] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [freshIds, setFreshIds] = useState(() => new Set()); // streams that just went live
  const freshTimers = useRef(new Map());
  // Stat tiles patched from socket events; reset whenever the auth user object is refreshed
  const [followCounts, setFollowCounts] = useState({});
  const [myPostIds, setMyPostIds] = useState(null);
  const { user } = useAuth();
  const { isConnected } = useSocket();

  // GET /api/posts/feed?page&limit → { success, posts, currentPage, hasMore }
  const fetchPosts = useCallback(async (pageNum = 1, append = false) => {
    try {
      if (pageNum > 1) setLoadingMore(true);
      const res = await axios.get(`${backendUrl}/api/posts/feed`, {
        params: { page: pageNum, limit: POSTS_PER_PAGE },
        withCredentials: true,
      });
      if (res.data.success) {
        const next = res.data.posts ?? [];
        setPosts((p) => (append ? [...p, ...next] : next));
        setHasMore(Boolean(res.data.hasMore));
        setPage(pageNum);
      }
    } catch (err) {
      console.error("Error fetching posts:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // GET /api/stream/live → Stream[] (host populated)
  const fetchLiveStreams = useCallback(async () => {
    try {
      setStreamLoading(true);
      const res = await axios.get(`${backendUrl}/api/stream/live`);
      const list = Array.isArray(res.data) ? res.data : [];
      // Keep live viewer counts from the socket — REST only has the join list
      setLiveStreams((prev) => {
        const counts = new Map(
          prev.filter((s) => typeof s.viewerCount === "number").map((s) => [String(s._id), s.viewerCount]),
        );
        return counts.size
          ? list.map((s) => (counts.has(String(s._id)) ? { ...s, viewerCount: counts.get(String(s._id)) } : s))
          : list;
      });
    } catch (err) {
      console.error("Error fetching streams:", err);
    } finally {
      setStreamLoading(false);
      setStreamsLoaded(true);
    }
  }, []);

  const userId = user?._id;
  useEffect(() => {
    if (userId) {
      fetchPosts();
      fetchLiveStreams();
    }
  }, [userId, fetchPosts, fetchLiveStreams]);

  useEffect(() => {
    const iv = setInterval(fetchLiveStreams, LIVE_SAFETY_REFRESH_MS);
    return () => clearInterval(iv);
  }, [fetchLiveStreams]);

  useEffect(() => {
    const timers = freshTimers.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  // A refreshed auth user already carries the latest counts
  useEffect(() => {
    setFollowCounts({});
    setMyPostIds(null);
  }, [user]);

  const markFresh = (id) => {
    const key = String(id);
    setFreshIds((prev) => new Set(prev).add(key));
    clearTimeout(freshTimers.current.get(key));
    freshTimers.current.set(
      key,
      setTimeout(() => {
        freshTimers.current.delete(key);
        setFreshIds((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }, FRESH_MS),
    );
  };

  // ── Realtime: live streams ──────────────────────────────────────────────
  useSocketEvent(
    "stream:started",
    ({ stream } = {}) => {
      if (!stream?._id) return;
      setLiveStreams((prev) =>
        prev.some((s) => sameId(s._id, stream._id)) ? prev : [{ ...stream, isLive: true }, ...prev],
      );
      setStreamsLoaded(true);
      markFresh(stream._id);
    },
    { onReconnect: fetchLiveStreams },
  );

  useSocketEvent("stream:ended", ({ streamId } = {}) => {
    if (!streamId) return;
    setLiveStreams((prev) =>
      prev.some((s) => sameId(s._id, streamId)) ? prev.filter((s) => !sameId(s._id, streamId)) : prev,
    );
  });

  useSocketEvent("stream:viewers", ({ streamId, count } = {}) => {
    if (!streamId || typeof count !== "number") return;
    setLiveStreams((prev) =>
      patchById(prev, streamId, (s) => (s.viewerCount === count ? s : { ...s, viewerCount: count })),
    );
  });

  // ── Realtime: follower / following tiles (counts come from the event) ───
  useSocketEvent("follow:updated", (e = {}) => {
    if (!userId) return;
    setFollowCounts((prev) => {
      let next = prev;
      if (sameId(e.targetId, userId) && typeof e.followersCount === "number") {
        next = { ...next, followers: e.followersCount };
      }
      if (sameId(e.followerId, userId) && typeof e.followingCount === "number") {
        next = { ...next, following: e.followingCount };
      }
      return next;
    });
  });

  // ── Realtime: recent posts + the Posts tile ─────────────────────────────
  const userPostIds = useMemo(() => new Set((user?.posts || []).map(idOf)), [user?.posts]);

  useSocketEvent("post:created", ({ post } = {}) => {
    if (!post?._id || !userId || !sameId(idOf(post.author), userId)) return;
    setMyPostIds((prev) => new Set(prev ?? userPostIds).add(String(post._id)));
  });

  useSocketEvent("post:deleted", ({ postId } = {}) => {
    if (!postId) return;
    setPosts((prev) =>
      prev.some((p) => sameId(p._id, postId)) ? prev.filter((p) => !sameId(p._id, postId)) : prev,
    );
    setMyPostIds((prev) => {
      const base = prev ?? userPostIds;
      if (!base.has(String(postId))) return prev;
      const next = new Set(base);
      next.delete(String(postId));
      return next;
    });
  });

  useSocketEvent("post:likes", ({ postId, likesCount } = {}) => {
    if (!postId || typeof likesCount !== "number") return;
    setPosts((prev) => patchById(prev, postId, (p) => ({ ...p, likesCount })));
  });

  useSocketEvent("post:comment", ({ postId, commentsCount } = {}) => {
    if (!postId || typeof commentsCount !== "number") return;
    setPosts((prev) => patchById(prev, postId, (p) => ({ ...p, commentsCount })));
  });

  const loadMore = () => {
    if (!loadingMore && hasMore) fetchPosts(page + 1, true);
  };

  const now = new Date();
  const date = now.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" });
  const firstName = (user?.profile?.name || user?.username || "player").trim().split(/\s+/)[0];

  return (
    <Page>
      <PageHeader
        eyebrow={`${date} / Overview`}
        title={`${greetingFor(now.getHours())}, ${firstName}`}
        description="Your squad at a glance — new posts, who's live, and shortcuts to everything else."
        actions={
          <Button as={Link} to="/profile/me" variant="outline" size="sm">
            @{user?.username}
          </Button>
        }
      />

      <DeviceAlertsBanner />

      <section aria-label="Stats" className="grid grid-cols-2 border-t border-l border-border lg:grid-cols-4">
        <StatTile
          index="01"
          icon={Users}
          label="Followers"
          value={followCounts.followers ?? user?.followers?.length ?? 0}
          tone="text-info"
        />
        <StatTile
          index="02"
          icon={UserPlus}
          label="Following"
          value={followCounts.following ?? user?.following?.length ?? 0}
          tone="text-primary"
        />
        <StatTile
          index="03"
          icon={FileText}
          label="Posts"
          value={(myPostIds ?? userPostIds).size}
          tone="text-warning"
        />
        <StatTile
          index="04"
          icon={Radio}
          label="Live now"
          value={streamsLoaded ? liveStreams.length : undefined}
          tone="text-destructive"
        />
      </section>

      <section>
        <h2 className="eyebrow mb-3 text-faint">Quick actions</h2>
        <div className="grid grid-cols-2 border-t border-l border-border lg:grid-cols-4">
          {QUICK_ACTIONS.map(({ label, to, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="group flex min-w-0 items-center gap-2.5 border-r border-b border-border bg-card/60 px-4 py-4 transition-colors hover:bg-accent sm:px-5"
            >
              <span className="text-primary" aria-hidden="true">
                &gt;
              </span>
              <span className="min-w-0 flex-1 text-[11px] font-bold tracking-[0.12em] text-foreground uppercase">
                {label}
              </span>
              <Icon
                className="hidden size-4 shrink-0 text-faint transition-colors group-hover:text-primary sm:block"
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_21rem]">
        <Card>
          <CardBar
            title="Recent posts"
            right={
              <Link to="/post" className="eyebrow text-muted-foreground transition-colors hover:text-primary">
                Open feed &gt;
              </Link>
            }
          />
          {loading ? (
            <LoadingBlock label="Loading posts" />
          ) : posts.length === 0 ? (
            <EmptyState
              icon={Newspaper}
              title="No posts yet"
              description="Be the first to share a clip or screenshot with the community."
              action={
                <Button as={Link} to="/post" icon={PenSquare}>
                  Create a post
                </Button>
              }
            />
          ) : (
            <>
              <ul className="divide-y divide-border">
                {posts.map((post) => {
                  const author = post.author ?? {};
                  const name = author.profile?.name || author.username || "Unknown";
                  const hasImage = post.media?.type === "image" && post.media?.url;
                  return (
                    <li key={post._id}>
                      <Link to="/post" className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-accent">
                        <Avatar src={author.profile?.profileImage} name={name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="flex min-w-0 items-baseline gap-2">
                            <span className="truncate text-xs font-bold text-foreground">{name}</span>
                            {author.username && (
                              <span className="hidden truncate text-[11px] text-faint sm:inline">@{author.username}</span>
                            )}
                            <span className="ml-auto shrink-0 text-[11px] text-faint">{timeAgo(post.createdAt)}</span>
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed break-words text-muted-foreground">
                            {post.content}
                          </p>
                          <p className="mt-2 flex items-center gap-4 text-[10px] text-faint tabular-nums">
                            <span className="flex items-center gap-1">
                              <Heart className="size-3" aria-hidden="true" /> {post.likesCount ?? post.likes?.length ?? 0}
                              <span className="sr-only">likes</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="size-3" aria-hidden="true" />{" "}
                              {post.commentsCount ?? post.comments?.length ?? 0}
                              <span className="sr-only">comments</span>
                            </span>
                            {post.media?.type === "video" && <Badge variant="secondary">Video</Badge>}
                          </p>
                        </div>
                        {hasImage && (
                          <img
                            src={mediaUrl(post.media.url)}
                            alt=""
                            loading="lazy"
                            className="size-12 shrink-0 border border-border object-cover sm:size-14"
                          />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {hasMore && (
                <div className="border-t border-border p-2">
                  <Button variant="ghost" size="sm" fullWidth loading={loadingMore} onClick={loadMore}>
                    Load more
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardBar
              title={
                <span className="flex items-center gap-2">
                  <StatusDot tone="danger" pulse={liveStreams.length > 0} /> Live now
                </span>
              }
              right={
                <IconButton
                  icon={RefreshCw}
                  label="Refresh live streams"
                  size="sm"
                  onClick={fetchLiveStreams}
                  disabled={streamLoading}
                  className={streamLoading ? "[&_svg]:animate-spin" : undefined}
                />
              }
            />
            {!streamsLoaded ? (
              <LoadingBlock label="Scanning streams" className="py-12" />
            ) : liveStreams.length === 0 ? (
              <EmptyState
                icon={Radio}
                title="No one is live"
                description="Start a stream and your followers get pinged."
                action={
                  <Button as={Link} to="/streams" size="sm" icon={Video}>
                    Go live
                  </Button>
                }
                className="py-10"
              />
            ) : (
              <ul className="divide-y divide-border">
                {liveStreams.slice(0, 8).map((stream) => {
                  const hostName = stream.host?.profile?.name || stream.host?.username || "Host";
                  const fresh = freshIds.has(String(stream._id));
                  return (
                    <li
                      key={stream._id}
                      className={
                        fresh ? "animate-slide-up bg-primary/[0.04] shadow-[inset_2px_0_0_var(--primary)]" : undefined
                      }
                    >
                      <Link
                        to={`/stream/${stream._id}`}
                        className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent"
                      >
                        <Avatar src={stream.host?.profile?.profileImage} name={hostName} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-xs font-bold text-foreground">{stream.title}</span>
                            {fresh && <Badge>New</Badge>}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-faint">{hostName}</p>
                        </div>
                        <div className="shrink-0 text-right text-[10px] text-faint tabular-nums">
                          <p className="flex items-center justify-end gap-1">
                            <Users className="size-3" aria-hidden="true" />
                            {viewerCountOf(stream)}
                            <span className="sr-only">watching</span>
                          </p>
                          <p className="mt-0.5 flex items-center justify-end gap-1">
                            <Clock className="size-3" aria-hidden="true" />
                            {formatDuration(stream.startedAt)}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            {liveStreams.length > 8 && (
              <div className="border-t border-border px-5 py-2.5 text-right">
                <Link to="/streams" className="eyebrow text-muted-foreground hover:text-primary">
                  All {liveStreams.length} streams &gt;
                </Link>
              </div>
            )}
          </Card>

          <Alert
            variant={isConnected ? "success" : "warning"}
            title={isConnected ? "Link online" : "Link reconnecting"}
            role="status"
          >
            {isConnected
              ? "Realtime chat, notifications and stream updates are flowing."
              : "Live updates are paused while the connection is restored."}
          </Alert>
        </div>
      </div>
    </Page>
  );
}

export default Home;
