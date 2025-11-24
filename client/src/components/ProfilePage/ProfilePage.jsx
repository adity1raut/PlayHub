import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import ProfileHeader from "./ProfileHeader";
import ProfileTabs from "./ProfileTabs";
import EditProfileModal from "./EditProfileModal";
import LoadingState from "./LoadingState";
import ErrorState from "./ErrorState";
import { User, AlertCircle } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axios from "axios";

const backendUrl = import.meta.env.VITE_BACKEND_URL;
import GamingBackground from "../../GamingBackground/GamingBackground";

export default function ProfilePage() {
  const { username: paramUsername } = useParams();
  const { user: currentUser, isAuthenticated } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("posts");
  const navigate = useNavigate();

  // Get username from params or current user
  const username = paramUsername || currentUser?.username;
  const isOwnProfile = currentUser?.username === username;

  useEffect(() => {
    if (username) {
      fetchProfile();
    } else if (!isAuthenticated) {
      navigate("/login");
    }
  }, [username, isAuthenticated, navigate]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError("");

      const endpoint = isOwnProfile
        ? `${backendUrl}/api/auth/profile/`
        : `${backendUrl}/api/auth/profile/${username}`;
      const response = await axios.get(endpoint, { withCredentials: true });

      if (response.data.success) {
        const userData = response.data.data;
        if (!Array.isArray(userData.followers)) userData.followers = [];
        setProfileData(userData);
      } else {
        setError(response.data.message || "Failed to load profile");
        toast.error(response.data.message || "Failed to load profile");
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to load profile";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Show success/error toasts
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

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-900 via-black to-purple-900 min-h-screen flex items-center justify-center">
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
        <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl p-8 max-w-md mx-auto text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Loading Profile
          </h2>
          <p className="text-gray-400">
            Please wait while we fetch the profile data...
          </p>
        </div>
      </div>
    );
  }

  if (error && !profileData) {
    return (
      <div className="bg-gradient-to-br from-gray-900 via-black to-purple-900 min-h-screen flex items-center justify-center p-4">
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
        <div className="bg-red-900/30 border border-red-700 rounded-xl shadow-2xl p-8 max-w-md mx-auto text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-400 mb-4">
            Error Loading Profile
          </h2>
          <p className="text-red-300 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={fetchProfile}
              className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate("/")}
              className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors font-medium"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="bg-gradient-to-br from-gray-900 via-black to-purple-900 min-h-screen flex items-center justify-center p-4">
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
        <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl p-8 max-w-md mx-auto text-center">
          <User className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-4">User Not Found</h2>
          <p className="text-gray-400 mb-6">
            The profile you're looking for doesn't exist or has been removed.
          </p>
          <button
            onClick={() => navigate("/")}
            className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-2 rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all duration-300 shadow-lg hover:shadow-purple-700/30 font-medium"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-900 via-black to-purple-900 min-h-screen">
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
      />

      <div className="pb-8">
        <ProfileTabs
          profileData={profileData}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
      </div>

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
        />
      )}
    </div>
  );
}
