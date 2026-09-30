import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "./AuthContext";
import { API_URL as backendUrl } from "../lib/config";
import { useSocketEvent } from "../lib/useSocketEvent";
import { idOf, mergeStore } from "../features/store/liveCatalog";

const StoreContext = createContext();


export function StoreProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
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

  // `silent`: refresh in the background (no loading skeleton), e.g. after a reconnect
  const getAllStores = async (params = {}, { silent = false } = {}) => {
    if (!silent) setLoading(true);
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

  const createStore = async (storeData) => {
    try {
      setLoading(true);
      console.log("Creating store with data:", storeData);

      // The API takes multipart form data with the logo file under "logo"
      const formData = new FormData();
      formData.append("name", storeData.name ?? "");
      formData.append("description", storeData.description ?? "");
      if (storeData.logo instanceof File) formData.append("logo", storeData.logo);

      const res = await axios.post(`${backendUrl}/api/stores`, formData);

      setUserStore(res.data);
      return { success: true, data: res.data };
    } catch (error) {
      console.error("Create store error:", error);
      const message =
        error.response?.data?.error ||
        error.response?.data?.message ||
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

      // The API takes multipart form data with the logo file under "logo"
      const formData = new FormData();
      formData.append("name", storeData.name ?? "");
      formData.append("description", storeData.description ?? "");
      if (storeData.logo instanceof File) formData.append("logo", storeData.logo);

      const res = await axios.put(`${backendUrl}/api/stores/${id}`, formData);

      setUserStore(res.data);
      return { success: true, data: res.data };
    } catch (error) {
      console.error("Update store error:", error);
      const message =
        error.response?.data?.error ||
        error.response?.data?.message ||
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
        error.response?.data?.message ||
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
      setFollowedStores((res.data.stores ?? []).map((store) => store._id));
      return { success: true, data: res.data };
    } catch (error) {
      console.error("Error fetching following stores:", error);
      setError(
        error.response?.data?.error || "Failed to fetch following stores",
      );
      return { success: false, message: error.response?.data?.error };
    }
  };

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

  const clearError = () => setError(null);

  // Realtime: storefronts and their product counts (store lists, filters, MyStore)
  const patchStore = (storeId, fn) => {
    const id = String(storeId);
    setStores((prev) => (prev.some((s) => idOf(s) === id) ? prev.map((s) => (idOf(s) === id ? fn(s) : s)) : prev));
    setUserStore((prev) => (prev && idOf(prev) === id ? fn(prev) : prev));
  };

  // Opened from another of our tabs → MyStore picks it up
  useSocketEvent(
    "store:created",
    ({ store } = {}) => {
      if (store && user?._id && idOf(store.owner) === String(user._id)) {
        setUserStore((prev) => prev ?? { ...store, products: [] });
      }
    },
    { onReconnect: () => isAuthenticated && getCurrentUserStore() },
  );

  useSocketEvent("store:updated", ({ storeId, store } = {}) => {
    if (store) patchStore(storeId, (s) => mergeStore(s, store));
  });

  useSocketEvent("store:deleted", ({ storeId } = {}) => {
    const id = String(storeId);
    setStores((prev) => (prev.some((s) => idOf(s) === id) ? prev.filter((s) => idOf(s) !== id) : prev));
    setUserStore((prev) => (prev && idOf(prev) === id ? null : prev));
    setFollowedStores((prev) => prev.filter((s) => String(s) !== id));
  });

  // Store cards show how many products a store has
  useSocketEvent("product:created", ({ storeId, productId, product } = {}) => {
    if (!product) return;
    const { _id, name, price, images, stock } = product;
    patchStore(storeId, (s) =>
      (s.products || []).some((p) => idOf(p) === String(productId))
        ? s
        : { ...s, products: [...(s.products || []), { _id, name, price, images, stock }] },
    );
  });

  useSocketEvent("product:deleted", ({ storeId, productId } = {}) => {
    patchStore(storeId, (s) =>
      (s.products || []).some((p) => idOf(p) === String(productId))
        ? { ...s, products: s.products.filter((p) => idOf(p) !== String(productId)) }
        : s,
    );
  });

  return (
    <StoreContext.Provider
      value={{
        stores,
        userStore,
        loading,
        error,
        followedStores,

        getAllStores,
        getStoreById,
        createStore,
        updateStore,
        deleteStore,
        getCurrentUserStore,
        getUserStore,
        getStoreProducts,

        getStoreAnalytics,

        followStore,
        getFollowStatus,
        getFollowingStores,

        searchProducts,
        getTrendingProducts,

        clearError,

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
