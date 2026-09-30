import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  CalendarDays,
  Eye,
  Package,
  Pencil,
  Plus,
  Store as StoreIcon,
  Trash2,
  TriangleAlert,
  Users,
  Warehouse,
} from "lucide-react";
import { useStore } from "../../../context/StoreContext";
import { useAuth } from "../../../context/AuthContext";
import { useProduct } from "../../../context/ProductContext";
import StoreForm from "./StoreForm";
import StoreAnalytics from "./StoreAnalytics";
import {
  Badge,
  Button,
  Card,
  CardBar,
  EmptyState,
  IconButton,
  LoadingBlock,
  LogoMark,
  Modal,
  Page,
  PageHeader,
  Skeleton,
  StatTile,
} from "../../../components/ui";
import { API_URL, mediaUrl } from "../../../lib/config";
import { toast } from "../../../lib/toast";
import { useSocketEvent } from "../../../lib/useSocketEvent";
import { idOf, useLiveProductList } from "../liveCatalog";

const LOW_STOCK = 5;
const pad = (n) => String(n).padStart(2, "0");
const formatPrice = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const apiError = (err, fallback) =>
  err?.response?.data?.error || err?.response?.data?.message || err?.message || fallback;

function StockBadge({ stock }) {
  const n = Number(stock || 0);
  if (n <= 0) return <Badge variant="destructive">Out of stock</Badge>;
  if (n <= LOW_STOCK) return <Badge variant="warning">{n} left</Badge>;
  return <Badge variant="secondary">{n} in stock</Badge>;
}

// StoreContext.createStore/updateStore send JSON with `logoBase64`, but the API
// expects multipart/form-data with a `logo` file (multer upload.single("logo")),
// so the logo was silently dropped. Send the multipart request here instead.
async function saveStore(method, url, storeData) {
  const fd = new FormData();
  fd.append("name", storeData.name);
  fd.append("description", storeData.description || "");
  if (storeData.logo instanceof File) fd.append("logo", storeData.logo);
  const res = await axios({ method, url, data: fd, withCredentials: true });
  return res.data;
}

function MyStore() {
  const {
    userStore,
    getCurrentUserStore,
    deleteStore,
    getStoreProducts,
    clearError,
    setUserStore,
  } = useStore();
  const { isAuthenticated, user } = useAuth();
  const { deleteProduct } = useProduct();
  const [showForm, setShowForm] = useState(false);
  const [editingStore, setEditingStore] = useState(null);
  const [storeProducts, setStoreProducts] = useState([]);
  const [productTotal, setProductTotal] = useState(0);
  const [localLoading, setLocalLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [storeChecked, setStoreChecked] = useState(!!userStore);
  const [confirmDeleteStore, setConfirmDeleteStore] = useState(false);
  const [deletingStore, setDeletingStore] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [deletingProduct, setDeletingProduct] = useState(false);
  const [analyticsKey, setAnalyticsKey] = useState(0);
  // Store followers = the owner's followers; patched live, reset when the auth user refreshes
  const [liveFollowers, setLiveFollowers] = useState(null);

  // Context functions are re-created on every provider render, so only depend on auth.
  useEffect(() => {
    if (isAuthenticated) {
      getCurrentUserStore().finally(() => setStoreChecked(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    if (userStore?._id) {
      fetchStoreProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userStore?._id]);

  useEffect(() => {
    clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLiveFollowers(null);
  }, [user]);

  const isMe = (id) => !!user?._id && id != null && String(id) === String(user._id);

  // Realtime: follower total for this store (its owner = you)
  useSocketEvent("store:followers", ({ ownerId, followersCount } = {}) => {
    if (isMe(ownerId) && typeof followersCount === "number") setLiveFollowers(followersCount);
  });

  // Following a store = following its owner, so plain user follows count too
  useSocketEvent("follow:updated", ({ targetId, followersCount } = {}) => {
    if (isMe(targetId) && typeof followersCount === "number") setLiveFollowers(followersCount);
  });

  // Realtime: a buyer paid for an order with your products (sent only to the owner)
  // The NEW_ORDER notification already alerts the owner (in-app pop-up + phone),
  // so this page only refreshes its figures.
  useSocketEvent("order:created", ({ storeIds } = {}) => {
    const forThisStore =
      !Array.isArray(storeIds) || !userStore?._id || storeIds.some((id) => String(id) === String(userStore._id));
    if (forThisStore && userStore?._id) {
      // Stock went down and the sales figures changed
      fetchStoreProducts();
      setAnalyticsKey((k) => k + 1);
    }
  });

  // Realtime: this store's products follow edits, purchases, reviews and removals from any tab
  // (StoreContext keeps the store itself — renamed, deleted or opened elsewhere).
  const isMyStore = (storeId) => !!userStore?._id && String(storeId) === String(userStore._id);
  const refreshAnalytics = () => setAnalyticsKey((k) => k + 1);

  useLiveProductList(storeProducts, setStoreProducts, {
    onRemoved: (n) => setProductTotal((t) => Math.max(0, t - n)),
  });

  // Added from another tab: newest first, like the list the API returns
  useSocketEvent(
    "product:created",
    ({ storeId, product } = {}) => {
      if (!product || !isMyStore(storeId)) return;
      if (!storeProducts.some((p) => idOf(p) === idOf(product))) {
        setStoreProducts((prev) => (prev.some((p) => idOf(p) === idOf(product)) ? prev : [product, ...prev]));
        setProductTotal((t) => t + 1);
      }
      refreshAnalytics();
    },
    {
      onReconnect: () => {
        if (!isAuthenticated) return;
        getCurrentUserStore();
        fetchStoreProducts();
        refreshAnalytics();
      },
    },
  );

  // The analytics panel: in / out of stock counts, product names, ratings and product totals.
  // (Its stock chart reads `storeProducts`, which is already live.)
  useSocketEvent("product:updated", ({ storeId, productId, product } = {}) => {
    if (!product || !isMyStore(storeId)) return;
    const before = storeProducts.find((p) => idOf(p) === String(productId));
    const stockFlipped = "stock" in product && (Number(before?.stock) > 0) !== (Number(product.stock) > 0);
    if (!before || stockFlipped || ("name" in product && product.name !== before.name)) refreshAnalytics();
  });
  useSocketEvent("product:rating", ({ storeId } = {}) => isMyStore(storeId) && refreshAnalytics());
  useSocketEvent("product:deleted", ({ storeId } = {}) => isMyStore(storeId) && refreshAnalytics());

  const fetchStoreProducts = async () => {
    if (!userStore?._id) return;

    setLocalLoading(true);
    try {
      const result = await getStoreProducts(userStore._id, { limit: 100 });
      if (result?.success) {
        const list = result.data.products || [];
        setStoreProducts(list);
        setProductTotal(result.data.total ?? list.length);
      } else {
        toast.error(result?.message || "Failed to fetch store products");
      }
    } catch {
      toast.error("Failed to fetch store products");
    } finally {
      setLocalLoading(false);
    }
  };

  const handleCreateStore = async (storeData) => {
    setSaving(true);
    try {
      const data = await saveStore("post", `${API_URL}/api/stores`, storeData);
      setUserStore(data);
      setShowForm(false);
      toast.success("Store created successfully!");
      // Refresh user store data (adds populated products)
      getCurrentUserStore();
    } catch (error) {
      toast.error(apiError(error, "Failed to create store"));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStore = async (storeData) => {
    if (!editingStore) return;

    setSaving(true);
    try {
      const data = await saveStore("put", `${API_URL}/api/stores/${editingStore._id}`, storeData);
      setUserStore((prev) => ({ ...prev, ...data, products: prev?.products ?? data.products }));
      setShowForm(false);
      setEditingStore(null);
      toast.success("Store updated successfully!");
      getCurrentUserStore();
    } catch (error) {
      toast.error(apiError(error, "Failed to update store"));
    } finally {
      setSaving(false);
    }
  };

  const handleEditStore = (store) => {
    setEditingStore(store);
    setShowForm(true);
  };

  const handleDeleteStore = async () => {
    if (!userStore) return;
    setDeletingStore(true);
    try {
      const result = await deleteStore(userStore._id);
      if (result?.success) {
        toast.success("Store deleted successfully!");
        setStoreProducts([]);
        setProductTotal(0);
        setConfirmDeleteStore(false);
      } else {
        toast.error(result?.message || "Failed to delete store");
      }
    } catch {
      toast.error("Failed to delete store");
    } finally {
      setDeletingStore(false);
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingStore(null);
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete || !userStore) return;

    setDeletingProduct(true);
    try {
      const result = await deleteProduct(userStore._id, productToDelete._id);
      if (result?.success) {
        toast.success("Product deleted successfully!");
        setProductToDelete(null);
        await Promise.all([fetchStoreProducts(), getCurrentUserStore()]);
        setAnalyticsKey((k) => k + 1);
      } else {
        toast.error(result?.message || "Failed to delete product");
      }
    } catch {
      toast.error("Failed to delete product");
    } finally {
      setDeletingProduct(false);
    }
  };

  const storeForm = (
    <StoreForm
      isOpen={showForm}
      onClose={handleCloseForm}
      onSubmit={editingStore ? handleUpdateStore : handleCreateStore}
      store={editingStore}
      loading={saving}
    />
  );

  if (!isAuthenticated) {
    return (
      <Page>
        <Card>
          <EmptyState
            icon={StoreIcon}
            title="Authentication required"
            description="Please login to manage your store."
            action={
              <Button as={Link} to="/login" variant="solid">
                Sign in
              </Button>
            }
          />
        </Card>
      </Page>
    );
  }

  if (!userStore && !storeChecked) {
    return (
      <Page>
        <LoadingBlock label="Loading your store" />
      </Page>
    );
  }

  if (!userStore) {
    return (
      <Page>
        <PageHeader
          eyebrow="Marketplace / My store"
          title="My store"
          description="Manage your storefront and products."
          actions={
            <Button as={Link} to="/stores" variant="outline" icon={StoreIcon}>
              All stores
            </Button>
          }
        />
        <Card corners>
          <EmptyState
            icon={Warehouse}
            title="No store yet"
            description="Create your store to start selling to the Spawnpoint community."
            action={
              <Button variant="solid" icon={Plus} onClick={() => setShowForm(true)}>
                Create store
              </Button>
            }
          />
        </Card>
        {storeForm}
      </Page>
    );
  }

  const lowStock = storeProducts.filter((p) => Number(p.stock || 0) <= LOW_STOCK).length;
  const followers = liveFollowers ?? (Array.isArray(user?.followers) ? user.followers.length : null);
  const since = userStore.createdAt ? new Date(userStore.createdAt).getFullYear() : null;

  return (
    <Page wide>
      <PageHeader
        eyebrow="Marketplace / My store"
        title={
          <span className="flex min-w-0 items-center gap-3">
            {userStore.logo ? (
              <img
                src={mediaUrl(userStore.logo)}
                alt=""
                className="size-10 shrink-0 border border-border object-cover sm:size-12"
              />
            ) : (
              <span className="flex size-10 shrink-0 items-center justify-center border border-border bg-card sm:size-12">
                <LogoMark className="size-6 text-primary" />
              </span>
            )}
            <span className="min-w-0 break-words">{userStore.name}</span>
          </span>
        }
        description={userStore.description || "No description yet — edit your store to add one."}
        actions={
          <>
            <Button as={Link} to="/add-product" variant="solid" icon={Plus}>
              Add product
            </Button>
            <Button variant="outline" icon={Pencil} onClick={() => handleEditStore(userStore)}>
              Edit store
            </Button>
            <Button variant="destructive" icon={Trash2} onClick={() => setConfirmDeleteStore(true)}>
              Delete store
            </Button>
          </>
        }
      />

      <section>
        <h2 className="eyebrow mb-3 text-faint">Overview</h2>
        <div className="grid grid-cols-2 border-t border-l border-border lg:grid-cols-4">
          <StatTile index="01" icon={Package} label="Products" value={productTotal} />
          <StatTile index="02" icon={Users} label="Followers" value={followers} tone="text-info" />
          <StatTile
            index="03"
            icon={TriangleAlert}
            label="Low stock"
            value={lowStock}
            tone={lowStock > 0 ? "text-warning" : "text-muted-foreground"}
          />
          <StatTile index="04" icon={CalendarDays} label="Since" value={since} tone="text-muted-foreground" />
        </div>
      </section>

      <section>
        <h2 className="eyebrow mb-3 text-faint">Inventory</h2>
        <Card>
          <CardBar
            title={`Products · ${pad(productTotal)}`}
            right={
              <Button as={Link} to="/add-product" size="sm" icon={Plus}>
                Add
              </Button>
            }
          />
          {localLoading && storeProducts.length === 0 ? (
            <ul className="divide-y divide-border">
              {[1, 2, 3].map((i) => (
                <li key={i} className="flex items-center gap-3 px-5 py-3">
                  <Skeleton className="size-12" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </li>
              ))}
            </ul>
          ) : storeProducts.length > 0 ? (
            <ul className="divide-y divide-border">
              {storeProducts.map((product, i) => (
                <li key={product._id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent sm:px-5">
                  <span className="hidden w-5 shrink-0 text-[10px] text-faint tabular-nums sm:block">{pad(i + 1)}</span>
                  {product.images?.[0] ? (
                    <img
                      src={mediaUrl(product.images[0])}
                      alt=""
                      loading="lazy"
                      className="size-12 shrink-0 border border-border object-cover"
                    />
                  ) : (
                    <div className="flex size-12 shrink-0 items-center justify-center border border-border bg-background/60 text-faint">
                      <Package className="size-5" aria-hidden="true" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/products/${product._id}`}
                      className="block truncate text-xs font-bold tracking-[0.08em] text-foreground uppercase hover:text-primary"
                    >
                      {product.name}
                    </Link>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-primary tabular-nums">{formatPrice(product.price)}</span>
                      <StockBadge stock={product.stock} />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <IconButton
                      as={Link}
                      to={`/products/${product._id}`}
                      icon={Eye}
                      label={`View ${product.name}`}
                      size="sm"
                    />
                    <IconButton
                      as={Link}
                      to={`/edit-product/${product._id}`}
                      icon={Pencil}
                      label={`Edit ${product.name}`}
                      size="sm"
                    />
                    <IconButton
                      icon={Trash2}
                      label={`Delete ${product.name}`}
                      size="sm"
                      disabled={deletingProduct}
                      onClick={() => setProductToDelete(product)}
                      className="[&_svg]:text-destructive"
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Package}
              title="No products yet"
              description="Add your first product to get started!"
              action={
                <Button as={Link} to="/add-product" variant="solid" icon={Plus}>
                  Add product
                </Button>
              }
            />
          )}
        </Card>
      </section>

      <section>
        <h2 className="eyebrow mb-3 text-faint">Analytics</h2>
        <StoreAnalytics storeId={userStore._id} products={storeProducts} refreshKey={analyticsKey} />
      </section>

      {storeForm}

      <Modal
        open={confirmDeleteStore}
        onClose={() => !deletingStore && setConfirmDeleteStore(false)}
        title="Delete store?"
        description="This action cannot be undone and will delete all associated products."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDeleteStore(false)} disabled={deletingStore}>
              Cancel
            </Button>
            <Button variant="destructive" icon={Trash2} loading={deletingStore} onClick={handleDeleteStore}>
              Delete store
            </Button>
          </>
        }
      >
        <p className="text-xs text-muted-foreground">
          <span className="text-destructive">&gt;</span> {userStore.name} and its {productTotal}{" "}
          {productTotal === 1 ? "product" : "products"} will be removed permanently.
        </p>
      </Modal>

      <Modal
        open={!!productToDelete}
        onClose={() => !deletingProduct && setProductToDelete(null)}
        title="Delete product?"
        description="This action cannot be undone."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setProductToDelete(null)} disabled={deletingProduct}>
              Cancel
            </Button>
            <Button variant="destructive" icon={Trash2} loading={deletingProduct} onClick={handleDeleteProduct}>
              Delete product
            </Button>
          </>
        }
      >
        <p className="text-xs text-muted-foreground">
          <span className="text-destructive">&gt;</span> {productToDelete?.name} will be removed from your store.
        </p>
      </Modal>
    </Page>
  );
}

export default MyStore;
