import { PackageSearch } from "lucide-react";
import { cn } from "../../../lib/cn";
import { Card, EmptyState } from "../../../components/ui";
import ProductCard from "./ProductCard";

// Wrapper for ProductCard tiles: the tiles draw the right/bottom borders, this draws top/left.
export const PRODUCT_GRID_CLASS =
  "grid border-t border-l border-border sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

export function ProductGrid({
  products,
  onWishlistToggle,
  inWishlist,
  className,
  emptyTitle = "No products found",
  emptyDescription = "Try a different search or loosen the filters.",
  emptyAction,
}) {
  if (!products?.length) {
    return (
      <Card className="bg-card/60">
        <EmptyState icon={PackageSearch} title={emptyTitle} description={emptyDescription} action={emptyAction} />
      </Card>
    );
  }

  return (
    <div className={cn(PRODUCT_GRID_CLASS, className)}>
      {products.map((product) => (
        <ProductCard
          key={product._id}
          product={product}
          inWishlist={inWishlist}
          onWishlistToggle={onWishlistToggle}
        />
      ))}
    </div>
  );
}

export default ProductGrid;
