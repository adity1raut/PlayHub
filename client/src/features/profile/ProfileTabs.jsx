import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { ChevronRight, Grid3x3, Handshake, Heart, MessageSquare, Play, RefreshCw, UserPlus, Users } from "lucide-react";
import { API_URL as backendUrl, mediaUrl } from "../../lib/config";
import { useSocketEvent } from "../../lib/useSocketEvent";
import { Alert, Avatar, Button, Card, EmptyState, LoadingBlock, Modal, Tabs } from "../../components/ui";
import PostCard from "../posts/PostCard";
import { friendsCountOf } from "./friends";

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

/** Apply `fn` to the item with `id`; returns the same array when it isn't there (no re-render). */
const patchById = (list, id, fn) =>
  list.some((x) => sameId(x._id, id)) ? list.map((x) => (sameId(x._id, id) ? fn(x) : x)) : list;

/**
 * Fetch `${backendUrl}${path}` → res.data.data, with loading / error / retry.
 * Once a path has loaded, later refetches (deps changed, e.g. a live follower count)
 * run in the background: the current list stays on screen instead of a spinner.
 */
function useProfileList(path, deps) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);
  const loadedPath = useRef(null);

  useEffect(() => {
    let ignore = false;
    const silent = loadedPath.current === path;
    (async () => {
      if (!silent) {
        setLoading(true);
        setError("");
      }
      try {
        const res = await axios.get(`${backendUrl}${path}`, { withCredentials: true });
        if (ignore) return;
        if (res.data.success) {
          setItems(res.data.data || []);
          setError("");
          loadedPath.current = path;
        } else if (!silent) setError(res.data.message || "Request failed");
      } catch (err) {
        if (!ignore && !silent) setError(err.response?.data?.message || "Request failed");
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce, ...deps]);

  return { items, setItems, loading, error, retry: () => setNonce((n) => n + 1) };
}

function ListError({ title, error, onRetry }) {
  return (
    <Alert variant="destructive" title={title}>
      <p>{error}</p>
      <Button variant="outline" size="sm" icon={RefreshCw} className="mt-3" onClick={onRetry}>
        Try again
      </Button>
    </Alert>
  );
}

const shortDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

// GET /api/auth/profile/:username/posts → { success, data: posts }
function UserPostsList({ username, isOwnProfile, onPostDeleted }) {
  const { items: posts, setItems: setPosts, loading, error, retry } = useProfileList(
    `/api/auth/profile/${encodeURIComponent(username)}/posts`,
    [],
  );
  const [openId, setOpenId] = useState(null);
  const [openPost, setOpenPost] = useState(null);
  const [openLoading, setOpenLoading] = useState(false);
  const [openError, setOpenError] = useState("");

  // The list endpoint doesn't populate comment authors, so load the full post (GET /api/posts/:id)
  useEffect(() => {
    if (!openId) return undefined;
    let ignore = false;
    setOpenPost(null);
    setOpenError("");
    setOpenLoading(true);
    axios
      .get(`${backendUrl}/api/posts/${openId}`, { withCredentials: true })
      .then((res) => {
        if (ignore) return;
        if (res.data.success) setOpenPost(res.data.post);
        else setOpenError(res.data.message || "Failed to load post");
      })
      .catch((err) => !ignore && setOpenError(err.response?.data?.message || "Failed to load post"))
      .finally(() => !ignore && setOpenLoading(false));
    return () => {
      ignore = true;
    };
  }, [openId]);

  const closePost = () => setOpenId(null);

  const handleDeleted = (postId) => {
    setPosts((prev) => prev.filter((p) => p._id !== postId));
    onPostDeleted?.(postId);
    closePost();
  };

  const handleUpdated = (updated) =>
    setPosts((prev) =>
      patchById(prev, updated._id, (p) => ({
        ...p,
        likes: updated.likes,
        comments: updated.comments,
        likesCount: updated.likesCount ?? p.likesCount,
        commentsCount: updated.commentsCount ?? p.commentsCount,
      })),
    );

  // Realtime: new posts by this user, deletions, and live like / comment counts
  // (plus a background reload after a reconnect)
  useSocketEvent(
    "post:created",
    ({ post } = {}) => {
      if (!post?._id || post.author?.username !== username) return;
      setPosts((prev) => (prev.some((p) => sameId(p._id, post._id)) ? prev : [post, ...prev]));
    },
    { onReconnect: retry },
  );

  useSocketEvent("post:deleted", ({ postId } = {}) => {
    if (!postId) return;
    setPosts((prev) =>
      prev.some((p) => sameId(p._id, postId)) ? prev.filter((p) => !sameId(p._id, postId)) : prev,
    );
    if (sameId(openId, postId)) closePost();
  });

  useSocketEvent("post:likes", ({ postId, likesCount } = {}) => {
    if (postId && typeof likesCount === "number") {
      setPosts((prev) => patchById(prev, postId, (p) => ({ ...p, likesCount })));
    }
  });

  useSocketEvent("post:comment", ({ postId, commentsCount } = {}) => {
    if (postId && typeof commentsCount === "number") {
      setPosts((prev) => patchById(prev, postId, (p) => ({ ...p, commentsCount })));
    }
  });

  if (loading) return <LoadingBlock label="Loading posts" />;
  if (error) return <ListError title="Couldn't load posts" error={error} onRetry={retry} />;
  if (!posts.length)
    return (
      <Card>
        <EmptyState
          icon={Grid3x3}
          title="No posts yet"
          description={isOwnProfile ? "Share your first post from the feed." : `@${username} hasn't posted anything yet.`}
          action={
            isOwnProfile && (
              <Button as={Link} to="/post" variant="solid">
                Go to feed
              </Button>
            )
          }
        />
      </Card>
    );

  return (
    <>
      <ul className="grid grid-cols-2 border-t border-l border-border sm:grid-cols-3 lg:grid-cols-4">
        {posts.map((post, i) => {
          const type = post.media?.url ? post.media.type : "none";
          return (
            <li key={post._id} className="border-r border-b border-border">
              <button
                type="button"
                onClick={() => setOpenId(post._id)}
                aria-label={`Open post: ${post.content?.slice(0, 60) || "media post"}`}
                className="group relative flex aspect-square w-full flex-col overflow-hidden bg-card/60 text-left transition-colors hover:bg-accent focus-visible:outline-1 focus-visible:outline-ring"
              >
                {type === "image" ? (
                  <img
                    src={mediaUrl(post.media.url)}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 size-full object-cover transition-opacity group-hover:opacity-80"
                  />
                ) : type === "video" ? (
                  <>
                    <video
                      src={mediaUrl(post.media.url)}
                      muted
                      playsInline
                      preload="metadata"
                      className="absolute inset-0 size-full bg-background object-cover"
                    />
                    <span className="absolute top-2 right-2 flex size-7 items-center justify-center border border-border-strong bg-popover text-primary">
                      <Play className="size-3.5" aria-hidden="true" />
                    </span>
                  </>
                ) : (
                  <div className="flex-1 p-4 pb-10">
                    <p className="text-[10px] text-faint tabular-nums">{String(i + 1).padStart(2, "0")}</p>
                    <p className="mt-2 line-clamp-5 text-xs leading-relaxed break-words whitespace-pre-wrap text-foreground">
                      {post.content}
                    </p>
                  </div>
                )}

                <span className="absolute inset-x-0 bottom-0 flex items-center gap-3 border-t border-border bg-card/90 px-3 py-1.5 text-[10px] font-bold text-muted-foreground tabular-nums">
                  <span className="inline-flex items-center gap-1">
                    <Heart className="size-3" aria-hidden="true" /> {post.likesCount ?? post.likes?.length ?? 0}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="size-3" aria-hidden="true" />{" "}
                    {post.commentsCount ?? post.comments?.length ?? 0}
                  </span>
                  <span className="ml-auto hidden truncate font-normal text-faint sm:inline">
                    {shortDate(post.createdAt)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <Modal open={Boolean(openId)} onClose={closePost} title="Post" size="lg">
        {openLoading ? (
          <LoadingBlock label="Loading post" />
        ) : openError ? (
          <Alert variant="destructive">{openError}</Alert>
        ) : (
          openPost && <PostCard key={openPost._id} post={openPost} onDelete={handleDeleted} onUpdate={handleUpdated} />
        )}
      </Modal>
    </>
  );
}

const LIST_EMPTY = {
  friends: {
    icon: Handshake,
    title: "No friends yet",
    description: (username) => `Friends are players who follow each other. @${username} has none yet.`,
  },
  followers: { icon: Users, title: "No followers yet", description: (username) => `Nobody follows @${username} yet.` },
  following: {
    icon: UserPlus,
    title: "Not following anyone yet",
    description: (username) => `@${username} isn't following anyone yet.`,
  },
};

// GET /api/auth/profile/:username/(friends|followers|following) → { success, data: users }
function UserList({ username, kind, refreshKey }) {
  const { items: users, setItems: setUsers, loading, error, retry } = useProfileList(
    `/api/auth/profile/${encodeURIComponent(username)}/${kind}`,
    [refreshKey],
  );
  const noun = kind;
  const empty = LIST_EMPTY[kind];

  // Listed players' live name / avatar / bio edits (and a background reload after a reconnect)
  useSocketEvent(
    "user:updated",
    ({ userId, profile } = {}) => {
      if (profile) setUsers((prev) => patchById(prev, userId, (u) => ({ ...u, profile: { ...u.profile, ...profile } })));
    },
    { onReconnect: retry },
  );

  if (loading) return <LoadingBlock label={`Loading ${noun}`} />;
  if (error) return <ListError title={`Couldn't load ${noun}`} error={error} onRetry={retry} />;
  if (!users.length)
    return (
      <Card>
        <EmptyState icon={empty.icon} title={empty.title} description={empty.description(username)} />
      </Card>
    );

  return (
    <Card>
      <ul className="divide-y divide-border">
        {users.map((u, i) => {
          const name = u.profile?.name || u.username;
          return (
            <li key={u._id}>
              <Link
                to={`/profile/${u.username}`}
                className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent sm:px-5"
              >
                <span className="hidden w-5 text-[10px] text-faint tabular-nums sm:block">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Avatar src={u.profile?.profileImage} name={name} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-foreground group-hover:text-primary">
                    {name}
                  </span>
                  <span className="block truncate text-[11px] text-faint">@{u.username}</span>
                  {u.profile?.bio && (
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{u.profile.bio}</span>
                  )}
                </span>
                <span className="hidden shrink-0 text-[10px] text-faint tabular-nums sm:block">
                  {u.followers?.length || 0} followers
                </span>
                <ChevronRight className="size-4 shrink-0 text-faint group-hover:text-primary" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

const ProfileTabs = ({ profileData, activeTab, setActiveTab, isOwnProfile, onPostDeleted }) => {
  // ProfilePage patches these from `follow:updated`; a changed count refetches the open list
  const followersCount =
    typeof profileData.followersCount === "number"
      ? profileData.followersCount
      : Array.isArray(profileData.followers)
        ? profileData.followers.length
        : 0;
  const followingCount =
    typeof profileData.followingCount === "number"
      ? profileData.followingCount
      : Array.isArray(profileData.following)
        ? profileData.following.length
        : 0;

  const friendsCount = friendsCountOf(profileData);

  const options = [
    { value: "posts", label: "Posts", icon: Grid3x3, count: profileData.posts?.length || 0 },
    { value: "friends", label: "Friends", icon: Handshake, count: friendsCount },
    { value: "followers", label: "Followers", icon: Users, count: followersCount },
    { value: "following", label: "Following", icon: UserPlus, count: followingCount },
  ];

  return (
    <section aria-label="Profile content" className="space-y-4">
      <Tabs options={options} value={activeTab} onChange={setActiveTab} />

      <div role="tabpanel">
        {activeTab === "posts" && (
          <UserPostsList
            username={profileData.username}
            isOwnProfile={isOwnProfile}
            onPostDeleted={onPostDeleted}
          />
        )}
        {activeTab === "friends" && (
          <UserList username={profileData.username} kind="friends" refreshKey={friendsCount} />
        )}
        {activeTab === "followers" && (
          <UserList username={profileData.username} kind="followers" refreshKey={followersCount} />
        )}
        {activeTab === "following" && (
          <UserList username={profileData.username} kind="following" refreshKey={followingCount} />
        )}
      </div>
    </section>
  );
};

export default ProfileTabs;
