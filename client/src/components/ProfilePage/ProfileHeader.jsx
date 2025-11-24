import React, { useRef } from "react";
import { Camera, Edit2, Mail, Calendar, User, Loader2 } from "lucide-react";
import axios from "axios";

const backendUrl = import.meta.env.VITE_BACKEND_URL;
import { toast } from "react-toastify";

const ProfileHeader = ({
  profileData,
  isOwnProfile,
  uploadingImage,
  setUploadingImage,
  setSuccess,
  setError,
  setProfileData,
  setIsEditing,
  currentUserId,
}) => {
  const profileImageRef = useRef(null);
  const coverImageRef = useRef(null);

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setUploadingImage(true);

    try {
      const base64 = await fileToBase64(file);
      const updateData = {
        [type === "profile" ? "profileImage" : "coverImage"]: base64,
      };

      const response = await axios.put(
        `${backendUrl}/api/auth/profile`,
        updateData,
        {
          withCredentials: true,
          headers: { "Content-Type": "application/json" },
        },
      );

      if (response.data.success) {
        const updatedUser = response.data.data;
        setProfileData(updatedUser);
        toast.success("Image uploaded successfully!");
      } else {
        toast.error(response.data.message || "Failed to upload image");
      }
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error(error.response?.data?.message || "Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
    });
  };

  const getDisplayName = () => {
    const profileName = profileData.profile?.name || "";
    return profileName || profileData.username;
  };

  // Follow button state
  const [followLoading, setFollowLoading] = React.useState(false);
  // Ensure followers is always an array
  const followersArr = Array.isArray(profileData.followers)
    ? profileData.followers
    : [];
  const [isFollowing, setIsFollowing] = React.useState(
    followersArr.some((f) => f === currentUserId),
  );
  const [followersCount, setFollowersCount] = React.useState(
    followersArr.length,
  );

  React.useEffect(() => {
    const arr = Array.isArray(profileData.followers)
      ? profileData.followers
      : [];
    setFollowersCount(arr.length);
    setIsFollowing(arr.includes(currentUserId));
  }, [profileData, currentUserId]);

  const handleFollow = async () => {
    setFollowLoading(true);
    try {
      const res = await axios.post(
        `${backendUrl}/api/auth/profile/${profileData.username}/follow`,
        {},
        { withCredentials: true },
      );
      if (res.data.success) {
        setIsFollowing(res.data.followed);
        setFollowersCount(res.data.followersCount);
        setProfileData((prev) => ({
          ...prev,
          followers: res.data.followersCount,
        }));
        toast.success(
          res.data.followed
            ? "Successfully followed!"
            : "Successfully unfollowed!",
        );
      }
    } catch (err) {
      toast.error("Failed to follow/unfollow");
    } finally {
      setFollowLoading(false);
    }
  };

  return (
    <div className=" via-black to-purple-900">
      {/* Cover Image Section */}
      <div className="relative h-80 bg-gradient-to-r from-purple-800 to-purple-900 overflow-hidden">
        {profileData.profile?.coverImage ? (
          <img
            src={profileData.profile.coverImage}
            alt="Cover"
            className="w-full h-full object-cover opacity-90"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-purple-800 to-purple-900"></div>
        )}

        <div className="absolute inset-0 bg-black bg-opacity-30"></div>

        {isOwnProfile && (
          <>
            <button
              onClick={() => coverImageRef.current?.click()}
              className="absolute bottom-4 right-4 bg-gray-800/90 backdrop-blur-sm p-3 rounded-full shadow-lg hover:bg-gray-700/90 transition-all transform hover:scale-105 border border-gray-600"
              disabled={uploadingImage}
            >
              {uploadingImage ? (
                <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
              ) : (
                <Camera className="w-5 h-5 text-purple-400" />
              )}
            </button>
            <input
              ref={coverImageRef}
              type="file"
              className="hidden"
              accept="image/*"
              onChange={(e) => handleImageUpload(e, "cover")}
              disabled={uploadingImage}
            />
          </>
        )}
      </div>

      {/* Profile Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-20">
          {/* Profile Header */}
          <div className="bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 p-6 mb-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6">
              {/* Profile Image */}
              <div className="relative group">
                <div className="w-32 h-32 rounded-full overflow-hidden ring-4 ring-purple-500 shadow-xl">
                  {profileData.profile?.profileImage ? (
                    <img
                      src={profileData.profile.profileImage}
                      alt={getDisplayName()}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-600 to-purple-700 flex items-center justify-center">
                      <User className="w-12 h-12 text-white" />
                    </div>
                  )}
                </div>
                {isOwnProfile ? (
                  <>
                    <button
                      onClick={() => profileImageRef.current?.click()}
                      className="absolute bottom-0 right-0 bg-purple-600 p-2.5 rounded-full shadow-lg hover:bg-purple-700 transition-all transform hover:scale-105 border-2 border-gray-800"
                      disabled={uploadingImage}
                    >
                      {uploadingImage ? (
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      ) : (
                        <Camera className="w-4 h-4 text-white" />
                      )}
                    </button>
                    <input
                      ref={profileImageRef}
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, "profile")}
                      disabled={uploadingImage}
                    />
                  </>
                ) : (
                  <button
                    onClick={handleFollow}
                    className={`absolute bottom-0 right-0 px-4 py-2 rounded-full shadow-lg text-white font-semibold transition-all transform hover:scale-105 border-2 border-gray-800 ${
                      isFollowing
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-blue-600 hover:bg-blue-700"
                    } ${followLoading ? "opacity-60 cursor-not-allowed" : ""}`}
                    disabled={followLoading}
                  >
                    {followLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isFollowing ? (
                      "Unfollow"
                    ) : (
                      "Follow"
                    )}
                  </button>
                )}
              </div>

              {/* Profile Info */}
              <div className="flex-1 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4">
                  <div>
                    <h1 className="text-3xl font-bold text-white mb-1">
                      {getDisplayName()}
                    </h1>
                    <p className="text-gray-400 mb-3">
                      @{profileData.username}
                    </p>
                    <p className="text-gray-300 max-w-lg">
                      {profileData.profile?.bio || "No bio yet"}
                    </p>
                  </div>
                  {isOwnProfile && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="group relative px-6 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-full font-medium transition-all duration-300 shadow-lg hover:shadow-purple-700/30 hover:translate-y-[-1px] overflow-hidden"
                    >
                      <span className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-purple-700/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                      <span className="relative flex items-center gap-2">
                        <Edit2 className="w-4 h-4" />
                        Edit Profile
                      </span>
                    </button>
                  )}
                </div>

                {/* Stats */}
                <div className="flex flex-wrap gap-6 mt-6 justify-center sm:justify-start">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-400">
                      {profileData.posts?.length || 0}
                    </p>
                    <p className="text-gray-400 text-sm">Posts</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-400">
                      {followersCount}
                    </p>
                    <p className="text-gray-400 text-sm">Followers</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-400">
                      {profileData.following?.length || 0}
                    </p>
                    <p className="text-gray-400 text-sm">Following</p>
                  </div>
                </div>

                {/* Meta Info */}
                <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-400 justify-center sm:justify-start">
                  {profileData.email && (
                    <span className="flex items-center gap-1 bg-gray-700/50 px-3 py-1 rounded-full">
                      <Mail className="w-4 h-4 text-purple-400" />
                      {profileData.email}
                    </span>
                  )}
                  {profileData.createdAt && (
                    <span className="flex items-center gap-1 bg-gray-700/50 px-3 py-1 rounded-full">
                      <Calendar className="w-4 h-4 text-purple-400" />
                      Joined {formatDate(profileData.createdAt)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileHeader;
