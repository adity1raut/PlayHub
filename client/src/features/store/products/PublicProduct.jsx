import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Grid,
  Heart,
  List,
  Package,
  Search,
  ShoppingCart,
  Star,
  Store as StoreIcon,
} from "lucide-react";
import { useStore } from "../../../context/StoreContext";
import { useProduct } from "../../../context/ProductContext";
import { useAuth } from "../../../context/AuthContext";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  Page,
  PageHeader,
  Select,
  Skeleton,
} from "../../../components/ui";
import { cn } from "../../../lib/cn";
import { mediaUrl } from "../../../lib/config";
import { toast } from "../../../lib/toast";
import { useSocketEvent } from "../../../lib/useSocketEvent";
import { idOf, useLiveProductList } from "../liveCatalog";

const productsPerPage = 12;
const formatPrice = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const avgRating = (p) =>
  p.ratings?.length > 0 ? p.ratings.reduce((sum, r) => sum + r.rating, 0) / p.ratings.length : 0;

// UI sort → API sort/order (rating is re-sorted client-side within the page)
const SORTS = {
  name: ["name", "asc"],
  newest: ["createdAt", "desc"],
  price_low: ["price", "asc"],
  price_high: ["price", "desc"],
  rating: ["createdAt", "desc"],
};

function StockBadge({ stock, className }) {
  if (stock === undefined || stock === null) return null;
  if (stock <= 0)
    return (
      <Badge variant="destructive" className={className}>
        Sold out
      </Badge>
    );
  if (stock <= 5)
    return (
      <Badge variant="warning" className={className}>
        {stock} left
      </Badge>
    );
  return null;
}

function Thumb({ product, className }) {
  return product.images?.[0] ? (
    <img
      src={mediaUrl(product.images[0])}
      alt=""
      loading="lazy"
      className={cn("object-cover", className)}
    />
  ) : (
    <div className={cn("flex items-center justify-center bg-background/60 text-faint", className)}>
      <Package className="size-6" aria-hidden="true" />
    </div>
  );
}

function Rating({ product }) {
  const count = product.ratings?.length || 0;
  if (!count) return <span className="text-[11px] text-faint">No reviews</span>;
  return (
    <span className="flex items-center gap-1 text-[11px] text-faint tabular-nums">
      <Star className="size-3 fill-current text-warning" aria-hidden="true" />
      {avgRating(product).toFixed(1)} ({count})
    </span>
  );
}

export default function PublicProducts() {
  const navigate = useNavigate();
  const { stores, getAllStores, setStores } = useStore();
  const { getAllProducts, searchProducts, addToCart, toggleWishlist, getUserWishlist, wishlist, isInCart } =
    useProduct();
  const { isAuthenticated } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStore, setSelectedStore] = useState("");
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });
  const [applied, setApplied] = useState({ q: "", min: "", max: "" });
  const [sortBy, setSortBy] = useState("name");
  const [viewMode, setViewMode] = useState("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [cartBusy, setCartBusy] = useState(null);
  const requestRef = useRef(0);

  // Stores for the filter (previously this page depended on /stores having been
  // visited first — with an empty `stores` list it showed no products at all).
  useEffect(() => {
    getAllStores({ page: 1, limit: 100 });
    if (isAuthenticated) getUserWishlist(1, 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce free-text filters.
  useEffect(() => {
    const t = setTimeout(() => {
      const next = { q: searchTerm.trim(), min: priceRange.min, max: priceRange.max };
      if (next.q !== applied.q || next.min !== applied.min || next.max !== applied.max) {
        setApplied(next);
        setCurrentPage(1);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm, priceRange, applied]);

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied, selectedStore, sortBy, currentPage]);

  // `silent`: refresh in the background (no skeleton; a failure keeps what's shown)
  const fetchProducts = async ({ silent = false } = {}) => {
    const id = ++requestRef.current;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    const [sort, order] = SORTS[sortBy] || SORTS.name;
    const base = { page: currentPage, limit: productsPerPage, sort, order };
    const filtered = applied.q || selectedStore || applied.min || applied.max;

    let data = null;
    try {
      // GET /api/stores/search/products supports q/store/minPrice/maxPrice;
      // GET /api/stores/products/all is the unfiltered catalogue.
      data = filtered
        ? await searchProducts({
            ...base,
            q: applied.q || undefined,
            store: selectedStore || undefined,
            minPrice: applied.min || undefined,
            maxPrice: applied.max || undefined,
          })
        : await getAllProducts(base);
    } catch (err) {
      console.error("Error fetching products:", err);
    }
    if (id !== requestRef.current) return;
    if (!data && silent) {
      setLoading(false);
      return;
    }

    let list = data?.products || [];
    if (sortBy === "rating") list = [...list].sort((a, b) => avgRating(b) - avgRating(a));
    setProducts(list);
    setTotalPages(Math.max(1, data?.totalPages || 1));
    setTotal(data?.total ?? list.length);
    setError(data ? null : "Couldn't load products. Please try again.");
    setLoading(false);
  };

  // Realtime: price / stock / rating / store changes patch in place and removed products drop
  // out; a new in-stock product that could match refreshes the page in the background (its
  // spot depends on the sort, filters and paging).
  useLiveProductList(products, setProducts, { onRemoved: (n) => setTotal((t) => Math.max(0, t - n)) });

  useSocketEvent(
    "product:created",
    ({ storeId, product } = {}) => {
      if (product?.stock > 0 && (!selectedStore || selectedStore === String(storeId))) fetchProducts({ silent: true });
    },
    {
      onReconnect: () => {
        fetchProducts({ silent: true });
        getAllStores({ page: 1, limit: 100 }, { silent: true });
      },
    },
  );

  // The store filter: StoreContext renames / drops stores; new ones are added here
  useSocketEvent("store:created", ({ store } = {}) => {
    if (store?._id) setStores((prev) => (prev.some((s) => idOf(s) === idOf(store)) ? prev : [...prev, store]));
  });

  useSocketEvent("store:deleted", ({ storeId } = {}) => {
    if (selectedStore && selectedStore === String(storeId)) {
      setSelectedStore("");
      setCurrentPage(1);
    }
  });

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedStore("");
    setPriceRange({ min: "", max: "" });
    setSortBy("name");
    setCurrentPage(1);
  };

  const requireAuth = (msg) => {
    if (isAuthenticated) return true;
    toast.error(msg);
    navigate("/login");
    return false;
  };

  const handleAddToCart = async (product) => {
    if (!requireAuth("Please login to add items to cart")) return;
    const storeId = product.store?._id || product.store;
    if (!storeId) {
      toast.error("Store not available");
      return;
    }
    setCartBusy(product._id);
    const result = await addToCart(product._id, 1, storeId);
    setCartBusy(null);
    if (result?.success) toast.success(`${product.name} added to cart`);
    else toast.error(result?.message || "Failed to add to cart");
  };

  const handleWishlist = async (product) => {
    if (!requireAuth("Please login to use your wishlist")) return;
    const result = await toggleWishlist(product._id);
    if (result?.success) toast.success(result.inWishlist ? "Added to wishlist" : "Removed from wishlist");
    else toast.error(result?.message || "Failed to update wishlist");
  };

  const wishlistIds = new Set((wishlist || []).map((p) => p?._id || p));
  const hasFilters = searchTerm || selectedStore || priceRange.min || priceRange.max;

  return (
    <Page wide>
      <PageHeader
        eyebrow="Marketplace / Products"
        title="Products"
        description="Browse gear, merch and digital goods from every Spawnpoint store."
        actions={
          <>
            <div className="flex border border-border" role="group" aria-label="View mode">
              <IconButton
                icon={Grid}
                label="Grid view"
                size="sm"
                active={viewMode === "grid"}
                aria-pressed={viewMode === "grid"}
                onClick={() => setViewMode("grid")}
              />
              <IconButton
                icon={List}
                label="List view"
                size="sm"
                active={viewMode === "list"}
                aria-pressed={viewMode === "list"}
                onClick={() => setViewMode("list")}
              />
            </div>
            <Button as={Link} to="/stores" variant="outline" icon={StoreIcon}>
              Stores
            </Button>
          </>
        }
      />

      {/* Filters */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Input
          label="Search"
          type="search"
          icon={Search}
          placeholder="Search products…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="sm:col-span-2 lg:col-span-1"
        />
        <Select
          label="Store"
          value={selectedStore}
          onChange={(e) => {
            setSelectedStore(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="">All stores</option>
          {stores.map((store) => (
            <option key={store._id} value={store._id}>
              {store.name}
            </option>
          ))}
        </Select>
        <div>
          <p className="eyebrow mb-2 text-muted-foreground">Price (₹)</p>
          <div className="flex gap-2">
            <Input
              type="number"
              min="0"
              aria-label="Minimum price"
              placeholder="Min"
              value={priceRange.min}
              onChange={(e) => setPriceRange((prev) => ({ ...prev, min: e.target.value }))}
              className="min-w-0 flex-1"
            />
            <Input
              type="number"
              min="0"
              aria-label="Maximum price"
              placeholder="Max"
              value={priceRange.max}
              onChange={(e) => setPriceRange((prev) => ({ ...prev, max: e.target.value }))}
              className="min-w-0 flex-1"
            />
          </div>
        </div>
        <Select
          label="Sort by"
          value={sortBy}
          onChange={(e) => {
            setSortBy(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="name">Name (A–Z)</option>
          <option value="newest">Newest</option>
          <option value="price_low">Price (low to high)</option>
          <option value="price_high">Price (high to low)</option>
          <option value="rating">Rating (high to low)</option>
        </Select>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow text-faint tabular-nums">
            <span className="text-primary">&gt;</span> {loading ? "Loading" : `${total} ${total === 1 ? "product" : "products"}`}
            {applied.q && <span> for “{applied.q}”</span>}
          </p>
          <div className="flex items-center gap-3">
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
            <p className="eyebrow text-faint tabular-nums">
              Page {currentPage} / {totalPages}
            </p>
          </div>
        </div>

        {error && <Alert variant="destructive">{error}</Alert>}

        {loading ? (
          <div className="grid grid-cols-2 border-t border-l border-border md:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="border-r border-b border-border bg-card/60">
                <Skeleton className="aspect-square w-full" />
                <div className="space-y-2 p-4">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <>
            {viewMode === "grid" ? (
              <div className="grid grid-cols-2 border-t border-l border-border md:grid-cols-3 xl:grid-cols-4">
                {products.map((product) => {
                  const inWishlist = wishlistIds.has(product._id);
                  const soldOut = product.stock !== undefined && product.stock <= 0;
                  return (
                    <article
                      key={product._id}
                      className="group relative flex flex-col border-r border-b border-border bg-card/60 transition-colors hover:bg-card"
                    >
                      <Link
                        to={`/products/${product._id}`}
                        className="relative block aspect-square overflow-hidden border-b border-border"
                        aria-label={product.name}
                      >
                        <Thumb
                          product={product}
                          className="size-full transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                        <StockBadge stock={product.stock} className="absolute top-2 left-2" />
                      </Link>
                      <span className="absolute top-1.5 right-1.5">
                        <IconButton
                          icon={Heart}
                          label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
                          size="sm"
                          variant="secondary"
                          active={inWishlist}
                          aria-pressed={inWishlist}
                          onClick={() => handleWishlist(product)}
                        />
                      </span>
                      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:p-4">
                        <Link
                          to={`/products/${product._id}`}
                          className="line-clamp-2 text-xs font-bold tracking-[0.08em] text-foreground uppercase hover:text-primary"
                        >
                          {product.name}
                        </Link>
                        <p className="truncate text-[11px] text-faint">{product.store?.name || "—"}</p>
                        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                          <span className="text-sm font-bold text-primary tabular-nums">
                            {formatPrice(product.price)}
                          </span>
                          <Rating product={product} />
                        </div>
                        <div className="mt-auto flex gap-2 pt-2">
                          <Button
                            as={Link}
                            to={`/products/${product._id}`}
                            variant="outline"
                            size="sm"
                            className="min-w-0 flex-1"
                          >
                            View
                          </Button>
                          <IconButton
                            icon={ShoppingCart}
                            label={soldOut ? "Out of stock" : isInCart?.(product._id) ? "Add one more to cart" : "Add to cart"}
                            variant="default"
                            size="sm"
                            disabled={soldOut || cartBusy === product._id}
                            aria-busy={cartBusy === product._id || undefined}
                            onClick={() => handleAddToCart(product)}
                          />
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <Card>
                <ul className="divide-y divide-border">
                  {products.map((product) => {
                    const inWishlist = wishlistIds.has(product._id);
                    const soldOut = product.stock !== undefined && product.stock <= 0;
                    return (
                      <li
                        key={product._id}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent sm:gap-4 sm:px-5"
                      >
                        <Link to={`/products/${product._id}`} className="shrink-0" aria-label={product.name}>
                          <Thumb product={product} className="size-14 border border-border sm:size-16" />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link
                            to={`/products/${product._id}`}
                            className="block truncate text-xs font-bold tracking-[0.08em] text-foreground uppercase hover:text-primary"
                          >
                            {product.name}
                          </Link>
                          <p className="mt-0.5 truncate text-[11px] text-faint">{product.store?.name || "—"}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="text-sm font-bold text-primary tabular-nums">
                              {formatPrice(product.price)}
                            </span>
                            <Rating product={product} />
                            <StockBadge stock={product.stock} />
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <IconButton
                            icon={Heart}
                            label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
                            size="sm"
                            active={inWishlist}
                            aria-pressed={inWishlist}
                            onClick={() => handleWishlist(product)}
                          />
                          <IconButton
                            icon={ShoppingCart}
                            label={soldOut ? "Out of stock" : "Add to cart"}
                            variant="default"
                            size="sm"
                            disabled={soldOut || cartBusy === product._id}
                            onClick={() => handleAddToCart(product)}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={ChevronLeft}
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
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
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
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
                icon={Search}
                title="No products found"
                description="Try adjusting your search criteria or browse all products."
                action={
                  hasFilters ? (
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : (
                    <Button as={Link} to="/stores" size="sm" icon={StoreIcon}>
                      Browse stores
                    </Button>
                  )
                }
              />
            </Card>
          )
        )}
      </section>
    </Page>
  );
}
