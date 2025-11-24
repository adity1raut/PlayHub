import React, { useState, useEffect } from "react";
import { useStore } from "../../context/StoreContext";
import axios from "axios";

const backendUrl = import.meta.env.VITE_BACKEND_URL;
import { Search, Filter, Grid, List, Package } from "lucide-react";
import ProductCard from "../search/ProductCard"; //
import GamingBackground from "../../GamingBackground/GamingBackground";

export default function PublicProducts() {
  const { stores } = useStore();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStore, setSelectedStore] = useState("");
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });
  const [sortBy, setSortBy] = useState("name");
  const [viewMode, setViewMode] = useState("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const productsPerPage = 12;

  useEffect(() => {
    fetchProducts();
  }, [searchTerm, selectedStore, priceRange, sortBy, currentPage]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = {
        search: searchTerm,
        store: selectedStore,
        minPrice: priceRange.min,
        maxPrice: priceRange.max,
        sortBy,
        page: currentPage,
        limit: productsPerPage,
      };

      Object.keys(params).forEach((key) => {
        if (!params[key]) delete params[key];
      });

      const allProducts = [];
      if (selectedStore) {
        const res = await axios.get(
          `${backendUrl}/api/stores/${selectedStore}/products`,
          {
            params,
          },
        );
        if (res.data.products) {
          allProducts.push(...res.data.products);
        }
      } else {
        const storePromises = stores.map((store) =>
          axios.get(`${backendUrl}/api/stores/${store._id}/products`, {
            params,
          }),
        );
        const storeResponses = await Promise.all(storePromises);
        storeResponses.forEach((res) => {
          if (res.data.products) {
            allProducts.push(...res.data.products);
          }
        });
      }

      let filteredProducts = allProducts;

      if (searchTerm) {
        filteredProducts = filteredProducts.filter(
          (product) =>
            product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.description
              ?.toLowerCase()
              .includes(searchTerm.toLowerCase()),
        );
      }

      if (priceRange.min) {
        filteredProducts = filteredProducts.filter(
          (product) => product.price >= parseFloat(priceRange.min),
        );
      }
      if (priceRange.max) {
        filteredProducts = filteredProducts.filter(
          (product) => product.price <= parseFloat(priceRange.max),
        );
      }

      filteredProducts.sort((a, b) => {
        switch (sortBy) {
          case "name":
            return a.name.localeCompare(b.name);
          case "price_low":
            return a.price - b.price;
          case "price_high":
            return b.price - a.price;
          case "rating":
            const avgRatingA =
              a.ratings?.length > 0
                ? a.ratings.reduce((sum, r) => sum + r.rating, 0) /
                  a.ratings.length
                : 0;
            const avgRatingB =
              b.ratings?.length > 0
                ? b.ratings.reduce((sum, r) => sum + r.rating, 0) /
                  b.ratings.length
                : 0;
            return avgRatingB - avgRatingA;
          default:
            return 0;
        }
      });

      const startIndex = (currentPage - 1) * productsPerPage;
      const paginatedProducts = filteredProducts.slice(
        startIndex,
        startIndex + productsPerPage,
      );
      setProducts(paginatedProducts);
      setTotalPages(Math.ceil(filteredProducts.length / productsPerPage));
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 via-black to-purple-900 p-4 pt-32">
      <GamingBackground />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Header */}
        <div className="mb-8">
          <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-purple-800 to-purple-900 px-8 py-6 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Package className="w-6 h-6 text-purple-400 mr-2" />
                  <div>
                    <h1 className="text-3xl font-bold text-white">
                      BROWSE PRODUCTS
                    </h1>
                    <p className="text-purple-300 text-sm mt-1">
                      Discover amazing gaming products
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-2 rounded-lg transition-colors ${viewMode === "grid" ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
                  >
                    <Grid size={20} />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-2 rounded-lg transition-colors ${viewMode === "list" ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
                  >
                    <List size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Search Products
              </label>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                  size={20}
                />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Store
              </label>
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-white"
              >
                <option value="">All Stores</option>
                {stores.map((store) => (
                  <option key={store._id} value={store._id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Price Range
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={priceRange.min}
                  onChange={(e) =>
                    setPriceRange((prev) => ({ ...prev, min: e.target.value }))
                  }
                  className="w-full px-2 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm text-white placeholder-gray-500"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={priceRange.max}
                  onChange={(e) =>
                    setPriceRange((prev) => ({ ...prev, max: e.target.value }))
                  }
                  className="w-full px-2 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm text-white placeholder-gray-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-white"
              >
                <option value="name">Name (A-Z)</option>
                <option value="price_low">Price (Low to High)</option>
                <option value="price_high">Price (High to Low)</option>
                <option value="rating">Rating (High to Low)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-gray-800 border border-gray-700 rounded-xl h-64 animate-pulse"
              ></div>
            ))}
          </div>
        )}

        {/* Products Display */}
        {!loading && (
          <>
            <div className="mb-4 flex justify-between items-center">
              <p className="text-gray-400">
                Showing {products.length} products
                {searchTerm && ` for "${searchTerm}"`}
              </p>
              <p className="text-gray-400">
                Page {currentPage} of {totalPages}
              </p>
            </div>

            {products.length > 0 ? (
              <>
                {viewMode === "grid" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                    {products.map((product) => (
                      <ProductCard key={product._id} product={product} />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4 mb-8">
                    {products.map((product) => (
                      <ProductCard key={product._id} product={product} />
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center space-x-4">
                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(prev - 1, 1))
                      }
                      disabled={currentPage === 1}
                      className="px-6 py-3 bg-gray-800 border border-gray-700 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
                    >
                      Previous
                    </button>

                    <div className="px-6 py-3 bg-gradient-to-r from-purple-800 to-purple-900 rounded-lg border border-gray-700">
                      <span className="text-sm text-white font-medium">
                        Page {currentPage} of {totalPages}
                      </span>
                    </div>

                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                      }
                      disabled={currentPage === totalPages}
                      className="px-6 py-3 bg-gray-800 border border-gray-700 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl p-8 max-w-md mx-auto">
                  <Search size={48} className="mx-auto text-gray-600 mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">
                    No products found
                  </h3>
                  <p className="text-gray-400 mb-4">
                    Try adjusting your search criteria or browse all products.
                  </p>
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      setSelectedStore("");
                      setPriceRange({ min: "", max: "" });
                      setSortBy("name");
                      setCurrentPage(1);
                    }}
                    className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-2 rounded-lg hover:from-purple-700 hover:to-purple-800 transition-colors"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
