import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, ImageOff, ShoppingCart, Star } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useProduct } from "../../../context/ProductContext";
import { mediaUrl } from "../../../lib/config";
import { toast } from "../../../lib/toast";
import { useSocketEvent } from "../../../lib/useSocketEvent";
import { cn } from "../../../lib/cn";
import { Badge, Button, IconButton } from "../../../components/ui";
import { formatAmount } from "../checkout/razorpayUtils";

const idOf = (v) => (v && typeof v === "object" ? v._id : v);

/**
 * Product tile. Render inside a `grid border-t border-l border-border` wrapper
 * (see PRODUCT_GRID_CLASS in ./ProductGrid) so the tile borders line up.
 *
 * - `onWishlistToggle(productId, result)` is optional and runs after the wishlist toggled.
 * - `inWishlist` forces the initial heart state (e.g. on the wishlist page).
 */
function ProductCard({ product, onWishlistToggle, inWishlist, className }) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { addToCart, toggleWishlist, wishlist } = useProduct() ?? {};

  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [togglingWishlist, setTogglingWishlist] = useState(false);
  const [wishlistOverride, setWishlistOverride] = useState(null);

  // Toggled in another tab: the server's answer wins over whatever this card last saw
  useSocketEvent("wishlist:updated", (e = {}) => {
    if (product && String(e.productId) === String(product._id)) setWishlistOverride(Boolean(e.inWishlist));
  });

  if (!product) return null;

  const productId = product._id;
  const storeId = idOf(product.store);
  const productUrl = `/products/${productId}`;
  const image = product.images?.[0];
  const stock = Number(product.stock) || 0;
  const outOfStock = stock <= 0;
  const lowStock = !outOfStock && stock <= 5;

  const ratingCount = product.ratings?.length || 0;
  const averageRating =
    ratingCount > 0 ? product.ratings.reduce((acc, r) => acc + (Number(r.rating) || 0), 0) / ratingCount : 0;

  const inWishlistFromContext = Array.isArray(wishlist) && wishlist.some((p) => idOf(p) === productId);
  const isWishlisted = wishlistOverride ?? inWishlist ?? inWishlistFromContext;

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    if (!storeId) {
      toast.error("This product isn't linked to a store");
      return;
    }
    setIsAddingToCart(true);
    try {
      const result = await addToCart(productId, 1, storeId);
      if (result?.success) toast.success(`${product.name} added to cart`);
      else toast.error(result?.message || "Couldn't add to cart");
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleWishlistToggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      toast.error("Sign in to use your wishlist");
      return;
    }
    setTogglingWishlist(true);
    try {
      const result = await toggleWishlist(productId);
      if (result?.success) {
        setWishlistOverride(result.inWishlist);
        toast.success(result.inWishlist ? "Added to wishlist" : "Removed from wishlist");
        onWishlistToggle?.(productId, result);
      } else {
        toast.error(result?.message || "Couldn't update wishlist");
      }
    } finally {
      setTogglingWishlist(false);
    }
  };

  return (
    <article
      className={cn(
        "group relative flex min-w-0 flex-col border-r border-b border-border bg-card/60 transition-colors hover:bg-card",
        className,
      )}
    >
      <Link to={productUrl} className="relative block aspect-square overflow-hidden border-b border-border bg-muted">
        {image ? (
          <img
            src={mediaUrl(image)}
            alt={product.name}
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-faint">
            <ImageOff className="size-8" aria-hidden="true" />
            <span className="sr-only">No image</span>
          </span>
        )}
        {(outOfStock || lowStock) && (
          <span className="absolute top-2 left-2">
            {outOfStock ? (
              <Badge variant="destructive">Sold out</Badge>
            ) : (
              <Badge variant="warning">Only {stock} left</Badge>
            )}
          </span>
        )}
      </Link>

      <span className="absolute top-2 right-2 bg-background/80">
        <IconButton
          icon={Heart}
          label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          variant="outline"
          size="sm"
          active={isWishlisted}
          disabled={togglingWishlist}
          onClick={handleWishlistToggle}
          className={isWishlisted ? "[&_svg]:fill-current" : undefined}
        />
      </span>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {product.store?.name && <p className="eyebrow truncate text-faint">{product.store.name}</p>}
        <Link
          to={productUrl}
          title={product.name}
          className="truncate text-xs font-bold tracking-[0.08em] text-foreground uppercase transition-colors hover:text-primary"
        >
          {product.name}
        </Link>
        {product.description && (
          <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{product.description}</p>
        )}

        <p className="flex items-center gap-1.5 text-[11px] text-faint tabular-nums">
          <Star
            className={cn("size-3", ratingCount ? "fill-current text-warning" : "text-faint")}
            aria-hidden="true"
          />
          {averageRating.toFixed(1)}
          <span>({ratingCount})</span>
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="text-sm font-bold text-primary tabular-nums">{formatAmount(product.price || 0)}</span>
          {outOfStock ? (
            <Badge variant="destructive">Out of stock</Badge>
          ) : (
            <Badge variant="success">{stock} in stock</Badge>
          )}
        </div>

        <Button
          size="sm"
          fullWidth
          icon={ShoppingCart}
          loading={isAddingToCart}
          disabled={outOfStock}
          onClick={handleAddToCart}
        >
          {outOfStock ? "Out of stock" : isAddingToCart ? "Adding" : "Add to cart"}
        </Button>
      </div>
    </article>
  );
}

export default ProductCard;
