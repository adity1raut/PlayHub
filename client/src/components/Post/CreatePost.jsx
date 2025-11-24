import React, { useState, useRef } from "react";
import { Image, Video, X, User, PlusCircle, Sparkles } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";

const CreatePost = ({ onPostCreated }) => {
  const [content, setContent] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef();
  const { user } = useAuth();

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }

      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(file);
      toast.success("Media file selected!");
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast.info("Media file removed");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) {
      toast.error("Please write something before posting!");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("content", content);
      if (selectedFile) {
        formData.append("media", selectedFile);
      }

      const res = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/api/posts/create`,
        formData,
        {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" },
        },
      );

      if (res.data.success) {
        setContent("");
        removeFile();
        if (onPostCreated) onPostCreated(res.data.post);
        toast.success("Post created successfully! 🎉");
      }
    } catch (error) {
      console.error("Error creating post:", error);
      toast.error("Failed to create post. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl overflow-hidden mb-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-800 to-purple-900 px-6 py-4 border-b border-gray-700">
        <div className="flex items-center justify-center">
          <PlusCircle className="w-5 h-5 text-purple-400 mr-2" />
          <h2 className="text-lg font-bold text-white">Create New Post</h2>
          <Sparkles className="w-5 h-5 text-purple-400 ml-2" />
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6">
        <div className="flex items-start space-x-4">
          {/* User Avatar */}
          <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-purple-700 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
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

          <div className="flex-1">
            {/* Text Area */}
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind? Share your thoughts..."
              className="w-full p-4 bg-gray-700 border border-gray-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-400 transition-colors"
              rows="4"
            />

            {/* Media Preview */}
            {preview && (
              <div className="mt-4 relative">
                <button
                  type="button"
                  onClick={removeFile}
                  className="absolute top-3 right-3 bg-red-600 text-white rounded-full p-2 hover:bg-red-700 z-10 transition-colors shadow-lg"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="bg-gray-900 rounded-lg p-2 border border-gray-600">
                  {selectedFile?.type.startsWith("video/") ? (
                    <video
                      src={preview}
                      className="w-full max-h-64 object-cover rounded-lg"
                      controls
                    />
                  ) : (
                    <img
                      src={preview}
                      alt="Preview"
                      className="w-full max-h-64 object-cover rounded-lg"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-between items-center mt-4">
              <div className="flex space-x-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {/* Photo Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative px-4 py-2 bg-gradient-to-r from-blue-900/70 to-blue-800/70 text-blue-100 rounded-lg transition-all duration-300 shadow-md hover:shadow-blue-700/30 hover:translate-y-[-1px] overflow-hidden"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-blue-800/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                  <span className="relative flex items-center gap-2">
                    <Image className="w-4 h-4 text-blue-300" />
                    <span className="text-sm font-medium">Photo</span>
                  </span>
                </button>

                {/* Video Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative px-4 py-2 bg-gradient-to-r from-green-900/70 to-green-800/70 text-green-100 rounded-lg transition-all duration-300 shadow-md hover:shadow-green-700/30 hover:translate-y-[-1px] overflow-hidden"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-green-600/20 to-green-800/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                  <span className="relative flex items-center gap-2">
                    <Video className="w-4 h-4 text-green-300" />
                    <span className="text-sm font-medium">Video</span>
                  </span>
                </button>
              </div>

              {/* Post Button */}
              <button
                type="submit"
                disabled={!content.trim() || isSubmitting}
                className="group relative px-8 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg transition-all duration-300 shadow-lg hover:shadow-purple-700/30 hover:translate-y-[-1px] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none overflow-hidden"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-purple-700/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                <span className="relative flex items-center gap-2 font-medium">
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Posting...</span>
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-4 h-4" />
                      <span>Post</span>
                    </>
                  )}
                </span>
              </button>
            </div>

            {/* Character Count & File Info */}
            <div className="flex justify-between items-center mt-3 text-sm text-gray-500">
              <div className="flex items-center gap-4">
                <span
                  className={`${content.length > 280 ? "text-red-400" : "text-gray-400"}`}
                >
                  {content.length}/500 characters
                </span>
                {selectedFile && (
                  <span className="text-purple-400">
                    📎 {selectedFile.name.substring(0, 20)}
                    {selectedFile.name.length > 20 ? "..." : ""}
                  </span>
                )}
              </div>

              {/* Tips */}
              <div className="text-xs text-gray-500">
                💡 Max file size: 10MB
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CreatePost;
