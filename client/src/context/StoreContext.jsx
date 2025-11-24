import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "./AuthContext";

const StoreContext = createContext();

const backendUrl = import.meta.env.VITE_BACKEND_URL;

export function StoreProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [stores, setStores] = useState([]);
  const [userStore, setUserStore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [followedStores, setFollowedStores] = useState([]);

  useEffect(() => {
    if (isAuthenticated) {
      getCurrentUserStore();
      getFollowingStores();
    } else {
      setUserStore(null);
      setFollowedStores([]);
    }
  }, [isAuthenticated]);

  const getAllStores = async (params = {}) => {
    setLoading(true);
    try {
      const res = await axios.get(`${backendUrl}/api/stores`, { params });
      setStores(res.data.stores || []);
      return res.data;
    } catch (error) {
      console.error("Error fetching stores:", error);
      setError(error.response?.data?.error || "Error fetching stores");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getStoreById = async (id) => {
    try {
      const res = await axios.get(`${backendUrl}/api/stores/${id}`);
      return res.data;
    } catch (error) {
      console.error("Error fetching store:", error);
      setError(error.response?.data?.error || "Error fetching store");
      return null;
    }
  };

  // Convert image file to base64
  const convertImageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const createStore = async (storeData) => {
    try {
      setLoading(true);
      console.log("Creating store with data:", storeData);

      // Prepare data for API
      const apiData = {
        name: storeData.name,
        description: storeData.description || "",
      };

      // Convert logo to base64 if provided
      if (storeData.logo && storeData.logo instanceof File) {
        apiData.logoBase64 = await convertImageToBase64(storeData.logo);
      }

      const res = await axios.post(`${backendUrl}/api/stores`, apiData, {
        withCredentials: true,
        headers: { "Content-Type": "application/json" },
      });

      setUserStore(res.data);
      return { success: true, data: res.data };
    } catch (error) {
      console.error("Create store error:", error);
      const message =
        error.response?.data?.error ||
        error.message ||
        "Failed to create store";
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  const updateStore = async (id, storeData) => {
    try {
      setLoading(true);
      console.log("Updating store with data:", storeData);

      // Prepare data for API
      const apiData = {
        name: storeData.name,
        description: storeData.description,
      };

      // Convert logo to base64 if provided
      if (storeData.logo && storeData.logo instanceof File) {
        apiData.logoBase64 = await convertImageToBase64(storeData.logo);
      }

      const res = await axios.put(`${backendUrl}/api/stores/${id}`, apiData, {
        withCredentials: true,
        headers: { "Content-Type": "application/json" },
      });

      setUserStore(res.data);
      return { success: true, data: res.data };
    } catch (error) {
      console.error("Update store error:", error);
      const message =
        error.response?.data?.error ||
        error.message ||
        "Failed to update store";
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  const deleteStore = async (id) => {
    try {
      setLoading(true);
      await axios.delete(`${backendUrl}/api/stores/${id}`, {
        withCredentials: true,
      });
      setUserStore(null);
      return { success: true };
    } catch (error) {
      console.error("Delete store error:", error);
      const message =
        error.response?.data?.error ||
        error.message ||
        "Failed to delete store";
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  const getCurrentUserStore = async () => {
    try {
      const res = await axios.get(`${backendUrl}/api/stores/my/store`, {
        withCredentials: true,
      });
      setUserStore(res.data);
      return res.data;
    } catch (error) {
      console.error("Error fetching user store:", error);
      if (error.response?.status !== 404) {
        setError(error.response?.data?.error || "Error fetching user store");
      }
      setUserStore(null);
      return null;
    }
  };

  const getUserStore = async (userId) => {
    try {
      const res = await axios.get(`${backendUrl}/api/stores/user/${userId}`);
      return { success: true, data: res.data };
    } catch (error) {
      console.error("Error fetching user store:", error);
      setError(error.response?.data?.error || "Error fetching user store");
      return { success: false, message: error.response?.data?.error };
    }
  };

  const getStoreProducts = async (id, params = {}) => {
    try {
      const res = await axios.get(`${backendUrl}/api/stores/${id}/products`, {
        params,
      });
      return { success: true, data: res.data };
    } catch (error) {
      console.error("Error fetching store products:", error);
      setError(error.response?.data?.error || "Error fetching store products");
      return { success: false, message: error.response?.data?.error };
    }
  };

  // Store Analytics
  const getStoreAnalytics = async (storeId) => {
    if (!isAuthenticated) {
      return { success: false, message: "Authentication required" };
    }
    setLoading(true);
    try {
      const res = await axios.get(
        `${backendUrl}/api/stores/${storeId}/analytics`,
        {
          withCredentials: true,
        },
      );
      return { success: true, data: res.data };
    } catch (error) {
      console.error("Error fetching analytics:", error);
      setError(error.response?.data?.error || "Failed to fetch analytics");
      return { success: false, message: error.response?.data?.error };
    } finally {
      setLoading(false);
    }
  };

  // Store Social Features
  const followStore = async (storeId) => {
    if (!isAuthenticated) {
      return { success: false, message: "Authentication required" };
    }
    try {
      const res = await axios.post(
        `${backendUrl}/api/stores/${storeId}/follow`,
        {},
        {
          withCredentials: true,
        },
      );
      if (res.data.following) {
        setFollowedStores((prev) => [...prev, storeId]);
      } else {
        setFollowedStores((prev) => prev.filter((id) => id !== storeId));
      }
      return { success: true, data: res.data };
    } catch (error) {
      console.error("Error following store:", error);
      setError(
        error.response?.data?.error || "Failed to follow/unfollow store",
      );
      return { success: false, message: error.response?.data?.error };
    }
  };

  const getFollowStatus = async (storeId) => {
    if (!isAuthenticated) return { following: false };
    try {
      const res = await axios.get(
        `${backendUrl}/api/stores/${storeId}/follow-status`,
        {
          withCredentials: true,
        },
      );
      return { success: true, data: res.data };
    } catch (error) {
      console.error("Error getting follow status:", error);
      setError(error.response?.data?.error || "Failed to get follow status");
      return { success: false, message: error.response?.data?.error };
    }
  };

  const getFollowingStores = async () => {
    if (!isAuthenticated) return { success: true, data: [] };
    try {
      const res = await axios.get(`${backendUrl}/api/stores/following/stores`, {
        withCredentials: true,
      });
      setFollowedStores(res.data.map((store) => store._id));
      return { success: true, data: res.data };
    } catch (error) {
      console.error("Error fetching following stores:", error);
      setError(
        error.response?.data?.error || "Failed to fetch following stores",
      );
      return { success: false, message: error.response?.data?.error };
    }
  };

  // Search Functions
  const searchProducts = async (params = {}) => {
    try {
      const res = await axios.get(`${backendUrl}/api/stores/search/products`, {
        params,
      });
      return { success: true, data: res.data };
    } catch (error) {
      console.error("Error searching products:", error);
      setError(error.response?.data?.error || "Error searching products");
      return { success: false, message: error.response?.data?.error };
    }
  };

  const getTrendingProducts = async (params = {}) => {
    try {
      const res = await axios.get(
        `${backendUrl}/api/stores/trending/products`,
        { params },
      );
      return { success: true, data: res.data };
    } catch (error) {
      console.error("Error fetching trending products:", error);
      setError(
        error.response?.data?.error || "Error fetching trending products",
      );
      return { success: false, message: error.response?.data?.error };
    }
  };

  // Error Management
  const clearError = () => setError(null);

  return (
    <StoreContext.Provider
      value={{
        // State
        stores,
        userStore,
        loading,
        error,
        followedStores,

        // Store Management
        getAllStores,
        getStoreById,
        createStore,
        updateStore,
        deleteStore,
        getCurrentUserStore,
        getUserStore,
        getStoreProducts,

        // Store Analytics
        getStoreAnalytics,

        // Store Social Features
        followStore,
        getFollowStatus,
        getFollowingStores,

        // Search Functions
        searchProducts,
        getTrendingProducts,

        // Error Management
        clearError,

        // State Setters
        setStores,
        setUserStore,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
};
