import React, { useState, useEffect } from "react";
import {
  Heart,
  MessageCircle,
  Send,
  User,
  MoreHorizontal,
  Trash2,
  Share2,
  Copy,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";

const Post = ({ post, onUpdate, onDelete }) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes?.length || 0);
  const [comments, setComments] = useState(post.comments || []);
  const [newComment, setNewComment] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (post.likes && user) {
      setIsLiked(post.likes.includes(user._id));
    }
  }, [post.likes, user]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = (now - date) / (1000 * 60);

    if (diffInMinutes < 1) return "now";
    if (diffInMinutes < 60) return `${Math.floor(diffInMinutes)}m`;

    const diffInHours = diffInMinutes / 60;
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h`;

    const diffInDays = diffInHours / 24;
    if (diffInDays < 7) return `${Math.floor(diffInDays)}d`;

    return date.toLocaleDateString();
  };

  const handleLike = async () => {
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/api/posts/${post._id}/like`,
        {},
        {
          withCredentials: true,
        },
      );

      if (res.data.success) {
        setIsLiked(res.data.isLiked);
        setLikesCount(res.data.likesCount);
        // Optional: Show like/unlike feedback
        if (res.data.isLiked) {
          toast.success("Post liked! ❤️", { autoClose: 1000 });
        }
      }
    } catch (error) {
      console.error("Error liking post:", error);
      toast.error("Failed to like post");
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/api/posts/${post._id}/comment`,
        { text: newComment },
        { withCredentials: true },
      );

      if (res.data.success) {
        setComments((prev) => [...prev, res.data.comment]);
        setNewComment("");
        toast.success("Comment added successfully!");
      }
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
    }
  };

  const handleDelete = async () => {
    // Use toast for confirmation instead of window.confirm
    const confirmToast = () => {
      toast.warn(
        <div>
          <p className="mb-3">Are you sure you want to delete this post?</p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                toast.dismiss();
                performDelete();
              }}
              className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
            >
              Yes, Delete
            </button>
            <button
              onClick={() => toast.dismiss()}
              className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>,
        {
          position: "top-center",
          autoClose: false,
          closeOnClick: false,
          draggable: false,
        },
      );
    };

    const performDelete = async () => {
      setIsDeleting(true);
      try {
        const res = await axios.delete(
          `${import.meta.env.VITE_BACKEND_URL}/api/posts/${post._id}`,
          {
            withCredentials: true,
          },
        );

        if (res.data.success && onDelete) {
          onDelete(post._id);
          toast.success("Post deleted successfully!");
        }
      } catch (error) {
        console.error("Error deleting post:", error);
        toast.error("Failed to delete post");
      } finally {
        setIsDeleting(false);
        setShowOptions(false);
      }
    };

    confirmToast();
  };

  const handleShare = () => {
    setShowShareMenu(!showShareMenu);
  };

  const copyToClipboard = async () => {
    const postUrl = `${window.location.origin}/posts/${post._id}`;
    try {
      await navigator.clipboard.writeText(postUrl);
      setShareSuccess(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => {
        setShareSuccess(false);
        setShowShareMenu(false);
      }, 2000);
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
        setShareSuccess(true);
        toast.success("Link copied to clipboard!");
        setTimeout(() => {
          setShareSuccess(false);
          setShowShareMenu(false);
        }, 2000);
      } catch (fallbackError) {
        toast.error("Failed to copy link to clipboard");
      }
    }
  };

  const shareToTwitter = () => {
    const postUrl = `${window.location.origin}/posts/${post._id}`;
    const text = `Check out this post by ${post.author?.username}: ${post.content.substring(0, 100)}${post.content.length > 100 ? "..." : ""}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(postUrl)}`;
    window.open(twitterUrl, "_blank");
    setShowShareMenu(false);
    toast.success("Opening Twitter share...");
  };

  const shareToWhatsApp = () => {
    const postUrl = `${window.location.origin}/posts/${post._id}`;
    const text = `Check out this post: ${post.content.substring(0, 100)}${post.content.length > 100 ? "..." : ""} ${postUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, "_blank");
    setShowShareMenu(false);
    toast.success("Opening WhatsApp share...");
  };

  const shareToTelegram = () => {
    const postUrl = `${window.location.origin}/posts/${post._id}`;
    const text = `Check out this post: ${post.content.substring(0, 100)}${post.content.length > 100 ? "..." : ""}`;
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(postUrl)}&text=${encodeURIComponent(text)}`;
    window.open(telegramUrl, "_blank");
    setShowShareMenu(false);
    toast.success("Opening Telegram share...");
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        const postUrl = `${window.location.origin}/posts/${post._id}`;
        await navigator.share({
          title: `Post by ${post.author?.username}`,
          text:
            post.content.substring(0, 100) +
            (post.content.length > 100 ? "..." : ""),
          url: postUrl,
        });
        setShowShareMenu(false);
        toast.success("Shared successfully!");
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Error sharing:", error);
          toast.error("Failed to share");
        }
      }
    }
  };

  const isOwnPost = user && post.author?._id === user._id;

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl p-6 mb-6 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-700/20">
      {/* Post Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-purple-700 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
            {post.author?.profile?.profileImage ? (
              <img
                src={post.author.profile.profileImage}
                alt={post.author.username}
                className="w-10 h-10 rounded-full object-cover border-2 border-purple-500"
              />
            ) : (
              <User className="w-5 h-5 text-white" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-white hover:text-purple-300 transition-colors">
              {post.author?.profile?.name || post.author?.username}
            </h3>
            <p className="text-sm text-gray-400">
              @{post.author?.username} • {formatDate(post.createdAt)}
            </p>
          </div>
        </div>

        {isOwnPost && (
          <div className="relative">
            <button
              onClick={() => setShowOptions(!showOptions)}
              className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-700 transition-colors"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>

            {showOptions && (
              <div className="absolute right-0 mt-2 w-48 bg-gray-700 rounded-lg shadow-xl border border-gray-600 z-10">
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="w-full px-4 py-2 text-left text-red-400 hover:bg-red-900/30 rounded-lg flex items-center space-x-2 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isDeleting ? "Deleting..." : "Delete Post"}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Post Content */}
      <div className="mb-4">
        <p className="text-gray-200 whitespace-pre-wrap leading-relaxed">
          {post.content}
        </p>

        {/* Media */}
        {post.media && post.media.type !== "none" && (
          <div className="mt-4">
            {post.media.type === "video" ? (
              <video
                src={post.media.url}
                className="w-full max-h-96 object-cover rounded-lg border border-gray-600 shadow-lg"
                controls
              />
            ) : (
              <img
                src={post.media.url}
                alt="Post media"
                className="w-full max-h-96 object-cover rounded-lg border border-gray-600 shadow-lg hover:scale-105 transition-transform duration-300"
              />
            )}
          </div>
        )}
      </div>

      {/* Post Actions */}
      <div className="flex items-center space-x-6 py-3 border-t border-gray-700">
        <button
          onClick={handleLike}
          className={`flex items-center space-x-2 transition-all duration-300 hover:scale-105 ${
            isLiked
              ? "text-red-400 hover:text-red-300"
              : "text-gray-400 hover:text-red-400"
          }`}
        >
          <Heart className={`w-5 h-5 ${isLiked ? "fill-current" : ""}`} />
          <span className="font-medium">{likesCount}</span>
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center space-x-2 text-gray-400 hover:text-purple-400 transition-all duration-300 hover:scale-105"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="font-medium">{comments.length}</span>
        </button>

        {/* Share Button */}
        <div className="relative">
          <button
            onClick={handleShare}
            className="flex items-center space-x-2 text-gray-400 hover:text-blue-400 transition-all duration-300 hover:scale-105"
          >
            <Share2 className="w-5 h-5" />
            <span className="font-medium">Share</span>
          </button>

          {/* Share Menu */}
          {showShareMenu && (
            <div className="absolute bottom-full left-0 mb-2 w-64 bg-gray-700 rounded-lg shadow-xl border border-gray-600 z-20 p-3">
              <div className="space-y-2">
                {/* Native Share (if supported) */}
                {navigator.share && (
                  <button
                    onClick={nativeShare}
                    className="w-full px-3 py-2 text-left text-gray-200 hover:bg-gray-600 rounded-lg flex items-center space-x-3 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 text-blue-400" />
                    <span>Share via...</span>
                  </button>
                )}

                {/* Copy Link */}
                <button
                  onClick={copyToClipboard}
                  className="w-full px-3 py-2 text-left text-gray-200 hover:bg-gray-600 rounded-lg flex items-center space-x-3 transition-colors"
                >
                  <Copy className="w-4 h-4 text-green-400" />
                  <span>{shareSuccess ? "Copied!" : "Copy Link"}</span>
                </button>

                {/* Social Media Options */}
                <button
                  onClick={shareToTwitter}
                  className="w-full px-3 py-2 text-left text-gray-200 hover:bg-gray-600 rounded-lg flex items-center space-x-3 transition-colors"
                >
                  <div className="w-4 h-4 bg-blue-400 rounded-sm"></div>
                  <span>Share on Twitter</span>
                </button>

                <button
                  onClick={shareToWhatsApp}
                  className="w-full px-3 py-2 text-left text-gray-200 hover:bg-gray-600 rounded-lg flex items-center space-x-3 transition-colors"
                >
                  <div className="w-4 h-4 bg-green-500 rounded-sm"></div>
                  <span>Share on WhatsApp</span>
                </button>

                <button
                  onClick={shareToTelegram}
                  className="w-full px-3 py-2 text-left text-gray-200 hover:bg-gray-600 rounded-lg flex items-center space-x-3 transition-colors"
                >
                  <div className="w-4 h-4 bg-blue-500 rounded-sm"></div>
                  <span>Share on Telegram</span>
                </button>
              </div>

              {shareSuccess && (
                <div className="mt-2 p-2 bg-green-900/30 text-green-400 text-sm rounded-lg text-center">
                  Link copied to clipboard!
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="mt-4 border-t border-gray-700 pt-4">
          {/* Add Comment */}
          <form
            onSubmit={handleComment}
            className="flex items-center space-x-3 mb-4"
          >
            <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-purple-700 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
              {user?.profile?.profileImage ? (
                <img
                  src={user.profile.profileImage}
                  alt={user.username}
                  className="w-8 h-8 rounded-full object-cover border border-purple-500"
                />
              ) : (
                <User className="w-4 h-4 text-white" />
              )}
            </div>
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-400 transition-colors"
            />
            <button
              type="submit"
              disabled={!newComment.trim()}
              className="p-2 text-purple-400 hover:text-purple-300 disabled:text-gray-500 disabled:hover:text-gray-500 transition-colors hover:bg-purple-900/30 rounded-full"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>

          {/* Comments List */}
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {comments.map((comment) => (
              <div key={comment._id} className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-purple-700 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                  {comment.user?.profile?.profileImage ? (
                    <img
                      src={comment.user.profile.profileImage}
                      alt={comment.user.username}
                      className="w-8 h-8 rounded-full object-cover border border-purple-500"
                    />
                  ) : (
                    <User className="w-4 h-4 text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 shadow-md">
                    <p className="font-semibold text-sm text-purple-300">
                      {comment.user?.username}
                    </p>
                    <p className="text-gray-200">{comment.text}</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDate(comment.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Post;
