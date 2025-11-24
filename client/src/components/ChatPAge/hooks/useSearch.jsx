import { useState, useEffect } from "react";
import axios from "axios";

const useSearch = () => {
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("username");
  const [loading, setLoading] = useState(false);

  const searchUsers = async (query) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/api/chat/search`,
        {
          params: { query, type: searchType },
          withCredentials: true,
        },
      );
      if (response.data.success) {
        setSearchResults(response.data.users);
      }
    } catch (error) {
      console.error("Error searching users:", error);
    }
    setLoading(false);
  };

  // Handle search input change with debouncing
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, searchType]);

  return {
    searchResults,
    searchQuery,
    setSearchQuery,
    searchType,
    setSearchType,
    loading,
  };
};

export default useSearch;
