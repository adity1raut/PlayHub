import React, { useState, useEffect } from "react";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Timer,
  CheckCircle,
  ArrowLeft,
  Gamepad2,
} from "lucide-react";
import { toast } from "react-hot-toast";

const ForgetPassword = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    identifier: "",
    otp: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [buttonLoading, setButtonLoading] = useState({
    sendOTP: false,
    resendOTP: false,
    verifyOTP: false,
    resetPassword: false,
  });

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const setButtonLoadingState = (button, isLoading) => {
    setButtonLoading((prev) => ({
      ...prev,
      [button]: isLoading,
    }));
  };

  const sendOTP = async () => {
    if (!formData.identifier.trim()) {
      toast.error("Please enter your email or username");
      return;
    }

    setButtonLoadingState("sendOTP", true);

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/api/auth/send-reset-otp`,
        { identifier: formData.identifier },
        { headers: { "Content-Type": "application/json" } },
      );

      if (res.data.success) {
        toast.success("🎮 Recovery code sent to your email!");
        setStep(2);
        setCountdown(120);
      } else {
        toast.error(res.data.message || "Failed to send OTP");
      }
    } catch (error) {
      toast.error("Failed to send OTP. Please check your connection.");
    } finally {
      setButtonLoadingState("sendOTP", false);
    }
  };

  const resendOTP = async () => {
    setButtonLoadingState("resendOTP", true);

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/api/auth/resend-reset-otp`,
        { identifier: formData.identifier },
        { headers: { "Content-Type": "application/json" } },
      );

      if (res.data.success) {
        toast.success("🔄 New recovery code sent!");
        setCountdown(120);
      } else {
        toast.error(res.data.message || "Failed to resend OTP");
      }
    } catch (error) {
      toast.error("Failed to resend OTP. Please check your connection.");
    } finally {
      setButtonLoadingState("resendOTP", false);
    }
  };

  const verifyOTP = async () => {
    if (!formData.otp.trim() || formData.otp.length !== 4) {
      toast.error("Please enter a valid 4-digit OTP");
      return;
    }

    setButtonLoadingState("verifyOTP", true);

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/api/auth/verify-reset-otp`,
        {
          identifier: formData.identifier,
          otp: formData.otp,
        },
        { headers: { "Content-Type": "application/json" } },
      );

      if (res.data.success) {
        toast.success("🔓 Security code verified! Access granted!");
        setStep(3);
      } else {
        toast.error(res.data.message || "Invalid or expired OTP");
      }
    } catch (error) {
      toast.error("Failed to verify OTP. Please try again.");
    } finally {
      setButtonLoadingState("verifyOTP", false);
    }
  };

  const resetPassword = async () => {
    if (!formData.newPassword) {
      toast.error("Please enter a new password");
      return;
    }

    if (formData.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setButtonLoadingState("resetPassword", true);

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/api/auth/reset-password`,
        {
          identifier: formData.identifier,
          newPassword: formData.newPassword,
        },
        { headers: { "Content-Type": "application/json" } },
      );

      if (res.data.success) {
        toast.success("🎮 Password updated successfully! Welcome back, gamer!");
        setStep(4);
      } else {
        toast.error(res.data.message || "Failed to reset password");
      }
    } catch (error) {
      toast.error("Failed to reset password. Please try again.");
    } finally {
      setButtonLoadingState("resetPassword", false);
    }
  };

  const handleBackToLogin = () => {
    // Reset form data
    setFormData({
      identifier: "",
      otp: "",
      newPassword: "",
      confirmPassword: "",
    });
    setStep(1);
    setCountdown(0);
  };

  const handleKeyPress = (e, action) => {
    if (e.key === "Enter") {
      action();
    }
  };

  const LoadingSpinner = ({ size = "5" }) => (
    <div
      className={`animate-spin rounded-full h-${size} w-${size} border-b-2 border-white mr-2`}
    >
      <div
        className={`animate-pulse rounded-full h-${size} w-${size} border-2 border-transparent border-t-purple-300`}
      ></div>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-purple-900 rounded-full flex items-center justify-center mb-4 border border-purple-600">
          <Mail className="w-8 h-8 text-purple-400" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">Forgot Password?</h2>
        <p className="text-gray-400">
          No worries! Enter your email or username and we'll send you an OTP to
          reset your password.
        </p>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            name="identifier"
            value={formData.identifier}
            onChange={handleInputChange}
            onKeyPress={(e) => handleKeyPress(e, sendOTP)}
            placeholder="Email or Username"
            className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-white placeholder-gray-500"
            disabled={buttonLoading.sendOTP}
          />
        </div>

        <button
          onClick={sendOTP}
          disabled={buttonLoading.sendOTP || !formData.identifier.trim()}
          className={`w-full py-3 px-4 rounded-lg focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all font-medium tracking-wide transform ${
            buttonLoading.sendOTP
              ? "bg-purple-800 scale-95 cursor-wait"
              : "bg-purple-700 hover:bg-purple-600 hover:scale-105 active:scale-95"
          } text-white`}
        >
          {buttonLoading.sendOTP ? (
            <>
              <LoadingSpinner />
              <span className="animate-pulse">Sending OTP...</span>
            </>
          ) : (
            <>
              <Mail className="w-5 h-5 mr-2" />
              Send OTP
            </>
          )}
        </button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-purple-900 rounded-full flex items-center justify-center mb-4 border border-purple-600">
          <Timer className="w-8 h-8 text-purple-400" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">Enter OTP</h2>
        <p className="text-gray-400 mb-2">
          We've sent a 4-digit verification code to your email address
        </p>
        <p className="text-sm text-purple-400 font-medium">
          {formData.identifier}
        </p>

        {countdown > 0 && (
          <div className="flex items-center justify-center mt-3 bg-purple-900 rounded-full py-2 px-4 inline-flex border border-purple-700">
            <Timer className="w-4 h-4 mr-2 text-purple-400" />
            <span className="text-sm text-purple-300 font-medium">
              Code expires in {Math.floor(countdown / 60)}:
              {(countdown % 60).toString().padStart(2, "0")}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="relative">
          <input
            type="text"
            name="otp"
            value={formData.otp}
            onChange={(e) => {
              if (/^\d{0,4}$/.test(e.target.value)) {
                handleInputChange(e);
              }
            }}
            onKeyPress={(e) => handleKeyPress(e, verifyOTP)}
            placeholder="0000"
            maxLength="4"
            className="w-full text-center text-3xl font-mono py-4 bg-gray-800 border-2 border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 tracking-widest transition-all text-white"
            disabled={buttonLoading.verifyOTP}
          />
        </div>

        <button
          onClick={verifyOTP}
          disabled={buttonLoading.verifyOTP || formData.otp.length !== 4}
          className={`w-full py-3 px-4 rounded-lg focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all font-medium tracking-wide transform ${
            buttonLoading.verifyOTP
              ? "bg-purple-800 scale-95 cursor-wait"
              : "bg-purple-700 hover:bg-purple-600 hover:scale-105 active:scale-95"
          } text-white`}
        >
          {buttonLoading.verifyOTP ? (
            <>
              <LoadingSpinner />
              <span className="animate-pulse">Verifying...</span>
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5 mr-2" />
              Verify OTP
            </>
          )}
        </button>

        <div className="text-center space-y-2">
          <p className="text-gray-400">Didn't receive the code?</p>
          <button
            onClick={resendOTP}
            disabled={buttonLoading.resendOTP || countdown > 0}
            className={`text-purple-400 hover:text-purple-300 disabled:text-gray-600 disabled:cursor-not-allowed font-medium transition-all flex items-center justify-center mx-auto ${
              buttonLoading.resendOTP ? "animate-pulse" : ""
            }`}
          >
            {buttonLoading.resendOTP ? (
              <>
                <LoadingSpinner size="4" />
                Resending...
              </>
            ) : countdown > 0 ? (
              `Resend in ${countdown}s`
            ) : (
              "Resend OTP"
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-purple-900 rounded-full flex items-center justify-center mb-4 border border-purple-600">
          <Lock className="w-8 h-8 text-purple-400" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">
          Create New Password
        </h2>
        <p className="text-gray-400">
          Choose a strong password to secure your account
        </p>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type={showPassword ? "text" : "password"}
            name="newPassword"
            value={formData.newPassword}
            onChange={handleInputChange}
            placeholder="New Password"
            className="w-full pl-10 pr-12 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-white placeholder-gray-500"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
          >
            {showPassword ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        </div>

        <div className="relative">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type={showConfirmPassword ? "text" : "password"}
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            onKeyPress={(e) => handleKeyPress(e, resetPassword)}
            placeholder="Confirm New Password"
            className="w-full pl-10 pr-12 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-white placeholder-gray-500"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
          >
            {showConfirmPassword ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>Password must:</p>
          <ul className="ml-4 space-y-1">
            <li
              className={`flex items-center ${
                formData.newPassword.length >= 6
                  ? "text-green-400"
                  : "text-gray-500"
              }`}
            >
              <div
                className={`w-1 h-1 rounded-full mr-2 ${
                  formData.newPassword.length >= 6
                    ? "bg-green-400"
                    : "bg-gray-500"
                }`}
              ></div>
              Be at least 6 characters long
            </li>
            <li
              className={`flex items-center ${
                formData.newPassword &&
                formData.confirmPassword &&
                formData.newPassword === formData.confirmPassword
                  ? "text-green-400"
                  : "text-gray-500"
              }`}
            >
              <div
                className={`w-1 h-1 rounded-full mr-2 ${
                  formData.newPassword &&
                  formData.confirmPassword &&
                  formData.newPassword === formData.confirmPassword
                    ? "bg-green-400"
                    : "bg-gray-500"
                }`}
              ></div>
              Match the confirmation password
            </li>
          </ul>
        </div>

        <button
          onClick={resetPassword}
          disabled={
            buttonLoading.resetPassword ||
            !formData.newPassword ||
            !formData.confirmPassword
          }
          className={`w-full py-3 px-4 rounded-lg focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all font-medium tracking-wide transform ${
            buttonLoading.resetPassword
              ? "bg-purple-800 scale-95 cursor-wait"
              : "bg-purple-700 hover:bg-purple-600 hover:scale-105 active:scale-95"
          } text-white`}
        >
          {buttonLoading.resetPassword ? (
            <>
              <LoadingSpinner />
              <span className="animate-pulse">Updating Password...</span>
            </>
          ) : (
            <>
              <Lock className="w-5 h-5 mr-2" />
              Update Password
            </>
          )}
        </button>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6 text-center">
      <div className="mx-auto w-20 h-20 bg-purple-900 rounded-full flex items-center justify-center border border-purple-600">
        <CheckCircle className="w-10 h-10 text-green-400" />
      </div>

      <div className="space-y-3">
        <h2 className="text-3xl font-bold text-white">Success!</h2>
        <p className="text-gray-400">
          Your password has been successfully reset. You can now login with your
          new password.
        </p>
      </div>

      <div className="space-y-3">
        <button
          onClick={handleBackToLogin}
          className="w-full bg-purple-700 text-white py-3 px-4 rounded-lg hover:bg-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all font-medium tracking-wide"
        >
          Back to Login
        </button>
        <p className="text-sm text-gray-500">
          Redirecting you to the login page in a few seconds...
        </p>
      </div>
    </div>
  );

  // Auto redirect after success
  useEffect(() => {
    if (step === 4) {
      const timer = setTimeout(() => {
        handleBackToLogin();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [step]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full">
        {/* Gaming-themed header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mb-2">
            <Gamepad2 className="w-8 h-8 text-purple-500 mr-2" />
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
              GAME PORTAL
            </h1>
          </div>
          <p className="text-xs text-gray-500 tracking-widest">
            POWER UP YOUR ACCOUNT
          </p>
        </div>

        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`w-3 h-3 rounded-full ${
                  s <= step ? "bg-purple-600" : "bg-gray-700"
                } transition-all`}
              />
            ))}
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl p-8 relative overflow-hidden">
          {/* Subtle gaming pattern in background */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-0 left-0 w-32 h-32 border-4 border-white rounded-full transform -translate-x-16 -translate-y-16"></div>
            <div className="absolute bottom-0 right-0 w-32 h-32 border-4 border-white rounded-full translate-x-16 translate-y-16"></div>
          </div>

          {/* Back button - only show before success */}
          {step < 4 && step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center text-gray-400 hover:text-gray-200 mb-6 transition-colors z-10 relative"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </button>
          )}

          {/* Step content */}
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </div>
      </div>
    </div>
  );
};

export default ForgetPassword;
