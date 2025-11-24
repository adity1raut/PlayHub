import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  AlertCircle,
  Gamepad2,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import GamingBackground from "../../GamingBackground/GamingBackground";

const LoginForm = () => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);

  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setLocalError(null);
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate("/profile");
  }, [user, navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (localError) setLocalError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      setLocalError("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    setLocalError(null);

    const res = await login(formData.email, formData.password);
    if (!res.success) setLocalError(res.message || "Login failed");

    setIsSubmitting(false);
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  const handleKeyPress = (e) => {
    if (
      e.key === "Enter" &&
      formData.email &&
      formData.password &&
      !isSubmitting
    ) {
      handleSubmit(e);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 flex items-center justify-center p-4 overflow-hidden relative">
      {/* Gaming Background Component */}
      <GamingBackground />

      <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl w-full max-w-md overflow-hidden relative z-10">
        {/* Subtle gaming pattern overlay */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 left-0 w-32 h-32 border-4 border-white rounded-full transform -translate-x-16 -translate-y-16"></div>
          <div className="absolute bottom-0 right-0 w-32 h-32 border-4 border-white rounded-full translate-x-16 translate-y-16"></div>
        </div>

        <div className="bg-gradient-to-r from-purple-800 to-purple-900 px-8 py-6 border-b border-gray-700 relative">
          <div className="flex items-center justify-center mb-2">
            <div className="relative">
              <Gamepad2 className="w-6 h-6 text-purple-400 mr-2" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-purple-400 rounded-full animate-ping"></div>
            </div>
            <h2 className="text-2xl font-bold text-white text-center font-mono">
              GAME PORTAL
            </h2>
          </div>
          <p className="text-purple-300 text-center mt-2 text-sm">
            Sign in to continue your adventure
          </p>
        </div>

        <div className="px-8 py-6 relative">
          {localError && (
            <div className="mb-4 p-3 bg-red-900 bg-opacity-20 border border-red-800 rounded-lg flex items-center gap-2 text-red-300">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">{localError}</span>
            </div>
          )}

          <div className="space-y-4" onKeyPress={handleKeyPress}>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter your email"
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors text-white placeholder-gray-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter your password"
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-12 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors text-white placeholder-gray-500"
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-300 transition-colors"
                  disabled={isSubmitting}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:from-gray-700 disabled:to-gray-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:cursor-not-allowed shadow-lg animate-pulse-glow"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Signing In...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Sign In
                </>
              )}
            </button>
          </div>

          <div className="mt-6 text-center space-y-3">
            <a
              href="/forgot-password"
              className="text-sm text-purple-400 hover:text-purple-300 hover:underline transition-colors block"
            >
              Forgot your password?
            </a>
            <div className="text-sm text-gray-500">
              Don't have an account?{" "}
              <a
                href="/signup"
                className="text-purple-400 hover:text-purple-300 hover:underline transition-colors font-medium"
              >
                Sign up now
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Login-specific styles */}
      <style jsx>{`
        @keyframes pulse-glow {
          0%,
          100% {
            box-shadow: 0 0 10px rgba(168, 85, 247, 0.3);
          }
          50% {
            box-shadow: 0 0 20px rgba(168, 85, 247, 0.6);
          }
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default LoginForm;
