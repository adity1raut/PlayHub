import React from "react";
import axios from "axios";

const backendUrl = import.meta.env.VITE_BACKEND_URL;
import { Grid, Users, User, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

function UserPostsList({ username }) {
  const [posts, setPosts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    async function fetchPosts() {
      setLoading(true);
      setError("");
      try {
        const res = await axios.get(
          `${backendUrl}/api/auth/profile/${username}/posts`,
          {
            withCredentials: true,
          },
        );
        if (res.data.success) {
          setPosts(res.data.data);
        } else {
          setError(res.data.message || "Failed to fetch posts");
          toast.error(res.data.message || "Failed to fetch posts");
        }
      } catch (err) {
        setError("Failed to fetch posts");
        toast.error("Failed to fetch posts");
      } finally {
        setLoading(false);
      }
    }
    fetchPosts();
  }, [username]);

  if (loading)
    return (
      <div className="col-span-3 text-center py-12">
        <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl p-8 max-w-md mx-auto">
          <Grid className="w-12 h-12 mx-auto mb-4 text-purple-400 animate-pulse" />
          <p className="text-gray-300">Loading posts...</p>
        </div>
      </div>
    );

  if (error)
    return (
      <div className="col-span-3 text-center py-12">
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-8 max-w-md mx-auto">
          <MessageCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
          <p className="text-red-300">{error}</p>
        </div>
      </div>
    );

  if (!posts.length)
    return (
      <div className="col-span-3 text-center py-12">
        <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl p-8 max-w-md mx-auto">
          <Grid className="w-12 h-12 mx-auto mb-4 text-gray-600" />
          <p className="text-gray-400">No posts yet</p>
        </div>
      </div>
    );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {posts.map((post) => (
        <div
          key={post._id}
          className="bg-gray-800 border border-gray-700 rounded-xl hover:shadow-2xl hover:shadow-purple-700/20 transition-all duration-300 cursor-pointer flex flex-col justify-between p-6 group hover:translate-y-[-2px]"
        >
          <div className="mb-4">
            <p className="text-gray-200 font-medium text-sm leading-relaxed line-clamp-3">
              {post.content}
            </p>
          </div>

          {post.media?.url && (
            <div className="mb-4">
              {post.media.type === "image" ? (
                <img
                  src={post.media.url}
                  alt="post"
                  className="w-full h-32 object-cover rounded-lg border border-gray-600"
                />
              ) : post.media.type === "video" ? (
                <video
                  src={post.media.url}
                  controls
                  className="w-full h-32 object-cover rounded-lg border border-gray-600"
                />
              ) : null}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              {new Date(post.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <MessageCircle className="w-3 h-3" />
              <span>{post.comments?.length || 0}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function FollowersList({ username }) {
  const [followers, setFollowers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const navigate = useNavigate();

  React.useEffect(() => {
    async function fetchFollowers() {
      setLoading(true);
      setError("");
      try {
        const res = await axios.get(
          `${backendUrl}/api/auth/profile/${username}/followers`,
          {
            withCredentials: true,
          },
        );
        if (res.data.success) {
          setFollowers(res.data.data);
        } else {
          setError(res.data.message || "Failed to fetch followers");
          toast.error(res.data.message || "Failed to fetch followers");
        }
      } catch (err) {
        setError("Failed to fetch followers");
        toast.error("Failed to fetch followers");
      } finally {
        setLoading(false);
      }
    }
    fetchFollowers();
  }, [username]);

  if (loading)
    return (
      <div className="text-center py-12">
        <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl p-8 max-w-md mx-auto">
          <Users className="w-12 h-12 mx-auto mb-4 text-purple-400 animate-pulse" />
          <p className="text-gray-300">Loading followers...</p>
        </div>
      </div>
    );

  if (error)
    return (
      <div className="text-center py-12">
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-8 max-w-md mx-auto">
          <Users className="w-12 h-12 mx-auto mb-4 text-red-400" />
          <p className="text-red-300">{error}</p>
        </div>
      </div>
    );

  if (!followers.length)
    return (
      <div className="text-center py-12">
        <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl p-8 max-w-md mx-auto">
          <Users className="w-12 h-12 mx-auto mb-4 text-gray-600" />
          <p className="text-gray-400">No followers yet</p>
        </div>
      </div>
    );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
      {followers.map((f) => (
        <div
          key={f._id}
          className="bg-gray-800 border border-gray-700 rounded-xl p-6 flex items-center gap-4 shadow-lg cursor-pointer hover:bg-gray-700/50 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-700/20 hover:translate-y-[-2px]"
          onClick={() => navigate(`/profile/${f.username}`)}
        >
          <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-purple-500">
            {f.profile?.profileImage ? (
              <img
                src={f.profile.profileImage}
                alt={f.username}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-600 to-purple-700 flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-white truncate">
              {f.profile?.name || f.username}
            </div>
            <div className="text-gray-400 text-sm truncate">@{f.username}</div>
            {f.profile?.bio && (
              <div className="text-gray-500 text-xs mt-1 line-clamp-1">
                {f.profile.bio}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function FollowingList({ username }) {
  const [following, setFollowing] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const navigate = useNavigate();

  React.useEffect(() => {
    async function fetchFollowing() {
      setLoading(true);
      setError("");
      try {
        const res = await axios.get(
          `${backendUrl}/api/auth/profile/${username}/following`,
          {
            withCredentials: true,
          },
        );
        if (res.data.success) {
          setFollowing(res.data.data);
        } else {
          setError(res.data.message || "Failed to fetch following");
          toast.error(res.data.message || "Failed to fetch following");
        }
      } catch (err) {
        setError("Failed to fetch following");
        toast.error("Failed to fetch following");
      } finally {
        setLoading(false);
      }
    }
    fetchFollowing();
  }, [username]);

  if (loading)
    return (
      <div className="text-center py-12">
        <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl p-8 max-w-md mx-auto">
          <Users className="w-12 h-12 mx-auto mb-4 text-purple-400 animate-pulse" />
          <p className="text-gray-300">Loading following...</p>
        </div>
      </div>
    );

  if (error)
    return (
      <div className="text-center py-12">
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-8 max-w-md mx-auto">
          <Users className="w-12 h-12 mx-auto mb-4 text-red-400" />
          <p className="text-red-300">{error}</p>
        </div>
      </div>
    );

  if (!following.length)
    return (
      <div className="text-center py-12">
        <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl p-8 max-w-md mx-auto">
          <Users className="w-12 h-12 mx-auto mb-4 text-gray-600" />
          <p className="text-gray-400">Not following anyone yet</p>
        </div>
      </div>
    );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
      {following.map((f) => (
        <div
          key={f._id}
          className="bg-gray-800 border border-gray-700 rounded-xl p-6 flex items-center gap-4 shadow-lg cursor-pointer hover:bg-gray-700/50 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-700/20 hover:translate-y-[-2px]"
          onClick={() => navigate(`/profile/${f.username}`)}
        >
          <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-purple-500">
            {f.profile?.profileImage ? (
              <img
                src={f.profile.profileImage}
                alt={f.username}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-600 to-purple-700 flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-white truncate">
              {f.profile?.name || f.username}
            </div>
            <div className="text-gray-400 text-sm truncate">@{f.username}</div>
            {f.profile?.bio && (
              <div className="text-gray-500 text-xs mt-1 line-clamp-1">
                {f.profile.bio}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const ProfileTabs = ({ profileData, activeTab, setActiveTab }) => {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
        {/* Tab Headers */}
        <div className="bg-gradient-to-r from-purple-800 to-purple-900 border-b border-gray-700">
          <div className="flex">
            {["posts", "followers", "following"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-4 px-6 text-center font-medium transition-all duration-300 relative group ${
                  activeTab === tab
                    ? "text-white bg-gray-800/50"
                    : "text-purple-300 hover:text-white hover:bg-purple-700/30"
                }`}
              >
                <span className="capitalize font-semibold">{tab}</span>
                <span className="ml-2 text-sm opacity-75">
                  (
                  {tab === "posts"
                    ? profileData.posts?.length || 0
                    : tab === "followers"
                      ? profileData.followers?.length || 0
                      : profileData.following?.length || 0}
                  )
                </span>
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-400 to-pink-400 shadow-lg"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-8 bg-gray-900/50">
          {activeTab === "posts" && (
            <UserPostsList username={profileData.username} />
          )}
          {activeTab === "followers" && (
            <FollowersList username={profileData.username} />
          )}
          {activeTab === "following" && (
            <FollowingList username={profileData.username} />
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileTabs;
