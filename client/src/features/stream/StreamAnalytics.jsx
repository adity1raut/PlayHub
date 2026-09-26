import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Clock,
  Download,
  MessageSquare,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";
import axios from "axios";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBar,
  EmptyState,
  LoadingBlock,
  Modal,
  StatTile,
  StatusDot,
} from "../../components/ui";
import { API_URL as backendUrl } from "../../lib/config";
import { toast } from "../../lib/toast";

const BUCKETS = 12;

const StreamAnalytics = ({ streamId, isOpen, onClose }) => {
  const [analytics, setAnalytics] = useState(null);
  // Chat history (from GET /api/stream/:id → liveChat, newest 50) used for the activity chart.
  const [chatLog, setChatLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      // GET /:id/analytics → { stream: <title>, analytics: { totalViewers, totalMessages, duration, isLive, startedAt, endedAt } }
      const [analyticsRes, streamRes] = await Promise.allSettled([
        axios.get(`${backendUrl}/api/stream/${streamId}/analytics`),
        axios.get(`${backendUrl}/api/stream/${streamId}`),
      ]);

      if (analyticsRes.status === "rejected") throw analyticsRes.reason;
      if (analyticsRes.value.status === 200) {
        setAnalytics(analyticsRes.value.data);
      }
      setChatLog(
        streamRes.status === "fulfilled" && Array.isArray(streamRes.value.data?.liveChat)
          ? streamRes.value.data.liveChat
          : [],
      );
    } catch (err) {
      setError(
        err.response?.status === 403
          ? "Only the host can view analytics for this stream."
          : "Failed to load analytics data",
      );
      console.error("Error fetching analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && streamId) {
      fetchAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, streamId]);

  const formatDuration = (minutes = 0) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const formatDate = (dateString) => (dateString ? new Date(dateString).toLocaleString() : "—");

  const getEngagementRate = () => {
    if (!analytics) return 0;
    const { totalViewers, totalMessages } = analytics.analytics;
    if (totalViewers === 0) return 0;
    return ((totalMessages / totalViewers) * 100).toFixed(1);
  };

  const getPerformanceRating = () => {
    if (!analytics) return "N/A";
    const { totalViewers, duration } = analytics.analytics;
    if (totalViewers > 100 && duration > 60) return "Excellent";
    if (totalViewers > 50 && duration > 30) return "Good";
    if (totalViewers > 10 && duration > 15) return "Fair";
    return "Needs Improvement";
  };

  // Bucket chat messages across the broadcast window for the activity chart.
  const activity = useMemo(() => {
    const a = analytics?.analytics;
    if (!a?.startedAt) return null;
    const start = new Date(a.startedAt).getTime();
    const end = a.endedAt ? new Date(a.endedAt).getTime() : Date.now();
    const span = Math.max(end - start, 60 * 1000);
    const counts = Array(BUCKETS).fill(0);
    chatLog.forEach((m) => {
      const t = new Date(m.createdAt).getTime();
      if (Number.isNaN(t)) return;
      const idx = Math.min(BUCKETS - 1, Math.max(0, Math.floor(((t - start) / span) * BUCKETS)));
      counts[idx] += 1;
    });
    const bucketMinutes = span / BUCKETS / 60000;
    return {
      counts,
      max: Math.max(...counts, 1),
      label: (i) => {
        const from = Math.round(i * bucketMinutes);
        const to = Math.round((i + 1) * bucketMinutes);
        return `${from}–${to}m`;
      },
      sampled: chatLog.length,
    };
  }, [analytics, chatLog]);

  const handleExportCsv = () => {
    if (!analytics) return;
    const a = analytics.analytics;
    const rows = [
      ["metric", "value"],
      ["stream", analytics.stream],
      ["status", a.isLive ? "live" : "ended"],
      ["viewers", a.totalViewers],
      ["messages", a.totalMessages],
      ["duration_minutes", a.duration],
      ["engagement_rate_pct", getEngagementRate()],
      ["started_at", a.startedAt || ""],
      ["ended_at", a.endedAt || ""],
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `stream-${streamId}-analytics.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Analytics exported");
  };

  const a = analytics?.analytics;
  const engagement = getEngagementRate();
  const recommendations = a
    ? [
        a.totalViewers < 10 && "Try streaming at different times to reach more viewers",
        engagement < 5 && "Encourage more chat interaction to boost engagement",
        a.duration < 30 && "Consider longer streaming sessions for better discovery",
        a.totalMessages < 5 && "Ask questions to encourage viewer participation",
      ].filter(Boolean)
    : [];

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="2xl"
      title="Stream analytics"
      description={analytics ? `> ${analytics.stream}` : "Performance report for your broadcast"}
      footer={
        analytics && !loading && !error ? (
          <>
            <span className="mr-auto self-center text-[11px] text-faint">
              Generated {new Date().toLocaleString()}
            </span>
            <Button variant="outline" size="sm" icon={Download} onClick={handleExportCsv}>
              Export CSV
            </Button>
            <Button size="sm" icon={RefreshCw} onClick={fetchAnalytics}>
              Refresh data
            </Button>
          </>
        ) : null
      }
    >
      {loading ? (
        <LoadingBlock label="Loading analytics" />
      ) : error ? (
        <div className="space-y-4">
          <Alert variant="destructive">{error}</Alert>
          <Button variant="outline" size="sm" icon={RefreshCw} onClick={fetchAnalytics}>
            Try again
          </Button>
        </div>
      ) : a ? (
        <div className="space-y-6">
          {/* Key metrics */}
          <div className="grid grid-cols-2 border-t border-l border-border lg:grid-cols-4">
            <StatTile index="01" icon={Users} label="Viewers" value={a.totalViewers} tone="text-info" />
            <StatTile index="02" icon={MessageSquare} label="Messages" value={a.totalMessages} tone="text-success" />
            <StatTile index="03" icon={Clock} label="Duration" value={formatDuration(a.duration)} />
            <StatTile index="04" icon={TrendingUp} label="Engagement" value={`${engagement}%`} tone="text-warning" />
          </div>

          {/* Chat activity */}
          <Card>
            <CardBar
              title="Chat activity"
              right={<span className="text-[11px] text-faint">Messages per interval</span>}
            />
            <div className="px-5 pt-5 pb-4">
              {activity && activity.sampled > 0 ? (
                <>
                  <div
                    className="flex h-36 items-end gap-1 border-b border-border"
                    role="img"
                    aria-label={`Chat messages over the broadcast: ${activity.counts.join(", ")}`}
                  >
                    {activity.counts.map((c, i) => (
                      <div key={i} className="group/bar relative flex h-full flex-1 items-end">
                        <div
                          className="relative w-full bg-primary/70 transition-colors group-hover/bar:bg-primary"
                          style={{ height: `${(c / activity.max) * 100}%`, minHeight: c ? 2 : 0 }}
                        >
                          <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 border border-border-strong bg-popover px-1.5 py-0.5 text-[10px] whitespace-nowrap text-foreground tabular-nums opacity-0 shadow-float transition-opacity group-hover/bar:opacity-100">
                            {activity.label(i)} · {c}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between text-[10px] text-faint tabular-nums">
                    <span>Start</span>
                    <span>{a.isLive ? "Now" : "End"}</span>
                  </div>
                  {a.totalMessages > activity.sampled && (
                    <p className="mt-3 text-[11px] text-faint">
                      Based on the latest {activity.sampled} of {a.totalMessages} messages.
                    </p>
                  )}
                </>
              ) : (
                <EmptyState
                  icon={Activity}
                  title="No chat yet"
                  description="Activity appears here once viewers start chatting."
                  className="py-8"
                />
              )}
            </div>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Status */}
            <Card>
              <CardBar title="Stream status" />
              <dl className="divide-y divide-border text-xs">
                <div className="flex items-center justify-between gap-3 px-5 py-3">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>
                    {a.isLive ? (
                      <Badge variant="destructive">
                        <StatusDot tone="danger" pulse />
                        Live
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Ended</Badge>
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 px-5 py-3">
                  <dt className="text-muted-foreground">Started</dt>
                  <dd className="text-right tabular-nums">{formatDate(a.startedAt)}</dd>
                </div>
                {a.endedAt && (
                  <div className="flex items-center justify-between gap-3 px-5 py-3">
                    <dt className="text-muted-foreground">Ended</dt>
                    <dd className="text-right tabular-nums">{formatDate(a.endedAt)}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 px-5 py-3">
                  <dt className="text-muted-foreground">Performance</dt>
                  <dd className="font-bold text-primary">{getPerformanceRating()}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 px-5 py-3">
                  <dt className="text-muted-foreground">Avg. messages / viewer</dt>
                  <dd className="tabular-nums">
                    {a.totalViewers > 0 ? (a.totalMessages / a.totalViewers).toFixed(1) : "0"}
                  </dd>
                </div>
              </dl>
            </Card>

            {/* Insights */}
            <Card>
              <CardBar title="Insights" right={<BarChart3 className="size-4 text-faint" aria-hidden="true" />} />
              <div className="space-y-4 px-5 py-4 text-xs leading-relaxed text-muted-foreground">
                <p>
                  <span className="text-primary">&gt;</span> {a.totalMessages} chat messages,{" "}
                  {engagement}% engagement rate.
                </p>
                <p>
                  <span className="text-primary">&gt;</span> {a.totalViewers} viewers in the room over{" "}
                  {formatDuration(a.duration)}.
                </p>
                {recommendations.length > 0 && (
                  <div className="border-t border-dashed border-border pt-4">
                    <p className="eyebrow mb-2 text-faint">Recommendations</p>
                    <ul className="space-y-1.5">
                      {recommendations.map((r, i) => (
                        <li key={r} className="flex gap-2">
                          <span className="text-[10px] text-faint tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </Modal>
  );
};

export default StreamAnalytics;
