import React, { useState, useEffect } from "react";
import CreatePost from "./CreatePost";
import Post from "./PostCard";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";
import {
  MessageCircle,
  RefreshCw,
  PlusCircle,
  User,
  Heart,
  ShoppingCart,
  FileText,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import GamingBackground from "../../GamingBackground/GamingBackground";

const Feed = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const fetchPosts = async (pageNum = 1, append = false) => {
    try {
      if (pageNum > 1) setLoadingMore(true);

      const res = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/api/posts/feed?page=${pageNum}&limit=10`,
        {
          withCredentials: true,
        },
      );

      if (res.data.success) {
        if (append) {
          setPosts((prev) => [...prev, ...res.data.posts]);
        } else {
          setPosts(res.data.posts);
        }
        setHasMore(res.data.hasMore);
        setPage(pageNum);
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
      toast.error("Failed to fetch posts");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPosts();
    }
  }, [user]);

  const handleNewPost = (newPost) => {
    setPosts((prev) => [newPost, ...prev]);
    toast.success("Post created successfully! 🎉");
  };

  const handleDeletePost = (postId) => {
    setPosts((prev) => prev.filter((post) => post._id !== postId));
    toast.success("Post deleted successfully");
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchPosts(page + 1, true);
    }
  };

  const refreshFeed = async () => {
    setRefreshing(true);
    setPage(1);
    try {
      await fetchPosts(1, false);
      toast.success("Feed refreshed!");
    } catch (error) {
      toast.error("Failed to refresh feed");
    } finally {
      setRefreshing(false);
    }
  };

  const handleMyStoreClick = () => {
    if (!isAuthenticated) {
      toast.error("Please login to view your store");
      navigate("/login");
      return;
    }
    navigate("/my-store");
  };

  const handleMyCartClick = () => {
    if (!isAuthenticated) {
      toast.error("Please login to view your cart");
      navigate("/login");
      return;
    }
    navigate("/cart");
  };

  const handleWishlistClick = () => {
    if (!isAuthenticated) {
      toast.error("Please login to view your wishlist");
      navigate("/login");
      return;
    }
    navigate("/wishlist");
  };

  const handleMyPostsClick = () => {
    if (!isAuthenticated) {
      toast.error("Please login to view your posts");
      navigate("/login");
      return;
    }
    navigate("/myposts");
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-900 via-black to-purple-900 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  // Filter out current user's posts
  const filteredPosts = posts.filter(
    (post) => post.author !== user?._id && post.author?._id !== user?._id,
  );

  return (
    <div className="bg-gradient-to-br from-gray-900 via-black to-purple-900 min-h-screen p-4 pt-32">
      <GamingBackground />
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Header */}
        <div className="mb-8">
          <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-purple-800 to-purple-900 px-8 py-6 border-b border-gray-700">
              <div className="flex items-center justify-center mb-2">
                <MessageCircle className="w-6 h-6 text-purple-400 mr-2" />
                <h1 className="text-3xl font-bold text-white text-center">
                  SOCIAL FEED
                </h1>
              </div>
              <p className="text-purple-300 text-center mt-2 text-sm">
                Share your thoughts and connect with friends
              </p>
            </div>

            <div className="px-8 py-6">
              {/* Quick Actions */}
              <div className="flex items-center gap-4 max-w-4xl mx-auto justify-center flex-wrap">
                <button
                  onClick={handleMyPostsClick}
                  className="group relative px-5 py-2.5 bg-gradient-to-r from-indigo-900/70 to-purple-900/70 text-indigo-100 rounded-lg transition-all duration-300 shadow-md hover:shadow-indigo-700/30 hover:translate-y-[-2px] overflow-hidden"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 to-indigo-800/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                  <span className="relative flex items-center gap-2">
                    <FileText size={16} className="text-indigo-300" />
                    <span>My Posts</span>
                  </span>
                </button>

                <button
                  onClick={handleWishlistClick}
                  className="group relative px-5 py-2.5 bg-gradient-to-r from-pink-900/70 to-purple-900/70 text-pink-100 rounded-lg transition-all duration-300 shadow-md hover:shadow-pink-700/30 hover:translate-y-[-2px] overflow-hidden"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-pink-600/20 to-pink-800/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                  <span className="relative flex items-center gap-2">
                    <Heart size={16} className="text-pink-300" />
                    <span>Wishlist</span>
                  </span>
                </button>

                <button
                  onClick={handleMyCartClick}
                  className="group relative px-5 py-2.5 bg-gradient-to-r from-green-900/70 to-emerald-900/70 text-green-100 rounded-lg transition-all duration-300 shadow-md hover:shadow-green-700/30 hover:translate-y-[-2px] overflow-hidden"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-green-600/20 to-green-800/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                  <span className="relative flex items-center gap-2">
                    <ShoppingCart size={16} className="text-green-300" />
                    <span>My Cart</span>
                  </span>
                </button>

                <button
                  onClick={handleMyStoreClick}
                  className="group relative px-5 py-2.5 bg-gradient-to-r from-blue-900/70 to-indigo-900/70 text-blue-100 rounded-lg transition-all duration-300 shadow-md hover:shadow-blue-700/30 hover:translate-y-[-2px] overflow-hidden"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-blue-800/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                  <span className="relative flex items-center gap-2">
                    <User size={16} className="text-blue-300" />
                    <span>My Store</span>
                  </span>
                </button>

                <button
                  onClick={() => navigate("/stores")}
                  className="group relative px-5 py-2.5 bg-gradient-to-r from-orange-900/70 to-red-900/70 text-orange-100 rounded-lg transition-all duration-300 shadow-md hover:shadow-orange-700/30 hover:translate-y-[-2px] overflow-hidden"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-orange-600/20 to-orange-800/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                  <span className="relative flex items-center gap-2">
                    <MessageCircle size={16} className="text-orange-300" />
                    <span>All Stores</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Feed Controls */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-bold text-white">Latest Posts</h2>
          </div>
          <button
            onClick={refreshFeed}
            disabled={refreshing}
            className="group relative px-4 py-2 bg-gradient-to-r from-purple-700 to-purple-800 text-purple-300 rounded-lg transition-all duration-300 shadow-md hover:shadow-purple-500/30 hover:translate-y-[-1px] overflow-hidden border border-purple-600 hover:border-purple-400 disabled:opacity-50"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-purple-700/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
            <span className="relative flex items-center gap-2">
              <RefreshCw
                className={`w-4 h-4 text-purple-400 group-hover:text-purple-200 transition-colors ${refreshing ? "animate-spin" : ""}`}
              />
              <span className="font-medium group-hover:text-white transition-colors">
                {refreshing ? "Refreshing..." : "Refresh"}
              </span>
            </span>
          </button>
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Create Post */}
          <div className="mb-8">
            <CreatePost onPostCreated={handleNewPost} />
          </div>

          {/* Posts List */}
          <div className="space-y-6">
            {filteredPosts.map((post) => (
              <Post key={post._id} post={post} onDelete={handleDeletePost} />
            ))}
          </div>

          {/* Load More Button */}
          {hasMore && filteredPosts.length > 0 && (
            <div className="text-center mt-8">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-purple-700/30 font-medium"
              >
                {loadingMore ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Loading more posts...</span>
                  </div>
                ) : (
                  "Load More Posts"
                )}
              </button>
            </div>
          )}

          {/* Empty State */}
          {filteredPosts.length === 0 && !loading && (
            <div className="text-center py-12">
              <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl p-8 max-w-md mx-auto">
                <MessageCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-300 mb-2">
                  No posts yet
                </h3>
                <p className="text-gray-500 mb-4">
                  Be the first to share something with your friends!
                </p>
                <div className="bg-gradient-to-r from-purple-900/40 to-purple-800/40 rounded-lg p-4 border border-purple-700/50">
                  <p className="text-purple-300 text-sm">
                    💡 <strong>Tip:</strong> Create your first post above to get
                    started!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Feed;
