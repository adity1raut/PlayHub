import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await axios.get(`${backendUrl}/api/auth/profile`, {
          withCredentials: true,
        });
        if (res.data.success) {
          setUser(res.data.data);
        } else {
          setUser(null);
        }
      } catch (error) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const login = async (identifier, password) => {
    try {
      const res = await axios.post(
        `${backendUrl}/api/auth/login`,
        { identifier, password },
        { withCredentials: true },
      );
      if (res.status === 200) {
        const profileRes = await axios.get(`${backendUrl}/api/auth/profile`, {
          withCredentials: true,
        });
        if (profileRes.data.success) {
          setUser(profileRes.data.data);
        }
        return { success: true };
      }
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  };

  const logout = async () => {
    try {
      await axios.post(
        `${backendUrl}/api/auth/logout`,
        {},
        { withCredentials: true },
      );
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const updateProfile = async (formData) => {
    try {
      const res = await axios.put(`${backendUrl}/api/auth/profile`, formData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data.success) {
        setUser(res.data.data);
        return { success: true, message: res.data.message };
      }
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
        loading,
        login,
        logout,
        updateProfile,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
