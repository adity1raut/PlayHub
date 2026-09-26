import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { API_URL } from "../../../lib/config";

/** Debounced player search against GET /api/chat/search?query=&type=username|name */
const useSearch = () => {
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("username");
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    const query = searchQuery.trim().replace(/^@/, "");
    const requestId = ++requestRef.current;

    // The API rejects queries shorter than 2 characters
    if (query.length < 2) {
      setSearchResults([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const debounceTimer = setTimeout(async () => {
      try {
        const response = await axios.get(`${API_URL}/api/chat/search`, {
          params: { query, type: searchType },
          withCredentials: true,
        });
        if (requestId !== requestRef.current) return; // a newer search replaced this one
        setSearchResults(response.data?.success ? response.data.users || [] : []);
      } catch (error) {
        if (requestId !== requestRef.current) return;
        console.error("Error searching users:", error);
        setSearchResults([]);
      } finally {
        if (requestId === requestRef.current) setLoading(false);
      }
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
