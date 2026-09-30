import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  BarChart3,
  Clock,
  Eye,
  LayoutGrid,
  List,
  Radio,
  Search,
  Square,
  Users,
  Video,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import CreateStreamModal from "./CreateStreamModal";
import StreamAnalytics from "./StreamAnalytics";
import StreamCard from "./StreamCard";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  LoadingBlock,
  Modal,
  Page,
  PageHeader,
  StatTile,
  StatusDot,
  Tabs,
} from "../../components/ui";
import { API_URL as backendUrl } from "../../lib/config";
import { cn } from "../../lib/cn";
import { toast } from "../../lib/toast";
import { useSocketEvent } from "../../lib/useSocketEvent";

const idOf = (v) => (v && typeof v === "object" ? v._id : v);
const sameId = (a, b) => a != null && b != null && String(a) === String(b);

// Socket events keep the lists current; this is only a safety net for missed events.
const SAFETY_REFRESH_MS = 2 * 60 * 1000;
// How long a stream that just went live stays highlighted.
const FRESH_MS = 6000;

/** Live count from `stream:viewers` when we have one, else the REST viewers list. */
const viewerCountOf = (stream) =>
  typeof stream?.viewerCount === "number" ? stream.viewerCount : stream?.viewers?.length || 0;

/** REST lists don't carry the live SFU viewer count — keep the one the socket gave us. */
const keepViewerCounts = (prev, next) => {
  const counts = new Map(
    prev.filter((s) => typeof s.viewerCount === "number").map((s) => [String(s._id), s.viewerCount]),
  );
  if (!counts.size) return next;
  return next.map((s) =>
    s.isLive && counts.has(String(s._id)) ? { ...s, viewerCount: counts.get(String(s._id)) } : s,
  );
};

/** Apply `fn` to the stream with `id`; returns the same array when it isn't there (no re-render). */
const patchStream = (list, id, fn) =>
  list.some((s) => sameId(s._id, id)) ? list.map((s) => (sameId(s._id, id) ? fn(s) : s)) : list;

/** Ended: no longer live, and its live viewer count no longer applies. */
const markEnded = (endedAt) => (s) => {
  const next = { ...s, isLive: false, endedAt: endedAt || s.endedAt || new Date().toISOString() };
  delete next.viewerCount;
  return next;
};

const formatDuration = (startedAt, endedAt) => {
  if (!startedAt) return "0m";
  const start = new Date(startedAt);
  const end = endedAt ? new Date(endedAt) : new Date();
  const duration = Math.max(0, Math.floor((end - start) / 1000 / 60));
  if (duration < 60) return `${duration}m`;
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  return `${hours}h ${minutes}m`;
};

const StreamsList = () => {
  const [streams, setStreams] = useState([]);
  const [myStreams, setMyStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [selectedStreamId, setSelectedStreamId] = useState(null);
  const [activeTab, setActiveTab] = useState("live"); // 'live', 'my-streams'
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // 'grid', 'list'
  const [endTarget, setEndTarget] = useState(null); // stream pending "end" confirmation
  const [ending, setEnding] = useState(false);
  const [freshIds, setFreshIds] = useState(() => new Set()); // streams that just went live
  const freshTimers = useRef(new Map());

  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // GET /api/stream/live → array of live streams (host populated)
  const fetchLiveStreams = useCallback(async () => {
    try {
      const response = await axios.get(`${backendUrl}/api/stream/live`);
      const list = Array.isArray(response.data) ? response.data : [];
      setStreams((prev) => keepViewerCounts(prev, list));
    } catch (err) {
      console.error("Error fetching live streams:", err);
      setError("Failed to load live streams");
    }
  }, []);

  // GET /api/stream/user/my-streams → array of the user's streams, newest first
  const fetchMyStreams = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const response = await axios.get(`${backendUrl}/api/stream/user/my-streams`);
      const list = Array.isArray(response.data) ? response.data : [];
      setMyStreams((prev) => keepViewerCounts(prev, list));
    } catch (err) {
      console.error("Error fetching my streams:", err);
      setError("Failed to load your streams");
    }
  }, [isAuthenticated]);

  // Initial load — both lists, so the tab counts are accurate
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([fetchLiveStreams(), fetchMyStreams()]);
      } catch {
        setError("Failed to load streams");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [fetchLiveStreams, fetchMyStreams]);

  // Slow safety refetch — socket events below do the real-time work
  useEffect(() => {
    const interval = setInterval(fetchLiveStreams, SAFETY_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchLiveStreams]);

  useEffect(() => {
    const timers = freshTimers.current;
    return () => timers.forEach(clearTimeout);
  }, []);

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

  // Realtime: a stream went live → prepend it (deduped) and highlight it briefly.
  // Also refetch both lists after a socket reconnect, in case events were missed.
  useSocketEvent(
    "stream:started",
    ({ stream } = {}) => {
      if (!stream?._id) return;
      const live = { ...stream, isLive: true };
      const prepend = (prev) => (prev.some((s) => sameId(s._id, live._id)) ? prev : [live, ...prev]);
      setStreams(prepend);
      if (isOwn(live)) setMyStreams(prepend);
      markFresh(live._id);
    },
    {
      onReconnect: () => {
        fetchLiveStreams();
        fetchMyStreams();
      },
    },
  );

  // Realtime: a stream ended → drop it from "Live now", mark it ended in "My streams"
  useSocketEvent("stream:ended", ({ streamId, endedAt } = {}) => {
    if (!streamId) return;
    setStreams((prev) =>
      prev.some((s) => sameId(s._id, streamId)) ? prev.filter((s) => !sameId(s._id, streamId)) : prev,
    );
    setMyStreams((prev) => patchStream(prev, streamId, markEnded(endedAt)));
    // Ended elsewhere (another tab) → the "End stream?" prompt is moot
    setEndTarget((t) => (t && sameId(t._id, streamId) ? null : t));
  });

  // Realtime: live viewer count from the SFU
  useSocketEvent("stream:viewers", ({ streamId, count } = {}) => {
    if (!streamId || typeof count !== "number") return;
    const setCount = (s) => (s.viewerCount === count ? s : { ...s, viewerCount: count });
    setStreams((prev) => patchStream(prev, streamId, setCount));
    setMyStreams((prev) => patchStream(prev, streamId, setCount));
  });

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setError(null);
    if (tab === "live") fetchLiveStreams();
    else fetchMyStreams();
  };

  const handleStreamCreated = (newStream) => {
    // `stream:started` may already have added it (with the host populated)
    setMyStreams((prev) => (prev.some((s) => sameId(s._id, newStream._id)) ? prev : [newStream, ...prev]));
    setShowCreateModal(false);
    navigate(`/stream/${newStream._id}`);
  };

  const handleViewStream = (stream) => {
    navigate(`/stream/${stream._id}`);
  };

  const handleShowAnalytics = (streamId) => {
    setSelectedStreamId(streamId);
    setShowAnalytics(true);
  };

  const requestEndStream = (streamId) => {
    const target = [...myStreams, ...streams].find((s) => s._id === streamId) || { _id: streamId };
    setEndTarget(target);
  };

  const handleEndStream = async (streamId) => {
    setEnding(true);
    try {
      await axios.put(`${backendUrl}/api/stream/${streamId}/end`, {});
      toast.success("Stream ended");
      setEndTarget(null);
      await Promise.all([fetchMyStreams(), fetchLiveStreams()]);
    } catch (err) {
      console.error("Error ending stream:", err);
      toast.error(err.response?.data?.message || "Failed to end stream");
    } finally {
      setEnding(false);
    }
  };

  const isOwn = (stream) => Boolean(user?._id) && String(idOf(stream.host)) === String(user._id);

  const term = searchTerm.trim().toLowerCase();
  const filteredStreams = (activeTab === "live" ? streams : myStreams).filter(
    (stream) =>
      !term ||
      stream.title?.toLowerCase().includes(term) ||
      stream.host?.username?.toLowerCase().includes(term),
  );

  const renderStreamRow = (stream, index) => {
    const own = isOwn(stream);
    return (
      <li
        key={stream._id}
        className={cn(
          "flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-accent sm:flex-nowrap sm:px-5",
          freshIds.has(String(stream._id)) &&
            "animate-slide-up bg-primary/[0.04] shadow-[inset_2px_0_0_var(--primary)]",
        )}
      >
        <span className="hidden w-6 text-[10px] text-faint tabular-nums sm:block">
          {String(index + 1).padStart(2, "0")}
        </span>
        <button
          type="button"
          onClick={() => handleViewStream(stream)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <Avatar src={stream.host?.profile?.profileImage} name={stream.host?.profile?.name || stream.host?.username} size="sm" />
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              {stream.isLive && <StatusDot tone="danger" pulse />}
              <span className="truncate text-xs font-bold tracking-[0.1em] text-foreground uppercase">
                {stream.title}
              </span>
            </span>
            <span className="block truncate text-[11px] text-faint">
              @{stream.host?.username}
              {stream.description ? ` · ${stream.description}` : ""}
            </span>
          </span>
        </button>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" icon={Users} className="tabular-nums">
            {viewerCountOf(stream)}
            <span className="sr-only"> watching</span>
          </Badge>
          <Badge variant="secondary" icon={Clock} className="tabular-nums">
            {formatDuration(stream.startedAt, stream.endedAt)}
          </Badge>
          {stream.isLive ? <Badge variant="destructive">Live</Badge> : <Badge variant="secondary">Ended</Badge>}
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" icon={Eye} onClick={() => handleViewStream(stream)}>
            Watch
          </Button>
          {own && (
            <IconButton icon={BarChart3} label="Analytics" size="sm" onClick={() => handleShowAnalytics(stream._id)} />
          )}
          {own && stream.isLive && (
            <IconButton
              icon={Square}
              label="End stream"
              size="sm"
              variant="destructive"
              onClick={() => requestEndStream(stream._id)}
            />
          )}
        </div>
      </li>
    );
  };

  if (!isAuthenticated && activeTab === "my-streams") {
    return (
      <Page wide>
        <Card>
          <EmptyState
            icon={Video}
            title="Authentication required"
            description="Please log in to manage your streams."
          />
        </Card>
      </Page>
    );
  }

  const liveMine = myStreams.filter((s) => s.isLive).length;
  const totalViewers = myStreams.filter((s) => s.isLive).reduce((acc, s) => acc + viewerCountOf(s), 0);

  return (
    <Page wide>
      <PageHeader
        eyebrow="Broadcast / Live"
        title="Live streams"
        description={
          activeTab === "live"
            ? "Discover live content from creators in the community."
            : "Manage your broadcasts and check how they performed."
        }
        actions={
          isAuthenticated && (
            <Button variant="solid" icon={Radio} onClick={() => setShowCreateModal(true)}>
              Go live
            </Button>
          )
        }
      />

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            options={[
              { value: "live", label: "Live now", icon: Radio, count: streams.length },
              ...(isAuthenticated
                ? [{ value: "my-streams", label: "My streams", icon: BarChart3, count: myStreams.length }]
                : []),
            ]}
          />
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Input
              type="search"
              icon={Search}
              placeholder="Search streams or creators…"
              aria-label="Search streams or creators"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="min-w-0 flex-1 sm:w-72 sm:flex-none"
            />
            <IconButton
              icon={LayoutGrid}
              label="Grid view"
              active={viewMode === "grid"}
              onClick={() => setViewMode("grid")}
            />
            <IconButton
              icon={List}
              label="List view"
              active={viewMode === "list"}
              onClick={() => setViewMode("list")}
            />
          </div>
        </div>

        {error && <Alert variant="destructive">{error}</Alert>}
      </section>

      <section aria-label={activeTab === "live" ? "Live streams" : "My streams"}>
        {loading ? (
          <LoadingBlock label="Loading streams" />
        ) : filteredStreams.length === 0 ? (
          <Card>
            <EmptyState
              icon={term ? Search : Video}
              title={term ? "No streams found" : activeTab === "live" ? "No live streams" : "No streams yet"}
              description={
                term
                  ? "Try adjusting your search terms."
                  : activeTab === "live"
                    ? "Nobody is broadcasting right now. Check back later — or be the first."
                    : "Create your first stream to get started."
              }
              action={
                !term &&
                isAuthenticated && (
                  <Button variant="solid" icon={Radio} onClick={() => setShowCreateModal(true)}>
                    {activeTab === "live" ? "Go live" : "Create your first stream"}
                  </Button>
                )
              }
            />
          </Card>
        ) : viewMode === "grid" ? (
          <div className="grid border-t border-l border-border sm:grid-cols-2 xl:grid-cols-3">
            {filteredStreams.map((stream) => {
              const own = isOwn(stream);
              return (
                <StreamCard
                  key={stream._id}
                  stream={stream}
                  onClick={handleViewStream}
                  showAnalytics={own}
                  showEndButton={own}
                  onShowAnalytics={handleShowAnalytics}
                  onEndStream={requestEndStream}
                  fresh={freshIds.has(String(stream._id))}
                />
              );
            })}
          </div>
        ) : (
          <Card>
            <ul className="divide-y divide-border">{filteredStreams.map(renderStreamRow)}</ul>
          </Card>
        )}
      </section>

      {activeTab === "my-streams" && myStreams.length > 0 && (
        <section>
          <h2 className="eyebrow mb-3 text-faint">Stream statistics</h2>
          <div className="grid grid-cols-2 border-t border-l border-border lg:grid-cols-3">
            <StatTile index="01" icon={Video} label="Total streams" value={myStreams.length} />
            <StatTile index="02" icon={Radio} label="Live now" value={liveMine} tone="text-destructive" />
            <StatTile
              index="03"
              icon={Users}
              label="Current viewers"
              value={totalViewers}
              tone="text-info"
              className="col-span-2 lg:col-span-1"
            />
          </div>
        </section>
      )}

      <CreateStreamModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onStreamCreated={handleStreamCreated}
      />

      <StreamAnalytics
        streamId={selectedStreamId}
        isOpen={showAnalytics}
        onClose={() => setShowAnalytics(false)}
      />

      <Modal
        open={Boolean(endTarget)}
        onClose={() => !ending && setEndTarget(null)}
        size="sm"
        title="End stream?"
        description="Viewers will be disconnected and chat will close. This can't be undone."
        footer={
          <>
            <Button variant="outline" onClick={() => setEndTarget(null)} disabled={ending}>
              Keep streaming
            </Button>
            <Button
              variant="destructive"
              icon={Square}
              loading={ending}
              onClick={() => endTarget && handleEndStream(endTarget._id)}
            >
              End stream
            </Button>
          </>
        }
      >
        <p className="text-xs text-muted-foreground">
          <span className="text-primary">&gt;</span>{" "}
          <span className="font-bold text-foreground uppercase">{endTarget?.title || "This stream"}</span>
        </p>
      </Modal>
    </Page>
  );
};

export default StreamsList;
