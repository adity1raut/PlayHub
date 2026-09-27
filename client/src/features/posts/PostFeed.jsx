import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  ArrowUp,
  FileText,
  Heart,
  MessagesSquare,
  RefreshCw,
  ShoppingCart,
  Store,
  Warehouse,
} from "lucide-react";
import CreatePost from "./CreatePost";
import Post from "./PostCard";
import { useAuth } from "../../context/AuthContext";
import { API_URL } from "../../lib/config";
import { toast } from "../../lib/toast";
import { useSocketEvent } from "../../lib/useSocketEvent";
import { Alert, Button, Card, CardBar, EmptyState, LoadingBlock, Page, PageHeader } from "../../components/ui";

const PAGE_SIZE = 10;

const idOf = (v) => String(v?._id ?? v ?? "");
const hasPost = (list, id) => list.some((p) => idOf(p) === String(id));
/** Prepend the `incoming` posts (newest first) that aren't in `list` yet. */
const prependNew = (list, incoming) => {
  const seen = new Set(list.map(idOf));
  const fresh = [];
  for (const p of incoming) {
    if (p?._id && !seen.has(idOf(p))) {
      seen.add(idOf(p));
      fresh.push(p);
    }
  }
  return fresh.length ? [...fresh, ...list] : list;
};
const withoutPost = (list, id) => (hasPost(list, id) ? list.filter((p) => idOf(p) !== String(id)) : list);

const Feed = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Other people's posts that arrived live — shown behind the "N new posts" pill
  const [pendingPosts, setPendingPosts] = useState([]);
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const sentinelRef = useRef(null);
  const scrolledToHash = useRef(false);
  const topRef = useRef(null);

  // GET /api/posts/feed?page=&limit= → { success, posts, currentPage, hasMore }
  const fetchPosts = async (pageNum = 1, append = false) => {
    try {
      if (pageNum > 1) setLoadingMore(true);

      const res = await axios.get(`${API_URL}/api/posts/feed`, {
        params: { page: pageNum, limit: PAGE_SIZE },
        withCredentials: true,
      });

      if (res.data.success) {
        const incoming = res.data.posts || [];
        if (append) {
          // Skip duplicates in case new posts shifted the page window
          setPosts((prev) => {
            const seen = new Set(prev.map((p) => p._id));
            return [...prev, ...incoming.filter((p) => !seen.has(p._id))];
          });
        } else {
          setPosts(incoming);
          // A full reload already includes anything that was waiting behind the pill
          setPendingPosts((prev) => (prev.length ? prev.filter((p) => !hasPost(incoming, p._id)) : prev));
        }
        setHasMore(Boolean(res.data.hasMore));
        setPage(res.data.currentPage || pageNum);
        setError("");
      }
      return true;
    } catch (err) {
      console.error("Error fetching posts:", err);
      const message = err.response?.data?.message || "Failed to fetch posts";
      if (pageNum === 1) setError(message);
      else toast.error(message);
      return false;
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPosts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  // Shared links point at /post#post-<id>: scroll to it once it has rendered
  useEffect(() => {
    if (scrolledToHash.current || !location.hash.startsWith("#post-") || !posts.length) return;
    const el = document.getElementById(location.hash.slice(1));
    if (el) {
      scrolledToHash.current = true;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [posts, location.hash]);

  const handleNewPost = (newPost) => {
    // The `post:created` broadcast may already have added it — dedupe by _id
    if (newPost) setPosts((prev) => prependNew(prev, [newPost]));
  };

  const handleDeletePost = (postId) => {
    setPosts((prev) => prev.filter((post) => post._id !== postId));
  };

  // Realtime: your own posts (e.g. from another tab) go straight in; everyone else's wait
  // behind the "N new posts" pill so the feed doesn't jump while you're reading.
  useSocketEvent("post:created", ({ post } = {}) => {
    if (!post?._id) return;
    if (user && idOf(post.author) === String(user._id)) {
      setPosts((prev) => prependNew(prev, [post]));
      setPendingPosts((prev) => withoutPost(prev, post._id));
      return;
    }
    setPendingPosts((prev) => (hasPost(prev, post._id) || hasPost(posts, post._id) ? prev : [post, ...prev]));
  });

  useSocketEvent("post:deleted", ({ postId } = {}) => {
    if (!postId) return;
    setPosts((prev) => withoutPost(prev, postId));
    setPendingPosts((prev) => withoutPost(prev, postId));
  });

  // Cards keep their own like/comment state; posts still waiting behind the pill need patching
  useSocketEvent("post:likes", ({ postId, likesCount } = {}) => {
    if (typeof likesCount !== "number") return;
    setPendingPosts((prev) =>
      hasPost(prev, postId) ? prev.map((p) => (idOf(p) === String(postId) ? { ...p, likesCount } : p)) : prev,
    );
  });

  useSocketEvent("post:comment", ({ postId, comment, commentsCount } = {}) => {
    setPendingPosts((prev) =>
      hasPost(prev, postId)
        ? prev.map((p) => {
            if (idOf(p) !== String(postId)) return p;
            const list = p.comments || [];
            const known = comment?._id && list.some((c) => idOf(c) === String(comment._id));
            return {
              ...p,
              comments: comment && !known ? [...list, comment] : list,
              commentsCount: typeof commentsCount === "number" ? commentsCount : p.commentsCount,
            };
          })
        : prev,
    );
  });

  const showPendingPosts = () => {
    setPosts((prev) => prependNew(prev, pendingPosts));
    setPendingPosts([]);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchPosts(page + 1, true);
    }
  };

  // Infinite scroll: load the next page when the sentinel scrolls into view
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;
  const observe = useCallback((node) => {
    sentinelRef.current?.disconnect?.();
    if (!node || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadMoreRef.current(), {
      rootMargin: "400px 0px",
    });
    io.observe(node);
    sentinelRef.current = io;
  }, []);
  useEffect(() => () => sentinelRef.current?.disconnect?.(), []);

  const refreshFeed = async () => {
    setRefreshing(true);
    setPage(1);
    const ok = await fetchPosts(1, false);
    if (ok) toast.success("Feed refreshed");
    setRefreshing(false);
  };

  const requireAuth = (path, what) => {
    if (!isAuthenticated) {
      toast.error(`Please login to view your ${what}`);
      navigate("/login");
      return;
    }
    navigate(path);
  };

  const handleMyPostsClick = () => requireAuth("/myposts", "posts");
  const handleWishlistClick = () => requireAuth("/wishlist", "wishlist");
  const handleMyCartClick = () => requireAuth("/cart", "cart");
  const handleMyStoreClick = () => requireAuth("/my-store", "store");

  const quickActions = [
    { label: "My posts", icon: FileText, onClick: handleMyPostsClick },
    { label: "Wishlist", icon: Heart, onClick: handleWishlistClick },
    { label: "My cart", icon: ShoppingCart, onClick: handleMyCartClick },
    { label: "My store", icon: Warehouse, onClick: handleMyStoreClick },
    { label: "All stores", icon: Store, onClick: () => navigate("/stores") },
  ];

  return (
    <Page>
      <PageHeader
        eyebrow="Community / Feed"
        title="Feed"
        description="Share your thoughts, clips and screenshots with the Spawnpoint community."
        actions={
          <>
            <Button variant="outline" icon={FileText} onClick={handleMyPostsClick}>
              My posts
            </Button>
            <Button icon={RefreshCw} onClick={refreshFeed} loading={refreshing} disabled={loading}>
              {refreshing ? "Refreshing" : "Refresh"}
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="mx-auto w-full max-w-2xl min-w-0 space-y-6">
          <CreatePost onPostCreated={handleNewPost} />

          <section ref={topRef} aria-label="Latest posts" className="scroll-mt-6 space-y-4">
            <h2 className="eyebrow flex items-center gap-3 text-faint">
              <span className="text-primary">&gt;</span> Latest posts
              <span aria-hidden="true" className="h-px flex-1 border-t border-dashed border-border-strong" />
            </h2>

            {/* "N new posts" pill — zero-height sticky rail, so showing it never shifts the feed */}
            <div className="pointer-events-none sticky top-4 z-20 mb-0! flex h-0 justify-center" aria-live="polite">
              {pendingPosts.length > 0 && (
                <Button
                  variant="solid"
                  size="sm"
                  icon={ArrowUp}
                  onClick={showPendingPosts}
                  className="pointer-events-auto shadow-float animate-slide-up"
                >
                  {pendingPosts.length} new {pendingPosts.length === 1 ? "post" : "posts"}
                </Button>
              )}
            </div>

            {loading ? (
              <LoadingBlock label="Loading feed" />
            ) : error && posts.length === 0 ? (
              <Alert variant="destructive" title="Couldn't load the feed">
                <p>{error}</p>
                <Button variant="outline" size="sm" icon={RefreshCw} className="mt-3" onClick={refreshFeed}>
                  Try again
                </Button>
              </Alert>
            ) : posts.length === 0 ? (
              <Card>
                <EmptyState
                  icon={MessagesSquare}
                  title="No posts yet"
                  description="Be the first to share something — write your first post above."
                />
              </Card>
            ) : (
              <>
                {posts.map((post) => (
                  <Post key={post._id} post={post} onDelete={handleDeletePost} />
                ))}

                {hasMore ? (
                  <div ref={observe} className="flex justify-center pt-2">
                    <Button variant="outline" onClick={loadMore} loading={loadingMore}>
                      {loadingMore ? "Loading more posts" : "Load more"}
                    </Button>
                  </div>
                ) : (
                  <p className="eyebrow flex items-center gap-3 pt-2 text-faint">
                    <span aria-hidden="true" className="h-px flex-1 border-t border-dashed border-border-strong" />
                    End of feed
                    <span aria-hidden="true" className="h-px flex-1 border-t border-dashed border-border-strong" />
                  </p>
                )}
              </>
            )}
          </section>
        </div>

        <aside className="hidden lg:sticky lg:top-6 lg:block">
          <Card>
            <CardBar title="Quick actions" />
            <ul className="divide-y divide-border">
              {quickActions.map(({ label, icon: Icon, onClick }, i) => (
                <li key={label}>
                  <button
                    type="button"
                    onClick={onClick}
                    className="group flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-accent"
                  >
                    <span className="w-5 text-[10px] text-faint tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                    <Icon className="size-4 text-faint group-hover:text-primary" aria-hidden="true" />
                    <span className="flex-1 text-[11px] font-bold tracking-[0.12em] uppercase">
                      <span className="text-primary">&gt;</span> {label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </Page>
  );
};

export default Feed;
