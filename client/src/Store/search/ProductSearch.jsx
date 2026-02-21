import { useState } from "react";
import { useProduct } from "../../context/ProductContext";
import ProductGrid from "./ProductGrid";
import { Search, Filter, Gamepad2 } from "lucide-react";
import GamingBackground from "../../GamingBackground/GamingBackground";

export function ProductSearch() {
  const { searchProducts, products, searchLoading } = useProduct();
  const [searchParams, setSearchParams] = useState({
    q: "",
    minPrice: "",
    maxPrice: "",
    category: "",
    store: "",
    sort: "createdAt",
    order: "desc",
  });
  const [showFilters, setShowFilters] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    const params = Object.fromEntries(
      Object.entries(searchParams).filter(([_, value]) => value !== ""),
    );
    await searchProducts(params);
  };

  const handleInputChange = (field, value) => {
    setSearchParams((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 via-black to-purple-900 min-h-screen p-4 pt-32">
      <GamingBackground />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Header */}
        <div className="mb-8">
          <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-purple-800 to-purple-900 px-8 py-6 border-b border-gray-700">
              <div className="flex items-center justify-center mb-2">
                <Gamepad2 className="w-6 h-6 text-purple-400 mr-2" />
                <h1 className="text-3xl font-bold text-white text-center">
                  PRODUCT SEARCH
                </h1>
              </div>
              <p className="text-purple-300 text-center mt-2 text-sm">
                Find exactly what you're looking for
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex gap-2 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchParams.q}
                onChange={(e) => handleInputChange("q", e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-500 transition-colors"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-3 rounded-lg flex items-center gap-2 transition-colors border ${
                showFilters
                  ? "bg-purple-700 border-purple-600 text-white"
                  : "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
              }`}
            >
              <Filter className="h-5 w-5" />
              Filters
            </button>
            <button
              type="submit"
              disabled={searchLoading}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 transition-all duration-300 shadow-lg hover:shadow-purple-700/30 font-medium"
            >
              {searchLoading ? "Searching..." : "Search"}
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-800 rounded-xl border border-gray-700">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Min Price
                </label>
                <input
                  type="number"
                  value={searchParams.minPrice}
                  onChange={(e) =>
                    handleInputChange("minPrice", e.target.value)
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="₹0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Max Price
                </label>
                <input
                  type="number"
                  value={searchParams.maxPrice}
                  onChange={(e) =>
                    handleInputChange("maxPrice", e.target.value)
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="₹10000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Sort By
                </label>
                <select
                  value={searchParams.sort}
                  onChange={(e) => handleInputChange("sort", e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="createdAt">Date Created</option>
                  <option value="price">Price</option>
                  <option value="name">Name</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Order
                </label>
                <select
                  value={searchParams.order}
                  onChange={(e) => handleInputChange("order", e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </div>
            </div>
          )}
        </form>

        <ProductGrid products={products} />
      </div>
    </div>
  );
}

export default ProductSearch;
