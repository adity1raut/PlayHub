import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, FileText, Grid3x3, Heart, List, MessageSquare, SquarePen, RefreshCw, UserRound } from "lucide-react";
import Post from "./PostCard";
import { useAuth } from "../../context/AuthContext";
import { API_URL } from "../../lib/config";
import { cn } from "../../lib/cn";
import { toast } from "../../lib/toast";
import { useSocketEvent } from "../../lib/useSocketEvent";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  IconButton,
  LoadingBlock,
  Page,
  PageHeader,
  StatTile,
} from "../../components/ui";

const PAGE_SIZE = 12;

const idOf = (v) => String(v?._id ?? v ?? "");
const hasPost = (list, id) => list.some((p) => idOf(p) === String(id));
/** Apply `fn` to the post with `id`; returns the same array when it isn't there (no re-render). */
const patchPost = (list, id, fn) =>
  hasPost(list, id) ? list.map((p) => (idOf(p) === String(id) ? fn(p) : p)) : list;
const likesOf = (p) => (typeof p.likesCount === "number" ? p.likesCount : p.likes?.length || 0);
const commentsOf = (p) => (typeof p.commentsCount === "number" ? p.commentsCount : p.comments?.length || 0);

const MyPosts = () => {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [viewMode, setViewMode] = useState("grid"); // 'grid' or 'list'
  const navigate = useNavigate();

  // GET /api/posts/user/:username?page=&limit= → { success, posts, currentPage, hasMore }
  // `silent`: reload in the background (keep the list on screen, no error banner), e.g. after a reconnect
  const fetchMyPosts = async (pageNum = 1, append = false, { silent = false } = {}) => {
    if (!isAuthenticated || !user?.username) return false;

    if (append) setLoadingMore(true);
    else if (!silent) setLoading(true);
    if (!silent) setError("");
    try {
      const res = await axios.get(`${API_URL}/api/posts/user/${encodeURIComponent(user.username)}`, {
        params: { page: pageNum, limit: PAGE_SIZE },
        withCredentials: true,
      });
      if (res.data.success) {
        const incoming = res.data.posts || res.data.data || [];
        setPosts((prev) => {
          if (!append) return incoming;
          const seen = new Set(prev.map((p) => p._id));
          return [...prev, ...incoming.filter((p) => !seen.has(p._id))];
        });
        setHasMore(Boolean(res.data.hasMore));
        setPage(res.data.currentPage || pageNum);
        setError("");
        return true;
      }
      if (!silent) setError(res.data.message || "Failed to fetch your posts");
      return false;
    } catch (err) {
      console.error("Error fetching posts:", err);
      const message = err.response?.data?.message || "Failed to fetch your posts";
      if (append) toast.error(message);
      else if (!silent) setError(message);
      return false;
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated && user?.username) {
      fetchMyPosts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading, user?.username]);

  const handleDeletePost = (postId) => {
    setPosts((prev) => prev.filter((post) => post._id !== postId));
  };

  const handleUpdatePost = (updated) => {
    setPosts((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
  };

  // Realtime: your new posts (from any tab) are prepended; deletions drop out; the
  // like / comment totals follow the live counts (each card updates itself).
  useSocketEvent(
    "post:created",
    ({ post } = {}) => {
      if (!post?._id || !user || idOf(post.author) !== String(user._id)) return;
      setPosts((prev) => (hasPost(prev, post._id) ? prev : [post, ...prev]));
    },
    { onReconnect: () => fetchMyPosts(1, false, { silent: true }) },
  );

  useSocketEvent("post:deleted", ({ postId } = {}) => {
    if (!postId) return;
    setPosts((prev) => (hasPost(prev, postId) ? prev.filter((p) => idOf(p) !== String(postId)) : prev));
  });

  useSocketEvent("post:likes", ({ postId, likesCount, userId, liked } = {}) => {
    if (typeof likesCount !== "number") return;
    setPosts((prev) =>
      patchPost(prev, postId, (p) => {
        const others = (p.likes || []).filter((l) => idOf(l) !== String(userId));
        return { ...p, likesCount, likes: userId ? (liked ? [...others, userId] : others) : p.likes };
      }),
    );
  });

  useSocketEvent("post:comment", ({ postId, comment, commentsCount } = {}) => {
    setPosts((prev) =>
      patchPost(prev, postId, (p) => {
        const list = p.comments || [];
        const known = comment?._id && list.some((c) => idOf(c) === String(comment._id));
        return {
          ...p,
          comments: comment && !known ? [...list, comment] : list,
          commentsCount: typeof commentsCount === "number" ? commentsCount : p.commentsCount,
        };
      }),
    );
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    const ok = await fetchMyPosts(1, false);
    if (ok) toast.success("Posts refreshed");
    setRefreshing(false);
  };

  if (!authLoading && !isAuthenticated) {
    return (
      <Page>
        <Card className="mx-auto max-w-md">
          <EmptyState
            icon={UserRound}
            title="Authentication required"
            description="You must be logged in to view your posts."
            action={
              <Button variant="solid" onClick={() => navigate("/login")}>
                Login
              </Button>
            }
          />
        </Card>
      </Page>
    );
  }

  const totalLikes = posts.reduce((sum, p) => sum + likesOf(p), 0);
  const totalComments = posts.reduce((sum, p) => sum + commentsOf(p), 0);
  const postsTotal = hasMore ? Math.max(user?.posts?.length || 0, posts.length) : posts.length;
  const isBusy = authLoading || loading;

  return (
    <Page wide>
      <PageHeader
        eyebrow="Community / My posts"
        title="My posts"
        description={`Manage everything you've shared as @${user?.username ?? "you"}.`}
        actions={
          <>
            <Button as={Link} to="/post" variant="outline" icon={ArrowLeft}>
              Back to feed
            </Button>
            <Button icon={RefreshCw} onClick={handleRefresh} loading={refreshing} disabled={isBusy}>
              {refreshing ? "Refreshing" : "Refresh"}
            </Button>
          </>
        }
      />

      <section aria-label="Post stats" className="grid grid-cols-3 border-t border-l border-border">
        <StatTile index="01" icon={FileText} label="Posts" value={isBusy ? null : postsTotal} />
        <StatTile index="02" icon={Heart} label="Likes" value={isBusy ? null : totalLikes} tone="text-destructive" />
        <StatTile
          index="03"
          icon={MessageSquare}
          label="Comments"
          value={isBusy ? null : totalComments}
          tone="text-info"
        />
      </section>

      <section aria-label="Your posts" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="eyebrow flex items-center gap-2 text-faint">
            <span className="text-primary">&gt;</span> {viewMode === "grid" ? "Grid view" : "List view"}
          </h2>
          <div role="group" aria-label="View mode" className="flex items-center gap-1">
            <IconButton
              icon={Grid3x3}
              label="Grid view"
              size="sm"
              active={viewMode === "grid"}
              aria-pressed={viewMode === "grid"}
              onClick={() => setViewMode("grid")}
            />
            <IconButton
              icon={List}
              label="List view"
              size="sm"
              active={viewMode === "list"}
              aria-pressed={viewMode === "list"}
              onClick={() => setViewMode("list")}
            />
          </div>
        </div>

        {error && (
          <Alert variant="destructive" title="Couldn't load your posts">
            <p>{error}</p>
            <Button variant="outline" size="sm" icon={RefreshCw} className="mt-3" onClick={handleRefresh}>
              Try again
            </Button>
          </Alert>
        )}

        {isBusy ? (
          <LoadingBlock label="Loading your posts" />
        ) : posts.length > 0 ? (
          <>
            <div
              className={cn(
                viewMode === "grid"
                  ? "grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3"
                  : "mx-auto max-w-2xl space-y-4",
              )}
            >
              {posts.map((post) => (
                <Post key={post._id} post={post} onDelete={handleDeletePost} onUpdate={handleUpdatePost} />
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button variant="outline" loading={loadingMore} onClick={() => fetchMyPosts(page + 1, true)}>
                  {loadingMore ? "Loading more posts" : "Load more"}
                </Button>
              </div>
            )}
          </>
        ) : (
          !error && (
            <Card>
              <EmptyState
                icon={FileText}
                title="No posts yet"
                description="You haven't created any posts yet. Start sharing your thoughts!"
                action={
                  <Button as={Link} to="/post" variant="solid" icon={SquarePen}>
                    Create your first post
                  </Button>
                }
              />
            </Card>
          )
        )}
      </section>
    </Page>
  );
};

export default MyPosts;
