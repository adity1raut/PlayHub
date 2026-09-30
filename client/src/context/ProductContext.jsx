import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "./AuthContext";
import { API_URL as backendUrl } from "../lib/config";
import { useSocketEvent } from "../lib/useSocketEvent";
import {
  idOf,
  inDeletedStore,
  patchProducts,
  storeIdOf,
  withChanges,
  withRating,
  withStore,
} from "../features/store/liveCatalog";

const ProductContext = createContext();

/** Same rule as the server's cart total: Σ price × quantity, 2 decimals. */
const cartTotalOf = (items) =>
  Number(
    items
      .reduce((sum, i) => sum + (Number(i.product?.price) || 0) * (Number(i.quantity) || 0), 0)
      .toFixed(2),
  );

export function ProductProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [products, setProducts] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [cart, setCart] = useState({ items: [], totalAmount: 0 });
  const [orders, setOrders] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [cartLoading, setCartLoading] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);

  const getAllProducts = async (params = {}) => {
    setLoading(true);
    try {
      const res = await axios.get(`${backendUrl}/api/stores/products/all`, {
        params,
      });
      setProducts(res.data.products || []);
      return res.data;
    } catch (error) {
      console.error("Error fetching products:", error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getProductById = async (id) => {
    try {
      const res = await axios.get(`${backendUrl}/api/stores/products/${id}`);
      return res.data;
    } catch (error) {
      console.error("Error fetching product:", error);
      return null;
    }
  };

  const addProduct = async (storeId, formData) => {
    try {
      const res = await axios.post(
        `${backendUrl}/api/stores/${storeId}/products`,
        formData,
        {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      return { success: true, data: res.data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.error || error.message,
      };
    }
  };

  const updateProduct = async (storeId, productId, formData) => {
    try {
      const res = await axios.put(
        `${backendUrl}/api/stores/${storeId}/products/${productId}`,
        formData,
        {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      return { success: true, data: res.data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.error || error.message,
      };
    }
  };

  const deleteProduct = async (storeId, productId) => {
    try {
      await axios.delete(
        `${backendUrl}/api/stores/${storeId}/products/${productId}`,
        {
          withCredentials: true,
        },
      );
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.error || error.message,
      };
    }
  };

  const getStoreProducts = async (storeId, params = {}) => {
    try {
      const res = await axios.get(
        `${backendUrl}/api/stores/${storeId}/products`,
        {
          params,
        },
      );
      return res.data;
    } catch (error) {
      console.error("Error fetching store products:", error);
      return null;
    }
  };

  const addProductRating = async (productId, rating, review) => {
    try {
      const res = await axios.post(
        `${backendUrl}/api/stores/products/${productId}/rating`,
        { rating, review },
        { withCredentials: true },
      );
      return { success: true, data: res.data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.error || error.message,
      };
    }
  };

  const searchProducts = async (params = {}) => {
    setSearchLoading(true);
    try {
      const res = await axios.get(`${backendUrl}/api/stores/search/products`, {
        params,
      });
      setProducts(res.data.products || []);
      return res.data;
    } catch (error) {
      console.error("Error searching products:", error);
      return null;
    } finally {
      setSearchLoading(false);
    }
  };

  const getTrendingProducts = async (limit = 20) => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${backendUrl}/api/stores/trending/products`,
        {
          params: { limit },
        },
      );
      return res.data;
    } catch (error) {
      console.error("Error fetching trending products:", error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const toggleWishlist = async (productId) => {
    try {
      const res = await axios.post(
        `${backendUrl}/api/stores/wishlist/add/${productId}`,
        {},
        { withCredentials: true },
      );

      // The backend returns only a message and inWishlist, so we need to refetch the wishlist
      await getUserWishlist();

      return {
        success: true,
        message: res.data.message,
        inWishlist: res.data.inWishlist,
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.error || error.message,
      };
    }
  };

  const getUserWishlist = async (page = 1, limit = 12) => {
    setLoading(true);
    try {
      const res = await axios.get(`${backendUrl}/api/stores/wishlist`, {
        params: { page, limit },
        withCredentials: true,
      });
      setWishlist(res.data.products || []);
      return res.data;
    } catch (error) {
      console.error("Error fetching wishlist:", error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getUserAddresses = async () => {
    if (!isAuthenticated) {
      setAddresses([]);
      return { success: false, message: "Please login to view addresses" };
    }

    setAddressLoading(true);
    try {
      const res = await axios.get(`${backendUrl}/api/stores/order/addresses`, {
        withCredentials: true,
      });

      setAddresses(res.data.data.addresses || []);
      return {
        success: true,
        data: res.data.data,
      };
    } catch (error) {
      console.error("Error fetching addresses:", error);
      return {
        success: false,
        message: error.response?.data?.message || "Failed to fetch addresses",
      };
    } finally {
      setAddressLoading(false);
    }
  };

  const addDeliveryAddress = async (addressData) => {
    if (!isAuthenticated) {
      return { success: false, message: "Please login to add address" };
    }

    setAddressLoading(true);
    try {
      const res = await axios.post(
        `${backendUrl}/api/stores/order/addresses`,
        addressData,
        {
          withCredentials: true,
        },
      );

      await getUserAddresses();

      return {
        success: true,
        data: res.data.data,
        message: res.data.message,
      };
    } catch (error) {
      console.error("Error adding address:", error);
      return {
        success: false,
        message: error.response?.data?.message || "Failed to add address",
      };
    } finally {
      setAddressLoading(false);
    }
  };

  const updateAddress = async (addressId, addressData) => {
    if (!isAuthenticated) {
      return { success: false, message: "Please login to update address" };
    }

    setAddressLoading(true);
    try {
      const res = await axios.put(
        `${backendUrl}/api/stores/order/addresses/${addressId}`,
        addressData,
        { withCredentials: true },
      );

      await getUserAddresses();

      return {
        success: true,
        data: res.data.data,
        message: res.data.message,
      };
    } catch (error) {
      console.error("Error updating address:", error);
      return {
        success: false,
        message: error.response?.data?.message || "Failed to update address",
      };
    } finally {
      setAddressLoading(false);
    }
  };

  const deleteAddress = async (addressId) => {
    if (!isAuthenticated) {
      return { success: false, message: "Please login to delete address" };
    }

    setAddressLoading(true);
    try {
      const res = await axios.delete(
        `${backendUrl}/api/stores/order/addresses/${addressId}`,
        {
          withCredentials: true,
        },
      );

      setAddresses(res.data.data.remainingAddresses || []);

      return {
        success: true,
        data: res.data.data,
        message: res.data.message,
      };
    } catch (error) {
      console.error("Error deleting address:", error);
      return {
        success: false,
        message: error.response?.data?.message || "Failed to delete address",
      };
    } finally {
      setAddressLoading(false);
    }
  };

  const createOrder = async (addressId, newAddress = null) => {
    if (!isAuthenticated) {
      return { success: false, message: "Please login to create order" };
    }

    setOrderLoading(true);
    try {
      const payload = {};

      if (addressId) {
        payload.addressId = addressId;
      }

      if (newAddress) {
        payload.newAddress = newAddress;
      }

      const res = await axios.post(
        `${backendUrl}/api/stores/order/create`,
        payload,
        {
          withCredentials: true,
        },
      );

      return { success: true, data: res.data.data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to create order",
      };
    } finally {
      setOrderLoading(false);
    }
  };

  const verifyPayment = async (paymentData) => {
    setOrderLoading(true);
    try {
      const res = await axios.post(
        `${backendUrl}/api/stores/order/verify`,
        paymentData,
        {
          withCredentials: true,
        },
      );

      await fetchCart();

      return { success: true, data: res.data.data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Payment verification failed",
      };
    } finally {
      setOrderLoading(false);
    }
  };

  // Save delivery location after payment
  const saveOrderLocation = async (orderId, locationData) => {
    try {
      const res = await axios.post(
        `${backendUrl}/api/stores/order/${orderId}/location`,
        locationData,
        { withCredentials: true },
      );
      return {
        success: true,
        data: res.data.data,
        message: res.data.message,
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to save location",
      };
    }
  };

  const getOrderDetails = async (orderId) => {
    setLoading(true);
    try {
      const res = await axios.get(`${backendUrl}/api/stores/order/${orderId}`, {
        withCredentials: true,
      });
      return {
        success: true,
        data: res.data.data,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to fetch order details",
      };
    } finally {
      setLoading(false);
    }
  };

  const getUserOrders = async (params = {}) => {
    setLoading(true);
    try {
      const { page = 1, limit = 10, status } = params;
      const res = await axios.get(`${backendUrl}/api/stores/orders`, {
        params: { page, limit, status },
        withCredentials: true,
      });

      const ordersData = res.data.data;
      setOrders(ordersData.orders || []);

      return {
        success: true,
        data: ordersData,
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to fetch orders",
      };
    } finally {
      setLoading(false);
    }
  };

  const getStoreAnalytics = async (storeId) => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${backendUrl}/api/stores/${storeId}/analytics`,
        {
          withCredentials: true,
        },
      );
      return res.data;
    } catch (error) {
      console.error("Error fetching analytics:", error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateCartIcon = (items) => {
    if (!Array.isArray(items)) return;

    const totalItems = items.reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      return sum + quantity;
    }, 0);

    // Show the item count in the tab title, e.g. "(3) Spawnpoint"
    if (typeof document !== "undefined") {
      const title = document.title.replace(/^\(\d+\)\s*/, "");
      document.title = totalItems > 0 ? `(${totalItems}) ${title}` : title;
    }
  };

  const fetchCart = async () => {
    if (!isAuthenticated) {
      const emptyCart = { items: [], totalAmount: 0 };
      setCart(emptyCart);
      updateCartIcon([]);
      return emptyCart;
    }

    setCartLoading(true);
    try {
      const response = await axios.get(`${backendUrl}/api/stores/cart`, {
        withCredentials: true,
        timeout: 10000,
      });

      // Backend already handles filtering null products and calculating totalAmount
      const cartData = response.data || { items: [], totalAmount: 0 };

      const formattedCart = {
        ...cartData,
        totalAmount: Number(cartData.totalAmount || 0),
        items: cartData.items || [],
      };

      setCart(formattedCart);
      updateCartIcon(formattedCart.items);

      console.log("Cart fetched successfully:", {
        itemCount: formattedCart.items.length,
        totalAmount: formattedCart.totalAmount,
      });

      return formattedCart;
    } catch (error) {
      console.error("Error fetching cart:", error);

      if (error.response?.status === 401) {
        console.log("User not authenticated, clearing cart");
        const emptyCart = { items: [], totalAmount: 0 };
        setCart(emptyCart);
        updateCartIcon([]);
        return emptyCart;
      }

      if (error.response?.status === 500) {
        console.error("Server error while fetching cart:", error.response.data);
        // Keep existing cart state on server error to avoid data loss
        return cart;
      }

      const emptyCart = { items: [], totalAmount: 0 };
      setCart(emptyCart);
      updateCartIcon([]);
      return emptyCart;
    } finally {
      setCartLoading(false);
    }
  };

  const addToCart = async (productId, quantity = 1, storeId) => {
    if (!isAuthenticated) {
      return {
        success: false,
        message: "Please login to add items to cart",
      };
    }

    if (!storeId) {
      return {
        success: false,
        message: "Store ID is required",
      };
    }

    setCartLoading(true);
    try {
      const response = await axios.post(
        `${backendUrl}/api/stores/${storeId}/cart/add`,
        { productId, quantity },
        { withCredentials: true },
      );

      const cartData = response.data || { items: [], totalAmount: 0 };
      setCart(cartData);
      updateCartIcon(cartData.items);
      return {
        success: true,
        data: cartData,
        message: "Item added to cart successfully",
      };
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || "Failed to add to cart";
      console.error("Error adding to cart:", error);
      return {
        success: false,
        message: errorMessage,
      };
    } finally {
      setCartLoading(false);
    }
  };

  const updateCartItem = async (productId, quantity) => {
    if (!isAuthenticated) {
      return {
        success: false,
        message: "Please login to update cart",
      };
    }

    if (!productId) {
      return {
        success: false,
        message: "Product ID is required",
      };
    }

    setCartLoading(true);
    try {
      const response = await axios.put(
        `${backendUrl}/api/stores/cart/update`,
        { productId, quantity },
        { withCredentials: true },
      );

      const cartData = response.data || { items: [], totalAmount: 0 };
      setCart(cartData);
      updateCartIcon(cartData.items);
      return {
        success: true,
        data: cartData,
        message: "Cart updated successfully",
      };
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || "Failed to update cart";
      console.error("Error updating cart:", error);
      return {
        success: false,
        message: errorMessage,
      };
    } finally {
      setCartLoading(false);
    }
  };

  const removeFromCart = async (productId) => {
    if (!isAuthenticated) {
      return {
        success: false,
        message: "Please login to remove items from cart",
      };
    }

    if (!productId) {
      return {
        success: false,
        message: "Product ID is required",
      };
    }

    setCartLoading(true);
    try {
      const response = await axios.delete(
        `${backendUrl}/api/stores/cart/remove/${productId}`,
        {
          withCredentials: true,
        },
      );

      const cartData = response.data || { items: [], totalAmount: 0 };
      setCart(cartData);
      updateCartIcon(cartData.items);
      return {
        success: true,
        data: cartData,
        message: "Item removed from cart successfully",
      };
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || "Failed to remove from cart";
      console.error("Error removing from cart:", error);
      return {
        success: false,
        message: errorMessage,
      };
    } finally {
      setCartLoading(false);
    }
  };

  const clearCart = async () => {
    if (!isAuthenticated) {
      return {
        success: false,
        message: "Please login to clear cart",
      };
    }

    setCartLoading(true);
    try {
      await axios.delete(
        `${backendUrl}/api/stores/cart/clear`,
        {
          withCredentials: true,
        },
      );

      const emptyCart = { items: [], totalAmount: 0 };
      setCart(emptyCart);
      updateCartIcon([]);
      return { success: true, message: "Cart cleared successfully" };
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || "Failed to clear cart";
      console.error("Error clearing cart:", error);
      return {
        success: false,
        message: errorMessage,
      };
    } finally {
      setCartLoading(false);
    }
  };

  const getCartItemCount = () => {
    if (!cart.items || !Array.isArray(cart.items)) return 0;
    return cart.items.reduce((total, item) => {
      const quantity = Number(item.quantity) || 0;
      return total + quantity;
    }, 0);
  };

  const isInCart = (productId) => {
    if (!cart.items || !Array.isArray(cart.items) || !productId) return false;
    return cart.items.some(
      (item) =>
        item.product &&
        (item.product._id === productId || item.product === productId),
    );
  };

  const getCartItemQuantity = (productId) => {
    if (!cart.items || !Array.isArray(cart.items) || !productId) return 0;
    const item = cart.items.find(
      (item) =>
        item.product &&
        (item.product._id === productId || item.product === productId),
    );
    return Number(item?.quantity) || 0;
  };

  const validateCartData = (cartData) => {
    if (!cartData || typeof cartData !== "object") {
      return { items: [], totalAmount: 0 };
    }

    return {
      items: Array.isArray(cartData.items) ? cartData.items : [],
      totalAmount: Number(cartData.totalAmount) || 0,
      user: cartData.user,
      _id: cartData._id,
      updatedAt: cartData.updatedAt,
    };
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchCart();
      getUserAddresses();
    }
  }, [isAuthenticated]);

  // The cart as the server just saved it: changed in another tab, or emptied by checkout
  useSocketEvent(
    "cart:updated",
    ({ cart: saved } = {}) => {
      if (!saved) return;
      const items = saved.items || [];
      setCart({ ...saved, items, totalAmount: Number(saved.totalAmount || 0) });
      updateCartIcon(items);
    },
    { onReconnect: fetchCart },
  );

  // Saved / unsaved in another tab: hearts follow (the Wishlist page reloads its page itself)
  useSocketEvent("wishlist:updated", ({ productId, inWishlist, product } = {}) => {
    if (!productId) return;
    setWishlist((prev) => {
      const rest = (Array.isArray(prev) ? prev : []).filter((p) => idOf(p) !== String(productId));
      return inWishlist ? [...rest, product ?? productId] : rest;
    });
  });

  /** Patch (or drop, when `fn` returns null) the cart items and wishlist entries whose product `match`es. */
  const patchCartAndWishlist = (match, fn) => {
    setCart((prev) => {
      const items = Array.isArray(prev.items) ? prev.items : [];
      if (!items.some((i) => i?.product && match(i.product))) return prev;
      const next = items.flatMap((i) => {
        if (!i?.product || !match(i.product)) return [i];
        const product = fn(i.product);
        return product ? [{ ...i, product }] : [];
      });
      return { ...prev, items: next, totalAmount: cartTotalOf(next) };
    });
    setWishlist((prev) => patchProducts(prev, match, fn));
  };

  /** Removed products leave the cart and wishlist too (the server drops them on its next read). */
  const dropProducts = (match) => {
    patchCartAndWishlist(match, () => null);
    const items = cart.items || [];
    if (items.some((i) => i?.product && match(i.product))) {
      updateCartIcon(items.filter((i) => !(i?.product && match(i.product))));
    }
  };

  // Live price / stock / name / images and reviews on cart lines and saved products
  useSocketEvent("product:updated", ({ productId, product } = {}) => {
    if (product) patchCartAndWishlist((p) => idOf(p) === String(productId), (p) => withChanges(p, product));
  });

  useSocketEvent("product:rating", (e = {}) => {
    if (e.review) setWishlist((prev) => patchProducts(prev, (p) => idOf(p) === String(e.productId), (p) => withRating(p, e)));
  });

  useSocketEvent("store:updated", ({ storeId, store } = {}) => {
    if (store) patchCartAndWishlist((p) => storeIdOf(p) === String(storeId), (p) => withStore(p, store));
  });

  useSocketEvent("product:deleted", ({ productId } = {}) => dropProducts((p) => idOf(p) === String(productId)));
  useSocketEvent("store:deleted", (e = {}) => dropProducts((p) => inDeletedStore(p, e)));

  return (
    <ProductContext.Provider
      value={{
        products,
        wishlist,
        cart,
        orders,
        addresses,
        loading,
        searchLoading,
        orderLoading,
        cartLoading,
        addressLoading,

        getAllProducts,
        getProductById,
        addProduct,
        updateProduct,
        deleteProduct,
        getStoreProducts,
        addProductRating,

        searchProducts,
        getTrendingProducts,

        toggleWishlist,
        getUserWishlist,

        getUserAddresses,
        addDeliveryAddress,
        updateAddress,
        deleteAddress,

        fetchCart,
        addToCart,
        updateCartItem,
        removeFromCart,
        clearCart,
        getCartItemCount,
        isInCart,
        getCartItemQuantity,
        validateCartData,

        createOrder,
        verifyPayment,
        saveOrderLocation,
        getOrderDetails,
        getUserOrders,

        getStoreAnalytics,

        setProducts,
        setWishlist,
        setCart,
        setOrders,
        setAddresses,
      }}
    >
      {children}
    </ProductContext.Provider>
  );
}

export const useProduct = () => useContext(ProductContext);
