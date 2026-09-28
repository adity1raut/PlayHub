import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { useProduct } from "../../../context/ProductContext";
import { Eyebrow, Skeleton } from "../../../components/ui";
import ProductGrid, { PRODUCT_GRID_CLASS } from "./ProductGrid";
import { useLiveProductList } from "../liveCatalog";

export function TrendingProducts({ limit = 12, className }) {
  const { getTrendingProducts } = useProduct();
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Context functions aren't memoised, so only re-fetch when the limit changes.
  useEffect(() => {
    let active = true;
    const fetchTrending = async () => {
      setLoading(true);
      const products = await getTrendingProducts(limit);
      if (!active) return;
      setTrendingProducts(Array.isArray(products) ? products : []);
      setLoading(false);
    };
    fetchTrending();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  // Live price / stock / ratings; removed products drop out
  useLiveProductList(trendingProducts, setTrendingProducts);

  return (
    <section className={className} aria-label="Trending products">
      <div className="mb-4 flex items-end justify-between gap-3">
        <Eyebrow index="02" rule className="flex-1">
          <span className="inline-flex items-center gap-1.5">
            <TrendingUp className="size-3.5" aria-hidden="true" /> Trending now
          </span>
        </Eyebrow>
        {!loading && trendingProducts.length > 0 && (
          <span className="text-[11px] text-faint tabular-nums">{trendingProducts.length} items</span>
        )}
      </div>

      {loading ? (
        <div className={PRODUCT_GRID_CLASS} aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="border-r border-b border-border bg-card/60">
              <Skeleton className="aspect-square w-full" />
              <div className="space-y-2 p-4">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-8 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <ProductGrid
          products={trendingProducts}
          emptyTitle="Nothing trending yet"
          emptyDescription="Products show up here once shoppers start rating them."
        />
      )}
    </section>
  );
}

export default TrendingProducts;
