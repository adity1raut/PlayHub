// utils/razorpayUtils.js
import { useState } from "react";

/**
 * Load Razorpay script dynamically
 */
export const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    // Check if script is already loaded
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => {
      resolve(true);
    };
    script.onerror = () => {
      resolve(false);
    };
    document.body.appendChild(script);
  });
};

/**
 * Initialize Razorpay payment
 * @param {Object} options - Razorpay options
 * @param {Function} onSuccess - Success callback
 * @param {Function} onError - Error callback
 */
export const initiatePayment = async (options, onSuccess, onError) => {
  try {
    const isLoaded = await loadRazorpayScript();

    if (!isLoaded) {
      throw new Error("Razorpay SDK failed to load");
    }

    const razorpayOptions = {
      ...options,
      handler: (response) => {
        onSuccess(response);
      },
      modal: {
        ondismiss: () => {
          console.log("Payment modal closed");
          if (onError) {
            onError("Payment cancelled by user");
          }
        },
      },
    };

    const rzp = new window.Razorpay(razorpayOptions);
    rzp.open();
  } catch (error) {
    console.error("Payment initiation error:", error);
    if (onError) {
      onError(error.message);
    }
  }
};

/**
 * Format amount for display
 * @param {number} amount - Amount in rupees
 * @returns {string} Formatted amount
 */
export const formatAmount = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

/**
 * Validate payment response
 * @param {Object} response - Razorpay response
 * @returns {boolean} Is valid response
 */
export const validatePaymentResponse = (response) => {
  return !!(
    response.razorpay_payment_id &&
    response.razorpay_order_id &&
    response.razorpay_signature
  );
};

// Custom hook for Razorpay integration
export const useRazorpay = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const makePayment = async (orderData, onSuccess) => {
    setIsLoading(true);
    setError(null);

    try {
      await initiatePayment(
        orderData,
        (response) => {
          setIsLoading(false);
          if (validatePaymentResponse(response)) {
            onSuccess(response);
          } else {
            setError("Invalid payment response");
          }
        },
        (error) => {
          setIsLoading(false);
          setError(error);
        },
      );
    } catch (err) {
      setIsLoading(false);
      setError(err.message);
    }
  };

  return {
    makePayment,
    isLoading,
    error,
    clearError: () => setError(null),
  };
};
