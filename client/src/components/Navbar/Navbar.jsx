import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  Gamepad2,
  ChevronDown,
  User,
  LogIn,
  Menu,
  X,
  Home,
  Settings,
  LogOut,
  UserCircle,
  MessageCircle,
  Aperture,
  Shield,
  Zap,
  Crown,
  Sparkles,
  AppWindowMac,
  Store,
} from "lucide-react";
import NotificationBell from "../Notification/NotificationBell";

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownOpen && !event.target.closest(".dropdown-container")) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [dropdownOpen]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  const handleNavigation = (action) => {
    setIsMobileMenuOpen(false);
    setDropdownOpen(false);
    if (typeof action === "function") {
      action();
    }
  };

  // User menu items
  const userMenuItems = [
    {
      icon: <Home size={16} />,
      name: "Dashboard",
      description: "Your gaming command center",
      path: "/",
    },
    {
      icon: <MessageCircle size={16} />,
      name: "Chat",
      description: "Chatting with Friends",
      path: "/chat",
    },
    {
      icon: <Aperture size={16} />,
      name: "Post",
      description: "Chatting with Friends",
      path: "/post",
    },
    {
      icon: <AppWindowMac size={16} />,
      name: "Stream",
      description: "Manage your gaming identity",
      path: "/streams",
    },
    {
      icon: <Store size={16} />,
      name: "Store",
      description: "Chatting with Friends",
      path: "/stores",
    },
    {
      icon: <UserCircle size={16} />,
      name: "Profile",
      description: "Manage your gaming identity",
      path: "/profile/me",
    },
  ];

  return (
    <>
      <nav
        className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
          scrolled
            ? "bg-gray-900 shadow-lg py-2 border-b border-purple-900"
            : "bg-gradient-to-b from-gray-900 to-black py-4"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            {/* Logo Section */}
            <div className="flex items-center">
              <Link
                to="/"
                className="flex items-center focus:outline-none group"
              >
                <div
                  className={`relative overflow-hidden transition-all duration-300 ${
                    scrolled ? "h-10 w-10" : "h-12 w-12"
                  }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg transform group-hover:scale-110 transition-transform duration-300">
                    <Gamepad2 className="h-full w-full p-2 text-white" />
                  </div>
                  {!scrolled && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  )}
                </div>
                <div className="ml-3">
                  <span
                    className={`font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400 transition-all duration-300 ${
                      scrolled ? "text-xl" : "text-2xl"
                    }`}
                  >
                    PLAYHUB
                  </span>
                  <div
                    className={`text-xs text-gray-400 transition-opacity duration-300 ${
                      scrolled ? "opacity-0 h-0" : "opacity-100"
                    }`}
                  >
                    Level Up Your Gaming Experience
                  </div>
                </div>
              </Link>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex md:items-center md:space-x-4">
              {!isAuthenticated && (
                <>
                  <Link
                    to="/login"
                    className="flex items-center text-sm font-medium px-3 py-2 rounded-md transition-all duration-200 text-gray-300 hover:text-white hover:bg-gray-800 group"
                  >
                    <LogIn
                      size={16}
                      className="mr-1 group-hover:scale-110 transition-transform"
                    />
                    Login
                  </Link>
                  <Link
                    to="/signup"
                    className="flex items-center text-sm font-medium px-3 py-2 rounded-md transition-all duration-200 text-gray-300 hover:text-white hover:bg-gray-800 group"
                  >
                    <User
                      size={16}
                      className="mr-1 group-hover:scale-110 transition-transform"
                    />
                    Sign Up
                  </Link>
                </>
              )}

              {isAuthenticated && (
                <>
                  {/* Dashboard Link */}
                  <Link
                    to="/"
                    className="flex items-center text-sm font-medium px-3 py-2 rounded-md transition-all duration-200 text-gray-300 hover:text-white hover:bg-gray-800 group"
                  >
                    <Home
                      size={16}
                      className="mr-1 group-hover:scale-110 transition-transform"
                    />
                    Dashboard
                  </Link>

                  {/* Notification Bell */}
                  <div className="relative">
                    <NotificationBell />
                  </div>

                  {/* User Menu Dropdown */}
                  <div className="relative dropdown-container">
                    <button
                      onClick={toggleDropdown}
                      className={`flex items-center text-sm font-medium px-3 py-2 rounded-md transition-all duration-200 group ${
                        dropdownOpen
                          ? "text-white bg-gray-800"
                          : "text-gray-300 hover:text-white hover:bg-gray-800"
                      }`}
                    >
                      <Shield
                        size={16}
                        className="mr-1 group-hover:scale-110 transition-transform"
                      />
                      Menu
                      <ChevronDown
                        size={16}
                        className={`ml-1 transition-transform duration-200 ${
                          dropdownOpen ? "transform rotate-180" : ""
                        }`}
                      />
                    </button>

                    {dropdownOpen && (
                      <div className="absolute right-0 mt-2 w-72 bg-gray-800 rounded-lg shadow-xl overflow-hidden z-50 border border-purple-700 transform transition-all duration-200 origin-top-right">
                        <div className="p-2">
                          {userMenuItems.map((item, index) => (
                            <Link
                              key={index}
                              to={item.path}
                              onClick={() => setDropdownOpen(false)}
                              className="flex w-full p-3 hover:bg-purple-900 rounded-lg transition-all duration-150 text-left group hover:transform hover:scale-105"
                            >
                              <div className="text-purple-400 group-hover:text-purple-300">
                                {item.icon}
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-white">
                                  {item.name}
                                </div>
                                <div className="text-xs text-gray-400">
                                  {item.description}
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Logout Button */}
                  <button
                    onClick={() => handleNavigation(logout)}
                    className="flex items-center text-sm font-medium px-3 py-2 rounded-md transition-all duration-200 text-red-400 hover:text-red-300 hover:bg-gray-800 group"
                  >
                    <LogOut
                      size={16}
                      className="mr-1 group-hover:scale-110 transition-transform"
                    />
                    Logout
                  </button>
                </>
              )}
            </div>

            {/* Right Actions */}
            {isAuthenticated && (
              <div className="hidden md:flex items-center space-x-4">
                {/* User Profile */}
                <div className="border-l pl-4 border-gray-700">
                  <Link
                    to="/profile/me"
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-2 rounded-md text-sm font-medium shadow-lg hover:shadow-purple-500/25 transition-all duration-200 flex items-center group"
                  >
                    <Crown
                      size={16}
                      className="mr-2 group-hover:animate-pulse"
                    />
                    <span className="max-w-xs truncate">
                      {user?.username ||
                        user?.firstName ||
                        user?.email ||
                        "Player"}
                    </span>
                    <Sparkles size={14} className="ml-1 text-yellow-300" />
                  </Link>
                </div>
              </div>
            )}

            {/* Login Button for non-authenticated users */}
            {!isAuthenticated && (
              <div className="hidden md:flex items-center">
                <Link
                  to="/login"
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-2 rounded-md text-sm font-medium shadow-lg hover:shadow-purple-500/25 transition-all duration-200 flex items-center group"
                >
                  <Zap size={16} className="mr-2 group-hover:animate-pulse" />
                  <span>Play Now</span>
                </Link>
              </div>
            )}

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button
                onClick={toggleMobileMenu}
                className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-purple-900 transition-all duration-200"
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-70 z-40 md:hidden transition-opacity duration-300 ${
          isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
      >
        <div
          className={`fixed inset-y-0 right-0 max-w-xs w-full bg-gray-900 shadow-xl z-50 transform transition-transform duration-300 ease-in-out border-l border-purple-800 ${
            isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center p-4 border-b border-purple-800">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-pink-600 rounded flex items-center justify-center">
                <Gamepad2 className="h-5 w-5 text-white" />
              </div>
              <span className="ml-2 font-bold text-lg text-white">
                GAME PORTAL
              </span>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 rounded-md text-gray-400 hover:text-red-400 hover:bg-red-900 transition-colors duration-200"
            >
              <X size={20} />
            </button>
          </div>

          <div className="py-2 px-4">
            {!isAuthenticated && (
              <>
                <Link
                  to="/login"
                  onClick={() => handleNavigation()}
                  className="flex items-center px-4 py-3 w-full text-left rounded-lg transition-all duration-200 text-gray-300 hover:bg-purple-900 hover:text-white group"
                >
                  <LogIn size={18} className="mr-3 group-hover:scale-110" />
                  Login
                </Link>
                <Link
                  to="/signup"
                  onClick={() => handleNavigation()}
                  className="flex items-center px-4 py-3 w-full text-left rounded-lg transition-all duration-200 text-gray-300 hover:bg-purple-900 hover:text-white group"
                >
                  <User size={18} className="mr-3 group-hover:scale-110" />
                  Sign Up
                </Link>
              </>
            )}

            {isAuthenticated && (
              <>
                {/* User Info Section */}
                <div className="px-4 py-3 border-b border-purple-800 mb-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center font-semibold text-white">
                      {(user?.username ||
                        user?.firstName ||
                        user?.email ||
                        "P")[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="text-white font-medium">
                        {user?.username ||
                          user?.firstName ||
                          user?.email ||
                          "Player"}
                      </div>
                      <div className="text-xs text-purple-400 flex items-center">
                        <span>Level 25</span>
                        <Sparkles size={10} className="ml-1 text-yellow-300" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                {userMenuItems.map((item, index) => (
                  <Link
                    key={index}
                    to={item.path}
                    onClick={() => handleNavigation()}
                    className="flex items-center px-4 py-3 w-full text-left rounded-lg transition-all duration-200 text-gray-300 hover:bg-purple-900 hover:text-white group"
                  >
                    {item.icon && (
                      <span className="mr-3 group-hover:scale-110">
                        {item.icon}
                      </span>
                    )}
                    {item.name}
                  </Link>
                ))}

                {/* Logout Button */}
                <button
                  onClick={() => handleNavigation(logout)}
                  className="flex items-center px-4 py-3 w-full text-left rounded-lg transition-all duration-200 text-red-400 hover:bg-red-900 hover:text-red-300 group"
                >
                  <LogOut size={18} className="mr-3 group-hover:scale-110" />
                  Logout
                </button>
              </>
            )}
          </div>

          {!isAuthenticated && (
            <div className="border-t border-purple-800 mt-2 pt-4 px-6">
              <Link
                to="/login"
                onClick={() => handleNavigation()}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-3 rounded-lg text-sm font-medium shadow-lg transition-all duration-200 flex items-center justify-center group"
              >
                <Zap size={18} className="mr-2 group-hover:animate-pulse" />
                Play Now
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Navbar;
