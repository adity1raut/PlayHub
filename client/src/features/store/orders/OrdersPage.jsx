import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { FlaskConical, Package, ReceiptText, RefreshCw } from "lucide-react";
import { API_URL } from "../../../lib/config";
import { useSocketEvent } from "../../../lib/useSocketEvent";
import { Alert, Badge, Button, Card, EmptyState, LoadingBlock, Page, PageHeader } from "../../../components/ui";
import { formatAmount } from "../checkout/razorpayUtils";

const PAGE_SIZE = 10;

const STATUS_VARIANT = {
  confirmed: "success",
  processing: "info",
  packed: "info",
  shipped: "info",
  out_for_delivery: "info",
  delivered: "success",
  cancelled: "destructive",
  return_requested: "warning",
  returned: "secondary",
};

const statusLabel = (status = "") => status.replace(/_/g, " ");

function OrderCard({ order }) {
  const payment = order.payment || {};
  const placed = new Date(order.createdAt);
  return (
    <Card as="article" aria-label={`Order ${order.orderNumber || order._id}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-foreground tabular-nums">#{order.orderNumber || order._id}</p>
          <p className="mt-0.5 text-[11px] text-faint">
            {placed.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })} ·{" "}
            {placed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {payment.mode === "test" && (
            <Badge variant="warning" icon={FlaskConical} title="Paid with Razorpay test mode — no real money">
              Test payment
            </Badge>
          )}
          <Badge variant={STATUS_VARIANT[order.orderStatus] || "secondary"}>{statusLabel(order.orderStatus)}</Badge>
        </div>
      </header>

      <ul className="divide-y divide-border">
        {(order.items || []).map((item) => (
          <li key={item._id || item.product?._id || item.productName} className="flex items-center justify-between gap-3 px-5 py-2.5">
            <span className="min-w-0">
              <span className="block truncate text-xs font-bold text-foreground">{item.productName}</span>
              <span className="block truncate text-[11px] text-faint">
                {item.storeName} · {item.quantity} × {formatAmount(item.price)}
              </span>
            </span>
            <span className="shrink-0 text-xs tabular-nums">{formatAmount(item.totalPrice)}</span>
          </li>
        ))}
      </ul>

      <footer className="space-y-1.5 border-t border-dashed border-border px-5 py-3 text-[11px]">
        <p className="flex items-baseline justify-between gap-3">
          <span className="eyebrow text-faint">Total</span>
          <span className="text-base font-extrabold text-primary tabular-nums">{formatAmount(order.totalAmount)}</span>
        </p>
        <p className="flex justify-between gap-3 text-faint">
          <span>Payment</span>
          <span className="truncate text-right text-muted-foreground">
            {payment.status === "completed" ? "Paid" : payment.status} · Razorpay {payment.razorpayPaymentId}
          </span>
        </p>
        {order.deliveryAddress && (
          <p className="flex justify-between gap-3 text-faint">
            <span>Deliver to</span>
            <span className="truncate text-right text-muted-foreground">
              {order.deliveryAddress.name}, {order.deliveryAddress.city}
            </span>
          </p>
        )}
      </footer>
    </Card>
  );
}

/** The signed-in buyer's orders (GET /api/stores/orders), newest first. */
export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(0);

  // Loads pages 1…upTo in one request so a refresh keeps what's already on screen
  const load = useCallback(async ({ upTo = 1, append = false } = {}) => {
    const id = ++requestRef.current;
    try {
      setError("");
      const res = await axios.get(`${API_URL}/api/stores/orders`, {
        params: append ? { page: upTo, limit: PAGE_SIZE } : { page: 1, limit: PAGE_SIZE * upTo },
      });
      if (id !== requestRef.current) return;
      const next = res.data?.data?.orders || [];
      setOrders((prev) => (append ? [...prev, ...next] : next));
      setHasMore(Boolean(res.data?.data?.pagination?.hasMore));
      setPage(upTo);
    } catch (err) {
      if (id === requestRef.current) setError(err.response?.data?.message || "Couldn't load your orders");
    } finally {
      if (id === requestRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // A new order confirmation (e.g. paid in another tab) — or missed ones after a reconnect
  useSocketEvent(
    "new-notification",
    (n) => {
      if (n?.type === "ORDER_UPDATE") load({ upTo: page });
    },
    { onReconnect: () => load({ upTo: page }) },
  );

  const loadMore = () => {
    setLoadingMore(true);
    load({ upTo: page + 1, append: true });
  };

  return (
    <Page>
      <PageHeader
        eyebrow="Marketplace / Orders"
        title="My orders"
        description="Everything you've bought, newest first. Orders paid in Razorpay test mode are marked as test payments."
        actions={
          <Button variant="outline" icon={RefreshCw} onClick={() => load({ upTo: page })}>
            Refresh
          </Button>
        }
      />

      {loading ? (
        <LoadingBlock label="Loading orders" />
      ) : error && !orders.length ? (
        <Alert variant="destructive" title="Couldn't load your orders">
          <p>{error}</p>
          <Button variant="outline" size="sm" icon={RefreshCw} className="mt-3" onClick={() => load()}>
            Try again
          </Button>
        </Alert>
      ) : orders.length === 0 ? (
        <Card>
          <EmptyState
            icon={ReceiptText}
            title="No orders yet"
            description="When you check out, your orders and payment details show up here."
            action={
              <Button as={Link} to="/products" variant="solid" icon={Package}>
                Browse products
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="mx-auto max-w-3xl space-y-4">
          {orders.map((order) => (
            <OrderCard key={order._id} order={order} />
          ))}
          {hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" loading={loadingMore} onClick={loadMore}>
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </Page>
  );
}
