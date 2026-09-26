import { createContext, useCallback, useContext, useEffect, useState } from "react";
import axios from "axios";
import { API_URL as backendUrl } from "../lib/config";
import { detachPushFromServer } from "../lib/push";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Re-read the signed-in user from the server (after follow, profile edits, …).
  // Only a 401 signs the user out; a network blip keeps the current session.
  const refreshUser = useCallback(async () => {
    try {
      const res = await axios.get(`${backendUrl}/api/auth/profile`);
      const next = res.data.success ? res.data.data : null;
      setUser(next);
      return next;
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 404) {
        setUser(null);
        return null;
      }
      return undefined;
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = async (identifier, password) => {
    try {
      await axios.post(`${backendUrl}/api/auth/login`, { identifier, password });
      const profile = await refreshUser();
      if (profile === undefined) {
        return { success: false, message: "Couldn't reach the server. Please try again." };
      }
      if (!profile) {
        return {
          success: false,
          message:
            "Signed in, but the session cookie was not kept. Check CLIENT_URL / COOKIE_SAMESITE on the server.",
        };
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  };

  const logout = async () => {
    try {
      await detachPushFromServer();
      await axios.post(`${backendUrl}/api/auth/logout`, {});
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
    }
  };

  // The API expects JSON: { name, bio, email, profileImage?, coverImage? } where images are data: URIs
  const updateProfile = async (data) => {
    try {
      const body = data instanceof FormData ? Object.fromEntries(data.entries()) : data;
      const res = await axios.put(`${backendUrl}/api/auth/profile`, body);
      if (res.data.success) {
        setUser(res.data.data);
        return { success: true, message: res.data.message, user: res.data.data };
      }
      return { success: false, message: res.data.message };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        login,
        logout,
        refreshUser,
        updateProfile,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
