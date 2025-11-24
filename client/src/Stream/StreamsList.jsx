import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import CreateStreamModal from "./CreateStreamModal";
import StreamAnalytics from "./StreamAnalytics";
import axios from "axios";

const backendUrl = import.meta.env.VITE_BACKEND_URL;
import {
  Play,
  Plus,
  Users,
  Clock,
  Eye,
  BarChart3,
  Search,
  Grid,
  List,
  Gamepad2,
  Video,
  Zap,
} from "lucide-react";

const StreamsList = () => {
  const [streams, setStreams] = useState([]);
  const [myStreams, setMyStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [selectedStreamId, setSelectedStreamId] = useState(null);
  const [activeTab, setActiveTab] = useState("live"); // 'live', 'my-streams'
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // 'grid', 'list'

  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Fetch live streams
  const fetchLiveStreams = async () => {
    try {
      const response = await axios.get(`${backendUrl}/api/stream/live`);
      setStreams(response.data);
    } catch (error) {
      console.error("Error fetching live streams:", error);
      setError("Failed to load live streams");
    }
  };

  // Fetch user's streams
  const fetchMyStreams = async () => {
    if (!isAuthenticated) return;

    try {
      const response = await axios.get(
        `${backendUrl}/api/stream/user/my-streams`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );
      setMyStreams(response.data);
    } catch (error) {
      console.error("Error fetching my streams:", error);
      setError("Failed to load your streams");
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        if (activeTab === "live") {
          await fetchLiveStreams();
        } else if (activeTab === "my-streams") {
          await fetchMyStreams();
        }
      } catch (error) {
        setError("Failed to load streams");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [activeTab, isAuthenticated]);

  // Refresh every 30 seconds for live streams
  useEffect(() => {
    if (activeTab === "live") {
      const interval = setInterval(fetchLiveStreams, 30000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Handle stream creation
  const handleStreamCreated = (newStream) => {
    setMyStreams((prev) => [newStream, ...prev]);
    setShowCreateModal(false);
    // Navigate to the new stream
    navigate(`/stream/${newStream._id}`);
  };

  // Handle view stream
  const handleViewStream = (stream) => {
    navigate(`/stream/${stream._id}`);
  };

  // Handle show analytics
  const handleShowAnalytics = (streamId) => {
    setSelectedStreamId(streamId);
    setShowAnalytics(true);
  };

  // Handle end stream
  const handleEndStream = async (streamId) => {
    if (!window.confirm("Are you sure you want to end this stream?")) return;

    try {
      await axios.put(
        `${backendUrl}/api/stream/${streamId}/end`,
        {},
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );

      // Refresh streams
      if (activeTab === "my-streams") {
        await fetchMyStreams();
      }
    } catch (error) {
      console.error("Error ending stream:", error);
      alert("Failed to end stream");
    }
  };

  // Filter streams based on search
  const filteredStreams = (activeTab === "live" ? streams : myStreams).filter(
    (stream) =>
      stream.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      stream.host?.username.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Format duration
  const formatDuration = (startedAt, endedAt) => {
    const start = new Date(startedAt);
    const end = endedAt ? new Date(endedAt) : new Date();
    const duration = Math.floor((end - start) / 1000 / 60);

    if (duration < 60) return `${duration}m`;
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    return `${hours}h ${minutes}m`;
  };

  // Render stream card
  const renderStreamCard = (stream) => (
    <div
      key={stream._id}
      className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-purple-600 transition-all shadow-lg"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gray-900">
        <img
          src={stream.thumbnail || "/default-stream-thumbnail.jpg"}
          alt={stream.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.target.src = "/default-stream-thumbnail.jpg";
          }}
        />

        {/* Live badge */}
        {stream.isLive && (
          <div className="absolute top-3 left-3 bg-red-500 text-white px-2 py-1 rounded-lg text-xs font-bold animate-pulse flex items-center">
            <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse"></div>
            LIVE
          </div>
        )}

        {/* Viewer count */}
        <div className="absolute bottom-3 right-3 bg-black bg-opacity-70 text-white px-2 py-1 rounded-lg text-xs flex items-center backdrop-blur-sm">
          <Users size={12} className="mr-1" />
          {stream.viewers?.length || 0}
        </div>

        {/* Play button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black bg-opacity-50">
          <button
            onClick={() => handleViewStream(stream)}
            className="bg-purple-600 hover:bg-purple-700 rounded-full p-4 transition-colors shadow-xl"
          >
            <Play size={24} className="text-white ml-1" />
          </button>
        </div>
      </div>

      {/* Stream info */}
      <div className="p-4">
        <h3 className="font-semibold text-lg mb-2 text-white line-clamp-2">
          {stream.title}
        </h3>

        <div className="flex items-center mb-3">
          <img
            src={stream.host?.profile?.profileImage || "/default-avatar.png"}
            alt={stream.host?.username}
            className="w-8 h-8 rounded-full mr-2 border-2 border-gray-600"
            onError={(e) => {
              e.target.src = "/default-avatar.png";
            }}
          />
          <span className="text-gray-300 text-sm">
            {stream.host?.profile?.name || stream.host?.username}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm text-gray-400 mb-3">
          <div className="flex items-center">
            <Clock size={14} className="mr-1" />
            {formatDuration(stream.startedAt, stream.endedAt)}
          </div>

          {activeTab === "my-streams" && (
            <div className="flex gap-2">
              <button
                onClick={() => handleShowAnalytics(stream._id)}
                className="text-purple-400 hover:text-purple-300 transition-colors"
                title="View Analytics"
              >
                <BarChart3 size={16} />
              </button>

              {stream.isLive && (
                <button
                  onClick={() => handleEndStream(stream._id)}
                  className="text-red-400 hover:text-red-300 transition-colors"
                  title="End Stream"
                >
                  ■
                </button>
              )}
            </div>
          )}
        </div>

        {stream.description && (
          <p className="text-gray-400 text-sm line-clamp-2">
            {stream.description}
          </p>
        )}
      </div>
    </div>
  );

  // Render list view
  const renderStreamList = (stream) => (
    <div
      key={stream._id}
      className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex items-center gap-4 hover:border-purple-600 transition-all shadow-lg"
    >
      {/* Thumbnail */}
      <div className="relative w-32 h-20 bg-gray-900 rounded-lg flex-shrink-0 overflow-hidden">
        <img
          src={stream.thumbnail || "/default-stream-thumbnail.jpg"}
          alt={stream.title}
          className="w-full h-full object-cover"
        />
        {stream.isLive && (
          <div className="absolute top-1 left-1 bg-red-500 text-white px-1 py-0.5 rounded text-xs font-bold">
            🔴 LIVE
          </div>
        )}
      </div>

      {/* Stream info */}
      <div className="flex-1">
        <h3 className="font-semibold text-lg mb-1 text-white">
          {stream.title}
        </h3>
        <div className="flex items-center mb-2">
          <img
            src={stream.host?.profile?.profileImage || "/default-avatar.png"}
            alt={stream.host?.username}
            className="w-6 h-6 rounded-full mr-2 border border-gray-600"
          />
          <span className="text-gray-300 text-sm">
            {stream.host?.profile?.name || stream.host?.username}
          </span>
        </div>
        {stream.description && (
          <p className="text-gray-400 text-sm line-clamp-1">
            {stream.description}
          </p>
        )}
      </div>

      {/* Stats and actions */}
      <div className="text-right">
        <div className="text-sm text-gray-400 mb-2">
          <div className="flex items-center justify-end mb-1">
            <Users size={14} className="mr-1" />
            {stream.viewers?.length || 0}
          </div>
          <div className="flex items-center justify-end">
            <Clock size={14} className="mr-1" />
            {formatDuration(stream.startedAt, stream.endedAt)}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleViewStream(stream)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg text-sm transition-colors flex items-center"
          >
            <Eye size={14} className="inline mr-1" />
            Watch
          </button>

          {activeTab === "my-streams" && (
            <>
              <button
                onClick={() => handleShowAnalytics(stream._id)}
                className="text-purple-400 hover:text-purple-300 transition-colors"
                title="Analytics"
              >
                <BarChart3 size={16} />
              </button>
              {stream.isLive && (
                <button
                  onClick={() => handleEndStream(stream._id)}
                  className="text-red-400 hover:text-red-300 transition-colors"
                  title="End Stream"
                >
                  ■
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  if (!isAuthenticated && activeTab === "my-streams") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl p-8 max-w-md mx-auto text-center">
          <Video className="h-16 w-16 text-gray-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-white mb-2">
            Authentication Required
          </h2>
          <p className="text-gray-400">Please login to manage your streams.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-900 via-black to-purple-900 p-4 pt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Header */}
        <div className="mb-8">
          <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-purple-800 to-purple-900 px-8 py-6 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Gamepad2 className="w-6 h-6 text-purple-400 mr-2" />
                  <div>
                    <h1 className="text-3xl font-bold text-white">
                      LIVE STREAMS
                    </h1>
                    <p className="text-purple-300 text-sm mt-1">
                      {activeTab === "live"
                        ? "Discover amazing live content from creators"
                        : "Manage your streaming content and analytics"}
                    </p>
                  </div>
                </div>

                {isAuthenticated && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-colors flex items-center space-x-2 shadow-lg"
                  >
                    <Zap className="h-4 w-4" />
                    <span>Start Stream</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 rounded-lg border bg-red-900 bg-opacity-20 border-red-800 text-red-300">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-lg mb-6 overflow-hidden">
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActiveTab("live")}
              className={`px-6 py-4 border-b-2 font-medium transition-colors ${
                activeTab === "live"
                  ? "border-red-500 text-red-400 bg-gray-700"
                  : "border-transparent text-gray-400 hover:text-gray-300"
              }`}
            >
              <Video className="inline w-4 h-4 mr-2" />
              Live Streams
            </button>

            {isAuthenticated && (
              <button
                onClick={() => setActiveTab("my-streams")}
                className={`px-6 py-4 border-b-2 font-medium transition-colors ${
                  activeTab === "my-streams"
                    ? "border-red-500 text-red-400 bg-gray-700"
                    : "border-transparent text-gray-400 hover:text-gray-300"
                }`}
              >
                <BarChart3 className="inline w-4 h-4 mr-2" />
                My Streams
              </button>
            )}
          </div>

          {/* Search and filters */}
          <div className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search
                  size={20}
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Search streams or creators..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent placeholder-gray-400"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-3 rounded-lg transition-colors ${
                    viewMode === "grid"
                      ? "bg-red-600 text-white"
                      : "bg-gray-700 text-gray-400 hover:text-gray-300 border border-gray-600"
                  }`}
                >
                  <Grid size={20} />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-3 rounded-lg transition-colors ${
                    viewMode === "list"
                      ? "bg-red-600 text-white"
                      : "bg-gray-700 text-gray-400 hover:text-gray-300 border border-gray-600"
                  }`}
                >
                  <List size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredStreams.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl p-8 max-w-md mx-auto">
              <Video className="h-16 w-16 text-gray-500 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-white mb-2">
                {searchTerm
                  ? "No streams found"
                  : activeTab === "live"
                    ? "No live streams"
                    : "No streams yet"}
              </h2>
              <p className="text-gray-400 mb-6">
                {searchTerm
                  ? "Try adjusting your search terms"
                  : activeTab === "live"
                    ? "Check back later for live content"
                    : "Create your first stream to get started!"}
              </p>
              {activeTab === "my-streams" && !searchTerm && isAuthenticated && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-colors flex items-center space-x-2 mx-auto shadow-lg"
                >
                  <Plus className="h-5 w-5" />
                  <span>Create Your First Stream</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                : "space-y-4"
            }
          >
            {filteredStreams.map((stream) =>
              viewMode === "grid"
                ? renderStreamCard(stream)
                : renderStreamList(stream),
            )}
          </div>
        )}

        {/* Stream Stats for My Streams */}
        {activeTab === "my-streams" && myStreams.length > 0 && (
          <div className="mt-8">
            <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-4">
                Stream Statistics
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                  <div className="text-2xl font-bold text-purple-400 mb-1">
                    {myStreams.length}
                  </div>
                  <div className="text-sm text-gray-400">Total Streams</div>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                  <div className="text-2xl font-bold text-green-400 mb-1">
                    {myStreams.filter((s) => s.isLive).length}
                  </div>
                  <div className="text-sm text-gray-400">Live Now</div>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                  <div className="text-2xl font-bold text-blue-400 mb-1">
                    {myStreams.reduce(
                      (acc, s) => acc + (s.viewers?.length || 0),
                      0,
                    )}
                  </div>
                  <div className="text-sm text-gray-400">Total Viewers</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateStreamModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onStreamCreated={handleStreamCreated}
      />

      <StreamAnalytics
        streamId={selectedStreamId}
        isOpen={showAnalytics}
        onClose={() => setShowAnalytics(false)}
      />
    </div>
  );
};

export default StreamsList;
