import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useProduct } from "../../context/ProductContext";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  ArrowLeft,
  Store,
  CreditCard,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import GamingBackground from "../../GamingBackground/GamingBackground";

export default function Cart() {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading } = useAuth();
  const {
    cart,
    cartLoading,
    fetchCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    getCartItemCount,
  } = useProduct();

  const [updating, setUpdating] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  const toastConfig = {
    position: "top-right",
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    theme: "dark",
  };

  const handleRefreshCart = async () => {
    setRefreshing(true);
    try {
      await fetchCart();
      toast.success("Cart refreshed successfully", toastConfig);
    } catch (error) {
      toast.error("Failed to refresh cart", toastConfig);
    } finally {
      setRefreshing(false);
    }
  };

  const handleUpdateQuantity = async (productId, newQuantity) => {
    if (newQuantity < 0) return;

    setUpdating((prev) => ({ ...prev, [productId]: true }));

    try {
      const result = await updateCartItem(productId, newQuantity);
      if (result.success) {
        toast.success(
          result.message || "Cart updated successfully",
          toastConfig,
        );
      } else {
        toast.error(result.message || "Failed to update cart", toastConfig);
      }
    } catch (error) {
      toast.error("Error updating cart item", toastConfig);
      console.error("Update cart error:", error);
    } finally {
      setUpdating((prev) => ({ ...prev, [productId]: false }));
    }
  };

  const handleRemoveItem = async (productId, productName) => {
    const confirmRemove = window.confirm(`Remove "${productName}" from cart?`);

    if (confirmRemove) {
      setUpdating((prev) => ({ ...prev, [productId]: true }));
      try {
        const result = await removeFromCart(productId);
        if (result.success) {
          toast.success(
            result.message || "Item removed from cart",
            toastConfig,
          );
        } else {
          toast.error(result.message || "Failed to remove item", toastConfig);
        }
      } catch (error) {
        toast.error("Error removing item from cart", toastConfig);
        console.error("Remove item error:", error);
      } finally {
        setUpdating((prev) => ({ ...prev, [productId]: false }));
      }
    }
  };

  const handleClearCart = async () => {
    const confirmClear = window.confirm(
      "Are you sure you want to clear your entire cart? This action cannot be undone.",
    );

    if (confirmClear) {
      try {
        const result = await clearCart();
        if (result.success) {
          toast.success(
            result.message || "Cart cleared successfully",
            toastConfig,
          );
        } else {
          toast.error(result.message || "Failed to clear cart", toastConfig);
        }
      } catch (error) {
        toast.error("Error clearing cart", toastConfig);
        console.error("Clear cart error:", error);
      }
    }
  };

  const calculateItemTotal = (price, quantity) => {
    if (typeof price !== "number" || typeof quantity !== "number") {
      return "0.00";
    }
    return (price * quantity).toFixed(2);
  };

  const formatPrice = (price) => {
    if (typeof price !== "number" || isNaN(price)) {
      return "0.00";
    }
    return price.toFixed(2);
  };

  const safeCart = cart || { items: [], totalAmount: 0 };
  const safeItems = Array.isArray(safeCart.items)
    ? safeCart.items.filter((item) => item.product)
    : [];
  const totalItems = getCartItemCount();

  // Show loading spinner while auth status is loading
  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-900 via-black to-purple-900 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto text-purple-400" size={48} />
          <p className="text-purple-300 mt-4 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="bg-gradient-to-br from-gray-900 via-black to-purple-900 p-4 pt-32">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl p-8">
            <ShoppingCart size={64} className="mx-auto text-purple-400 mb-4" />
            <h1 className="text-2xl font-bold text-white mb-4">
              Sign In Required
            </h1>
            <p className="text-purple-300 mb-6">
              Please sign in to view your shopping cart.
            </p>
            <div className="space-x-4">
              <button
                onClick={() => navigate("/login")}
                className="bg-purple-700 text-white px-6 py-2 rounded-lg hover:bg-purple-800 transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate("/products")}
                className="border border-gray-600 text-purple-300 px-6 py-2 rounded-lg hover:bg-gray-900 transition-colors"
              >
                Browse Products
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-900 via-black to-purple-900 min-h-screen p-4 pt-32">
      <GamingBackground />
      {/* Replace Toaster with ToastContainer */}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
        toastStyle={{
          backgroundColor: "#1f2937",
          color: "#f3f4f6",
          border: "1px solid #374151",
        }}
      />

      <div className="max-w-6xl mx-auto">
        <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/stores")}
                className="group relative px-4 py-2 bg-gradient-to-r from-gray-700 to-gray-800 text-gray-300 rounded-lg transition-all duration-300 shadow-md hover:shadow-purple-700/30 hover:translate-y-[-1px] overflow-hidden border border-gray-600 hover:border-purple-500"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-purple-800/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                <span className="relative flex items-center gap-2">
                  <ArrowLeft
                    size={20}
                    className="text-purple-400 group-hover:text-purple-300 transition-colors"
                  />
                  <span className="font-medium group-hover:text-white transition-colors">
                    Back to Stores
                  </span>
                </span>
              </button>

              <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                <ShoppingCart size={32} className="text-purple-400" />
                Shopping Cart
                {totalItems > 0 && (
                  <span className="bg-purple-900 text-purple-300 text-sm px-2 py-1 rounded-full border border-purple-700">
                    {totalItems} item{totalItems !== 1 ? "s" : ""}
                  </span>
                )}
              </h1>
            </div>

            <button
              onClick={handleRefreshCart}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-2 text-purple-300 hover:text-white border border-purple-700 rounded-lg hover:bg-purple-900 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>

          {safeItems.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Cart Items */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-white">
                    Cart Items ({safeItems.length} product
                    {safeItems.length !== 1 ? "s" : ""})
                  </h2>
                  {safeItems.length > 0 && (
                    <button
                      onClick={handleClearCart}
                      disabled={cartLoading}
                      className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1 disabled:opacity-50 transition-colors"
                    >
                      <Trash2 size={16} />
                      Clear Cart
                    </button>
                  )}
                </div>

                {cartLoading && (
                  <div className="text-center py-4">
                    <Loader2
                      className="animate-spin mx-auto text-purple-400"
                      size={24}
                    />
                    <p className="text-purple-300 mt-2">Updating cart...</p>
                  </div>
                )}

                {safeItems.map((item) => {
                  const product = item.product;
                  const isUpdating = updating[product._id];
                  const itemTotal = calculateItemTotal(
                    product.price,
                    item.quantity,
                  );

                  return (
                    <div
                      key={product._id}
                      className="bg-gray-900 rounded-lg shadow-md p-4 border border-gray-700"
                    >
                      <div className="flex gap-4">
                        {/* Product Image */}
                        <div className="w-24 h-24 flex-shrink-0">
                          {product.images && product.images.length > 0 ? (
                            <img
                              src={product.images[0]}
                              alt={product.name}
                              className="w-full h-full object-cover rounded-lg"
                              onError={(e) => {
                                e.target.src = "/placeholder-image.jpg";
                              }}
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-800 rounded-lg flex items-center justify-center">
                              <span className="text-purple-400 text-xs">
                                No Image
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Product Details */}
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg mb-1 line-clamp-2 text-white">
                                {product.name}
                              </h3>
                              {product.store && (
                                <div className="flex items-center gap-2 text-sm text-purple-300 mb-2">
                                  <Store size={14} />
                                  <span>{product.store.name}</span>
                                </div>
                              )}
                              {product.description && (
                                <p className="text-purple-300 text-sm line-clamp-2 mb-3">
                                  {product.description}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() =>
                                handleRemoveItem(product._id, product.name)
                              }
                              disabled={isUpdating}
                              className="text-red-400 hover:text-red-300 p-1 disabled:opacity-50 transition-colors ml-4"
                              title="Remove from cart"
                            >
                              {isUpdating ? (
                                <Loader2 className="animate-spin" size={16} />
                              ) : (
                                <Trash2 size={16} />
                              )}
                            </button>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                            <div className="flex items-center gap-4">
                              <div className="text-lg font-bold text-purple-400">
                                ${formatPrice(product.price)}
                              </div>

                              {/* Quantity Controls */}
                              <div className="flex items-center border border-purple-700 rounded-lg bg-gray-800">
                                <button
                                  onClick={() =>
                                    handleUpdateQuantity(
                                      product._id,
                                      item.quantity - 1,
                                    )
                                  }
                                  disabled={isUpdating || item.quantity <= 1}
                                  className="p-2 hover:bg-purple-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-l-lg"
                                  title="Decrease quantity"
                                >
                                  <Minus size={16} />
                                </button>
                                <span className="px-4 py-2 border-x border-purple-700 min-w-[3rem] text-center font-medium text-white">
                                  {isUpdating ? "..." : item.quantity || 0}
                                </span>
                                <button
                                  onClick={() =>
                                    handleUpdateQuantity(
                                      product._id,
                                      item.quantity + 1,
                                    )
                                  }
                                  disabled={
                                    isUpdating ||
                                    item.quantity >= (product.stock || 0)
                                  }
                                  className="p-2 hover:bg-purple-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-r-lg"
                                  title="Increase quantity"
                                >
                                  <Plus size={16} />
                                </button>
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-lg font-bold text-white">
                                ${itemTotal}
                              </div>
                              <div className="text-sm text-purple-300">
                                Stock: {product.stock || 0} available
                              </div>
                              {item.quantity >= (product.stock || 0) && (
                                <div className="text-xs text-orange-400 font-medium">
                                  Max quantity reached
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Order Summary */}
              <div className="lg:col-span-1">
                <div className="bg-gray-900 rounded-lg shadow-md p-6 border border-purple-700 sticky top-6">
                  <h2 className="text-xl font-semibold mb-4 text-white">
                    Order Summary
                  </h2>

                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between text-purple-300">
                      <span>
                        Subtotal ({totalItems} item{totalItems !== 1 ? "s" : ""}
                        )
                      </span>
                      <span className="font-medium">
                        ${formatPrice(safeCart.totalAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between text-purple-300">
                      <span>Shipping</span>
                      <span className="text-green-400 font-medium">Free</span>
                    </div>
                    <div className="flex justify-between text-sm text-purple-300">
                      <span>Tax</span>
                      <span>Calculated at checkout</span>
                    </div>
                  </div>

                  <div className="border-t border-purple-700 pt-4 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-white">
                        Total
                      </span>
                      <span className="text-2xl font-bold text-purple-400">
                        ${formatPrice(safeCart.totalAmount)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={() => navigate("/checkout")}
                      disabled={cartLoading || safeItems.length === 0}
                      className="w-full bg-purple-700 text-white py-3 rounded-lg font-semibold hover:bg-purple-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CreditCard size={20} />
                      Proceed to Checkout
                    </button>

                    <button
                      onClick={() => navigate("/products")}
                      className="w-full border border-purple-700 text-purple-300 py-3 rounded-lg font-semibold hover:bg-purple-900 transition-colors"
                    >
                      Continue Shopping
                    </button>
                  </div>

                  {/* Cart Stats */}
                  <div className="mt-6 pt-4 border-t border-purple-700">
                    <h3 className="font-semibold mb-3 text-white">
                      Cart Statistics
                    </h3>
                    <div className="space-y-2 text-sm text-purple-300">
                      <div className="flex justify-between">
                        <span>Total Items:</span>
                        <span className="font-medium">{totalItems}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Unique Products:</span>
                        <span className="font-medium">{safeItems.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Different Stores:</span>
                        <span className="font-medium">
                          {
                            new Set(
                              safeItems
                                .filter((item) => item.product?.store?._id)
                                .map((item) => item.product.store._id),
                            ).size
                          }
                        </span>
                      </div>
                      {safeCart.updatedAt && (
                        <div className="flex justify-between">
                          <span>Last Updated:</span>
                          <span className="font-medium text-xs">
                            {new Date(safeCart.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-xl p-12">
                <ShoppingCart
                  size={64}
                  className="mx-auto text-purple-400 mb-4"
                />
                <h2 className="text-2xl font-semibold text-white mb-2">
                  Your cart is empty
                </h2>
                <p className="text-purple-300 mb-6">
                  Looks like you haven't added any items to your cart yet. Start
                  shopping to fill it up!
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => navigate("/products")}
                    className="bg-purple-700 text-white px-8 py-3 rounded-lg font-semibold hover:bg-purple-800 transition-colors"
                  >
                    Start Shopping
                  </button>
                  <div className="text-sm text-purple-300">
                    Or{" "}
                    <button
                      onClick={() => navigate("/stores")}
                      className="text-purple-400 hover:underline"
                    >
                      browse stores
                    </button>{" "}
                    to discover new products
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
