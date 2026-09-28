import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Package,
  Search,
  ShoppingCart,
  Store,
  Warehouse,
} from "lucide-react";
import { useStore } from "../../../context/StoreContext";
import { useAuth } from "../../../context/AuthContext";
import StoreCard from "./StoreCard";
import StoreDetail from "./StoreDetail";
import {
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  Page,
  PageHeader,
  Skeleton,
} from "../../../components/ui";
import { toast } from "../../../lib/toast";
import { API_URL } from "../../../lib/config";
import { useSocketEvent } from "../../../lib/useSocketEvent";

const PAGE_SIZE = 12;
const ownerIdOf = (store) => String(store?.owner?._id ?? store?.owner ?? "");

function AllStores() {
  const navigate = useNavigate();
  const { stores, setStores, loading, getAllStores, followStore } = useStore();
  const { isAuthenticated, user } = useAuth();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedStore, setSelectedStore] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [followingIds, setFollowingIds] = useState(() => new Set());
  const [followBusy, setFollowBusy] = useState(null);
  // ownerId → follower total. The list API doesn't include it, so it's only known once a
  // follow happens (ours or a live `store:followers` / `follow:updated` event).
  const [followerCounts, setFollowerCounts] = useState({});

  // Debounce the search box so we don't hit the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      const q = search.trim();
      if (q !== query) {
        setQuery(q);
        setCurrentPage(1);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search, query]);

  useEffect(() => {
    fetchStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, query]);

  // Which stores the viewer follows. StoreContext.getFollowingStores reads the
  // response as an array, but the API returns { stores: [...] }, so read it here.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    axios
      .get(`${API_URL}/api/stores/following/stores`, { params: { limit: 100 }, withCredentials: true })
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res.data) ? res.data : res.data?.stores || [];
        setFollowingIds(new Set(list.map((s) => s._id)));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // `silent`: refresh in the background (no skeleton), e.g. after a reconnect
  const fetchStores = async ({ silent = false } = {}) => {
    try {
      const result = await getAllStores(
        {
          page: currentPage,
          limit: PAGE_SIZE,
          search: query || undefined,
        },
        { silent },
      );
      if (result) {
        setTotalPages(result.totalPages || 1);
        setTotal(result.total || 0);
      } else {
        toast.error("Failed to fetch stores");
      }
    } catch {
      toast.error("Failed to fetch stores");
    }
  };

  const handleSearch = (e) => {
    setSearch(e.target.value);
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

  const handleMyCartClick = () => {
    if (!isAuthenticated) {
      toast.error("Please login to view your cart");
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

  /**
   * Following a store = following its owner, so every listed store of `ownerId`
   * (plus `storeId` itself) flips together.
   */
  const applyFollowing = (ownerId, following, storeId) => {
    const ids = stores.filter((s) => ownerIdOf(s) === String(ownerId)).map((s) => s._id);
    if (storeId) ids.push(storeId);
    setFollowingIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (following ? next.add(id) : next.delete(id)));
      return next;
    });
  };

  const setOwnerFollowers = (ownerId, count) => {
    if (!ownerId || typeof count !== "number") return;
    setFollowerCounts((prev) => (prev[ownerId] === count ? prev : { ...prev, [ownerId]: count }));
  };

  // Realtime: store follower totals, and our own Following state from any tab/page
  useSocketEvent("store:followers", (e = {}) => {
    setOwnerFollowers(String(e.ownerId ?? ""), e.followersCount);
    if (user?._id && String(e.userId) === String(user._id)) {
      applyFollowing(e.ownerId, Boolean(e.following), e.storeId);
    }
  });

  // A plain user follow (e.g. from the owner's profile) also follows their stores
  useSocketEvent("follow:updated", (e = {}) => {
    if (!stores.some((s) => ownerIdOf(s) === String(e.targetId))) return;
    setOwnerFollowers(String(e.targetId), e.followersCount);
    if (user?._id && String(e.followerId) === String(user._id)) {
      applyFollowing(e.targetId, Boolean(e.followed));
    }
  });

  // Realtime: StoreContext renames stores, drops deleted ones and keeps product counts; this
  // page places new stores (newest first, so on page 1) and keeps the totals right.
  const setTotalStores = (next) => {
    setTotal(next);
    setTotalPages(Math.max(1, Math.ceil(next / PAGE_SIZE)));
  };

  useSocketEvent(
    "store:created",
    ({ store } = {}) => {
      if (!store?._id || stores.some((s) => s._id === store._id)) return;
      if (query && !store.name?.toLowerCase().includes(query.toLowerCase())) return;
      setTotalStores(total + 1);
      if (currentPage === 1) {
        setStores((prev) => (prev.some((s) => s._id === store._id) ? prev : [store, ...prev].slice(0, PAGE_SIZE)));
      }
    },
    { onReconnect: () => fetchStores({ silent: true }) },
  );

  useSocketEvent("store:deleted", ({ storeId } = {}) => {
    if (stores.some((s) => s._id === String(storeId))) setTotalStores(Math.max(0, total - 1));
  });

  const handleFollow = async (store) => {
    if (!isAuthenticated) {
      toast.error("Please login to follow stores");
      navigate("/login");
      return;
    }
    setFollowBusy(store._id);
    const result = await followStore(store._id);
    setFollowBusy(null);
    if (result?.success) {
      const nowFollowing = !!result.data?.following;
      applyFollowing(ownerIdOf(store), nowFollowing, store._id);
      setOwnerFollowers(ownerIdOf(store), result.data?.followersCount);
      toast.success(nowFollowing ? `Following ${store.name}` : `Unfollowed ${store.name}`);
    } else {
      toast.error(result?.message || "Failed to update follow");
    }
  };

  const isOwnStore = (store) => {
    const ownerId = store.owner?._id || store.owner;
    return !!user?._id && !!ownerId && String(ownerId) === String(user._id);
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
    <Page wide>
      <PageHeader
        eyebrow="Marketplace / Stores"
        title="Stores"
        description="Discover stores run by the Spawnpoint community. Follow the ones you like to keep up with new drops."
        actions={
          <>
            <IconButton icon={Heart} label="Wishlist" variant="outline" onClick={handleWishlistClick} />
            <IconButton icon={ShoppingCart} label="Cart" variant="outline" onClick={handleMyCartClick} />
            <Button as={Link} to="/my-store" icon={Warehouse}>
              My store
            </Button>
            <Button as={Link} to="/products" variant="outline" icon={Package}>
              Products
            </Button>
          </>
        }
      />

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            type="search"
            icon={Search}
            placeholder="Search stores…"
            aria-label="Search stores"
            value={search}
            onChange={handleSearch}
            className="w-full sm:max-w-sm"
          />
          {!loading && (
            <p className="eyebrow text-faint tabular-nums">
              <span className="text-primary">&gt;</span> {total} {total === 1 ? "store" : "stores"}
              {query && <span> matching “{query}”</span>}
            </p>
          )}
        </div>

        {loading ? (
          <div className="grid border-t border-l border-border sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-4 border-r border-b border-border bg-card/60 p-5">
                <div className="flex items-center gap-4">
                  <Skeleton className="size-14" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-2.5 w-1/3" />
                  </div>
                </div>
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : stores.length > 0 ? (
          <div className="grid border-t border-l border-border sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((store, i) => (
              <StoreCard
                key={store._id}
                store={store}
                index={String((currentPage - 1) * PAGE_SIZE + i + 1).padStart(2, "0")}
                onClick={handleStoreClick}
                onFollow={handleFollow}
                following={followingIds.has(store._id)}
                followLoading={followBusy === store._id}
                isOwner={isOwnStore(store)}
                followersCount={followerCounts[ownerIdOf(store)] ?? store.owner?.followers?.length}
              />
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={Store}
              title={query ? "No matching stores" : "No stores yet"}
              description={
                query
                  ? "No stores found matching your search."
                  : "No stores are open yet. Be the first to open one."
              }
              action={
                query ? (
                  <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                    Clear search
                  </Button>
                ) : (
                  <Button as={Link} to="/my-store" size="sm" icon={Warehouse}>
                    Open a store
                  </Button>
                )
              }
            />
          </Card>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              icon={ChevronLeft}
              onClick={handlePrevPage}
              disabled={currentPage === 1}
            >
              Prev
            </Button>
            <p className="eyebrow text-faint tabular-nums">
              Page <span className="text-foreground">{currentPage}</span> / {totalPages}
            </p>
            <Button
              variant="outline"
              size="sm"
              iconRight={ChevronRight}
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </nav>
        )}
      </section>
    </Page>
  );
}

export default AllStores;
