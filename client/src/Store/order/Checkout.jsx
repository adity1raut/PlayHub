import React, { useState, useEffect } from "react";
import { useProduct } from "../../context/ProductContext";
import { useAuth } from "../../context/AuthContext";
import {
  MapPin,
  CreditCard,
  CheckCircle,
  Loader2,
  Navigation,
  ArrowLeft,
  Store,
  Plus,
  Edit,
  Trash2,
  X,
} from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from "react-router-dom";
import GamingBackground from "../../GamingBackground/GamingBackground";

export function Checkout() {
  const navigate = useNavigate();
  const {
    createOrder,
    verifyPayment,
    saveOrderLocation,
    orderLoading,
    fetchCart,
    addresses,
    getUserAddresses,
    addDeliveryAddress,
    updateAddress,
    deleteAddress,
    addressLoading,
    cart,
  } = useProduct();
  const { user } = useAuth();

  const [selectedAddress, setSelectedAddress] = useState("");
  const [paymentStep, setPaymentStep] = useState("address");
  const [orderData, setOrderData] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);

  // Address form states
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [addressForm, setAddressForm] = useState({
    name: "",
    phone: "",
    street: "",
    city: "",
    state: "",
    zipCode: "",
    country: "India",
  });

  // Load addresses when component mounts
  useEffect(() => {
    getUserAddresses();
  }, []);

  // Auto-select first address if available
  useEffect(() => {
    if (addresses.length > 0 && !selectedAddress) {
      setSelectedAddress(addresses[0]._id);
    }
  }, [addresses, selectedAddress]);

  const handleAddressSelect = (addressId) => setSelectedAddress(addressId);

  const resetAddressForm = () => {
    setAddressForm({
      name: "",
      phone: "",
      street: "",
      city: "",
      state: "",
      zipCode: "",
      country: "India",
    });
    setEditingAddress(null);
    setShowAddressForm(false);
  };

  const handleAddressFormChange = (e) => {
    setAddressForm({
      ...addressForm,
      [e.target.name]: e.target.value,
    });
  };

  const handleAddAddress = () => {
    setShowAddressForm(true);
    resetAddressForm();
  };

  const handleEditAddress = (address) => {
    setAddressForm({
      name: address.name,
      phone: address.phone,
      street: address.street,
      city: address.city,
      state: address.state,
      zipCode: address.zipCode,
      country: address.country || "India",
    });
    setEditingAddress(address._id);
    setShowAddressForm(true);
  };

  const handleDeleteAddress = async (addressId) => {
    if (window.confirm("Are you sure you want to delete this address?")) {
      const result = await deleteAddress(addressId);
      if (result.success) {
        toast.success(result.message);
        // Clear selected address if it was deleted
        if (selectedAddress === addressId) {
          setSelectedAddress("");
        }
      } else {
        toast.error(result.message);
      }
    }
  };

  const handleSaveAddress = async (e) => {
    e.preventDefault();

    // Validate form
    if (
      !addressForm.name ||
      !addressForm.phone ||
      !addressForm.street ||
      !addressForm.city ||
      !addressForm.state ||
      !addressForm.zipCode
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate phone number
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(addressForm.phone)) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }

    // Validate zipCode
    const zipCodeRegex = /^\d{6}$/;
    if (!zipCodeRegex.test(addressForm.zipCode)) {
      toast.error("Please enter a valid 6-digit zip code");
      return;
    }

    let result;
    if (editingAddress) {
      result = await updateAddress(editingAddress, addressForm);
    } else {
      result = await addDeliveryAddress(addressForm);
    }

    if (result.success) {
      toast.success(result.message);
      resetAddressForm();
      // Auto-select the new/updated address
      if (result.data?.address?._id) {
        setSelectedAddress(result.data.address._id);
      } else if (result.data?.addressId) {
        setSelectedAddress(result.data.addressId);
      }
    } else {
      toast.error(result.message);
    }
  };

  // Function to get user's current location
  const getCurrentLocation = () => {
    setGettingLocation(true);

    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by this browser");
      setGettingLocation(false);
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date().toISOString(),
        };

        setUserLocation(location);
        setGettingLocation(false);

        toast.success("Location captured successfully!");

        // Save location to order if we have an orderId
        if (orderData?.orderId) {
          saveLocationToOrder(location);
        }
      },
      (error) => {
        setGettingLocation(false);
        let errorMessage = "Unable to get location";

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location access denied by user";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information unavailable";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out";
            break;
          default:
            errorMessage = "An unknown error occurred";
        }

        toast.error(errorMessage);
        console.error("Geolocation error:", error);
      },
      options,
    );
  };

  // Function to save location to order using ProductContext
  const saveLocationToOrder = async (location) => {
    if (!orderData?.orderId) {
      console.warn("No order ID available to save location");
      return;
    }

    setSavingLocation(true);
    try {
      const result = await saveOrderLocation(orderData.orderId, location);

      if (result.success) {
        toast.success(
          result.message || "Location saved to order successfully!",
        );
      } else {
        toast.error(result.message || "Failed to save location");
      }
    } catch (error) {
      console.error("Error saving location:", error);
      toast.error("Failed to save location");
    } finally {
      setSavingLocation(false);
    }
  };

  const proceedToPayment = async () => {
    if (!selectedAddress) {
      toast.error("Please select an address");
      return;
    }

    // Check if cart is empty
    if (!cart.items || cart.items.length === 0) {
      toast.error("Your cart is empty");
      navigate("/cart");
      return;
    }

    const result = await createOrder(selectedAddress);
    if (result.success) {
      setOrderData(result.data);
      initiateRazorpayPayment(result.data);
    } else {
      toast.error(result.message);
    }
  };

  const initiateRazorpayPayment = (orderData) => {
    const options = {
      key: orderData.key,
      amount: orderData.amount * 100,
      currency: orderData.currency,
      name: orderData.name,
      description: orderData.description,
      order_id: orderData.orderId,
      prefill: orderData.prefill,
      theme: orderData.theme,
      handler: async (response) => {
        const paymentData = {
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          addressId: selectedAddress,
        };

        const result = await verifyPayment(paymentData);
        if (result.success) {
          setPaymentStep("success");
          setOrderData(result.data);

          // Clear cart after successful payment
          await fetchCart();

          // Automatically get location after successful payment
          toast.success("Payment successful! Getting your location...");
          setTimeout(() => {
            getCurrentLocation();
          }, 1000);
        } else {
          toast.error(result.message);
        }
      },
      modal: {
        ondismiss: () => {
          console.log("Payment modal closed");
        },
      },
    };

    if (window.Razorpay) {
      const rzp = new window.Razorpay(options);
      rzp.open();
    } else {
      toast.error("Razorpay SDK not loaded");
    }
  };

  if (paymentStep === "success") {
    return (
      <div className="bg-gradient-to-br from-gray-900 via-black to-purple-900 min-h-screen p-4 pt-32">
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
        />

        <div className="max-w-4xl mx-auto">
          {/* Navigation */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigate("/products")}
              className="group relative px-4 py-2 bg-gradient-to-r from-gray-700 to-gray-800 text-gray-300 rounded-lg transition-all duration-300 shadow-md hover:shadow-purple-700/30 hover:translate-y-[-1px] overflow-hidden border border-gray-600 hover:border-purple-500"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-purple-800/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
              <span className="relative flex items-center gap-2">
                <ArrowLeft
                  size={20}
                  className="text-purple-400 group-hover:text-purple-300 transition-colors"
                />
                <span className="font-medium group-hover:text-white transition-colors">
                  Continue Shopping
                </span>
              </span>
            </button>

            <button
              onClick={() => navigate("/my-store")}
              className="group relative px-4 py-2 bg-gradient-to-r from-purple-700 to-purple-800 text-purple-300 rounded-lg transition-all duration-300 shadow-md hover:shadow-purple-500/30 hover:translate-y-[-1px] overflow-hidden border border-purple-600 hover:border-purple-400"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-purple-700/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
              <span className="relative flex items-center gap-2">
                <Store
                  size={20}
                  className="text-purple-400 group-hover:text-purple-200 transition-colors"
                />
                <span className="font-medium group-hover:text-white transition-colors">
                  My Store
                </span>
              </span>
            </button>
          </div>

          <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl p-8">
            <div className="text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-green-400 mb-4">
                Payment Successful!
              </h2>
              <p className="text-purple-300 mb-6">
                Your order has been placed successfully
              </p>

              {/* Location Section */}
              <div className="bg-gray-900 rounded-lg p-6 mb-6 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <Navigation className="h-5 w-5" />
                    Delivery Location
                  </h3>
                  {!userLocation && (
                    <button
                      onClick={getCurrentLocation}
                      disabled={gettingLocation}
                      className="flex items-center gap-2 px-3 py-1 bg-purple-700 text-white rounded-lg hover:bg-purple-800 disabled:opacity-50 text-sm transition-colors"
                    >
                      {gettingLocation ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Getting Location...
                        </>
                      ) : (
                        <>
                          <MapPin className="h-4 w-4" />
                          Get Location
                        </>
                      )}
                    </button>
                  )}
                </div>

                {userLocation ? (
                  <div className="text-sm text-purple-300 space-y-2">
                    <div className="flex items-center gap-2 text-green-400 mb-2">
                      <CheckCircle className="h-4 w-4" />
                      <span>
                        Location captured{" "}
                        {savingLocation ? "and saving..." : "successfully!"}
                      </span>
                      {savingLocation && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                    </div>
                    <div className="text-left bg-gray-800 rounded p-3 space-y-1">
                      <div className="flex justify-between">
                        <span>Latitude:</span>
                        <span className="font-mono">
                          {userLocation.latitude.toFixed(6)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Longitude:</span>
                        <span className="font-mono">
                          {userLocation.longitude.toFixed(6)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Accuracy:</span>
                        <span>{Math.round(userLocation.accuracy)} meters</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Captured:</span>
                        <span>
                          {new Date(
                            userLocation.timestamp,
                          ).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-yellow-400 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>
                      Location not captured yet. Click "Get Location" to capture
                      your current position for delivery tracking.
                    </span>
                  </div>
                )}
              </div>

              {/* Order Details */}
              <div className="bg-gray-900 rounded-lg p-6 mb-6 border border-gray-700">
                <h3 className="font-semibold mb-4 text-white">Order Details</h3>
                <div className="space-y-2 text-sm text-purple-300">
                  <div className="flex justify-between">
                    <span>Order ID:</span>
                    <span className="font-mono">
                      {orderData?.orderNumber || orderData?.orderId}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Payment ID:</span>
                    <span className="font-mono">{orderData?.paymentId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Amount:</span>
                    <span>₹{orderData?.amount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Order Status:</span>
                    <span className="text-green-400 capitalize">
                      {orderData?.orderStatus || "confirmed"}
                    </span>
                  </div>
                  {orderData?.estimatedDelivery && (
                    <div className="flex justify-between">
                      <span>Expected Delivery:</span>
                      <span>
                        {new Date(
                          orderData.estimatedDelivery,
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => navigate("/orders")}
                  className="w-full px-6 py-3 bg-purple-700 text-white rounded-lg hover:bg-purple-800 transition-colors font-semibold"
                >
                  View My Orders
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => navigate("/products")}
                    className="px-6 py-2 border border-purple-700 text-purple-300 rounded-lg hover:bg-purple-900 transition-colors"
                  >
                    Continue Shopping
                  </button>

                  <button
                    onClick={() => navigate("/wishlist")}
                    className="px-6 py-2 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    View Wishlist
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-900 via-black to-purple-900 pb-20 p-4 pt-32">
      <GamingBackground />
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
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate("/cart")}
            className="group relative px-4 py-2 bg-gradient-to-r from-gray-700 to-gray-800 text-gray-300 rounded-lg transition-all duration-300 shadow-md hover:shadow-purple-700/30 hover:translate-y-[-1px] overflow-hidden border border-gray-600 hover:border-purple-500"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-purple-800/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
            <span className="relative flex items-center gap-2">
              <ArrowLeft
                size={20}
                className="text-purple-400 group-hover:text-purple-300 transition-colors"
              />
              <span className="font-medium group-hover:text-white transition-colors">
                Back to Cart
              </span>
            </span>
          </button>

          <button
            onClick={() => navigate("/my-store")}
            className="group relative px-4 py-2 bg-gradient-to-r from-purple-700 to-purple-800 text-purple-300 rounded-lg transition-all duration-300 shadow-md hover:shadow-purple-500/30 hover:translate-y-[-1px] overflow-hidden border border-purple-600 hover:border-purple-400"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-purple-700/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
            <span className="relative flex items-center gap-2">
              <Store
                size={20}
                className="text-purple-400 group-hover:text-purple-200 transition-colors"
              />
              <span className="font-medium group-hover:text-white transition-colors">
                My Store
              </span>
            </span>
          </button>
        </div>

        <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-purple-800 to-purple-900 px-8 py-6 border-b border-gray-700">
            <div className="flex items-center justify-center mb-2">
              <CreditCard className="w-6 h-6 text-purple-400 mr-2" />
              <h1 className="text-3xl font-bold text-white text-center">
                Checkout
              </h1>
            </div>
            <p className="text-purple-300 text-center mt-2 text-sm">
              Complete your order securely with Razorpay
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-8 py-10">
            {/* Address Selection Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold flex items-center gap-2 text-white">
                  <MapPin className="h-5 w-5" />
                  Select Delivery Address
                </h3>
                <button
                  onClick={handleAddAddress}
                  className="flex items-center gap-2 px-3 py-1 bg-purple-700 text-white rounded-lg hover:bg-purple-800 transition-colors text-sm"
                >
                  <Plus className="h-4 w-4" />
                  Add New
                </button>
              </div>

              {/* Address Form Modal */}
              {showAddressForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                  <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold text-white">
                        {editingAddress ? "Edit Address" : "Add New Address"}
                      </h4>
                      <button
                        onClick={resetAddressForm}
                        className="text-gray-400 hover:text-white"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <form onSubmit={handleSaveAddress} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={addressForm.name}
                          onChange={handleAddressFormChange}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Phone Number *
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          value={addressForm.phone}
                          onChange={handleAddressFormChange}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                          placeholder="10-digit mobile number"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Street Address *
                        </label>
                        <input
                          type="text"
                          name="street"
                          value={addressForm.street}
                          onChange={handleAddressFormChange}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">
                            City *
                          </label>
                          <input
                            type="text"
                            name="city"
                            value={addressForm.city}
                            onChange={handleAddressFormChange}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">
                            State *
                          </label>
                          <input
                            type="text"
                            name="state"
                            value={addressForm.state}
                            onChange={handleAddressFormChange}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">
                            ZIP Code *
                          </label>
                          <input
                            type="text"
                            name="zipCode"
                            value={addressForm.zipCode}
                            onChange={handleAddressFormChange}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                            placeholder="6-digit PIN"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">
                            Country
                          </label>
                          <input
                            type="text"
                            name="country"
                            value={addressForm.country}
                            onChange={handleAddressFormChange}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      </div>

                      <div className="flex gap-3 pt-4">
                        <button
                          type="button"
                          onClick={resetAddressForm}
                          className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={addressLoading}
                          className="flex-1 px-4 py-2 bg-purple-700 text-white rounded-lg hover:bg-purple-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                        >
                          {addressLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : editingAddress ? (
                            "Update Address"
                          ) : (
                            "Save Address"
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Address List */}
              <div className="space-y-3">
                {addressLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
                    <span className="ml-2 text-purple-300">
                      Loading addresses...
                    </span>
                  </div>
                ) : addresses.length > 0 ? (
                  addresses.map((address) => (
                    <div
                      key={address._id}
                      className={`p-4 border rounded-lg transition-colors ${
                        selectedAddress === address._id
                          ? "border-purple-500 bg-purple-900"
                          : "border-gray-700 hover:border-purple-400 bg-gray-900"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div
                          onClick={() => handleAddressSelect(address._id)}
                          className="flex items-start gap-3 cursor-pointer flex-1"
                        >
                          <input
                            type="radio"
                            checked={selectedAddress === address._id}
                            onChange={() => handleAddressSelect(address._id)}
                            className="text-purple-600 accent-purple-600 mt-1"
                          />
                          <div>
                            <p className="font-medium text-white">
                              {address.name}
                            </p>
                            <p className="text-sm text-purple-300">
                              {address.street}, {address.city}, {address.state}{" "}
                              - {address.zipCode}
                            </p>
                            <p className="text-sm text-purple-400">
                              Phone: {address.phone}
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => handleEditAddress(address)}
                            className="p-1 text-gray-400 hover:text-purple-400 transition-colors"
                            title="Edit address"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteAddress(address._id)}
                            className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                            title="Delete address"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-purple-300 p-6 bg-gray-900 rounded-lg border border-gray-700 text-center">
                    <MapPin className="h-12 w-12 text-gray-500 mx-auto mb-3" />
                    <p className="mb-3">No addresses found</p>
                    <button
                      onClick={handleAddAddress}
                      className="text-purple-400 hover:text-purple-300 underline text-sm"
                    >
                      Add your first address →
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Section */}
            <div>
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
                <CreditCard className="h-5 w-5" />
                Payment Method
              </h3>
              <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center gap-3 mb-4">
                  <img
                    src="https://razorpay.com/assets/razorpay-logo.svg"
                    alt="Razorpay"
                    className="h-6"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                  <span className="text-white font-medium">
                    Secure Payment Gateway
                  </span>
                </div>
                <p className="text-sm text-purple-300 mb-4">
                  You will be redirected to Razorpay for secure payment
                  processing. We accept:
                </p>
                <div className="flex flex-wrap gap-2 mb-6 text-xs text-gray-400">
                  <span className="bg-gray-800 px-2 py-1 rounded">
                    Credit Cards
                  </span>
                  <span className="bg-gray-800 px-2 py-1 rounded">
                    Debit Cards
                  </span>
                  <span className="bg-gray-800 px-2 py-1 rounded">
                    Net Banking
                  </span>
                  <span className="bg-gray-800 px-2 py-1 rounded">UPI</span>
                  <span className="bg-gray-800 px-2 py-1 rounded">Wallets</span>
                </div>

                {/* Order Summary */}
                {cart.items && cart.items.length > 0 && (
                  <div className="bg-gray-800 rounded-lg p-4 mb-4">
                    <h4 className="text-white font-medium mb-3">
                      Order Summary
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-purple-300">
                        <span>Items ({cart.items.length})</span>
                        <span>₹{cart.totalAmount}</span>
                      </div>
                      <div className="flex justify-between text-purple-300">
                        <span>Delivery</span>
                        <span className="text-green-400">Free</span>
                      </div>
                      <hr className="border-gray-700" />
                      <div className="flex justify-between text-white font-semibold">
                        <span>Total Amount</span>
                        <span>₹{cart.totalAmount}</span>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={proceedToPayment}
                  disabled={
                    !selectedAddress ||
                    orderLoading ||
                    !cart.items ||
                    cart.items.length === 0
                  }
                  className="w-full py-3 bg-purple-700 text-white rounded-lg hover:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors font-semibold"
                >
                  {orderLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Processing Order...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-5 w-5" />
                      Proceed to Payment
                    </>
                  )}
                </button>

                {!selectedAddress && (
                  <p className="text-red-400 text-sm mt-2 text-center">
                    Please select a delivery address to continue
                  </p>
                )}

                {(!cart.items || cart.items.length === 0) && (
                  <p className="text-red-400 text-sm mt-2 text-center">
                    Your cart is empty
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Checkout;
