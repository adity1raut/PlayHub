import React, { useState, useEffect } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Store,
  Heart,
  User,
  ShoppingCart,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../context/StoreContext";
import { useAuth } from "../../context/AuthContext";
import StoreCard from "./StoreCard";
import StoreDetail from "./StoreDetail";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import GamingBackground from "../../GamingBackground/GamingBackground";

function AllStores() {
  const navigate = useNavigate();
  const { stores, loading, getAllStores } = useStore();
  const { isAuthenticated, user } = useAuth();
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedStore, setSelectedStore] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    fetchStores();
  }, [currentPage, search]);

  const fetchStores = async () => {
    try {
      const result = await getAllStores({
        page: currentPage,
        limit: 12,
        search: search || undefined,
      });
      if (result) {
        setTotalPages(result.totalPages || 1);
      }
    } catch (error) {
      toast.error("Failed to fetch stores");
    }
  };

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };

  const handleStoreClick = (store) => {
    setSelectedStore(store);
    setShowDetail(true);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleMyStoreClick = () => {
    if (!isAuthenticated) {
      toast.error("Please login to view your store");
      navigate("/login");
      return;
    }
    navigate("/my-store");
  };
  const handleMyCartClick = () => {
    if (!isAuthenticated) {
      toast.error("Please login to view your store");
      navigate("/login");
      return;
    }
    navigate("/cart");
  };

  const handleWishlistClick = () => {
    if (!isAuthenticated) {
      toast.error("Please login to view your wishlist");
      navigate("/login");
      return;
    }
    navigate("/wishlist");
  };

  if (showDetail && selectedStore) {
    return (
      <StoreDetail
        store={selectedStore}
        onBack={() => {
          setShowDetail(false);
          setSelectedStore(null);
        }}
      />
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-900 via-black to-purple-900 p-4 pt-32">
      <GamingBackground />
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Header */}
        <div className="mb-8">
          <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-purple-800 to-purple-900 px-8 py-6 border-b border-gray-700">
              <div className="flex items-center justify-center mb-2">
                <Store className="w-6 h-6 text-purple-400 mr-2" />
                <h1 className="text-3xl font-bold text-white text-center">
                  GAME STORES
                </h1>
              </div>
              <p className="text-purple-300 text-center mt-2 text-sm">
                Discover amazing gaming stores
              </p>
            </div>

            <div className="px-8 py-6">
              {/* Search Bar with Side Buttons */}
              <div className="flex items-center gap-4 max-w-4xl mx-auto">
                {/* Left Button - View Wishlist */}
                <button
                  onClick={handleWishlistClick}
                  className="group relative px-5 py-2.5 bg-gradient-to-r from-pink-900/70 to-purple-900/70 text-pink-100 rounded-lg transition-all duration-300 shadow-md hover:shadow-pink-700/30 hover:translate-y-[-2px] overflow-hidden"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-pink-600/20 to-pink-800/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                  <span className="relative flex items-center gap-2">
                    <Heart size={16} className="text-pink-300" />
                    <span>View Wishlist</span>
                  </span>
                </button>

                {/* Search Bar */}
                <div className="relative flex-1 max-w-md">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-500" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search stores..."
                    value={search}
                    onChange={handleSearch}
                    className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors text-white placeholder-gray-500"
                  />
                </div>

                {/* Right Button - My Store */}
                <button
                  onClick={handleMyStoreClick}
                  className="group relative px-5 py-2.5 bg-gradient-to-r from-blue-900/70 to-indigo-900/70 text-blue-100 rounded-lg transition-all duration-300 shadow-md hover:shadow-blue-700/30 hover:translate-y-[-2px] overflow-hidden"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-blue-800/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                  <span className="relative flex items-center gap-2">
                    <User size={16} className="text-blue-300" />
                    <span>My Store</span>
                  </span>
                </button>

                <button
                  onClick={handleMyCartClick}
                  className="group relative px-5 py-2.5 bg-gradient-to-r from-blue-900/70 to-indigo-900/70 text-blue-100 rounded-lg transition-all duration-300 shadow-md hover:shadow-blue-700/30 hover:translate-y-[-2px] overflow-hidden"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-blue-800/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                  <span className="relative flex items-center gap-2">
                    <ShoppingCart size={16} className="text-blue-300" />
                    <span> My Card </span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="bg-gray-800 border border-gray-700 rounded-xl h-64 animate-pulse"
              ></div>
            ))}
          </div>
        ) : (
          <>
            {/* Stores Grid */}
            {stores.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                {stores.map((store) => (
                  <StoreCard
                    key={store._id}
                    store={store}
                    onClick={handleStoreClick}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl p-8 max-w-md mx-auto">
                  <Store className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 text-lg">
                    {search
                      ? "No stores found matching your search."
                      : "No stores available yet."}
                  </p>
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="mt-4 text-purple-400 hover:text-purple-300 text-sm underline"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center space-x-4">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  className="flex items-center space-x-2 px-6 py-3 bg-gray-800 border border-gray-700 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Previous</span>
                </button>

                <div className="px-6 py-3 bg-gradient-to-r from-purple-800 to-purple-900 rounded-lg border border-gray-700">
                  <span className="text-sm text-white font-medium">
                    Page {currentPage} of {totalPages}
                  </span>
                </div>

                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className="flex items-center space-x-2 px-6 py-3 bg-gray-800 border border-gray-700 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
                >
                  <span>Next</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default AllStores;
