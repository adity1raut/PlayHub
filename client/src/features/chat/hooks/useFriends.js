import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../lib/config";

/** Your friends (mutual followers) from GET /api/chat/friends, loaded once `enabled` turns true. */
const useFriends = (enabled) => {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const loadedRef = useRef(false);
  const requestRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestRef.current;
    if (!loadedRef.current) setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/chat/friends`, { withCredentials: true });
      if (requestId !== requestRef.current) return;
      setFriends(response.data?.success ? response.data.users || [] : []);
      loadedRef.current = true;
    } catch (error) {
      if (requestId === requestRef.current) console.error("Error loading friends:", error);
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);

  return { friends, loading, refresh };
};

export default useFriends;
