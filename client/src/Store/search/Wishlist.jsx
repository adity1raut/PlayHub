import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useProduct } from "../../context/ProductContext";
import { Heart, ArrowLeft, Store } from "lucide-react";
import ProductCard from "./ProductCard";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import GamingBackground from "../../GamingBackground/GamingBackground";

export function Wishlist() {
  const navigate = useNavigate();
  const { getUserWishlist, wishlist, loading, toggleWishlist } = useProduct();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchWishlist = async () => {
      const data = await getUserWishlist(currentPage);
      if (data) {
        setTotalPages(data.totalPages);
      }
    };
  }, [currentPage, getUserWishlist]);

  const handleWishlistToggle = async (productId) => {
    const result = await toggleWishlist(productId);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  };

  const handleGoBack = () => {
    navigate(-1); // Go back one step in history
  };

  const handleMyStore = () => {
    navigate("/my-store"); // Navigate to my store page
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading wishlist...</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-900 via-black to-purple-900 p-4 pt-32">
      <GamingBackground />
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handleGoBack}
            className="group relative px-4 py-2 bg-gradient-to-r from-gray-700 to-gray-800 text-gray-300 rounded-lg transition-all duration-300 shadow-md hover:shadow-purple-700/30 hover:translate-y-[-1px] overflow-hidden border border-gray-600 hover:border-purple-500"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-purple-800/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
            <span className="relative flex items-center gap-2">
              <ArrowLeft
                size={20}
                className="text-purple-400 group-hover:text-purple-300 transition-colors"
              />
              <span className="font-medium group-hover:text-white transition-colors">
                Back
              </span>
            </span>
          </button>

          <button
            onClick={handleMyStore}
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

        <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-purple-800 to-purple-900 px-8 py-6 border-b border-gray-700">
            <div className="flex items-center justify-center mb-2">
              <Heart className="w-6 h-6 text-purple-400 mr-2" />
              <h2 className="text-3xl font-bold text-white text-center">
                MY WISHLIST
              </h2>
            </div>
            <p className="text-purple-300 text-center mt-2 text-sm">
              All your favorite products in one place
            </p>
          </div>
        </div>

        {wishlist?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-gray-800 rounded-xl border border-gray-700 shadow-xl max-w-md mx-auto">
            <Heart className="h-20 w-20 text-gray-600 mb-6" />
            <p className="text-xl text-gray-400 font-semibold mb-2">
              Your wishlist is empty
            </p>
            <p className="text-gray-500 mb-4">
              Add products to your wishlist to see them here
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
              {wishlist.map((product) => (
                <ProductCard
                  key={product._id}
                  product={product}
                  onWishlistToggle={() => handleWishlistToggle(product._id)}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center space-x-4">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="flex items-center space-x-2 px-6 py-3 bg-gray-800 border border-gray-700 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
                >
                  <span>Previous</span>
                </button>

                <div className="px-6 py-3 bg-gradient-to-r from-purple-800 to-purple-900 rounded-lg border border-gray-700">
                  <span className="text-sm text-white font-medium">
                    Page {currentPage} of {totalPages}
                  </span>
                </div>

                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="flex items-center space-x-2 px-6 py-3 bg-gray-800 border border-gray-700 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
                >
                  <span>Next</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Wishlist;
