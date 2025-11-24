import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";

const backendUrl = import.meta.env.VITE_BACKEND_URL;
import GamingBackground from "../../GamingBackground/GamingBackground";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Check,
  X,
  Loader,
  UserCheck,
  Shield,
  Send,
  RefreshCw,
  Gamepad2,
  ArrowRight,
  Zap,
  Trophy,
  Target,
} from "lucide-react";

// Toast component
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor =
    type === "success"
      ? "bg-green-600"
      : type === "error"
        ? "bg-red-600"
        : "bg-purple-600";
  const icon =
    type === "success" ? (
      <Check size={20} />
    ) : type === "error" ? (
      <X size={20} />
    ) : (
      <Shield size={20} />
    );

  return (
    <div
      className={`fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-slide-in`}
    >
      {icon}
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-80">
        <X size={16} />
      </button>
    </div>
  );
};

// Toast hook
const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return { toasts, addToast, removeToast };
};

const RegistrationForm = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    name: "",
    password: "",
    confirmPassword: "",
    otp: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nextStepLoading, setNextStepLoading] = useState(false);
  const [availability, setAvailability] = useState({});
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);

  const { toasts, addToast, removeToast } = useToast();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/profile/me");
    }
  }, [isAuthenticated, navigate]);

  // Timer for OTP resend
  useEffect(() => {
    let interval;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear availability check when user types
    if (name === "username" || name === "email") {
      setAvailability((prev) => ({ ...prev, [name]: null }));
    }
  };

  const checkAvailability = async (field) => {
    if (!formData[field]) return;

    try {
      setAvailability((prev) => ({ ...prev, [field]: "checking" }));
      await axios.post(`${backendUrl}/api/auth/check-availability`, {
        identifier: formData[field],
      });
      setAvailability((prev) => ({ ...prev, [field]: "available" }));
    } catch (error) {
      setAvailability((prev) => ({ ...prev, [field]: "unavailable" }));
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Availability check failed";
      addToast(errorMessage, "error");
    }
  };

  const sendOTP = async () => {
    try {
      setLoading(true);
      await axios.post(`${backendUrl}/api/auth/send-otp`, {
        email: formData.email,
      });
      setOtpSent(true);
      setOtpTimer(300); // 5 minutes
      addToast("OTP sent to your email", "success");
    } catch (error) {
      const errorMessage =
        error.response?.data?.message || error.message || "Failed to send OTP";
      addToast(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  const resendOTP = async () => {
    try {
      setLoading(true);
      await axios.post(`${backendUrl}/api/auth/resend-otp`, {
        email: formData.email,
      });
      setOtpTimer(300);
      addToast("New OTP sent to your email", "success");
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to resend OTP";
      addToast(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    try {
      setNextStepLoading(true);
      await axios.post(`${backendUrl}/api/auth/verify-otp`, {
        email: formData.email,
        otp: formData.otp,
      });
      addToast("OTP verified successfully", "success");

      setTimeout(() => {
        setCurrentStep(3);
        setNextStepLoading(false);
      }, 1000);
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "OTP verification failed";
      addToast(errorMessage, "error");
      setNextStepLoading(false);
    }
  };

  const registerUser = async () => {
    if (formData.password !== formData.confirmPassword) {
      addToast("Passwords do not match", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${backendUrl}/api/auth/register`, {
        username: formData.username,
        email: formData.email,
        name: formData.name,
        otp: formData.otp,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });

      if (res.data.success) {
        addToast("Account created successfully!", "success");

        setTimeout(() => {
          navigate("/login", {
            state: {
              message: "Account created successfully! Please log in.",
              email: formData.email,
            },
          });
        }, 2000);
      }
    } catch (error) {
      const errorMessage =
        error.response?.data?.message || error.message || "Registration failed";
      addToast(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  const nextStep = async () => {
    if (currentStep === 1) {
      if (!formData.username || !formData.email || !formData.name) {
        addToast("Please fill all required fields", "error");
        return;
      }
      if (
        availability.username !== "available" ||
        availability.email !== "available"
      ) {
        addToast("Please check username and email availability", "error");
        return;
      }

      setNextStepLoading(true);

      setTimeout(() => {
        setCurrentStep(2);
        setNextStepLoading(false);
      }, 800);
    } else if (currentStep === 2 && otpSent) {
      verifyOTP();
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {[1, 2, 3].map((step) => (
        <React.Fragment key={step}>
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
              currentStep >= step
                ? "bg-purple-600 text-white scale-110"
                : "bg-gray-700 text-gray-400"
            }`}
          >
            {nextStepLoading && currentStep === step - 1 ? (
              <Loader className="animate-spin" size={16} />
            ) : (
              step
            )}
          </div>
          {step < 3 && (
            <div
              className={`w-16 h-1 mx-2 transition-all duration-500 ${
                currentStep > step ? "bg-purple-600" : "bg-gray-700"
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="flex items-center justify-center mb-2">
          <Gamepad2 className="w-6 h-6 text-purple-400 mr-2" />
          <h2 className="text-2xl font-bold text-white">Create Account</h2>
        </div>
        <p className="text-gray-400">Join the gaming community</p>
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Full Name
        </label>
        <div className="relative">
          <User
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"
            size={20}
          />
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-500 transition-all"
            placeholder="Enter your full name"
            required
          />
        </div>
      </div>

      {/* Username */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Username
        </label>
        <div className="relative">
          <UserCheck
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"
            size={20}
          />
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleInputChange}
            onBlur={() => checkAvailability("username")}
            className="w-full pl-10 pr-12 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-500 transition-all"
            placeholder="Choose a username"
            required
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            {availability.username === "checking" && (
              <Loader className="animate-spin text-gray-500" size={20} />
            )}
            {availability.username === "available" && (
              <Check className="text-green-500" size={20} />
            )}
            {availability.username === "unavailable" && (
              <X className="text-red-500" size={20} />
            )}
          </div>
        </div>
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Email
        </label>
        <div className="relative">
          <Mail
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"
            size={20}
          />
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            onBlur={() => checkAvailability("email")}
            className="w-full pl-10 pr-12 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-500 transition-all"
            placeholder="Enter your email"
            required
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            {availability.email === "checking" && (
              <Loader className="animate-spin text-gray-500" size={20} />
            )}
            {availability.email === "available" && (
              <Check className="text-green-500" size={20} />
            )}
            {availability.email === "unavailable" && (
              <X className="text-red-500" size={20} />
            )}
          </div>
        </div>
      </div>

      <button
        onClick={nextStep}
        disabled={
          nextStepLoading ||
          loading ||
          availability.username !== "available" ||
          availability.email !== "available"
        }
        className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all font-medium tracking-wide transform hover:scale-105 active:scale-95"
      >
        {nextStepLoading ? (
          <>
            <Loader className="animate-spin" size={20} />
            <span>Processing...</span>
          </>
        ) : (
          <>
            <span>Next Step</span>
            <ArrowRight
              size={20}
              className="group-hover:translate-x-1 transition-transform"
            />
          </>
        )}
      </button>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="flex items-center justify-center mb-2">
          <Shield className="w-6 h-6 text-purple-400 mr-2" />
          <h2 className="text-2xl font-bold text-white">Verify Email</h2>
        </div>
      </div>

      {!otpSent ? (
        <div className="text-center space-y-4">
          <p className="text-gray-400">We'll send a verification code to:</p>
          <p className="font-medium text-purple-300">{formData.email}</p>
          <button
            onClick={sendOTP}
            disabled={loading}
            className="bg-purple-600 text-white py-3 px-6 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2 mx-auto transition-all transform hover:scale-105 active:scale-95"
          >
            {loading ? (
              <Loader className="animate-spin" size={20} />
            ) : (
              <Send size={20} />
            )}
            Send OTP
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-center text-gray-400">
            Enter the 6-digit code sent to your email
          </p>
          <div className="relative">
            <Shield
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"
              size={20}
            />
            <input
              type="text"
              name="otp"
              value={formData.otp}
              onChange={handleInputChange}
              className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center text-lg tracking-wider text-white transition-all"
              placeholder="000000"
              maxLength="6"
            />
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">
              {otpTimer > 0
                ? `Resend in ${formatTime(otpTimer)}`
                : "OTP expired"}
            </span>
            <button
              onClick={resendOTP}
              disabled={otpTimer > 0 || loading}
              className="text-purple-400 hover:text-purple-300 disabled:opacity-50 flex items-center gap-1 transition-colors"
            >
              <RefreshCw size={16} />
              Resend OTP
            </button>
          </div>

          <button
            onClick={nextStep}
            disabled={nextStepLoading || loading || formData.otp.length !== 6}
            className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all transform hover:scale-105 active:scale-95"
          >
            {nextStepLoading ? (
              <>
                <Loader className="animate-spin" size={20} />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <Check size={20} />
                <span>Verify OTP</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="flex items-center justify-center mb-2">
          <Lock className="w-6 h-6 text-purple-400 mr-2" />
          <h2 className="text-2xl font-bold text-white">Set Password</h2>
        </div>
      </div>

      {/* Password */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Password
        </label>
        <div className="relative">
          <Lock
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"
            size={20}
          />
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            className="w-full pl-10 pr-12 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-500 transition-all"
            placeholder="Create a password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
      </div>

      {/* Confirm Password */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Confirm Password
        </label>
        <div className="relative">
          <Lock
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"
            size={20}
          />
          <input
            type={showConfirmPassword ? "text" : "password"}
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            className="w-full pl-10 pr-12 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-500 transition-all"
            placeholder="Confirm your password"
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
          >
            {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
      </div>

      {formData.password && formData.confirmPassword && (
        <div className="flex items-center gap-2">
          {formData.password === formData.confirmPassword ? (
            <>
              <Check className="text-green-500" size={16} />
              <span className="text-green-400 text-sm">Passwords match</span>
            </>
          ) : (
            <>
              <X className="text-red-500" size={16} />
              <span className="text-red-400 text-sm">
                Passwords don't match
              </span>
            </>
          )}
        </div>
      )}

      <button
        onClick={registerUser}
        disabled={
          loading ||
          formData.password !== formData.confirmPassword ||
          !formData.password
        }
        className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all font-medium tracking-wide transform hover:scale-105 active:scale-95"
      >
        {loading ? (
          <>
            <Loader className="animate-spin" size={20} />
            <span>Creating Account...</span>
          </>
        ) : (
          <>
            <UserCheck size={20} />
            <span>Create Account</span>
          </>
        )}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Gaming Background */}
      <GamingBackground />

      <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl p-8 w-full max-w-md relative overflow-hidden z-10">
        {/* Subtle gaming pattern in background */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 left-0 w-32 h-32 border-4 border-white rounded-full transform -translate-x-16 -translate-y-16"></div>
          <div className="absolute bottom-0 right-0 w-32 h-32 border-4 border-white rounded-full translate-x-16 translate-y-16"></div>
        </div>

        {renderStepIndicator()}

        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}

        {currentStep > 1 && !nextStepLoading && (
          <button
            onClick={() => setCurrentStep(currentStep - 1)}
            className="mt-4 text-gray-400 hover:text-gray-200 flex items-center gap-1 transition-colors"
          >
            ← Back
          </button>
        )}

        {/* Login link */}
        <div className="mt-6 text-center">
          <p className="text-gray-400">
            Already have an account?{" "}
            <button
              onClick={() => navigate("/login")}
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>

      {/* Toast notifications */}
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}

      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default RegistrationForm;
