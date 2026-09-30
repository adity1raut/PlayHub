import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, ExternalLink, Heart, MessageSquare, Send, Share2, Trash2 } from "lucide-react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { API_URL, mediaUrl } from "../../lib/config";
import { cn } from "../../lib/cn";
import { toast } from "../../lib/toast";
import { useSocketEvent } from "../../lib/useSocketEvent";
import { Avatar, Button, Card, IconButton, Modal, inputClass } from "../../components/ui";

// Likes arrive as plain ids from most endpoints, but populated ({ _id, … }) from GET /api/posts/:id.
const idOf = (v) => String(v?._id ?? v ?? "");

/** Append comments whose _id isn't already in the list (the commenter's card got it from REST). */
const mergeComments = (list, ...incoming) => {
  const seen = new Set(list.map((c) => c?._id && String(c._id)).filter(Boolean));
  const fresh = incoming.filter((c) => c && !(c._id && seen.has(String(c._id))));
  return fresh.length ? [...list, ...fresh] : list;
};

const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const diffInMinutes = (Date.now() - date) / (1000 * 60);

  if (diffInMinutes < 1) return "now";
  if (diffInMinutes < 60) return `${Math.floor(diffInMinutes)}m`;

  const diffInHours = diffInMinutes / 60;
  if (diffInHours < 24) return `${Math.floor(diffInHours)}h`;

  const diffInDays = diffInHours / 24;
  if (diffInDays < 7) return `${Math.floor(diffInDays)}d`;

  return date.toLocaleDateString();
};

const excerpt = (text = "", n = 100) => text.substring(0, n) + (text.length > n ? "..." : "");

const shareItem =
  "flex w-full items-center gap-2.5 border border-transparent px-2.5 py-2 text-left text-xs font-medium outline-none hover:border-border hover:bg-accent focus-visible:border-border focus-visible:bg-accent [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground";

const Post = ({ post, onUpdate, onDelete }) => {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likesCount ?? post.likes?.length ?? 0);
  const [liking, setLiking] = useState(false);
  const [comments, setComments] = useState(post.comments || []);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount ?? post.comments?.length ?? 0);
  const [newComment, setNewComment] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const shareRef = useRef(null);

  const author = post.author && typeof post.author === "object" ? post.author : null;
  const authorId = idOf(post.author);
  const authorName = author?.profile?.name || author?.username || "Unknown";
  const isOwnPost = Boolean(user && authorId === String(user._id));
  const hasMedia = post.media?.url && post.media.type && post.media.type !== "none";
  const postUrl = `${window.location.origin}/post/${post._id}`;

  // Re-derive only when the likes list or the signed-in account changes — not on every
  // auth-user refresh, which would undo a like/unlike the parent's list hasn't recorded.
  const userId = user?._id;
  useEffect(() => {
    if (post.likes && userId) {
      setIsLiked(post.likes.some((l) => idOf(l) === String(userId)));
    }
  }, [post.likes, userId]);

  // Realtime: every rendered card for this post follows the live like / comment counts.
  // Only the viewer's own like toggles (e.g. from another tab) change the heart state.
  useSocketEvent("post:likes", (e = {}) => {
    if (idOf(e.postId) !== String(post._id)) return;
    if (typeof e.likesCount === "number") setLikesCount(e.likesCount);
    if (user && e.userId != null && idOf(e.userId) === String(user._id)) setIsLiked(Boolean(e.liked));
  });

  useSocketEvent("post:comment", (e = {}) => {
    if (idOf(e.postId) !== String(post._id)) return;
    if (e.comment) setComments((prev) => mergeComments(prev, e.comment));
    if (typeof e.commentsCount === "number") setCommentsCount(e.commentsCount);
  });

  // Close the share menu on outside click / Escape
  useEffect(() => {
    if (!showShareMenu) return undefined;
    const onDown = (e) => shareRef.current && !shareRef.current.contains(e.target) && setShowShareMenu(false);
    const onKey = (e) => e.key === "Escape" && setShowShareMenu(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [showShareMenu]);

  const handleLike = async () => {
    if (liking) return;
    setLiking(true);
    try {
      const res = await axios.post(`${API_URL}/api/posts/${post._id}/like`, {}, { withCredentials: true });

      if (res.data.success) {
        setIsLiked(res.data.isLiked);
        setLikesCount(res.data.likesCount);
        // likePost() already creates + pushes the LIKE notification server-side
        // (backend/src/modules/posts/post.controller.js), so no "post-liked" emit here —
        // emitting it as well would notify the owner twice.
        if (onUpdate && user) {
          const others = (post.likes || []).filter((l) => idOf(l) !== String(user._id));
          onUpdate({
            ...post,
            likes: res.data.isLiked ? [...others, user._id] : others,
            likesCount: res.data.likesCount,
            comments,
          });
        }
      }
    } catch (error) {
      console.error("Error liking post:", error);
      toast.error(error.response?.data?.message || "Failed to like post");
    } finally {
      setLiking(false);
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    const text = newComment.trim();
    if (!text || commenting) return;

    setCommenting(true);
    try {
      const res = await axios.post(
        `${API_URL}/api/posts/${post._id}/comment`,
        { text },
        { withCredentials: true },
      );

      if (res.data.success) {
        // The `post:comment` broadcast may have arrived first — dedupe by comment _id.
        // Comments can't be deleted, so the larger count is the newer one.
        const next = mergeComments(comments, res.data.comment);
        const count = Math.max(
          next.length,
          typeof res.data.commentsCount === "number" ? res.data.commentsCount : 0,
        );
        setComments((prev) => mergeComments(prev, res.data.comment));
        setCommentsCount((c) => Math.max(c, count));
        setNewComment("");
        // addComment() already creates the COMMENT notification server-side (see handleLike).
        onUpdate?.({ ...post, comments: next, commentsCount: count });
      }
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error(error.response?.data?.message || "Failed to add comment");
    } finally {
      setCommenting(false);
    }
  };

  const performDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await axios.delete(`${API_URL}/api/posts/${post._id}`, { withCredentials: true });

      if (res.data.success) {
        setConfirmDelete(false);
        toast.success("Post deleted");
        onDelete?.(post._id);
      }
    } catch (error) {
      console.error("Error deleting post:", error);
      toast.error(error.response?.data?.message || "Failed to delete post");
    } finally {
      setIsDeleting(false);
    }
  };

  const copyToClipboard = async () => {
    const done = () => {
      setShareSuccess(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => {
        setShareSuccess(false);
        setShowShareMenu(false);
      }, 1500);
    };
    try {
      await navigator.clipboard.writeText(postUrl);
      done();
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      // Fallback for older browsers
      try {
        const textArea = document.createElement("textarea");
        textArea.value = postUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        done();
      } catch {
        toast.error("Failed to copy link to clipboard");
      }
    }
  };

  const openShare = (url) => {
    window.open(url, "_blank", "noopener,noreferrer");
    setShowShareMenu(false);
  };

  const shareToTwitter = () => {
    const text = `Check out this post by ${author?.username}: ${excerpt(post.content)}`;
    openShare(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(postUrl)}`,
    );
  };

  const shareToWhatsApp = () => {
    const text = `Check out this post: ${excerpt(post.content)} ${postUrl}`;
    openShare(`https://wa.me/?text=${encodeURIComponent(text)}`);
  };

  const shareToTelegram = () => {
    const text = `Check out this post: ${excerpt(post.content)}`;
    openShare(`https://t.me/share/url?url=${encodeURIComponent(postUrl)}&text=${encodeURIComponent(text)}`);
  };

  const nativeShare = async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: `Post by ${author?.username}`,
        text: excerpt(post.content),
        url: postUrl,
      });
      setShowShareMenu(false);
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Error sharing:", error);
        toast.error("Failed to share");
      }
    }
  };

  const profileLink = author?.username ? `/profile/${author.username}` : null;

  return (
    <Card as="article" id={`post-${post._id}`} className="scroll-mt-6">
      <header className="flex items-start gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        {profileLink ? (
          <Link to={profileLink} aria-label={`${authorName}'s profile`} className="shrink-0">
            <Avatar src={author?.profile?.profileImage} name={authorName} size="md" />
          </Link>
        ) : (
          <Avatar src={author?.profile?.profileImage} name={authorName} size="md" />
        )}
        <div className="min-w-0 flex-1">
          {profileLink ? (
            <Link
              to={profileLink}
              className="block truncate text-sm font-bold text-foreground transition-colors hover:text-primary"
            >
              {authorName}
            </Link>
          ) : (
            <p className="truncate text-sm font-bold text-foreground">{authorName}</p>
          )}
          <p className="mt-0.5 truncate text-[11px] text-faint">
            {author?.username && <>@{author.username} · </>}
            <time dateTime={post.createdAt} title={post.createdAt ? new Date(post.createdAt).toLocaleString() : undefined}>
              {formatDate(post.createdAt)}
            </time>
          </p>
        </div>
        {isOwnPost && (
          <IconButton
            icon={Trash2}
            label="Delete post"
            size="sm"
            onClick={() => setConfirmDelete(true)}
            className="-mt-1 -mr-1 hover:border-destructive/40 hover:bg-destructive/10 hover:[&_svg]:text-destructive"
          />
        )}
      </header>

      <div className="space-y-4 px-4 py-4 sm:px-5">
        {post.content && (
          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground">{post.content}</p>
        )}

        {hasMedia &&
          (post.media.type === "video" ? (
            <video
              src={mediaUrl(post.media.url)}
              controls
              preload="metadata"
              className="max-h-[32rem] w-full border border-border bg-background object-contain"
            />
          ) : (
            <img
              src={mediaUrl(post.media.url)}
              alt={`Image posted by ${authorName}`}
              loading="lazy"
              className="max-h-[32rem] w-full border border-border bg-background object-cover"
            />
          ))}
      </div>

      <footer className="flex items-center gap-1 border-t border-border px-2 py-2 sm:px-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLike}
          aria-busy={liking || undefined}
          aria-pressed={isLiked}
          aria-label={`${isLiked ? "Unlike" : "Like"} post (${likesCount} ${likesCount === 1 ? "like" : "likes"})`}
        >
          <Heart className={cn("size-4", isLiked && "fill-current text-destructive")} aria-hidden="true" />
          <span className={cn("tabular-nums", isLiked && "text-destructive")}>{likesCount}</span>
        </Button>

        <Button
          variant={showComments ? "secondary" : "ghost"}
          size="sm"
          icon={MessageSquare}
          onClick={() => setShowComments((s) => !s)}
          aria-expanded={showComments}
          aria-label={`${showComments ? "Hide" : "Show"} comments (${commentsCount})`}
        >
          <span className="tabular-nums">{commentsCount}</span>
        </Button>

        <div ref={shareRef} className="relative ml-auto">
          <Button
            variant="ghost"
            size="sm"
            icon={Share2}
            onClick={() => setShowShareMenu((s) => !s)}
            aria-haspopup="menu"
            aria-expanded={showShareMenu}
          >
            Share
          </Button>

          {showShareMenu && (
            <div
              role="menu"
              className="absolute right-0 bottom-full z-20 mb-1 w-56 border border-border-strong bg-popover p-1 shadow-float animate-slide-up"
            >
              <p className="eyebrow px-2.5 py-1.5 text-faint">Share post</p>
              {typeof navigator !== "undefined" && navigator.share && (
                <button role="menuitem" type="button" onClick={nativeShare} className={shareItem}>
                  <ExternalLink /> Share via…
                </button>
              )}
              <button role="menuitem" type="button" onClick={copyToClipboard} className={shareItem}>
                <Copy className={cn(shareSuccess && "text-success!")} /> {shareSuccess ? "Copied!" : "Copy link"}
              </button>
              <div className="-mx-1 my-1 h-px bg-border" />
              <button role="menuitem" type="button" onClick={shareToTwitter} className={shareItem}>
                <span aria-hidden="true" className="w-4 text-center text-primary">&gt;</span> Twitter / X
              </button>
              <button role="menuitem" type="button" onClick={shareToWhatsApp} className={shareItem}>
                <span aria-hidden="true" className="w-4 text-center text-primary">&gt;</span> WhatsApp
              </button>
              <button role="menuitem" type="button" onClick={shareToTelegram} className={shareItem}>
                <span aria-hidden="true" className="w-4 text-center text-primary">&gt;</span> Telegram
              </button>
            </div>
          )}
        </div>
      </footer>

      {showComments && (
        <section aria-label="Comments" className="space-y-4 border-t border-border bg-background/40 px-4 py-4 sm:px-5">
          {comments.length > 0 ? (
            <ul className="max-h-72 space-y-3 overflow-y-auto pr-1 scrollbar-thin">
              {comments.map((comment, i) => {
                const cu = comment.user && typeof comment.user === "object" ? comment.user : null;
                const cName = cu?.profile?.name || cu?.username || "User";
                return (
                  <li key={comment._id ?? i} className="flex gap-2.5">
                    <Avatar src={cu?.profile?.profileImage} name={cName} size="xs" className="mt-0.5" />
                    <div className="min-w-0 flex-1 border-l border-border pl-3">
                      <p className="flex flex-wrap items-baseline gap-x-2 text-[11px]">
                        {cu?.username ? (
                          <Link
                            to={`/profile/${cu.username}`}
                            className="font-bold text-foreground transition-colors hover:text-primary"
                          >
                            {cName}
                          </Link>
                        ) : (
                          <span className="font-bold text-foreground">{cName}</span>
                        )}
                        <span className="text-faint">{formatDate(comment.createdAt)}</span>
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">
                        {comment.text}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[11px] text-faint">
              <span className="text-primary">&gt;</span> No comments yet. Start the thread.
            </p>
          )}

          <form onSubmit={handleComment} className="flex items-center gap-2">
            <span className="hidden sm:block">
              <Avatar src={user?.profile?.profileImage} name={user?.profile?.name || user?.username} size="sm" />
            </span>
            <div className="relative min-w-0 flex-1">
              <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs text-primary">
                &gt;
              </span>
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment…"
                aria-label="Write a comment"
                maxLength={500}
                disabled={commenting}
                className={cn(inputClass, "pl-7")}
              />
            </div>
            <IconButton
              type="submit"
              icon={Send}
              label="Post comment"
              variant="default"
              disabled={!newComment.trim() || commenting}
            />
          </form>
        </section>
      )}

      <Modal
        open={confirmDelete}
        onClose={() => !isDeleting && setConfirmDelete(false)}
        title="Delete post"
        description="This permanently removes the post, its likes and comments."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" icon={Trash2} loading={isDeleting} onClick={performDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="border-l border-border-strong pl-3 text-xs leading-relaxed text-muted-foreground line-clamp-4">
          {post.content}
        </p>
      </Modal>
    </Card>
  );
};

export default Post;
