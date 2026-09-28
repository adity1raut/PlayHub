import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CreditCard,
  ImageOff,
  Loader2,
  LogIn,
  Minus,
  Package,
  Plus,
  RefreshCw,
  ShoppingCart,
  Store,
  Trash2,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useProduct } from "../../../context/ProductContext";
import { mediaUrl } from "../../../lib/config";
import { toast } from "../../../lib/toast";
import { cn } from "../../../lib/cn";
import {
  Button,
  Card,
  CardBar,
  EmptyState,
  IconButton,
  LoadingBlock,
  Page,
  PageHeader,
  Spinner,
} from "../../../components/ui";
import { formatAmount } from "../checkout/razorpayUtils";

/* Square − value + stepper. */
function QtyStepper({ value, onDecrement, onIncrement, decDisabled, incDisabled, busy, label }) {
  return (
    <div role="group" aria-label={label} className="inline-flex items-center">
      <IconButton icon={Minus} label="Decrease quantity" variant="outline" size="sm" onClick={onDecrement} disabled={decDisabled} />
      <span
        aria-live="polite"
        className="flex h-8 min-w-12 items-center justify-center border-y border-border-strong px-3 text-xs font-bold tabular-nums"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin text-primary" aria-label="Updating" /> : value}
      </span>
      <IconButton icon={Plus} label="Increase quantity" variant="outline" size="sm" onClick={onIncrement} disabled={incDisabled} />
    </div>
  );
}

/* "label ........ value" row, like the landing handshake panel. */
function LeaderRow({ label, children, className }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <dt className="shrink-0 text-muted-foreground">&gt; {label}</dt>
      <span aria-hidden="true" className="min-w-0 flex-1 overflow-hidden whitespace-nowrap text-faint/50">
        {".".repeat(60)}
      </span>
      <dd className="shrink-0 text-right text-foreground tabular-nums">{children}</dd>
    </div>
  );
}

export default function Cart() {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();
  const { cart, cartLoading, fetchCart, updateCartItem, removeFromCart, clearCart, getCartItemCount } = useProduct();

  const [updating, setUpdating] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  // Load the current cart when the page opens (then `cart:updated` keeps it live). Context
  // functions aren't memoised, so only depend on auth.
  useEffect(() => {
    if (isAuthenticated) fetchCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const handleRefreshCart = async () => {
    setRefreshing(true);
    try {
      await fetchCart();
      toast.success("Cart refreshed");
    } catch {
      toast.error("Failed to refresh cart");
    } finally {
      setRefreshing(false);
    }
  };

  const handleUpdateQuantity = async (productId, newQuantity) => {
    if (newQuantity < 0) return;

    setUpdating((prev) => ({ ...prev, [productId]: true }));
    try {
      const result = await updateCartItem(productId, newQuantity);
      if (!result.success) toast.error(result.message || "Failed to update cart");
    } catch (error) {
      toast.error("Error updating cart item");
      console.error("Update cart error:", error);
    } finally {
      setUpdating((prev) => ({ ...prev, [productId]: false }));
    }
  };

  const handleRemoveItem = async (productId, productName) => {
    if (!window.confirm(`Remove "${productName}" from cart?`)) return;

    setUpdating((prev) => ({ ...prev, [productId]: true }));
    try {
      const result = await removeFromCart(productId);
      if (result.success) toast.success(`${productName} removed from cart`);
      else toast.error(result.message || "Failed to remove item");
    } catch (error) {
      toast.error("Error removing item from cart");
      console.error("Remove item error:", error);
    } finally {
      setUpdating((prev) => ({ ...prev, [productId]: false }));
    }
  };

  const handleClearCart = async () => {
    if (!window.confirm("Clear your entire cart? This can't be undone.")) return;

    try {
      const result = await clearCart();
      if (result.success) toast.success(result.message || "Cart cleared");
      else toast.error(result.message || "Failed to clear cart");
    } catch (error) {
      toast.error("Error clearing cart");
      console.error("Clear cart error:", error);
    }
  };

  const toNumber = (n) => (typeof n === "number" && !isNaN(n) ? n : Number(n) || 0);

  const safeCart = cart || { items: [], totalAmount: 0 };
  const safeItems = Array.isArray(safeCart.items) ? safeCart.items.filter((item) => item?.product?._id) : [];
  const totalItems = getCartItemCount();
  const storeCount = new Set(
    safeItems.map((item) => item.product.store?._id ?? item.product.store).filter(Boolean),
  ).size;
  // Prefer the server total; fall back to summing the rows.
  const subtotal =
    toNumber(safeCart.totalAmount) ||
    safeItems.reduce((sum, item) => sum + toNumber(item.product.price) * toNumber(item.quantity), 0);

  if (loading) {
    return (
      <Page>
        <LoadingBlock label="Loading cart" />
      </Page>
    );
  }

  if (!isAuthenticated) {
    return (
      <Page>
        <Card corners>
          <EmptyState
            icon={ShoppingCart}
            title="Sign in required"
            description="Sign in to view your shopping cart."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="solid" icon={LogIn} onClick={() => navigate("/login")}>
                  Sign in
                </Button>
                <Button as={Link} to="/products" variant="outline" icon={Package}>
                  Browse products
                </Button>
              </div>
            }
          />
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Marketplace / Cart"
        title="Cart"
        description={
          totalItems > 0
            ? `${totalItems} item${totalItems === 1 ? "" : "s"} from ${storeCount} store${storeCount === 1 ? "" : "s"}.`
            : "Nothing in your cart yet."
        }
        actions={
          <>
            <Button variant="ghost" icon={RefreshCw} loading={refreshing} onClick={handleRefreshCart}>
              Refresh
            </Button>
            <Button as={Link} to="/products" variant="outline" icon={ArrowLeft}>
              Continue shopping
            </Button>
          </>
        }
      />

      {safeItems.length > 0 ? (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
          {/* Line items */}
          <Card className="min-w-0">
            <CardBar
              title={`Items · ${String(safeItems.length).padStart(2, "0")}`}
              right={
                cartLoading ? (
                  <span className="flex items-center gap-2 text-[11px] text-faint">
                    <Spinner label="Updating cart" className="size-3.5" /> Syncing
                  </span>
                ) : (
                  <span className="text-[11px] text-faint tabular-nums">{totalItems} units</span>
                )
              }
            />
            <ul className="divide-y divide-border">
              {safeItems.map((item) => {
                const product = item.product;
                const isUpdating = Boolean(updating[product._id]);
                const quantity = toNumber(item.quantity);
                const stock = toNumber(product.stock);
                const image = product.images?.[0];
                const atMax = quantity >= stock;

                return (
                  <li key={product._id} className="flex gap-3 px-4 py-4 transition-colors hover:bg-accent/40 sm:gap-4 sm:px-5">
                    <Link
                      to={`/products/${product._id}`}
                      className="size-20 shrink-0 overflow-hidden border border-border bg-muted"
                    >
                      {image ? (
                        <img src={mediaUrl(image)} alt={product.name} loading="lazy" className="size-full object-cover" />
                      ) : (
                        <span className="flex size-full items-center justify-center text-faint">
                          <ImageOff className="size-5" aria-hidden="true" />
                          <span className="sr-only">No image</span>
                        </span>
                      )}
                    </Link>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            to={`/products/${product._id}`}
                            title={product.name}
                            className="block truncate text-xs font-bold tracking-[0.08em] text-foreground uppercase hover:text-primary"
                          >
                            {product.name}
                          </Link>
                          {product.store?.name && (
                            <p className="mt-1 flex items-center gap-1.5 truncate text-[11px] text-faint">
                              <Store className="size-3 shrink-0" aria-hidden="true" />
                              {product.store.name}
                            </p>
                          )}
                          <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                            {formatAmount(toNumber(product.price))} <span className="text-faint">/ unit</span>
                          </p>
                        </div>
                        <IconButton
                          icon={Trash2}
                          label={`Remove ${product.name} from cart`}
                          size="sm"
                          disabled={isUpdating}
                          onClick={() => handleRemoveItem(product._id, product.name)}
                        />
                      </div>

                      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <QtyStepper
                            label={`Quantity of ${product.name}`}
                            value={quantity}
                            busy={isUpdating}
                            onDecrement={() => handleUpdateQuantity(product._id, quantity - 1)}
                            onIncrement={() => handleUpdateQuantity(product._id, quantity + 1)}
                            decDisabled={isUpdating || quantity <= 1}
                            incDisabled={isUpdating || atMax}
                          />
                          <p className={cn("mt-1.5 text-[10px] tabular-nums", atMax ? "text-warning" : "text-faint")}>
                            {atMax ? "Max stock reached" : `${stock} available`}
                          </p>
                        </div>
                        <p className="text-sm font-bold text-primary tabular-nums">
                          {formatAmount(toNumber(product.price) * quantity)}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          {/* Summary */}
          <Card corners className="lg:sticky lg:top-6">
            <CardBar title="Order summary" />
            <dl className="space-y-2 px-5 py-4 text-[11px]">
              <LeaderRow label={`Subtotal (${totalItems})`}>{formatAmount(subtotal)}</LeaderRow>
              <LeaderRow label="Shipping">
                <span className="font-bold text-success">FREE</span>
              </LeaderRow>
              <LeaderRow label="Tax">
                <span className="text-faint">At checkout</span>
              </LeaderRow>
              <LeaderRow label="Stores">{storeCount}</LeaderRow>
            </dl>
            <div className="flex items-baseline justify-between gap-3 border-t border-dashed border-border px-5 py-4">
              <span className="eyebrow text-muted-foreground">Total</span>
              <span className="text-2xl font-extrabold text-primary tabular-nums">{formatAmount(subtotal)}</span>
            </div>
            <div className="space-y-2 border-t border-border p-5">
              <Button
                variant="solid"
                size="lg"
                fullWidth
                icon={CreditCard}
                disabled={cartLoading || safeItems.length === 0}
                onClick={() => navigate("/checkout")}
              >
                Checkout
              </Button>
              <button
                type="button"
                onClick={handleClearCart}
                disabled={cartLoading}
                className="flex h-10 w-full items-center justify-center gap-2 border border-transparent text-[11px] font-bold tracking-[0.12em] text-destructive uppercase transition-colors hover:border-destructive/40 hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-45"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Clear cart
              </button>
            </div>
            {safeCart.updatedAt && (
              <p className="border-t border-border px-5 py-2.5 text-[10px] text-faint">
                Updated {new Date(safeCart.updatedAt).toLocaleString()}
              </p>
            )}
          </Card>
        </div>
      ) : cartLoading ? (
        <LoadingBlock label="Loading cart" />
      ) : (
        <Card className="bg-card/60">
          <EmptyState
            icon={ShoppingCart}
            title="Your cart is empty"
            description="Looks like you haven't added anything yet. Find something you like and it'll show up here."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button as={Link} to="/products" variant="solid" icon={Package}>
                  Browse products
                </Button>
                <Button as={Link} to="/stores" variant="outline" icon={Store}>
                  Browse stores
                </Button>
              </div>
            }
          />
        </Card>
      )}
    </Page>
  );
}
