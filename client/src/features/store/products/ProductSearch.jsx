import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { ChevronLeft, ChevronRight, Heart, RotateCcw, Search, ShoppingCart, SlidersHorizontal } from "lucide-react";
import { useProduct } from "../../../context/ProductContext";
import { API_URL } from "../../../lib/config";
import { Button, Card, CardBar, Eyebrow, Input, LoadingBlock, Page, PageHeader, Select } from "../../../components/ui";
import ProductGrid from "./ProductGrid";
import TrendingProducts from "./TrendingProducts";

const DEFAULT_PARAMS = {
  q: "",
  minPrice: "",
  maxPrice: "",
  store: "",
  sort: "createdAt",
  order: "desc",
};

export function ProductSearch() {
  const { searchProducts, products, searchLoading } = useProduct();
  const [urlParams, setUrlParams] = useSearchParams();

  const [searchParams, setSearchParams] = useState(() => ({
    ...DEFAULT_PARAMS,
    q: urlParams.get("q") || "",
    store: urlParams.get("store") || "",
  }));
  const [showFilters, setShowFilters] = useState(() => Boolean(urlParams.get("store")));
  const [stores, setStores] = useState([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, page: 1 });
  const [hasSearched, setHasSearched] = useState(false);
  const paramsRef = useRef(searchParams);
  paramsRef.current = searchParams;

  const runSearch = async (page = 1, params = paramsRef.current) => {
    const clean = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== ""));
    const data = await searchProducts({ ...clean, page, limit: 12 });
    setHasSearched(true);
    if (data) {
      setMeta({
        total: data.total ?? data.products?.length ?? 0,
        totalPages: Math.max(1, data.totalPages || 1),
        page: Number(data.currentPage) || page,
      });
    }
  };

  // Initial results (honours ?q= and ?store= deep links).
  useEffect(() => {
    runSearch(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stores for the store filter (local fetch so the shared stores list isn't overwritten).
  useEffect(() => {
    let active = true;
    axios
      .get(`${API_URL}/api/stores`, { params: { limit: 50 } })
      .then((res) => active && setStores(res.data?.stores || []))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    const next = {};
    if (searchParams.q.trim()) next.q = searchParams.q.trim();
    if (searchParams.store) next.store = searchParams.store;
    setUrlParams(next, { replace: true });
    await runSearch(1);
  };

  const handleReset = async () => {
    setSearchParams(DEFAULT_PARAMS);
    setUrlParams({}, { replace: true });
    await runSearch(1, DEFAULT_PARAMS);
  };

  const handleInputChange = (field, value) => {
    setSearchParams((prev) => ({ ...prev, [field]: value }));
  };

  const goToPage = (page) => {
    runSearch(page);
    document.querySelector("main")?.scrollTo?.({ top: 0, behavior: "smooth" });
  };

  const activeFilters = ["minPrice", "maxPrice", "store"].filter((k) => searchParams[k] !== "").length +
    (searchParams.sort !== "createdAt" || searchParams.order !== "desc" ? 1 : 0);

  return (
    <Page wide>
      <PageHeader
        eyebrow="Marketplace / Search"
        title="Product search"
        description="Find gear across every PlayHub store — filter by price, store and sort order."
        actions={
          <>
            <Button as={Link} to="/wishlist" variant="outline" icon={Heart}>
              Wishlist
            </Button>
            <Button as={Link} to="/cart" variant="outline" icon={ShoppingCart}>
              Cart
            </Button>
          </>
        }
      />

      <Card as="form" onSubmit={handleSearch} role="search" corners>
        <CardBar
          title="Query"
          right={
            <span className="text-[11px] text-faint tabular-nums">
              {hasSearched ? `${meta.total} result${meta.total === 1 ? "" : "s"}` : "—"}
            </span>
          }
        />
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              aria-label="Search products"
              icon={Search}
              className="min-w-0 flex-1"
              placeholder="> search products…"
              value={searchParams.q}
              onChange={(e) => handleInputChange("q", e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                icon={SlidersHorizontal}
                aria-expanded={showFilters}
                aria-controls="product-filters"
                onClick={() => setShowFilters((v) => !v)}
                className="flex-1 sm:flex-none"
              >
                Filters{activeFilters > 0 && <span className="text-primary tabular-nums">[{activeFilters}]</span>}
              </Button>
              <Button type="submit" variant="solid" loading={searchLoading} className="flex-1 sm:flex-none">
                Search
              </Button>
            </div>
          </div>

          {showFilters && (
            <div
              id="product-filters"
              className="grid grid-cols-2 gap-4 border-t border-dashed border-border pt-4 lg:grid-cols-5"
            >
              <Select
                label="Store"
                className="col-span-2 lg:col-span-1"
                value={searchParams.store}
                onChange={(e) => handleInputChange("store", e.target.value)}
              >
                <option value="">All stores</option>
                {stores.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <Input
                label="Min price (₹)"
                type="number"
                min="0"
                inputMode="decimal"
                placeholder="0"
                value={searchParams.minPrice}
                onChange={(e) => handleInputChange("minPrice", e.target.value)}
              />
              <Input
                label="Max price (₹)"
                type="number"
                min="0"
                inputMode="decimal"
                placeholder="10000"
                value={searchParams.maxPrice}
                onChange={(e) => handleInputChange("maxPrice", e.target.value)}
              />
              <Select label="Sort by" value={searchParams.sort} onChange={(e) => handleInputChange("sort", e.target.value)}>
                <option value="createdAt">Date listed</option>
                <option value="price">Price</option>
                <option value="name">Name</option>
              </Select>
              <Select label="Order" value={searchParams.order} onChange={(e) => handleInputChange("order", e.target.value)}>
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </Select>
              <div className="col-span-2 flex justify-end lg:col-span-5">
                <Button variant="ghost" size="sm" icon={RotateCcw} onClick={handleReset}>
                  Reset filters
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      <section aria-label="Search results" aria-busy={searchLoading || undefined}>
        <Eyebrow index="01" rule className="mb-4">
          Results
        </Eyebrow>
        {searchLoading && !products?.length ? (
          <LoadingBlock label="Searching products" />
        ) : (
          <div className={searchLoading ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <ProductGrid
              products={products}
              emptyAction={
                <Button variant="outline" icon={RotateCcw} onClick={handleReset}>
                  Clear search
                </Button>
              }
            />
          </div>
        )}

        {meta.totalPages > 1 && (
          <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={ChevronLeft}
              disabled={meta.page <= 1 || searchLoading}
              onClick={() => goToPage(meta.page - 1)}
            >
              Prev
            </Button>
            <span className="border border-border px-3 py-1.5 text-[11px] font-bold text-muted-foreground tabular-nums">
              {String(meta.page).padStart(2, "0")} / {String(meta.totalPages).padStart(2, "0")}
            </span>
            <Button
              variant="outline"
              size="sm"
              iconRight={ChevronRight}
              disabled={meta.page >= meta.totalPages || searchLoading}
              onClick={() => goToPage(meta.page + 1)}
            >
              Next
            </Button>
          </nav>
        )}
      </section>

      <TrendingProducts />
    </Page>
  );
}

export default ProductSearch;
