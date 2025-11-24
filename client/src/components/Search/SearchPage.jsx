import React, { useState } from "react";
import { Search } from "lucide-react";
import PostCard from "../Post/PostCard";
import axios from "axios";

const backendUrl = import.meta.env.VITE_BACKEND_URL;
import GamingBackground from "../../GamingBackground/GamingBackground";

const SearchPage = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);

    try {
      const response = await axios.get(
        `${backendUrl}/api/posts/search/${encodeURIComponent(query)}`,
        {
          withCredentials: true,
        },
      );

      if (response.data.success) {
        setResults(response.data.posts);
      }
    } catch (error) {
      console.error("Error searching posts:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <GamingBackground />
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <form onSubmit={handleSearch} className="flex space-x-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search posts, hashtags..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </form>
      </div>

      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-lg shadow-md p-6 animate-pulse"
            >
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-300 rounded w-24"></div>
                  <div className="h-3 bg-gray-300 rounded w-16"></div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-300 rounded w-full"></div>
                <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                <div className="h-4 bg-gray-300 rounded w-1/2"></div>
              </div>
              <div className="flex space-x-4 mt-4">
                <div className="h-6 bg-gray-300 rounded w-16"></div>
                <div className="h-6 bg-gray-300 rounded w-16"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && hasSearched && (
        <div className="space-y-4">
          {results.length > 0 ? (
            results.map((post) => <PostCard key={post._id} post={post} />)
          ) : (
            <div className="bg-white rounded-lg shadow-md p-6 text-center">
              <p className="text-gray-500 text-lg">
                No posts found matching your search.
              </p>
              <p className="text-gray-400 mt-2">
                Try different keywords or hashtags.
              </p>
            </div>
          )}
        </div>
      )}

      {!hasSearched && (
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            Search for Posts
          </h2>
          <p className="text-gray-500">
            Enter keywords, hashtags, or content to find posts.
          </p>
        </div>
      )}
    </div>
  );
};

export default SearchPage;
