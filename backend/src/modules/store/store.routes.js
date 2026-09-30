import express from "express";
import authenticateToken from "../../middleware/auth.js";
import verifyStoreOwnership from "./verifyStore.js";
import upload from "../../config/multer.js";
import {
  getAllStores,
  createStore,
  getStoreById,
  updateStore,
  getUserStore,
  getCurrentUserStore,
  deleteStore,
  getStoreProducts,
} from "./store.controller.js";
import { addToWishlist, getUserWishlist } from "./wishlist.controller.js";
import { followStore, getFollowingStores, getFollowStatus } from "./social.controller.js";
import { getTrendingProducts, searchProducts, getAllProducts } from "./search.controller.js";
import {
  addProduct,
  addProductRating,
  deleteProduct,
  getProductById,
  updateProduct,
} from "./product.controller.js";
import {
  createOrder,
  getPaymentConfig,
  verifyPayment,
  saveOrderLocation,
  getOrderDetails,
  getUserOrders,
  getUserAddresses,
  addDeliveryAddress,
  updateAddress,
  deleteAddress,
} from "./order.controller.js";
import { addToCart, getCart, removeFromCart, updateCartItem, clearCart } from "./cart.controller.js";
import { getStoreAnalytics } from "./analytics.controller.js";

const router = express.Router();

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

router.get("/order/addresses", authenticateToken, getUserAddresses);
router.post("/order/addresses", authenticateToken, addDeliveryAddress);
router.put("/order/addresses/:addressId", authenticateToken, updateAddress);
router.delete("/order/addresses/:addressId", authenticateToken, deleteAddress);

router.get("/order/payment-config", authenticateToken, getPaymentConfig);
router.post("/order/create", authenticateToken, createOrder);
router.post("/order/verify", authenticateToken, verifyPayment);
router.post("/order/:orderId/location", authenticateToken, saveOrderLocation);
router.get("/order/:orderId", authenticateToken, getOrderDetails);
router.get("/orders", authenticateToken, getUserOrders);

router.get("/following/stores", authenticateToken, getFollowingStores);

router.get("/my/store", authenticateToken, getCurrentUserStore);

router.get("/products/:productId", getProductById);
router.post("/products/:productId/rating", authenticateToken, addProductRating);

router.get("/", getAllStores);
router.post("/", authenticateToken, upload.single("logo"), createStore);

router.get("/user/:userId", getUserStore);

router.get("/:id", getStoreById);
router.put("/:id", authenticateToken, verifyStoreOwnership, upload.single("logo"), updateStore);
router.delete("/:id", authenticateToken, verifyStoreOwnership, deleteStore);
router.get("/:id/products", getStoreProducts);

router.post("/:storeId/products", authenticateToken, upload.array("images", 5), verifyStoreOwnership, addProduct);
router.put("/:storeId/products/:productId", authenticateToken, upload.array("images", 5), verifyStoreOwnership, updateProduct);
router.delete("/:storeId/products/:productId", authenticateToken, verifyStoreOwnership, deleteProduct);

router.post("/:storeId/cart/add", authenticateToken, addToCart);

router.get("/:storeId/analytics", authenticateToken, verifyStoreOwnership, getStoreAnalytics);

router.post("/:storeId/follow", authenticateToken, followStore);
router.get("/:storeId/follow-status", authenticateToken, getFollowStatus);

export default router;
