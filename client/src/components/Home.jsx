import React, { useState, useEffect } from "react";
import Post from "./Post/PostCard";
import { useAuth } from "../context/AuthContext";
import { useProduct } from "../context/ProductContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

import {
  MessageCircle,
  ShoppingBag,
  Heart,
  Star,
  Video,
  Play,
  Users,
  Clock,
  Zap,
  ShoppingCart,
  User,
  Eye,
} from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import GamingBackground from "../GamingBackground/GamingBackground";

function Home() {
  const [posts, setPosts] = useState([]);
  const [liveStreams, setLiveStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [streamLoading, setStreamLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState("posts");
  const { user, isAuthenticated } = useAuth();
  const {
    products,
    getAllProducts,
    loading: productLoading,
    addToCart,
    toggleWishlist,
    isInCart,
    getCartItemQuantity,
  } = useProduct();
  const navigate = useNavigate();

  const fetchPosts = async (pageNum = 1, append = false) => {
    try {
      if (pageNum > 1) setLoadingMore(true);

      const res = await axios.get(
        `${backendUrl}/api/posts/feed?page=${pageNum}&limit=10`,
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
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const fetchProducts = async () => {
    try {
      await getAllProducts({
        page: 1,
        limit: 12,
        sort: "createdAt",
        order: "desc",
      });
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const fetchLiveStreams = async () => {
    try {
      setStreamLoading(true);
      const response = await axios.get(`${backendUrl}/api/stream/live`);
      setLiveStreams(response.data.slice(0, 8)); // Get first 8 live streams for home
    } catch (error) {
      console.error("Error fetching live streams:", error);
    } finally {
      setStreamLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPosts();
      fetchProducts();
      fetchLiveStreams();
    }
  }, [user]);

  // Refresh live streams every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTab === "streams") {
        fetchLiveStreams();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [activeTab]);

  const handleDeletePost = (postId) => {
    setPosts((prev) => prev.filter((post) => post._id !== postId));
  };

  const loadMore = () => {
    if (!loadingMore && hasMore && activeTab === "posts") {
      fetchPosts(page + 1, true);
    }
  };

  const handleAddToCart = async (product) => {
    if (!isAuthenticated) {
      toast.error("Please login to add items to cart");
      navigate("/login");
      return;
    }

    if (!product.store?._id) {
      toast.error("Store information not available");
      return;
    }

    const result = await addToCart(product._id, 1, product.store._id);
    if (result.success) {
      toast.success("Added to cart successfully!");
    } else {
      toast.error(result.message || "Failed to add to cart");
    }
  };

  const handleToggleWishlist = async (productId) => {
    if (!isAuthenticated) {
      toast.error("Please login to add items to wishlist");
      navigate("/login");
      return;
    }

    const result = await toggleWishlist(productId);
    if (result.success) {
      toast.success(
        result.inWishlist ? "Added to wishlist!" : "Removed from wishlist!",
      );
    } else {
      toast.error(result.message || "Failed to update wishlist");
    }
  };

  const handleProductClick = (productId) => {
    navigate(`/products/${productId}`);
  };

  const handleViewStream = (stream) => {
    window.open(`/stream/${stream._id}`, "_blank");
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

  // Format duration for streams
  const formatDuration = (startedAt) => {
    const start = new Date(startedAt);
    const now = new Date();
    const duration = Math.floor((now - start) / 1000 / 60);

    if (duration < 60) return `${duration}m`;
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    return `${hours}h ${minutes}m`;
  };

  if (loading && productLoading && streamLoading) {
    return (
      <div className="bg-gradient-to-br from-gray-900 via-black to-purple-900 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-900 via-black to-purple-900 p-4 pt-32">
      <GamingBackground />
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Header */}
        <div className="mb-8">
          <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl overflow-hidden">
            <div className="px-8 py-6">
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
                    <ShoppingBag size={16} className="text-orange-300" />
                    <span>All Stores</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6 bg-gray-800 p-1 rounded-lg border border-gray-700">
          <button
            onClick={() => setActiveTab("posts")}
            className={`flex-1 py-3 px-4 rounded-md font-medium transition-all duration-300 ${
              activeTab === "posts"
                ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-700"
            }`}
          >
            <MessageCircle className="w-4 h-4 inline mr-2" />
            Posts
          </button>
          <button
            onClick={() => setActiveTab("products")}
            className={`flex-1 py-3 px-4 rounded-md font-medium transition-all duration-300 ${
              activeTab === "products"
                ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-700"
            }`}
          >
            <ShoppingBag className="w-4 h-4 inline mr-2" />
            Latest Products
          </button>
          <button
            onClick={() => setActiveTab("streams")}
            className={`flex-1 py-3 px-4 rounded-md font-medium transition-all duration-300 ${
              activeTab === "streams"
                ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-700"
            }`}
          >
            <Video className="w-4 h-4 inline mr-2" />
            Live Streams
            {liveStreams.length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                {liveStreams.length}
              </span>
            )}
          </button>
        </div>

        {/* Posts Tab */}
        {activeTab === "posts" && (
          <div>
            {/* Posts List */}
            <div className="space-y-4 max-w-2xl mx-auto">
              {posts.map((post) => (
                <Post key={post._id} post={post} onDelete={handleDeletePost} />
              ))}
            </div>

            {/* Load More Button */}
            {hasMore && posts.length > 0 && (
              <div className="text-center mt-6">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg"
                >
                  {loadingMore ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Loading...</span>
                    </div>
                  ) : (
                    "Load More"
                  )}
                </button>
              </div>
            )}

            {/* Empty State for Posts */}
            {posts.length === 0 && !loading && (
              <div className="text-center py-12">
                <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl p-8 max-w-md mx-auto">
                  <MessageCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-300 mb-2">
                    No posts yet
                  </h3>
                  <p className="text-gray-500">
                    Check back later for new posts!
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Products Tab */}
        {activeTab === "products" && (
          <div>
            {/* Products Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product) => (
                <div
                  key={product._id}
                  className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl overflow-hidden hover:shadow-2xl hover:shadow-purple-700/30 transition-all duration-300 hover:translate-y-[-2px] cursor-pointer group"
                  onClick={() => handleProductClick(product._id)}
                >
                  {/* Product Image */}
                  <div className="relative h-48 bg-gray-700 overflow-hidden">
                    {product.images && product.images.length > 0 ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="w-12 h-12 text-gray-500" />
                      </div>
                    )}

                    {/* Wishlist Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleWishlist(product._id);
                      }}
                      className="absolute top-2 right-2 p-2 bg-gray-900/80 rounded-full shadow-md hover:bg-gray-800 transition-colors"
                    >
                      <Heart className="w-4 h-4 text-pink-400" />
                    </button>

                    {/* View Button */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <div className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                        <Eye size={16} />
                        <span>View Details</span>
                      </div>
                    </div>
                  </div>

                  {/* Product Info */}
                  <div className="p-4">
                    <h3 className="font-semibold text-white mb-1 truncate group-hover:text-purple-300 transition-colors">
                      {product.name}
                    </h3>

                    {/* Store Name */}
                    {product.store && (
                      <p className="text-sm text-gray-400 mb-2">
                        by {product.store.name}
                      </p>
                    )}

                    {/* Rating */}
                    {product.averageRating > 0 && (
                      <div className="flex items-center mb-2">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span className="text-sm text-gray-400 ml-1">
                          {product.averageRating.toFixed(1)} (
                          {product.totalRatings})
                        </span>
                      </div>
                    )}

                    {/* Price */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg font-bold text-purple-400">
                          ₹{product.price}
                        </span>
                        {product.originalPrice > product.price && (
                          <span className="text-sm text-gray-500 line-through">
                            ₹{product.originalPrice}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Add to Cart Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToCart(product);
                      }}
                      disabled={!product.inStock}
                      className={`w-full py-2 px-4 rounded-md font-medium transition-all duration-300 ${
                        product.inStock
                          ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800 shadow-lg hover:shadow-purple-700/30"
                          : "bg-gray-700 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      {!product.inStock
                        ? "Out of Stock"
                        : isInCart(product._id)
                          ? `In Cart (${getCartItemQuantity(product._id)})`
                          : "Add to Cart"}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Empty State for Products */}
            {products.length === 0 && !productLoading && (
              <div className="text-center py-12">
                <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl p-8 max-w-md mx-auto">
                  <ShoppingBag className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-300 mb-2">
                    No products available
                  </h3>
                  <p className="text-gray-500">
                    Check back later for new products!
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Live Streams Tab */}
        {activeTab === "streams" && (
          <div>
            {/* Stream Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <Zap className="w-6 h-6 text-red-500 mr-2" />
                <h2 className="text-2xl font-bold text-white">Live Now</h2>
                <span className="ml-3 bg-red-600 text-white text-sm px-3 py-1 rounded-full animate-pulse">
                  {liveStreams.length} streams
                </span>
              </div>
              <button
                onClick={fetchLiveStreams}
                className="px-4 py-2 text-purple-400 hover:text-purple-300 font-medium border border-purple-700 rounded-lg hover:bg-purple-900/30 transition-all duration-300"
              >
                Refresh
              </button>
            </div>

            {streamLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
              </div>
            ) : (
              <>
                {/* Live Streams Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {liveStreams.map((stream) => (
                    <div
                      key={stream._id}
                      className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl overflow-hidden hover:shadow-2xl hover:shadow-red-700/30 transition-all duration-300 hover:translate-y-[-2px] group"
                    >
                      {/* Stream Thumbnail */}
                      <div className="relative aspect-video bg-gray-700 overflow-hidden">
                        <img
                          src={
                            stream.thumbnail || "/default-stream-thumbnail.jpg"
                          }
                          alt={stream.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            e.target.src = "/default-stream-thumbnail.jpg";
                          }}
                        />

                        {/* Live Badge */}
                        <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-lg text-xs font-bold animate-pulse flex items-center">
                          <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse"></div>
                          LIVE
                        </div>

                        {/* Viewer Count */}
                        <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded-lg text-xs flex items-center">
                          <Users size={12} className="mr-1" />
                          {stream.viewers?.length || 0}
                        </div>

                        {/* Duration */}
                        <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded-lg text-xs flex items-center">
                          <Clock size={12} className="mr-1" />
                          {formatDuration(stream.startedAt)}
                        </div>

                        {/* Play Overlay */}
                        <div
                          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-50 cursor-pointer"
                          onClick={() => handleViewStream(stream)}
                        >
                          <div className="bg-white bg-opacity-90 rounded-full p-3">
                            <Play size={24} className="text-gray-900 ml-1" />
                          </div>
                        </div>
                      </div>

                      {/* Stream Info */}
                      <div className="p-4">
                        <h3 className="font-semibold text-white mb-2 line-clamp-2 group-hover:text-red-300 transition-colors">
                          {stream.title}
                        </h3>

                        <div className="flex items-center mb-3">
                          <img
                            src={
                              stream.host?.profile?.profileImage ||
                              "/default-avatar.png"
                            }
                            alt={stream.host?.username}
                            className="w-8 h-8 rounded-full mr-2 border-2 border-gray-600"
                            onError={(e) => {
                              e.target.src = "/default-avatar.png";
                            }}
                          />
                          <span className="text-gray-400 text-sm">
                            {stream.host?.profile?.name ||
                              stream.host?.username}
                          </span>
                        </div>

                        {stream.description && (
                          <p className="text-gray-500 text-sm mb-3 line-clamp-2">
                            {stream.description}
                          </p>
                        )}

                        {/* Watch Button */}
                        <button
                          onClick={() => handleViewStream(stream)}
                          className="w-full py-2 px-4 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-md font-medium hover:from-red-700 hover:to-red-800 transition-all duration-300 shadow-lg hover:shadow-red-700/30 flex items-center justify-center"
                        >
                          <Play size={16} className="mr-2" />
                          Watch Stream
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Empty State for Streams */}
                {liveStreams.length === 0 && (
                  <div className="text-center py-12">
                    <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl p-8 max-w-md mx-auto">
                      <Video className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-gray-300 mb-2">
                        No live streams
                      </h3>
                      <p className="text-gray-500">
                        Check back later for live content!
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;
