import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAuth } from "../../../context/AuthContext";
import io from "socket.io-client";
import Sidebar from "./Sidebar";
import ChatArea from "./ChatArea";
import WelcomeScreen from "./WelcomeScreen";

const ChatApplication = () => {
  const { user } = useAuth();
  const [activeView, setActiveView] = useState("conversations");
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("username");
  const [messageInput, setMessageInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [socket, setSocket] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const messagesEndRef = useRef(null);

  // Socket initialization
  useEffect(() => {
    const newSocket = io(import.meta.env.VITE_BACKEND_URL, {
      withCredentials: true,
      auth: {
        token: document.cookie
          .split("; ")
          .find((row) => row.startsWith("token="))
          ?.split("=")[1],
      },
    });

    setSocket(newSocket);
    return () => newSocket.close();
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on("new-message", (message) => {
      setMessages((prev) => [...prev, message]);
      setConversations((prev) =>
        prev.map((conv) =>
          conv._id === message.conversation
            ? { ...conv, lastMessage: message }
            : conv,
        ),
      );
    });

    socket.on("conversation-updated", (updatedConversation) => {
      setConversations((prev) =>
        prev.map((conv) =>
          conv._id === updatedConversation._id ? updatedConversation : conv,
        ),
      );
    });

    socket.on("user-typing", (data) => {
      setTypingUsers((prev) => ({
        ...prev,
        [data.conversationId]: [
          ...(prev[data.conversationId] || []).filter(
            (id) => id !== data.userId,
          ),
          data.userId,
        ],
      }));
    });

    socket.on("user-stop-typing", (data) => {
      setTypingUsers((prev) => ({
        ...prev,
        [data.conversationId]: (prev[data.conversationId] || []).filter(
          (id) => id !== data.userId,
        ),
      }));
    });

    socket.on("message-read", (data) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === data.messageId
            ? {
                ...msg,
                readBy: [
                  ...(msg.readBy || []),
                  { user: data.userId, readAt: new Date() },
                ],
              }
            : msg,
        ),
      );
    });

    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });

    return () => {
      socket.off("new-message");
      socket.off("conversation-updated");
      socket.off("user-typing");
      socket.off("user-stop-typing");
      socket.off("message-read");
      socket.off("error");
    };
  }, [socket]);

  // Fetch conversations on component mount
  useEffect(() => {
    fetchConversations();
  }, []);

  // Join conversation rooms when socket is ready
  useEffect(() => {
    if (socket && conversations.length > 0) {
      conversations.forEach((conv) => {
        socket.emit("join-conversation", conv._id);
      });
    }
  }, [socket, conversations]);

  // Join current conversation room when it changes
  useEffect(() => {
    if (socket && currentConversation) {
      socket.emit("join-conversation", currentConversation._id);
    }

    return () => {
      if (socket && currentConversation) {
        socket.emit("leave-conversation", currentConversation._id);
      }
    };
  }, [socket, currentConversation]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Fetch all conversations
  const fetchConversations = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/api/chat/conversations`,
        {
          withCredentials: true,
        },
      );
      if (response.data.success) {
        setConversations(response.data.conversations);
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
    }
  };

  // Search users
  const searchUsers = async (query) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/api/chat/search`,
        {
          params: { query, type: searchType },
          withCredentials: true,
        },
      );
      if (response.data.success) {
        setSearchResults(response.data.users);
      }
    } catch (error) {
      console.error("Error searching users:", error);
    }
    setLoading(false);
  };

  // Handle search input change with debouncing
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (activeView === "search") {
        searchUsers(searchQuery);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, searchType, activeView]);

  // Create or get conversation with a user
  const startConversation = async (userId) => {
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/api/chat/conversations`,
        { userId },
        { withCredentials: true },
      );
      if (response.data.success) {
        const conversation = response.data.conversation;
        setCurrentConversation(conversation);
        fetchMessages(conversation._id);
        setActiveView("chat");
        fetchConversations();
      }
    } catch (error) {
      console.error("Error creating conversation:", error);
    }
  };

  // Fetch messages for a conversation
  const fetchMessages = async (conversationId) => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/api/chat/conversations/${conversationId}/messages`,
        {
          withCredentials: true,
        },
      );
      if (response.data.success) {
        setMessages(response.data.messages);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  // Send a message
  const sendMessage = async () => {
    if (!messageInput.trim() || !currentConversation || !socket) return;

    try {
      socket.emit("send-message", {
        conversationId: currentConversation._id,
        content: messageInput.trim(),
        type: "text",
      });

      setMessageInput("");
      socket.emit("typing-stop", currentConversation._id);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // Handle typing indicators
  const handleTypingStart = () => {
    if (socket && currentConversation) {
      socket.emit("typing-start", currentConversation._id);
    }
  };

  const handleTypingStop = () => {
    if (socket && currentConversation) {
      socket.emit("typing-stop", currentConversation._id);
    }
  };

  // Mark messages as read
  const markMessagesAsRead = () => {
    if (socket && currentConversation && messages.length > 0) {
      const unreadMessages = messages.filter(
        (msg) =>
          msg.sender._id !== user._id &&
          !msg.readBy?.some((read) => read.user === user._id),
      );

      unreadMessages.forEach((msg) => {
        socket.emit("mark-as-read", {
          messageId: msg._id,
          conversationId: currentConversation._id,
        });
      });
    }
  };

  // Mark messages as read when opening conversation
  useEffect(() => {
    if (currentConversation) {
      markMessagesAsRead();
    }
  }, [currentConversation, messages]);

  // Open conversation from list
  const openConversation = (conversation) => {
    setCurrentConversation(conversation);
    fetchMessages(conversation._id);
    setActiveView("chat");
  };

  // Get other user in conversation
  const getOtherUser = (conversation) => {
    return conversation.members.find((member) => member._id !== user._id);
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Handle input change with typing indicators
  const handleInputChange = (e) => {
    setMessageInput(e.target.value);

    if (e.target.value.trim() && socket && currentConversation) {
      handleTypingStart();
    } else {
      handleTypingStop();
    }
  };

  // Check if user is typing in current conversation
  const isUserTyping =
    currentConversation &&
    typingUsers[currentConversation._id] &&
    typingUsers[currentConversation._id].length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 text-white flex items-center justify-center pt-24 pb-4">
      <div className="w-[90vw] h-[90vh] bg-gradient-to-br from-gray-900/95 via-black/90 to-purple-900/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-purple-500/20 overflow-hidden relative">
        {/* Animated background effects */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-transparent to-pink-600/10 animate-pulse"></div>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 animate-pulse"></div>

        <div className="flex h-full relative z-10 text-white">
          <Sidebar
            activeView={activeView}
            setActiveView={setActiveView}
            conversations={conversations}
            searchResults={searchResults}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchType={searchType}
            setSearchType={setSearchType}
            loading={loading}
            user={user}
            openConversation={openConversation}
            startConversation={startConversation}
            getOtherUser={getOtherUser}
            formatTime={formatTime}
          />

          <div className="flex-1 flex flex-col">
            {activeView === "chat" && currentConversation ? (
              <ChatArea
                currentConversation={currentConversation}
                messages={messages}
                messageInput={messageInput}
                user={user}
                isUserTyping={isUserTyping}
                messagesEndRef={messagesEndRef}
                setActiveView={setActiveView}
                getOtherUser={getOtherUser}
                formatTime={formatTime}
                handleInputChange={handleInputChange}
                handleKeyPress={handleKeyPress}
                handleTypingStop={handleTypingStop}
                sendMessage={sendMessage}
              />
            ) : (
              <WelcomeScreen />
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(75, 85, 99, 0.3);
          border-radius: 10px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #9333ea, #ec4899);
          border-radius: 10px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #7c3aed, #db2777);
        }
      `}</style>
    </div>
  );
};

export default ChatApplication;
