import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Package,
  Star,
  Store as StoreIcon,
  UserCheck,
  UserPlus,
  Warehouse,
} from "lucide-react";
import { useStore } from "../../../context/StoreContext";
import { useAuth } from "../../../context/AuthContext";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  LogoMark,
  Page,
  Select,
  Skeleton,
} from "../../../components/ui";
import { cn } from "../../../lib/cn";
import { mediaUrl } from "../../../lib/config";
import { toast } from "../../../lib/toast";
import { useSocketEvent } from "../../../lib/useSocketEvent";
import { mergeStore, useLiveProductList } from "../liveCatalog";

const formatPrice = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

function StoreDetail({ store: initialStore, onBack }) {
  const { getStoreById, getStoreProducts, getFollowStatus, followStore } = useStore();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const topRef = useRef(null);
  const requestRef = useRef(0);
  // The storefront as opened from the list, kept live (`store:updated`, reconnects)
  const [store, setStore] = useState(initialStore);
  const [removed, setRemoved] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(store.products?.length || 0);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [error, setError] = useState(null);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  // Starts from the owner's follower list; kept live by follow responses and socket events
  const [followersCount, setFollowersCount] = useState(
    Array.isArray(store.owner?.followers) ? store.owner.followers.length : null,
  );

  const ownerId = store.owner?._id || store.owner;
  const isOwner = !!user?._id && !!ownerId && String(ownerId) === String(user._id);
  const ownerName = store.owner?.username || store.owner?.profile?.name;
  const isMe = (id) => !!user?._id && id != null && String(id) === String(user._id);

  // Realtime: follower total + our Following state (following a store = following its owner,
  // so a follow of the owner from their profile or another store counts too)
  useSocketEvent("store:followers", (e = {}) => {
    const mine =
      String(e.storeId) === String(store._id) || (ownerId != null && String(e.ownerId) === String(ownerId));
    if (!mine) return;
    if (typeof e.followersCount === "number") setFollowersCount(e.followersCount);
    if (isMe(e.userId)) setFollowing(Boolean(e.following));
  });

  useSocketEvent("follow:updated", (e = {}) => {
    if (!ownerId || String(e.targetId) !== String(ownerId)) return;
    if (typeof e.followersCount === "number") setFollowersCount(e.followersCount);
    if (isMe(e.followerId)) setFollowing(Boolean(e.followed));
  });

  // After a reconnect: the storefront, follower total and products may all have changed
  const refreshStore = async () => {
    const fresh = await getStoreById(store._id);
    if (fresh) {
      setStore((prev) => ({ ...prev, ...fresh }));
      if (Array.isArray(fresh.owner?.followers)) setFollowersCount(fresh.owner.followers.length);
    }
    fetchProducts({ silent: true });
  };

  // Realtime: the storefront itself (name, logo, description) and its removal
  useSocketEvent(
    "store:updated",
    (e = {}) => {
      if (e.store && String(e.storeId) === String(store._id)) setStore((prev) => mergeStore(prev, e.store));
    },
    { onReconnect: () => !removed && refreshStore() },
  );

  useSocketEvent("store:deleted", (e = {}) => {
    if (String(e.storeId) === String(store._id)) setRemoved(true);
  });

  // Products: live price / stock / ratings and removals; a new one reloads the page in the
  // background (where it lands depends on the sort and paging)
  useLiveProductList(products, setProducts, { onRemoved: (n) => setTotalProducts((t) => Math.max(0, t - n)) });

  useSocketEvent("product:created", (e = {}) => {
    if (String(e.storeId) === String(store._id)) fetchProducts({ silent: true });
  });

  // Opened another store from the list
  useEffect(() => {
    setStore(initialStore);
    setRemoved(false);
  }, [initialStore]);

  // The app shell scrolls <main>, not the window — bring the header into view.
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: "start" });
    setFollowersCount(null);
  }, [store._id]);

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store._id, currentPage, sortBy, sortOrder]);

  useEffect(() => {
    if (!isAuthenticated || isOwner) return;
    let cancelled = false;
    getFollowStatus(store._id).then((result) => {
      if (!cancelled && result?.success) setFollowing(!!result.data?.following);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store._id, isAuthenticated, isOwner]);

  // `silent`: refresh in the background (no skeleton; a failure keeps what's shown)
  const fetchProducts = async ({ silent = false } = {}) => {
    const id = ++requestRef.current; // only the latest request may update the list
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const result = await getStoreProducts(store._id, {
        page: currentPage,
        limit: 12,
        sort: sortBy,
        order: sortOrder,
      });
      if (id !== requestRef.current) return;

      if (result?.success) {
        setProducts(result.data.products || []);
        setTotalPages(result.data.totalPages || 1);
        setTotalProducts(result.data.total ?? (result.data.products || []).length);
        setError(null);
      } else if (!silent) {
        setError(result?.message || "Failed to fetch products");
        setProducts([]);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      if (!silent && id === requestRef.current) {
        setError("Failed to fetch products");
        setProducts([]);
      }
    } finally {
      if (id === requestRef.current) setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!isAuthenticated) {
      toast.error("Please login to follow stores");
      navigate("/login");
      return;
    }
    setFollowLoading(true);
    const result = await followStore(store._id);
    setFollowLoading(false);
    if (result?.success) {
      const now = !!result.data?.following;
      setFollowing(now);
      if (typeof result.data?.followersCount === "number") setFollowersCount(result.data.followersCount);
      toast.success(now ? `Following ${store.name}` : `Unfollowed ${store.name}`);
    } else {
      toast.error(result?.message || "Failed to update follow");
    }
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

  const calculateAverageRating = (ratings) => {
    if (!ratings || ratings.length === 0) return 0;
    const sum = ratings.reduce((acc, rating) => acc + rating.rating, 0);
    return sum / ratings.length;
  };

  const since = store.createdAt ? new Date(store.createdAt) : null;

  if (removed) {
    return (
      <Page wide>
        <div ref={topRef} className="scroll-mt-8">
          <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack}>
            All stores
          </Button>
        </div>
        <Card corners>
          <EmptyState
            icon={StoreIcon}
            title="Store closed"
            description={`${store.name} was deleted by its owner, along with its products.`}
            action={
              <Button variant="outline" size="sm" icon={ArrowLeft} onClick={onBack}>
                Back to all stores
              </Button>
            }
          />
        </Card>
      </Page>
    );
  }

  return (
    <Page wide>
      <div ref={topRef} className="scroll-mt-8">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack}>
          All stores
        </Button>
      </div>

      <Card corners>
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:p-6">
          {store.logo ? (
            <img
              src={mediaUrl(store.logo)}
              alt=""
              className="size-20 shrink-0 border border-border object-cover sm:size-24"
            />
          ) : (
            <div className="flex size-20 shrink-0 items-center justify-center border border-border bg-background/60 sm:size-24">
              <LogoMark className="size-10 text-primary" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="eyebrow text-faint">Marketplace / Store</p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-[0.06em] break-words text-foreground uppercase sm:text-3xl">
              {store.name}
            </h1>
            {(ownerName || followersCount !== null) && (
              <p className="mt-1 text-[11px] text-faint tabular-nums">
                {ownerName && <>by @{ownerName}</>}
                {ownerName && followersCount !== null && " · "}
                {followersCount !== null && (
                  <span className="text-muted-foreground">
                    {followersCount} {followersCount === 1 ? "follower" : "followers"}
                  </span>
                )}
              </p>
            )}
            {store.description && (
              <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
                {store.description}
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {isOwner ? (
              <Button as={Link} to="/my-store" icon={Warehouse}>
                Manage store
              </Button>
            ) : (
              <Button
                variant={following ? "outline" : "solid"}
                icon={following ? UserCheck : UserPlus}
                loading={followLoading}
                aria-pressed={following}
                onClick={handleFollow}
              >
                {following ? "Following" : "Follow"}
              </Button>
            )}
          </div>
        </div>

        <dl className="grid grid-cols-3 border-t border-border">
          {[
            ["Products", totalProducts],
            ["Since", since ? since.getFullYear() : "–"],
            ["Owner", ownerName ? `@${ownerName}` : "–"],
          ].map(([label, value], i) => (
            <div key={label} className={cn("min-w-0 px-4 py-4 sm:px-5", i > 0 && "border-l border-border")}>
              <dt className="eyebrow text-faint">{label}</dt>
              <dd className="mt-1 truncate text-sm font-bold text-foreground tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="eyebrow text-faint">
            <span className="text-primary">&gt;</span> Products
          </h2>
          <div className="flex w-full gap-2 sm:w-auto">
            <Select
              aria-label="Sort by"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setCurrentPage(1);
              }}
              className="flex-1 sm:w-40 sm:flex-none"
            >
              <option value="createdAt">Date added</option>
              <option value="name">Name</option>
              <option value="price">Price</option>
            </Select>
            <Select
              aria-label="Sort order"
              value={sortOrder}
              onChange={(e) => {
                setSortOrder(e.target.value);
                setCurrentPage(1);
              }}
              className="flex-1 sm:w-36 sm:flex-none"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </Select>
          </div>
        </div>

        {error && <Alert variant="destructive">{error}</Alert>}

        {loading ? (
          <div className="grid grid-cols-2 border-t border-l border-border lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="border-r border-b border-border bg-card/60">
                <Skeleton className="aspect-square w-full" />
                <div className="space-y-2 p-4">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <>
            <div className="grid grid-cols-2 border-t border-l border-border lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => {
                const avg = calculateAverageRating(product.ratings);
                const count = product.ratings?.length || 0;
                return (
                  <Link
                    key={product._id}
                    to={`/products/${product._id}`}
                    className="group relative flex flex-col border-r border-b border-border bg-card/60 transition-colors hover:bg-card"
                  >
                    <div className="relative aspect-square overflow-hidden border-b border-border bg-background/60">
                      {product.images?.[0] ? (
                        <img
                          src={mediaUrl(product.images[0])}
                          alt=""
                          loading="lazy"
                          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center text-faint">
                          <Package className="size-8" aria-hidden="true" />
                        </div>
                      )}
                      {product.stock !== undefined && product.stock <= 0 && (
                        <Badge variant="destructive" className="absolute top-2 left-2">
                          Sold out
                        </Badge>
                      )}
                      {product.stock > 0 && product.stock <= 5 && (
                        <Badge variant="warning" className="absolute top-2 left-2">
                          {product.stock} left
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
                      <h3 className="line-clamp-2 text-xs font-bold tracking-[0.08em] text-foreground uppercase group-hover:text-primary">
                        {product.name}
                      </h3>
                      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-bold text-primary tabular-nums">
                          {formatPrice(product.price)}
                        </span>
                        {count > 0 && (
                          <span className="flex items-center gap-1 text-[11px] text-faint tabular-nums">
                            <Star className="size-3 fill-current text-warning" aria-hidden="true" />
                            {avg.toFixed(1)} ({count})
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {totalPages > 1 && (
              <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={ChevronLeft}
                  onClick={handlePrevPage}
                  disabled={currentPage === 1 || loading}
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
                  disabled={currentPage === totalPages || loading}
                >
                  Next
                </Button>
              </nav>
            )}
          </>
        ) : (
          !error && (
            <Card>
              <EmptyState
                icon={Package}
                title="No products yet"
                description="No products available in this store yet."
                action={
                  isOwner ? (
                    <Button as={Link} to="/add-product" size="sm">
                      Add a product
                    </Button>
                  ) : null
                }
              />
            </Card>
          )
        )}
      </section>
    </Page>
  );
}

export default StoreDetail;
