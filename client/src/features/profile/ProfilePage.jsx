import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { API_URL as backendUrl } from "../../lib/config";
import { toast } from "../../lib/toast";
import { useSocketEvent } from "../../lib/useSocketEvent";
import { Page } from "../../components/ui";
import ProfileHeader from "./ProfileHeader";
import ProfileTabs from "./ProfileTabs";
import EditProfileModal from "./EditProfileModal";
import LoadingState from "./LoadingState";
import ErrorState from "./ErrorState";

const idOf = (v) => String(v?._id ?? v ?? "");

export default function ProfilePage() {
  const { username: paramUsername } = useParams();
  const auth = useAuth();
  const { user: currentUser, isAuthenticated } = auth;
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("posts");
  const navigate = useNavigate();
  const requestId = useRef(0);

  // /profile/me has no :username param → fall back to the signed-in user
  const username = paramUsername || currentUser?.username;
  const isOwnProfile = currentUser?.username === username;

  // GET /api/auth/profile (me, includes email) or /api/auth/profile/:username → { success, data: user }
  const fetchProfile = async () => {
    const id = ++requestId.current;
    try {
      setLoading(true);
      setLoadError("");

      const endpoint = isOwnProfile
        ? `${backendUrl}/api/auth/profile`
        : `${backendUrl}/api/auth/profile/${encodeURIComponent(username)}`;
      const response = await axios.get(endpoint, { withCredentials: true });
      if (id !== requestId.current) return;

      if (response.data.success) {
        const userData = response.data.data;
        if (!Array.isArray(userData.followers)) userData.followers = [];
        if (!Array.isArray(userData.following)) userData.following = [];
        setProfileData(userData);
      } else {
        setProfileData(null);
        setLoadError(response.data.message || "Failed to load profile");
      }
    } catch (err) {
      if (id !== requestId.current) return;
      console.error("Error fetching profile:", err);
      setProfileData(null);
      setLoadError(err.response?.data?.message || "Failed to load profile");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (username) {
      setActiveTab("posts");
      setProfileData(null);
      fetchProfile();
    } else if (!isAuthenticated) {
      navigate("/login");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, isAuthenticated, navigate]);

  // Children report outcomes through setSuccess / setError → surface them as toasts
  useEffect(() => {
    if (success) {
      toast.success(success);
      setSuccess("");
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      setError("");
    }
  }, [error]);

  // Profile edits go through AuthContext.updateProfile(), which already stores the fresh user;
  // setUser here just keeps the sidebar in sync if a caller hands us a user some other way.
  const handleUserUpdated = (freshUser) => {
    if (!freshUser) return;
    setProfileData((prev) => ({ ...prev, ...freshUser }));
    if (freshUser._id && freshUser._id === currentUser?._id) auth.setUser?.(freshUser);
  };

  const handlePostDeleted = (postId) =>
    setProfileData((prev) => {
      const posts = prev?.posts || [];
      if (!posts.some((p) => idOf(p) === String(postId))) return prev;
      return { ...prev, posts: posts.filter((p) => idOf(p) !== String(postId)) };
    });

  // Realtime follows: patch the shown profile's followers (it was followed) or following
  // (it did the following). The follower id is added to / removed from `followers`, so the
  // Follow button (derived from it) stays in sync with follows made in other tabs/pages.
  useSocketEvent("follow:updated", (e = {}) => {
    setProfileData((prev) => {
      if (!prev) return prev;
      let next = prev;
      const isTarget =
        idOf(prev) === String(e.targetId) || (e.targetUsername && prev.username === e.targetUsername);
      const isFollower =
        idOf(prev) === String(e.followerId) || (e.followerUsername && prev.username === e.followerUsername);
      if (isTarget) {
        const others = (Array.isArray(prev.followers) ? prev.followers : []).filter(
          (f) => idOf(f) !== String(e.followerId),
        );
        next = {
          ...next,
          followers: e.followed ? [...others, e.followerId] : others,
          followersCount: typeof e.followersCount === "number" ? e.followersCount : undefined,
        };
      }
      if (isFollower) {
        const others = (Array.isArray(prev.following) ? prev.following : []).filter(
          (f) => idOf(f) !== String(e.targetId),
        );
        next = {
          ...next,
          following: e.followed ? [...others, e.targetId] : others,
          followingCount: typeof e.followingCount === "number" ? e.followingCount : undefined,
        };
      }
      return next;
    });
  });

  // Realtime posts: keep the header's post count in step
  useSocketEvent("post:created", ({ post } = {}) => {
    if (!post?._id) return;
    setProfileData((prev) => {
      if (!prev || idOf(post.author) !== idOf(prev)) return prev;
      const posts = prev.posts || [];
      return posts.some((p) => idOf(p) === String(post._id)) ? prev : { ...prev, posts: [...posts, post._id] };
    });
  });

  useSocketEvent("post:deleted", ({ postId } = {}) => {
    if (postId) handlePostDeleted(postId);
  });

  if (loading && !profileData) {
    return (
      <Page>
        <LoadingState />
      </Page>
    );
  }

  if (!profileData) {
    return (
      <Page>
        <ErrorState
          error={loadError || "The profile you're looking for doesn't exist or has been removed."}
          notFound={!loadError || /not found/i.test(loadError)}
          onRetry={fetchProfile}
        />
      </Page>
    );
  }

  return (
    <Page>
      <ProfileHeader
        profileData={profileData}
        isOwnProfile={isOwnProfile}
        uploadingImage={uploadingImage}
        setUploadingImage={setUploadingImage}
        setSuccess={setSuccess}
        setError={setError}
        setProfileData={setProfileData}
        setIsEditing={setIsEditing}
        currentUserId={currentUser?._id}
        onUserUpdated={handleUserUpdated}
        onStatClick={setActiveTab}
      />

      <ProfileTabs
        profileData={profileData}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOwnProfile={isOwnProfile}
        onPostDeleted={handlePostDeleted}
      />

      {isEditing && (
        <EditProfileModal
          profileData={profileData}
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          updating={updating}
          setUpdating={setUpdating}
          setSuccess={setSuccess}
          setError={setError}
          setProfileData={setProfileData}
          onUserUpdated={handleUserUpdated}
        />
      )}
    </Page>
  );
}
