import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, Send, Smile } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import axios from "axios";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

const StreamChat = ({
  streamId,
  messages = [],
  onSendMessage,
  isLive = true,
}) => {
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState(messages);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const { user } = useAuth();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  useEffect(() => {
    setChatMessages(messages);
  }, [messages]);

  const handleSendMessage = async () => {
    if (!message.trim() || loading || !isLive) return;

    const tempMessage = {
      _id: "temp-" + Date.now(),
      message: message.trim(),
      sender: user,
      createdAt: new Date().toISOString(),
      isTemp: true,
    };

    // Optimistically add message
    setChatMessages((prev) => [...prev, tempMessage]);
    const currentMessage = message.trim();
    setMessage("");
    setLoading(true);

    try {
      const response = await axios.post(
        `${backendUrl}/api/stream/${streamId}/chat`,
        {
          message: currentMessage,
        },
      );

      if (response.status === 201) {
        // Replace temp message with real one
        setChatMessages((prev) =>
          prev.map((msg) =>
            msg._id === tempMessage._id ? response.data : msg,
          ),
        );
        if (onSendMessage) onSendMessage(response.data);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      // Remove temp message on error
      setChatMessages((prev) =>
        prev.filter((msg) => msg._id !== tempMessage._id),
      );
      setMessage(currentMessage); // Restore message
      alert("Failed to send message. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getUserDisplayName = (sender) => {
    if (!sender) return "Anonymous";
    return sender.profile?.name || sender.username || "Anonymous";
  };

  const getUserAvatar = (sender) => {
    return sender?.profile?.profileImage || "/default-avatar.png";
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl h-96 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-800 to-purple-900 px-4 py-3 border-b border-gray-700">
        <h3 className="font-semibold flex items-center justify-between text-white">
          <span className="flex items-center gap-2">
            <MessageCircle size={20} className="text-purple-300" />
            <span className="text-lg">Live Chat</span>
          </span>
          <span className="text-sm text-purple-200 font-normal bg-purple-900/50 px-3 py-1 rounded-full">
            {chatMessages.length} messages
          </span>
        </h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-900/50">
        {chatMessages.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <MessageCircle size={32} className="mx-auto mb-3 text-gray-600" />
              <p className="text-sm text-gray-300 mb-1">No messages yet</p>
              <p className="text-xs text-gray-500">
                Be the first to say something!
              </p>
            </div>
          </div>
        ) : (
          chatMessages.map((msg, index) => (
            <div
              key={msg._id || index}
              className={`flex gap-3 p-2 rounded-lg transition-all duration-200 hover:bg-gray-800/30 ${
                msg.isTemp ? "opacity-70" : ""
              }`}
            >
              <img
                src={getUserAvatar(msg.sender)}
                alt="Avatar"
                className="w-8 h-8 rounded-full flex-shrink-0 mt-0.5 border-2 border-gray-600"
                onError={(e) => {
                  e.target.src = "/default-avatar.png";
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm text-purple-400 truncate">
                    {getUserDisplayName(msg.sender)}
                  </span>
                  <span className="text-xs text-gray-500 flex-shrink-0 bg-gray-800 px-2 py-0.5 rounded">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-gray-200 break-words leading-relaxed">
                  {msg.message}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-gray-800 border-t border-gray-700 p-4">
        {isLive ? (
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="w-full px-4 py-3 pr-12 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-400 text-sm transition-colors"
                maxLength={500}
                disabled={loading}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-purple-400 transition-colors"
                onClick={() => {
                  // You could add emoji picker here
                  inputRef.current?.focus();
                }}
              >
                <Smile size={18} />
              </button>
            </div>
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={!message.trim() || loading}
              className="group relative px-6 py-3 bg-gradient-to-r from-purple-800 to-purple-900 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-purple-700/30 overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-purple-800/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
              <span className="relative">
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send size={18} />
                )}
              </span>
            </button>
          </div>
        ) : (
          <div className="text-center bg-gray-700/50 rounded-lg border border-gray-600 py-4">
            <p className="text-sm text-gray-400">
              Stream has ended. Chat is disabled.
            </p>
          </div>
        )}

        {message.length > 450 && (
          <div className="text-xs text-gray-500 mt-2 text-right">
            <span
              className={`${message.length > 480 ? "text-red-400" : "text-yellow-400"}`}
            >
              {message.length}/500 characters
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StreamChat;
