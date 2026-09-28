import { useSocketEvent } from "../../lib/useSocketEvent";

/**
 * Live store catalogue: helpers to apply the server's product / store events to what a page
 * already shows (backend store/product.controller.js, store.controller.js, order.controller.js).
 *
 *   product:created { productId, storeId, product }
 *   product:updated { productId, storeId, product }   ← only the public fields that changed
 *   product:deleted { productId, storeId }
 *   product:rating  { productId, storeId, averageRating, ratingsCount, review }
 *   store:created   { storeId, store }                store:updated { storeId, store }
 *   store:deleted   { storeId, ownerId, productIds }  ← its products went with it
 */

export const idOf = (v) => String(v?._id ?? v ?? "");
export const storeIdOf = (product) => idOf(product?.store);

/** Did `product` go away with a deleted store (`store:deleted` payload)? */
export const inDeletedStore = (product, { storeId, productIds = [] } = {}) =>
  storeIdOf(product) === String(storeId) || productIds.includes(idOf(product));

/**
 * `list` with `fn` applied to the products `match` picks — `fn` returns the new product, or
 * null to drop it. Returns the same array when nothing matches (no re-render).
 */
export function patchProducts(list, match, fn) {
  if (!Array.isArray(list) || !list.some((p) => p && match(p))) return list;
  return list.flatMap((p) => (p && match(p) ? (fn(p) ?? []) : [p]));
}

/** `product:updated`: merge the changed fields (entries that are bare ids stay as they are). */
export const withChanges = (product, changes) =>
  product && typeof product === "object" ? { ...product, ...changes } : product;

/** `product:rating`: put the review in `ratings` (replacing the reviewer's earlier one) and refresh the average. */
export function withRating(product, { review, averageRating, ratingsCount } = {}) {
  if (!product || typeof product !== "object" || !review) return product;
  const reviewer = idOf(review.user);
  const ratings = Array.isArray(product.ratings) ? product.ratings : [];
  return {
    ...product,
    ratings: ratings.some((r) => idOf(r.user) === reviewer)
      ? ratings.map((r) => (idOf(r.user) === reviewer ? review : r))
      : [...ratings, review],
    // Aggregated lists (trending) carry these instead of computing from `ratings`
    averageRating,
    ratingCount: ratingsCount,
  };
}

/** `store:updated`: refresh the store's name / logo on one of its products (when `store` is populated). */
export const withStore = (product, store) =>
  product?.store && typeof product.store === "object"
    ? { ...product, store: { ...product.store, name: store.name, logo: store.logo } }
    : product;

/** `store:updated`: merge the storefront into a store we hold — its products and the owner's other fields stay. */
export const mergeStore = (prev, store) => ({
  ...prev,
  ...store,
  owner:
    prev?.owner && typeof prev.owner === "object" && store.owner && typeof store.owner === "object"
      ? { ...prev.owner, ...store.owner }
      : (store.owner ?? prev?.owner),
});

/**
 * Keep a product list (state + setter) in step with the live catalogue: edits and stock,
 * new / edited reviews, store renames, and removals (the product, or its whole store).
 * `onRemoved(count)` lets the page fix its totals. New products are left to each page —
 * whether one belongs in a filtered, sorted, paginated list is the page's call.
 */
export function useLiveProductList(products, setProducts, { onRemoved } = {}) {
  const byId = (id) => (p) => idOf(p) === String(id);
  const drop = (match) => {
    const count = (products || []).filter((p) => p && match(p)).length;
    if (!count) return;
    setProducts((list) => patchProducts(list, match, () => null));
    onRemoved?.(count);
  };

  useSocketEvent("product:updated", ({ productId, product } = {}) => {
    if (product) setProducts((list) => patchProducts(list, byId(productId), (p) => withChanges(p, product)));
  });

  useSocketEvent("product:rating", (e = {}) => {
    if (e.review) setProducts((list) => patchProducts(list, byId(e.productId), (p) => withRating(p, e)));
  });

  useSocketEvent("store:updated", ({ storeId, store } = {}) => {
    if (!store) return;
    setProducts((list) => patchProducts(list, (p) => storeIdOf(p) === String(storeId), (p) => withStore(p, store)));
  });

  useSocketEvent("product:deleted", ({ productId } = {}) => drop(byId(productId)));
  useSocketEvent("store:deleted", (e = {}) => drop((p) => inDeletedStore(p, e)));
}
