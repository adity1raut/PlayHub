import React, { useState, useEffect } from "react";
import {
  BarChart3,
  Users,
  MessageCircle,
  Clock,
  TrendingUp,
  Eye,
  X,
} from "lucide-react";
import axios from "axios";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

const StreamAnalytics = ({ streamId, isOpen, onClose }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(
        `${backendUrl}/api/stream/${streamId}/analytics`,
      );
      if (response.status === 200) {
        setAnalytics(response.data);
      }
    } catch (error) {
      setError("Failed to load analytics data");
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && streamId) {
      fetchAnalytics();
    }
  }, [isOpen, streamId]);

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getEngagementRate = () => {
    if (!analytics) return 0;
    const { totalViewers, totalMessages } = analytics.analytics;
    if (totalViewers === 0) return 0;
    return ((totalMessages / totalViewers) * 100).toFixed(1);
  };

  const getPerformanceRating = () => {
    if (!analytics) return "N/A";
    const { totalViewers, duration } = analytics.analytics;

    if (totalViewers > 100 && duration > 60) return "Excellent";
    if (totalViewers > 50 && duration > 30) return "Good";
    if (totalViewers > 10 && duration > 15) return "Fair";
    return "Needs Improvement";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed pt-40 inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <div className="flex items-center space-x-3">
            <BarChart3 size={24} className="text-blue-500" />
            <div>
              <h2 className="text-xl font-bold">Stream Analytics</h2>
              {analytics && (
                <p className="text-gray-600 text-sm">{analytics.stream}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-3">Loading analytics...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-500 mb-4">⚠️</div>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={fetchAnalytics}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Try Again
              </button>
            </div>
          ) : analytics ? (
            <div className="space-y-6">
              {/* Key Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-600 text-sm font-medium">
                        Total Viewers
                      </p>
                      <p className="text-2xl font-bold text-blue-700">
                        {analytics.analytics.totalViewers}
                      </p>
                    </div>
                    <Users className="text-blue-500" size={24} />
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-600 text-sm font-medium">
                        Messages
                      </p>
                      <p className="text-2xl font-bold text-green-700">
                        {analytics.analytics.totalMessages}
                      </p>
                    </div>
                    <MessageCircle className="text-green-500" size={24} />
                  </div>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-600 text-sm font-medium">
                        Duration
                      </p>
                      <p className="text-2xl font-bold text-purple-700">
                        {formatDuration(analytics.analytics.duration)}
                      </p>
                    </div>
                    <Clock className="text-purple-500" size={24} />
                  </div>
                </div>

                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-orange-600 text-sm font-medium">
                        Engagement
                      </p>
                      <p className="text-2xl font-bold text-orange-700">
                        {getEngagementRate()}%
                      </p>
                    </div>
                    <TrendingUp className="text-orange-500" size={24} />
                  </div>
                </div>
              </div>

              {/* Stream Status */}
              <div className="bg-white border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Eye className="mr-2" size={20} />
                  Stream Status
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Status:</span>
                        <span
                          className={`font-medium ${
                            analytics.analytics.isLive
                              ? "text-green-600"
                              : "text-gray-600"
                          }`}
                        >
                          {analytics.analytics.isLive ? "Live" : "Ended"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Started:</span>
                        <span className="font-medium">
                          {formatDate(analytics.analytics.startedAt)}
                        </span>
                      </div>
                      {analytics.analytics.endedAt && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Ended:</span>
                          <span className="font-medium">
                            {formatDate(analytics.analytics.endedAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Performance:</span>
                        <span className="font-medium text-blue-600">
                          {getPerformanceRating()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">
                          Avg. Messages/Viewer:
                        </span>
                        <span className="font-medium">
                          {analytics.analytics.totalViewers > 0
                            ? (
                                analytics.analytics.totalMessages /
                                analytics.analytics.totalViewers
                              ).toFixed(1)
                            : "0"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Stream Duration:</span>
                        <span className="font-medium">
                          {formatDuration(analytics.analytics.duration)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Engagement Insights */}
              <div className="bg-white border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">
                  Engagement Insights
                </h3>
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded">
                    <h4 className="font-medium mb-2">Chat Activity</h4>
                    <p className="text-sm text-gray-600">
                      Your stream had {analytics.analytics.totalMessages}{" "}
                      messages from viewers, showing {getEngagementRate()}%
                      engagement rate.
                    </p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded">
                    <h4 className="font-medium mb-2">Viewership</h4>
                    <p className="text-sm text-gray-600">
                      {analytics.analytics.totalViewers} unique viewers joined
                      your stream over{" "}
                      {formatDuration(analytics.analytics.duration)}.
                    </p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded">
                    <h4 className="font-medium mb-2">Recommendations</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {analytics.analytics.totalViewers < 10 && (
                        <li>
                          • Try streaming at different times to reach more
                          viewers
                        </li>
                      )}
                      {getEngagementRate() < 5 && (
                        <li>
                          • Encourage more chat interaction to boost engagement
                        </li>
                      )}
                      {analytics.analytics.duration < 30 && (
                        <li>
                          • Consider longer streaming sessions for better
                          discovery
                        </li>
                      )}
                      {analytics.analytics.totalMessages < 5 && (
                        <li>
                          • Ask questions to encourage viewer participation
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Export Options */}
              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-sm text-gray-500">
                  Analytics generated on {new Date().toLocaleString()}
                </div>
                <div className="space-x-3">
                  <button
                    onClick={() => {
                      // Implement export to CSV
                      console.log("Export to CSV");
                    }}
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={fetchAnalytics}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Refresh Data
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default StreamAnalytics;
