import React, { useState, useEffect } from "react";
import Post from "./PostCard";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  ArrowLeft,
  RefreshCw,
  User,
  MessageCircle,
  Heart,
  ShoppingCart,
  Store,
  Grid3X3,
  List,
} from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import GamingBackground from "../../GamingBackground/GamingBackground";

const MyPosts = () => {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState("grid"); // 'grid' or 'list'
  const navigate = useNavigate();

  const fetchMyPosts = async () => {
    if (!isAuthenticated || !user?.username) return;

    setLoading(true);
    setError("");
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/api/posts/user/${user.username}`,
        {
          withCredentials: true,
        },
      );
      if (res.data.success) {
        setPosts(res.data.posts || res.data.data || []);
      } else {
        setError(res.data.message || "Failed to fetch your posts");
        toast.error(res.data.message || "Failed to fetch your posts");
      }
    } catch (err) {
      console.error("Error fetching posts:", err);
      setError("Failed to fetch your posts");
      toast.error("Failed to fetch your posts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated && user?.username) {
      fetchMyPosts();
    }
  }, [isAuthenticated, authLoading, user?.username]);

  const handleDeletePost = (postId) => {
    setPosts((prev) => prev.filter((post) => post._id !== postId));
    toast.success("Post deleted successfully");
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchMyPosts();
      toast.success("Posts refreshed!");
    } catch (error) {
      toast.error("Failed to refresh posts");
    } finally {
      setRefreshing(false);
    }
  };

  const handleNavigateBack = () => {
    navigate("/feed");
  };

  const handleMyStoreClick = () => {
    navigate("/my-store");
  };

  const handleMyCartClick = () => {
    navigate("/cart");
  };

  const handleWishlistClick = () => {
    navigate("/wishlist");
  };

  if (authLoading || loading) {
    return (
      <div className="bg-gradient-to-br from-gray-900 via-black to-purple-900 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="bg-gradient-to-br from-gray-900 via-black to-purple-900 min-h-screen flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl p-8 max-w-md mx-auto text-center">
          <User className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-red-400 mb-4">
            Authentication Required
          </h1>
          <p className="text-gray-400 mb-4">
            You must be logged in to view your posts.
          </p>
          <button
            onClick={() => navigate("/login")}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Header */}
        <div className="mb-8">
          <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-purple-800 to-purple-900 px-8 py-6 border-b border-gray-700">
              <div className="flex items-center justify-center mb-2">
                <FileText className="w-6 h-6 text-purple-400 mr-2" />
                <h1 className="text-3xl font-bold text-white text-center">
                  MY POSTS
                </h1>
              </div>
              <p className="text-purple-300 text-center mt-2 text-sm">
                Manage and view all your posts
              </p>
            </div>

            <div className="px-8 py-6">
              {/* Navigation and Quick Actions */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={handleNavigateBack}
                  className="group relative px-4 py-2 bg-gradient-to-r from-gray-700 to-gray-800 text-gray-300 rounded-lg transition-all duration-300 shadow-md hover:shadow-purple-700/30 hover:translate-y-[-1px] overflow-hidden border border-gray-600 hover:border-purple-500"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-purple-800/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                  <span className="relative flex items-center gap-2">
                    <ArrowLeft
                      size={20}
                      className="text-purple-400 group-hover:text-purple-300 transition-colors"
                    />
                    <span className="font-medium group-hover:text-white transition-colors">
                      Back to Feed
                    </span>
                  </span>
                </button>

                <div className="flex items-center gap-3">
                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-gray-700 rounded-lg p-1 border border-gray-600">
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`p-2 rounded-md transition-all duration-300 ${
                        viewMode === "grid"
                          ? "bg-purple-600 text-white shadow-lg"
                          : "text-gray-400 hover:text-white hover:bg-gray-600"
                      }`}
                    >
                      <Grid3X3 size={18} />
                    </button>
                    <button
                      onClick={() => setViewMode("list")}
                      className={`p-2 rounded-md transition-all duration-300 ${
                        viewMode === "list"
                          ? "bg-purple-600 text-white shadow-lg"
                          : "text-gray-400 hover:text-white hover:bg-gray-600"
                      }`}
                    >
                      <List size={18} />
                    </button>
                  </div>

                  <button
                    onClick={handleRefresh}
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
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-4 max-w-4xl mx-auto justify-center flex-wrap">
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
                    <Store size={16} className="text-blue-300" />
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

        {/* Posts Section */}
        <div
          className={
            viewMode === "grid" ? "max-w-7xl mx-auto" : "max-w-2xl mx-auto"
          }
        >
          {/* Posts Stats */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-purple-700 rounded-full flex items-center justify-center shadow-lg">
                  {user?.profile?.profileImage ? (
                    <img
                      src={user.profile.profileImage}
                      alt={user.username}
                      className="w-12 h-12 rounded-full object-cover border-2 border-purple-500"
                    />
                  ) : (
                    <User className="w-6 h-6 text-white" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-white">
                    {user?.profile?.name || user?.username}
                  </h3>
                  <p className="text-sm text-gray-400">@{user?.username}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-purple-400">
                  {posts.length}
                </p>
                <p className="text-sm text-gray-400">Posts</p>
              </div>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-xl p-6 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-red-400">Error</h3>
                  <p className="text-red-300">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Posts List/Grid */}
          {posts.length > 0 ? (
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                  : "space-y-6"
              }
            >
              {posts.map((post) => (
                <div
                  key={post._id}
                  className={viewMode === "grid" ? "h-fit" : ""}
                >
                  <Post post={post} onDelete={handleDeletePost} />
                </div>
              ))}
            </div>
          ) : (
            !loading && (
              <div className="text-center py-12">
                <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl p-8 max-w-md mx-auto">
                  <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-300 mb-2">
                    No posts yet
                  </h3>
                  <p className="text-gray-500 mb-4">
                    You haven't created any posts yet. Start sharing your
                    thoughts!
                  </p>
                  <button
                    onClick={() => navigate("/post")}
                    className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-2 rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all duration-300 shadow-lg hover:shadow-purple-700/30"
                  >
                    Create Your First Post
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default MyPosts;
