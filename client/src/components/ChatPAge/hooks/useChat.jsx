import { useState, useEffect } from "react";
import axios from "axios";

const useChat = (socket) => {
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});

  // Fetch conversations
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

  // Create or get conversation with a user
  const startConversation = async (userId) => {
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/api/chat/conversations`,
        { userId },
        { withCredentials: true },
      );
      if (response.data.success) {
        return response.data.conversation;
      }
    } catch (error) {
      console.error("Error creating conversation:", error);
      return null;
    }
  };

  // Socket event handlers
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

    return () => {
      socket.off("new-message");
      socket.off("conversation-updated");
      socket.off("user-typing");
      socket.off("user-stop-typing");
      socket.off("message-read");
    };
  }, [socket]);

  return {
    conversations,
    setConversations,
    messages,
    setMessages,
    typingUsers,
    fetchConversations,
    fetchMessages,
    startConversation,
  };
};

export default useChat;
