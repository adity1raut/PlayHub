import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Users,
  Heart,
  Share2,
  Flag,
  Settings,
  Clock,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import StreamPlayer from "./StreamPlayer";
import StreamChat from "./StreamChat";
import axios from "axios";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

const StreamViewer = ({ stream: initialStream, onBack }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [stream, setStream] = useState(initialStream || null);
  const [hasJoined, setHasJoined] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [loading, setLoading] = useState(!initialStream);
  const [error, setError] = useState(null);
  const { user, isAuthenticated } = useAuth();

  // Fetch stream data if not provided as prop
  const fetchStream = async (streamId) => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${backendUrl}/api/stream/${streamId}`, {
        headers: isAuthenticated
          ? { Authorization: `Bearer ${localStorage.getItem("token")}` }
          : {},
      });

      if (response.status === 200) {
        setStream(response.data);
        setViewerCount(response.data.viewers?.length || 0);
      }
    } catch (error) {
      console.error("Error fetching stream:", error);
      setError("Failed to load stream");
    } finally {
      setLoading(false);
    }
  };

  // Initialize stream data
  useEffect(() => {
    if (initialStream) {
      setStream(initialStream);
      setViewerCount(initialStream.viewers?.length || 0);
      setLoading(false);
    } else if (id) {
      fetchStream(id);
    }
  }, [id, initialStream, isAuthenticated]);

  // Join stream on component mount if live
  const handleJoinStream = async () => {
    if (!stream?.isLive || hasJoined || !isAuthenticated) return;

    try {
      const response = await axios.post(
        `${backendUrl}/api/stream/${stream._id}/join`,
        {},
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );
      if (response.status === 200) {
        setHasJoined(true);
        setViewerCount(response.data.viewers);
      }
    } catch (error) {
      console.error("Error joining stream:", error);
    }
  };

  // Leave stream
  const handleLeaveStream = async () => {
    if (!hasJoined || !stream) return;

    try {
      const response = await axios.post(
        `${backendUrl}/api/stream/${stream._id}/leave`,
        {},
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );
      if (response.status === 200) {
        setHasJoined(false);
        setViewerCount(response.data.viewers);
      }
    } catch (error) {
      console.error("Error leaving stream:", error);
    }
  };

  // Handle follow/unfollow
  const handleFollowToggle = async () => {
    if (!isAuthenticated) {
      alert("Please log in to follow streamers");
      return;
    }

    setLoading(true);
    try {
      // This would be your follow/unfollow API endpoint
      const endpoint = isFollowing ? "unfollow" : "follow";
      const response = await axios.post(
        `${backendUrl}/api/users/${stream.host._id}/${endpoint}`,
        {},
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );

      if (response.status === 200) {
        setIsFollowing(!isFollowing);
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
    } finally {
      setLoading(false);
    }
  };

  // Share stream
  const handleShare = async (platform) => {
    const streamUrl = `${window.location.origin}/stream/${stream._id}`;
    const shareText = `Check out "${stream.title}" by ${stream.host?.username}`;

    switch (platform) {
      case "copy":
        try {
          await navigator.clipboard.writeText(streamUrl);
          alert("Link copied to clipboard!");
        } catch (error) {
          console.error("Failed to copy:", error);
        }
        break;
      case "twitter":
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(streamUrl)}`,
        );
        break;
      case "facebook":
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(streamUrl)}`,
        );
        break;
      default:
        break;
    }
    setShowShareMenu(false);
  };

  // Report stream
  const handleReport = () => {
    if (!isAuthenticated) {
      alert("Please log in to report content");
      return;
    }
    // Implement report functionality
    alert("Report functionality would be implemented here");
  };

  // Format duration
  const formatDuration = (start, end) => {
    if (!start) return "0m";
    const duration = end
      ? new Date(end) - new Date(start)
      : Date.now() - new Date(start);
    const minutes = Math.floor(duration / 1000 / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  // Handle back navigation
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate("/streams");
    }
  };

  // Auto-join on mount
  useEffect(() => {
    if (isAuthenticated && stream?.isLive) {
      handleJoinStream();
    }

    // Cleanup: leave stream on unmount
    return () => {
      if (hasJoined) {
        handleLeaveStream();
      }
    };
  }, [stream, isAuthenticated]);

  // Refresh stream data periodically
  useEffect(() => {
    if (!stream?.isLive) return;

    const interval = setInterval(async () => {
      try {
        const response = await axios.get(
          `${backendUrl}/api/stream/${stream._id}`,
          {
            headers: isAuthenticated
              ? { Authorization: `Bearer ${localStorage.getItem("token")}` }
              : {},
          },
        );
        if (response.status === 200) {
          setStream(response.data);
          setViewerCount(response.data.viewers?.length || 0);
        }
      } catch (error) {
        console.error("Error refreshing stream:", error);
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [stream?._id, stream?.isLive, isAuthenticated]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading stream...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !stream) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Stream Not Found
          </h2>
          <p className="text-gray-600 mb-4">
            {error ||
              "The stream you're looking for doesn't exist or has been removed."}
          </p>
          <button
            onClick={handleBack}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Back to Streams
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-md shadow-xl border-b border-white/20 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <button
                onClick={handleBack}
                className="flex items-center text-white/90 hover:text-purple-300 transition-all duration-200 font-medium group"
              >
                <ArrowLeft
                  size={20}
                  className="mr-2 group-hover:-translate-x-1 transition-transform"
                />
                Back
              </button>

              <div className="border-l border-white/30 pl-6">
                <h1 className="text-2xl font-bold text-white truncate max-w-md mb-1">
                  {stream.title}
                </h1>
                <div className="flex items-center text-sm text-white/80 space-x-4">
                  <span className="font-medium">{stream.host?.username}</span>
                  <span className="flex items-center bg-purple-500/20 backdrop-blur-sm px-3 py-1 rounded-full border border-purple-400/30">
                    <Users size={14} className="mr-1 text-purple-300" />
                    <span className="font-medium text-purple-200">
                      {viewerCount}
                    </span>
                  </span>
                  {stream.startedAt && (
                    <span className="flex items-center bg-emerald-500/20 backdrop-blur-sm px-3 py-1 rounded-full border border-emerald-400/30">
                      <Clock size={14} className="mr-1 text-emerald-300" />
                      <span className="font-medium text-emerald-200">
                        {formatDuration(stream.startedAt, stream.endedAt)}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* Live Status */}
              {stream.isLive && (
                <span className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg animate-pulse border border-red-400/50">
                  <span className="inline-block w-2 h-2 bg-white rounded-full mr-2 animate-ping"></span>
                  LIVE
                </span>
              )}

              {/* Follow Button */}
              {isAuthenticated && stream.host?._id !== user?._id && (
                <button
                  onClick={handleFollowToggle}
                  disabled={loading}
                  className={`px-6 py-2.5 rounded-full font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 border ${
                    isFollowing
                      ? "bg-white/10 backdrop-blur-sm text-white border-white/30 hover:bg-white/20"
                      : "bg-gradient-to-r from-purple-500 to-pink-500 text-white border-purple-400/50 hover:from-purple-600 hover:to-pink-600"
                  } disabled:opacity-50 disabled:transform-none`}
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Heart
                        size={16}
                        className={`inline mr-2 ${isFollowing ? "fill-current" : ""}`}
                      />
                      {isFollowing ? "Following" : "Follow"}
                    </>
                  )}
                </button>
              )}

              {/* Share Button */}
              <div className="relative">
                <button
                  onClick={() => setShowShareMenu(!showShareMenu)}
                  className="p-3 text-white/90 hover:text-purple-300 hover:bg-white/10 rounded-full transition-all duration-200 shadow-lg hover:shadow-xl backdrop-blur-sm border border-white/20"
                >
                  <Share2 size={20} />
                </button>

                {showShareMenu && (
                  <div className="absolute right-0 mt-3 w-56 bg-slate-800/95 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 z-50 overflow-hidden">
                    <div className="py-2">
                      <button
                        onClick={() => handleShare("copy")}
                        className="w-full text-left px-6 py-3 text-white hover:bg-purple-500/20 hover:text-purple-300 transition-all duration-200 font-medium"
                      >
                        📋 Copy Link
                      </button>
                      <button
                        onClick={() => handleShare("twitter")}
                        className="w-full text-left px-6 py-3 text-white hover:bg-purple-500/20 hover:text-purple-300 transition-all duration-200 font-medium"
                      >
                        🐦 Share on Twitter
                      </button>
                      <button
                        onClick={() => handleShare("facebook")}
                        className="w-full text-left px-6 py-3 text-white hover:bg-purple-500/20 hover:text-purple-300 transition-all duration-200 font-medium"
                      >
                        📘 Share on Facebook
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Report Button */}
              <button
                onClick={handleReport}
                className="p-3 text-white/90 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all duration-200 shadow-lg hover:shadow-xl backdrop-blur-sm border border-white/20"
                title="Report Stream"
              >
                <Flag size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Video Player - Takes 3 columns on large screens */}
          <div className="lg:col-span-3 space-y-8">
            <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden border border-white/10">
              <StreamPlayer stream={stream} className="aspect-video" />
            </div>

            {/* Stream Info */}
            <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/10">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center space-x-6">
                  <div className="relative">
                    <img
                      src={
                        stream.host?.profile?.profileImage ||
                        "/default-avatar.png"
                      }
                      alt={stream.host?.username}
                      className="w-16 h-16 rounded-full border-4 border-purple-400/50 shadow-xl"
                      onError={(e) => {
                        e.target.src = "/default-avatar.png";
                      }}
                    />
                    {stream.isLive && (
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-3 border-slate-800 rounded-full animate-pulse shadow-lg"></div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-xl text-white mb-1">
                      {stream.host?.profile?.name || stream.host?.username}
                    </h3>
                    <p className="text-purple-300 font-medium">
                      @{stream.host?.username}
                    </p>
                  </div>
                </div>

                <div className="text-right bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-sm p-6 rounded-xl border border-purple-400/30 shadow-lg">
                  <div className="text-3xl font-bold text-purple-300 mb-1">
                    {viewerCount}
                  </div>
                  <div className="text-sm text-purple-400 font-medium">
                    {viewerCount === 1 ? "viewer" : "viewers"}
                  </div>
                </div>
              </div>

              <div className="border-t border-white/20 pt-6">
                <h4 className="font-bold text-lg mb-3 text-white">
                  About this stream
                </h4>
                <p className="text-slate-300 leading-relaxed text-base">
                  {stream.description ||
                    "No description provided for this stream."}
                </p>

                {stream.startedAt && (
                  <div className="mt-6 p-4 bg-slate-700/40 backdrop-blur-sm rounded-xl border border-white/10">
                    <div className="text-sm text-slate-400">
                      <span className="font-medium text-white">Started:</span>{" "}
                      {new Date(stream.startedAt).toLocaleString()}
                      {stream.endedAt && (
                        <>
                          <br />
                          <span className="font-medium text-white">
                            Ended:
                          </span>{" "}
                          {new Date(stream.endedAt).toLocaleString()}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chat Sidebar - Takes 1 column on large screens */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl shadow-2xl border border-white/10 overflow-hidden">
              <StreamChat
                streamId={stream._id}
                messages={stream.liveChat || []}
                isLive={stream.isLive}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Click outside to close share menu */}
      {showShareMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowShareMenu(false)}
        />
      )}
    </div>
  );
};

export default StreamViewer;
