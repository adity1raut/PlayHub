import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Heart, Package, Search, ShoppingCart } from "lucide-react";
import { useProduct } from "../../../context/ProductContext";
import { Button, Card, EmptyState, LoadingBlock, Page, PageHeader } from "../../../components/ui";
import ProductCard from "../products/ProductCard";
import { PRODUCT_GRID_CLASS } from "../products/ProductGrid";

export function Wishlist() {
  const { getUserWishlist, wishlist } = useProduct();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchWishlist = async (page = currentPage) => {
    const data = await getUserWishlist(page);
    if (data) {
      const pages = Math.max(1, data.totalPages || 1);
      setTotalPages(pages);
      setTotal(data.total ?? data.products?.length ?? 0);
      // Removing the last item on a page: step back a page.
      if (page > 1 && !data.products?.length) setCurrentPage(Math.min(page - 1, pages));
    }
    return data;
  };

  // Context functions aren't memoised, so re-fetch only when the page changes.
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchWishlist(currentPage).finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // ProductCard already toggled + toasted; the context refetched page 1, so reload the page we're on.
  const handleWishlistToggle = async () => {
    await fetchWishlist(currentPage);
  };

  const items = Array.isArray(wishlist) ? wishlist.filter(Boolean) : [];

  return (
    <Page wide>
      <PageHeader
        eyebrow="Marketplace / Saved"
        title="Wishlist"
        description={
          total > 0
            ? `${total} saved product${total === 1 ? "" : "s"} — add them to your cart when you're ready.`
            : "Products you save show up here."
        }
        actions={
          <>
            <Button as={Link} to="/products/search" variant="outline" icon={Search}>
              Find products
            </Button>
            <Button as={Link} to="/cart" icon={ShoppingCart}>
              Cart
            </Button>
          </>
        }
      />

      {loading && items.length === 0 ? (
        <LoadingBlock label="Loading wishlist" />
      ) : items.length === 0 ? (
        <Card className="bg-card/60">
          <EmptyState
            icon={Heart}
            title="Your wishlist is empty"
            description="Tap the heart on any product to save it here for later."
            action={
              <Button as={Link} to="/products" variant="solid" icon={Package}>
                Browse products
              </Button>
            }
          />
        </Card>
      ) : (
        <section aria-label="Saved products" aria-busy={loading || undefined}>
          <h2 className="eyebrow mb-3 flex items-center justify-between text-faint">
            <span>Saved items</span>
            <span className="tabular-nums">
              {String(items.length).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </span>
          </h2>
          <div className={PRODUCT_GRID_CLASS}>
            {items.map((product) => (
              <ProductCard
                key={product._id}
                product={product}
                inWishlist
                onWishlistToggle={handleWishlistToggle}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={ChevronLeft}
                onClick={() => setCurrentPage((p) => p - 1)}
                disabled={currentPage === 1 || loading}
              >
                Prev
              </Button>
              <span className="border border-border px-3 py-1.5 text-[11px] font-bold text-muted-foreground tabular-nums">
                {String(currentPage).padStart(2, "0")} / {String(totalPages).padStart(2, "0")}
              </span>
              <Button
                variant="outline"
                size="sm"
                iconRight={ChevronRight}
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={currentPage === totalPages || loading}
              >
                Next
              </Button>
            </nav>
          )}
        </section>
      )}
    </Page>
  );
}

export default Wishlist;
