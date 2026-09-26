import { useState, useEffect } from "react";
import { BarChart3, MessageSquareText, PackageCheck, PackageX, Star } from "lucide-react";
import { useProduct } from "../../../context/ProductContext";
import { Card, CardBar, EmptyState, LoadingBlock, StatTile } from "../../../components/ui";

const pad = (n) => String(n).padStart(2, "0");

/* Vertical column chart: one series, direct value labels, baseline rule. */
function ColumnChart({ items, max, caption, format = (v) => v }) {
  const top = max || Math.max(1, ...items.map((i) => i.value));
  return (
    <figure className="px-5 pt-5 pb-4">
      <div className="flex h-40 items-end gap-3 border-b border-border pt-5" aria-hidden="true">
        {items.map((item) => {
          const pct = Math.max(0, Math.min(100, (item.value / top) * 100));
          return (
            <div key={item.key} className="group flex h-full min-w-0 flex-1 items-end justify-center">
              <div
                title={`${item.label}: ${format(item.value)}`}
                className="relative w-full max-w-12 bg-primary/70 transition-colors group-hover:bg-primary"
                style={{ height: `${pct}%`, minHeight: item.value > 0 ? 2 : 0 }}
              >
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-bold whitespace-nowrap text-foreground tabular-nums">
                  {format(item.value)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-3" aria-hidden="true">
        {items.map((item) => (
          <p key={item.key} title={item.label} className="min-w-0 flex-1 truncate text-center text-[10px] text-faint uppercase">
            {item.label}
          </p>
        ))}
      </div>
      <figcaption className="sr-only">{caption}</figcaption>
      <table className="sr-only">
        <tbody>
          {items.map((item) => (
            <tr key={item.key}>
              <th scope="row">{item.label}</th>
              <td>{format(item.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/* Horizontal bar list: label | bar track | value. */
function BarList({ items, caption }) {
  const top = Math.max(1, ...items.map((i) => i.value));
  return (
    <figure className="space-y-2.5 px-5 py-5">
      <figcaption className="sr-only">{caption}</figcaption>
      {items.map((item) => (
        <div
          key={item.key}
          title={`${item.label}: ${item.value}`}
          className="group grid grid-cols-[minmax(0,7.5rem)_1fr_2.5rem] items-center gap-3"
        >
          <span className="truncate text-[10px] text-faint uppercase">{item.label}</span>
          <span className="flex h-3 items-center border-l border-border">
            <span
              className="h-full bg-primary/70 transition-colors group-hover:bg-primary"
              style={{ width: `${(item.value / top) * 100}%`, minWidth: item.value > 0 ? 2 : 0 }}
            />
          </span>
          <span className="text-right text-[11px] font-bold text-foreground tabular-nums">{item.value}</span>
        </div>
      ))}
    </figure>
  );
}

/**
 * Store analytics panel. Reads GET /api/stores/:storeId/analytics
 * → { success, data: { totalProducts, inStockProducts, outOfStockProducts,
 *     averageRating, totalRatings, topRatedProducts[], recentRatings[] } }
 * `products` (optional) adds a stock-level chart.
 */
export function StoreAnalytics({ storeId, products = [], refreshKey }) {
  const { getStoreAnalytics } = useProduct();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchAnalytics = async () => {
      setLoading(true);
      const res = await getStoreAnalytics(storeId);
      if (cancelled) return;
      setAnalytics(res?.data ?? null);
      setLoading(false);
    };

    if (storeId) {
      fetchAnalytics();
    }
    return () => {
      cancelled = true;
    };
    // getStoreAnalytics is re-created on every provider render; depending on it loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, refreshKey]);

  if (loading && !analytics) {
    return (
      <Card>
        <LoadingBlock label="Loading analytics" />
      </Card>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <EmptyState
          icon={BarChart3}
          title="No analytics yet"
          description="Analytics show up once your store has products and reviews."
        />
      </Card>
    );
  }

  const topRated = (analytics.topRatedProducts || []).map((p) => ({
    key: p._id,
    label: p.name,
    value: Number(p.averageRating || 0),
  }));
  const hasRatings = topRated.some((p) => p.value > 0);

  const stock = [...products]
    .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))
    .slice(0, 8)
    .map((p) => ({ key: p._id, label: p.name, value: Number(p.stock || 0) }));

  const recent = analytics.recentRatings || [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 border-t border-l border-border lg:grid-cols-4">
        <StatTile index="01" icon={PackageCheck} label="In stock" value={analytics.inStockProducts ?? 0} tone="text-success" />
        <StatTile index="02" icon={PackageX} label="Out of stock" value={analytics.outOfStockProducts ?? 0} tone="text-destructive" />
        <StatTile
          index="03"
          icon={Star}
          label="Avg rating"
          value={analytics.totalRatings ? Number(analytics.averageRating || 0).toFixed(1) : "–"}
          tone="text-warning"
        />
        <StatTile index="04" icon={MessageSquareText} label="Reviews" value={analytics.totalRatings ?? 0} tone="text-info" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardBar title="Top rated" right={<span className="text-[10px] text-faint">avg / 5</span>} />
          {hasRatings ? (
            <ColumnChart
              items={topRated}
              max={5}
              caption="Average rating of your top rated products, out of 5"
              format={(v) => v.toFixed(1)}
            />
          ) : (
            <p className="px-5 py-10 text-center text-xs text-faint">No ratings yet.</p>
          )}
        </Card>

        <Card>
          <CardBar title="Stock levels" right={<span className="text-[10px] text-faint">lowest first</span>} />
          {stock.length > 0 ? (
            <BarList items={stock} caption="Units in stock per product, lowest first" />
          ) : (
            <p className="px-5 py-10 text-center text-xs text-faint">No products yet.</p>
          )}
        </Card>
      </div>

      <Card>
        <CardBar
          title="Recent reviews"
          right={<span className="text-[10px] text-faint tabular-nums">{pad(recent.length)}</span>}
        />
        {recent.length > 0 ? (
          <ul className="divide-y divide-border">
            {recent.map((r, i) => (
              <li key={`${r._id}-${i}`} className="flex gap-3 px-5 py-3">
                <span className="w-5 shrink-0 pt-0.5 text-[10px] text-faint tabular-nums">{pad(i + 1)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <p className="truncate text-xs font-bold text-foreground">{r.productName}</p>
                    <span className="flex items-center gap-0.5" aria-label={`${r.rating} out of 5`}>
                      {[...Array(5)].map((_, s) => (
                        <Star
                          key={s}
                          aria-hidden="true"
                          className={s < r.rating ? "size-3 fill-current text-warning" : "size-3 text-faint/50"}
                        />
                      ))}
                    </span>
                  </div>
                  {r.review && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.review}</p>}
                  <p className="mt-1 text-[11px] text-faint">
                    @{r.userName || "user"}
                    {r.createdAt && ` · ${new Date(r.createdAt).toLocaleDateString()}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-10 text-center text-xs text-faint">No reviews yet.</p>
        )}
      </Card>
    </div>
  );
}

export default StoreAnalytics;
