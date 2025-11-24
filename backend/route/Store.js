import express from "express";
import authenticateToken from "../middleware/Auth.js";
import verifyStoreOwnership from "../middleware/verifyStore.js";
import {
  getAllStores,
  createStore,
  getStoreById,
  updateStore,
  getUserStore,
  getCurrentUserStore,
  deleteStore,
  getStoreProducts,
} from "../controllers/Store/store.routes.js";
import {
  addToWishlist,
  getUserWishlist,
} from "../controllers/Store/wishlist.routes.js";
import {
  followStore,
  getFollowingStores,
  getFollowStatus,
} from "../controllers/Store/social.routes.js";
import {
  getTrendingProducts,
  searchProducts,
  getAllProducts,
} from "../controllers/Store/search.routes.js";
import {
  addProduct,
  addProductRating,
  deleteProduct,
  getProductById,
  updateProduct,
} from "../controllers/Store/product.routes.js";
import {
  createOrder,
  verifyPayment,
  saveOrderLocation,
  getOrderDetails,
  getUserOrders,
  getUserAddresses,
  addDeliveryAddress,
  updateAddress,
  deleteAddress,
} from "../controllers/Store/order.routes.js";
import {
  addToCart,
  getCart,
  removeFromCart,
  updateCartItem,
  clearCart,
} from "../controllers/Store/cart.routes.js";
import { getStoreAnalytics } from "../controllers/Store/analytics.routes.js";
import upload from "../config/multrer.js";

const router = express.Router();

// IMPORTANT: Put all specific/static routes BEFORE parameterized routes
// This prevents "cart", "wishlist", etc. from being treated as store IDs

// Search routes - must come first
router.get("/search/products", searchProducts);
router.get("/trending/products", getTrendingProducts);
router.get("/products/all", getAllProducts);

// Cart routes - must come before /:id routes
router.get("/cart", authenticateToken, getCart);
router.put("/cart/update", authenticateToken, updateCartItem);
router.delete("/cart/remove/:productId", authenticateToken, removeFromCart);
router.delete("/cart/clear", authenticateToken, clearCart);

// Wishlist routes - must come before /:id routes
router.post("/wishlist/add/:productId", authenticateToken, addToWishlist);
router.get("/wishlist", authenticateToken, getUserWishlist);

// Order routes - must come before /:id routes
router.get("/order/addresses", authenticateToken, getUserAddresses);
router.post("/order/addresses", authenticateToken, addDeliveryAddress);
router.put("/order/addresses/:addressId", authenticateToken, updateAddress);
router.delete("/order/addresses/:addressId", authenticateToken, deleteAddress);

// Order routes
router.post("/order/create", authenticateToken, createOrder);
router.post("/order/verify", authenticateToken, verifyPayment);
router.post("/order/:orderId/location", authenticateToken, saveOrderLocation);
router.get("/order/:orderId", authenticateToken, getOrderDetails);
router.get("/orders", authenticateToken, getUserOrders);
// ...existing code...

// Social routes that don't need storeId - must come before /:id routes
router.get("/following/stores", authenticateToken, getFollowingStores);

// Current user's store - must come before /:id routes
router.get("/my/store", authenticateToken, getCurrentUserStore);

// Product routes that don't need storeId - must come before /:id routes
router.get("/products/:productId", getProductById);
router.post("/products/:productId/rating", authenticateToken, addProductRating);

// General store routes
router.get("/", getAllStores);
router.post("/", authenticateToken, upload.single("logo"), createStore);

// User-specific store routes
router.get("/user/:userId", getUserStore);

// Store-specific routes (these can safely use :id or :storeId now)
router.get("/:id", getStoreById);
router.put("/:id", authenticateToken, upload.single("logo"), updateStore);
router.delete("/:id", authenticateToken, verifyStoreOwnership, deleteStore);
router.get("/:id/products", getStoreProducts);

// Store-specific product routes
router.post(
  "/:storeId/products",
  authenticateToken,
  upload.array("images", 5),
  verifyStoreOwnership,
  addProduct,
);
router.put(
  "/:storeId/products/:productId",
  authenticateToken,
  upload.array("images", 5),
  verifyStoreOwnership,
  updateProduct,
);
router.delete(
  "/:storeId/products/:productId",
  authenticateToken,
  verifyStoreOwnership,
  deleteProduct,
);

// Store-specific cart routes
router.post("/:storeId/cart/add", authenticateToken, addToCart);

// Store-specific analytics routes
router.get(
  "/:storeId/analytics",
  authenticateToken,
  verifyStoreOwnership,
  getStoreAnalytics,
);

// Store-specific social routes
router.post("/:storeId/follow", authenticateToken, followStore);
router.get("/:storeId/follow-status", authenticateToken, getFollowStatus);

export default router;
