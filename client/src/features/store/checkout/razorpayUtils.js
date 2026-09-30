import { useState } from "react";

export const loadRazorpayScript = () => {
  return new Promise((resolve) => {
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
 * @param {number} amount - Amount in rupees
 */
export const formatAmount = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

export const validatePaymentResponse = (response) => {
  return !!(
    response.razorpay_payment_id &&
    response.razorpay_order_id &&
    response.razorpay_signature
  );
};

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
