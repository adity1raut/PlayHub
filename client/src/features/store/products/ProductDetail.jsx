import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Edit,
  Heart,
  ImageOff,
  ImagePlus,
  MessageCircle,
  Minus,
  PackageX,
  Plus,
  Save,
  Send,
  ShoppingCart,
  Star,
  Store,
  Trash2,
  Warehouse,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useProduct } from "../../../context/ProductContext";
import { useStore } from "../../../context/StoreContext";
import { mediaUrl } from "../../../lib/config";
import { toast } from "../../../lib/toast";
import { cn } from "../../../lib/cn";
import { useSocketEvent } from "../../../lib/useSocketEvent";
import { inDeletedStore, withChanges, withRating, withStore } from "../liveCatalog";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardBar,
  Corners,
  EmptyState,
  IconButton,
  Input,
  LoadingBlock,
  Page,
  Textarea,
  buttonClass,
} from "../../../components/ui";
import { formatAmount } from "../checkout/razorpayUtils";

const idOf = (v) => (v && typeof v === "object" ? v._id : v);

/* Square − value + stepper. */
function QtyStepper({ value, onDecrement, onIncrement, decDisabled, incDisabled }) {
  return (
    <div role="group" aria-label="Quantity" className="inline-flex items-center">
      <IconButton icon={Minus} label="Decrease quantity" variant="outline" onClick={onDecrement} disabled={decDisabled} />
      <span
        aria-live="polite"
        className="flex h-10 min-w-14 items-center justify-center border-y border-border-strong px-3 text-sm font-bold tabular-nums"
      >
        {value}
      </span>
      <IconButton icon={Plus} label="Increase quantity" variant="outline" onClick={onIncrement} disabled={incDisabled} />
    </div>
  );
}

/* "label ........ value" row, like the landing handshake panel. */
function LeaderRow({ label, children }) {
  return (
    <div className="flex items-center gap-2">
      <dt className="shrink-0 text-faint">&gt; {label}</dt>
      <span aria-hidden="true" className="min-w-0 flex-1 overflow-hidden whitespace-nowrap text-faint/50">
        {".".repeat(80)}
      </span>
      <dd className="max-w-[60%] shrink-0 truncate text-right text-muted-foreground tabular-nums">{children}</dd>
    </div>
  );
}

const renderStars = (value, className = "size-4") =>
  [...Array(5)].map((_, i) => (
    <Star
      key={i}
      aria-hidden="true"
      className={cn(className, i < value ? "fill-current text-warning" : "text-faint/60")}
    />
  ));

const formatDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");

export default function ProductDetail() {
  const { productId } = useParams();
  const { isAuthenticated } = useAuth();
  const { getProductById, addProductRating, addToCart, toggleWishlist, updateProduct, isInCart, wishlist } =
    useProduct();
  const { userStore } = useStore();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [error, setError] = useState("");
  const [removed, setRemoved] = useState(false); // deleted (or its store closed) while open
  const [, setSuccess] = useState("");
  const [addingToCart, setAddingToCart] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: "", description: "", price: "", stock: "" });
  const [newImages, setNewImages] = useState([]);
  const [imagesToRemove, setImagesToRemove] = useState([]);
  const [updating, setUpdating] = useState(false);

  const storeId = idOf(product?.store);
  const storeName = product?.store?.name;

  const isProductOwner = Boolean(isAuthenticated && userStore && product && storeId === userStore._id);

  const [inWishlist, setInWishlist] = useState(false);

  useEffect(() => {
    if (!product) return;
    if (product.inWishlist !== undefined) setInWishlist(product.inWishlist);
    else if (Array.isArray(wishlist)) setInWishlist(wishlist.some((p) => idOf(p) === product._id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?._id]);

  useEffect(() => {
    if (productId) {
      setSelectedImage(0);
      setQuantity(1);
      setIsEditing(false);
      fetchProduct();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  // Fill the form when editing starts — not on every live update (a purchase changing the
  // stock, say), which would wipe what the owner is typing.
  useEffect(() => {
    if (product && isEditing) {
      setEditData({
        name: product.name || "",
        description: product.description || "",
        price: product.price?.toString() || "",
        stock: product.stock?.toString() || "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?._id, isEditing]);

  // Realtime: price / stock / details, reviews and the store's name follow along; if the
  // product (or its whole store) is deleted while open, say so.
  const isThisProduct = (id) => String(id) === String(productId);
  const markRemoved = () => {
    setRemoved(true);
    setProduct(null);
    setIsEditing(false);
    setError("This product was removed by its store.");
  };

  useSocketEvent(
    "product:updated",
    ({ productId: id, product: changes } = {}) => {
      if (changes && isThisProduct(id)) setProduct((prev) => (prev ? withChanges(prev, changes) : prev));
    },
    { onReconnect: () => productId && !removed && fetchProduct({ silent: true }) },
  );

  useSocketEvent("product:rating", (e = {}) => {
    if (e.review && isThisProduct(e.productId)) setProduct((prev) => (prev ? withRating(prev, e) : prev));
  });

  useSocketEvent("store:updated", ({ storeId: id, store } = {}) => {
    if (store && storeId && String(id) === storeId) setProduct((prev) => (prev ? withStore(prev, store) : prev));
  });

  useSocketEvent("product:deleted", ({ productId: id } = {}) => isThisProduct(id) && markRemoved());

  useSocketEvent("store:deleted", (e = {}) => product && inDeletedStore(product, e) && markRemoved());

  // Saved / unsaved in another tab
  useSocketEvent("wishlist:updated", (e = {}) => {
    if (isThisProduct(e.productId)) setInWishlist(Boolean(e.inWishlist));
  });

  // Object URLs for the not-yet-uploaded images (revoked when the list changes).
  const newImagePreviews = useMemo(() => newImages.map((file) => URL.createObjectURL(file)), [newImages]);
  useEffect(() => () => newImagePreviews.forEach((url) => URL.revokeObjectURL(url)), [newImagePreviews]);

  // `silent`: refresh in the background (e.g. after a reconnect) — keeps the page up if the request fails
  const fetchProduct = async ({ silent = false } = {}) => {
    setLoading(true);
    setError("");
    setRemoved(false);
    try {
      const productData = await getProductById(productId);
      if (productData) {
        setProduct(productData);
        setError("");
      } else if (!silent) {
        setProduct(null);
        setError("This product doesn't exist or was removed.");
      }
    } catch (err) {
      console.error("Error fetching product:", err);
      toast.error("Error fetching product details");
      setError("Error fetching product details");
    } finally {
      setLoading(false);
    }
  };

  const handleEditToggle = () => {
    if (isEditing) {
      setEditData({
        name: product.name || "",
        description: product.description || "",
        price: product.price?.toString() || "",
        stock: product.stock?.toString() || "",
      });
      setNewImages([]);
      setImagesToRemove([]);
      setError("");
    }
    setIsEditing(!isEditing);
  };

  const handleInputChange = (field, value) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageAdd = (e) => {
    const files = Array.from(e.target.files || []);
    setNewImages((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const handleImageRemove = (imageUrl) => {
    setImagesToRemove((prev) => [...prev, imageUrl]);
    setSelectedImage(0);
  };

  const handleNewImageRemove = (index) => {
    setNewImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateProduct = async () => {
    if (!editData.name.trim() || !editData.price || !editData.stock) {
      toast.error("Please fill in all required fields");
      setError("Please fill in all required fields");
      return;
    }

    setUpdating(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
      formData.append("name", editData.name.trim());
      formData.append("description", editData.description.trim());
      formData.append("price", parseFloat(editData.price));
      formData.append("stock", parseInt(editData.stock));

      newImages.forEach((image) => formData.append("images", image));

      // Images to remove — "removeImages[]" so multer parses it as an array
      // (the controller checks Array.isArray(removeImages)).
      imagesToRemove.forEach((url) => formData.append("removeImages[]", url));

      const result = await updateProduct(userStore._id, productId, formData);

      if (result.success) {
        // The update response doesn't populate ratings.user — keep the populated ones.
        setProduct((prev) => ({ ...result.data, ratings: prev?.ratings ?? result.data.ratings }));
        setIsEditing(false);
        setNewImages([]);
        setImagesToRemove([]);
        setSelectedImage(0);
        toast.success("Product updated");
        setSuccess("Product updated successfully!");
      } else {
        toast.error(result.message || "Failed to update product");
        setError(result.message || "Failed to update product");
      }
    } catch {
      toast.error("Error updating product");
      setError("Error updating product");
    } finally {
      setUpdating(false);
    }
  };

  const handleSubmitRating = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error("Please login to add a rating");
      return;
    }

    setSubmittingRating(true);
    setSuccess("");

    try {
      const result = await addProductRating(productId, rating, review);

      if (result.success) {
        // The rating response doesn't populate `store` — keep the populated one.
        setProduct((prev) => ({ ...result.data, store: prev?.store ?? result.data.store }));
        setReview("");
        setRating(5);
        toast.success("Rating submitted");
        setSuccess("Rating submitted successfully!");
      } else {
        toast.error(result.message || "Error submitting rating");
      }
    } catch {
      toast.error("Error submitting rating");
    } finally {
      setSubmittingRating(false);
    }
  };

  /** Returns true when the item landed in the cart. */
  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      navigate("/login");
      return false;
    }

    if (addingToCart) return false;

    if (quantity > product.stock) {
      toast.error(`Only ${product.stock} items available in stock`);
      return false;
    }

    setAddingToCart(true);
    try {
      const result = await addToCart(product._id, Number(quantity), storeId);
      if (result.success) {
        toast.success(`${quantity} × ${product.name} added to cart`);
        setSuccess(`${quantity} item(s) added to cart successfully!`);
        return true;
      }
      toast.error(result.message || "Failed to add product to cart");
      return false;
    } catch (err) {
      console.error("Error adding to cart:", err);
      toast.error("Failed to add product to cart");
      return false;
    } finally {
      setAddingToCart(false);
    }
  };

  const handleBuyNow = async () => {
    if (isAuthenticated && isInCart?.(product._id)) {
      navigate("/checkout");
      return;
    }
    if (await handleAddToCart()) navigate("/checkout");
  };

  const handleWishlistToggle = async () => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    try {
      const result = await toggleWishlist(product._id);
      if (result.success) {
        setInWishlist(result.inWishlist);
        toast.success(result.inWishlist ? "Added to wishlist" : "Removed from wishlist");
      } else {
        toast.error(result.message || "Error updating wishlist");
      }
    } catch {
      toast.error("Error updating wishlist");
    }
  };

  const calculateAverageRating = () => {
    if (!product?.ratings || product.ratings.length === 0) return 0;
    const sum = product.ratings.reduce((acc, r) => acc + r.rating, 0);
    return sum / product.ratings.length;
  };

  const getDisplayImages = () => {
    if (!product?.images) return [];
    return product.images.filter((img) => !imagesToRemove.includes(img));
  };

  if (loading && !product) {
    return (
      <Page wide>
        <LoadingBlock label="Loading product" />
      </Page>
    );
  }

  if (!product) {
    return (
      <Page wide>
        <Card corners>
          <EmptyState
            icon={PackageX}
            title={removed ? "Product removed" : "Product not found"}
            description={error || "This product doesn't exist or was removed."}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" icon={ArrowLeft} onClick={() => navigate(-1)}>
                  Go back
                </Button>
                <Button as={Link} to="/products" variant="solid">
                  Browse products
                </Button>
              </div>
            }
          />
        </Card>
      </Page>
    );
  }

  const displayImages = getDisplayImages();
  const mainImage = displayImages[selectedImage] || displayImages[0];
  const averageRating = calculateAverageRating();
  const ratingCount = product.ratings?.length || 0;
  const stock = Number(product.stock) || 0;
  const reviews = (product.ratings || []).slice().reverse();

  const addToCartLabel = addingToCart
    ? "Adding"
    : !isAuthenticated
      ? "Login to add to cart"
      : stock === 0
        ? "Out of stock"
        : quantity > stock
          ? "Insufficient stock"
          : "Add to cart";

  return (
    <Page wide>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[11px] text-faint">
          <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate(-1)}>
            Back
          </Button>
          <span aria-hidden="true">/</span>
          <Link to="/products" className="shrink-0 hover:text-primary">
            Products
          </Link>
          <span aria-hidden="true">/</span>
          <span className="truncate text-muted-foreground">{product.name}</span>
        </nav>

        {isProductOwner && (
          <div className="flex flex-wrap gap-2">
            {isEditing ? (
              <>
                <Button variant="solid" icon={Save} loading={updating} onClick={handleUpdateProduct}>
                  Save changes
                </Button>
                <Button variant="outline" icon={X} onClick={handleEditToggle} disabled={updating}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button as={Link} to="/my-store" variant="ghost" icon={Warehouse}>
                  My store
                </Button>
                <Button icon={Edit} onClick={handleEditToggle}>
                  Edit product
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div className="min-w-0 space-y-3">
          <div className="relative aspect-square border border-border bg-muted">
            <Corners />
            {mainImage ? (
              <img
                src={mediaUrl(mainImage)}
                alt={isEditing ? editData.name : product.name}
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-3 text-faint">
                <ImageOff className="size-10" aria-hidden="true" />
                <span className="eyebrow">No image available</span>
              </div>
            )}
            {displayImages.length > 1 && (
              <span className="absolute bottom-3 left-3 border border-border bg-background/85 px-2 py-1 text-[10px] font-bold text-muted-foreground tabular-nums">
                {String(Math.min(selectedImage, displayImages.length - 1) + 1).padStart(2, "0")} /{" "}
                {String(displayImages.length).padStart(2, "0")}
              </span>
            )}
            {isEditing && mainImage && (
              <span className="absolute top-3 right-3 bg-background/85">
                <IconButton
                  icon={Trash2}
                  label="Remove this image"
                  variant="destructive"
                  size="sm"
                  onClick={() => handleImageRemove(mainImage)}
                />
              </span>
            )}
          </div>

          {displayImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {displayImages.map((image, index) => {
                const active = image === mainImage;
                return (
                  <button
                    key={image}
                    type="button"
                    onClick={() => setSelectedImage(index)}
                    aria-label={`Show image ${index + 1}`}
                    aria-pressed={active}
                    className={cn(
                      "size-16 shrink-0 border bg-muted transition-colors sm:size-20",
                      active ? "border-primary" : "border-border hover:border-border-strong",
                    )}
                  >
                    <img src={mediaUrl(image)} alt="" className="size-full object-cover" />
                  </button>
                );
              })}
            </div>
          )}

          {isEditing && (
            <div className="space-y-3 border border-dashed border-border-strong p-4">
              <p className="eyebrow text-faint">New images</p>
              {newImagePreviews.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {newImagePreviews.map((src, index) => (
                    <div key={src} className="relative size-16 border border-success/60 sm:size-20">
                      <img src={src} alt={`New ${index + 1}`} className="size-full object-cover" />
                      <span className="absolute -top-2 -right-2 bg-background">
                        <IconButton
                          icon={X}
                          label={`Remove new image ${index + 1}`}
                          variant="outline"
                          size="sm"
                          onClick={() => handleNewImageRemove(index)}
                        />
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <label className={cn(buttonClass({ variant: "outline", size: "sm" }), "cursor-pointer")}>
                <ImagePlus aria-hidden="true" />
                Add images
                <input type="file" multiple accept="image/*" onChange={handleImageAdd} className="sr-only" />
              </label>
              {imagesToRemove.length > 0 && (
                <p className="text-[11px] text-warning">
                  {imagesToRemove.length} image{imagesToRemove.length === 1 ? "" : "s"} will be removed on save.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="min-w-0">
          {isEditing ? (
            <Card corners>
              <CardBar title="Editing product" />
              <div className="space-y-4 p-5">
                {error && <Alert variant="destructive">{error}</Alert>}
                <Input
                  label="Product name *"
                  value={editData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Enter product name"
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Price (₹) *"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editData.price}
                    onChange={(e) => handleInputChange("price", e.target.value)}
                    placeholder="0.00"
                  />
                  <Input
                    label="Stock *"
                    type="number"
                    min="0"
                    value={editData.stock}
                    onChange={(e) => handleInputChange("stock", e.target.value)}
                    placeholder="0"
                  />
                </div>
                <Textarea
                  label="Description"
                  rows={6}
                  value={editData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  placeholder="Enter product description"
                />
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button variant="solid" icon={Save} loading={updating} onClick={handleUpdateProduct}>
                    Save changes
                  </Button>
                  <Button variant="outline" icon={X} onClick={handleEditToggle} disabled={updating}>
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <div className="space-y-6">
              <div>
                {storeName && (
                  <Link
                    to={`/products/search?store=${storeId}`}
                    className="eyebrow inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
                    title={`More from ${storeName}`}
                  >
                    <Store className="size-3.5" aria-hidden="true" />
                    {storeName}
                  </Link>
                )}
                <h1 className="mt-3 text-2xl font-extrabold tracking-[0.06em] break-words text-foreground uppercase">
                  {product.name}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-0.5" role="img" aria-label={`Rated ${averageRating.toFixed(1)} out of 5`}>
                    {renderStars(Math.round(averageRating))}
                  </span>
                  <span className="tabular-nums">
                    {averageRating.toFixed(1)} · {ratingCount} review{ratingCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 border-y border-dashed border-border py-4">
                <span className="text-3xl font-extrabold text-primary tabular-nums">
                  {formatAmount(Number(product.price) || 0)}
                </span>
                {stock > 0 ? (
                  <Badge variant={stock <= 5 ? "warning" : "success"}>
                    {stock <= 5 ? `Only ${stock} left` : `${stock} in stock`}
                  </Badge>
                ) : (
                  <Badge variant="destructive">Out of stock</Badge>
                )}
              </div>

              <div>
                <h2 className="eyebrow mb-2 text-faint">Description</h2>
                <p className="text-xs leading-relaxed whitespace-pre-line text-muted-foreground sm:text-sm">
                  {product.description || "No description available."}
                </p>
              </div>

              {isProductOwner ? (
                <Alert variant="info" title="You sell this product">
                  Use “Edit product” to change details, price, stock or images.
                </Alert>
              ) : (
                <div className="space-y-4">
                  {stock > 0 && (
                    <div>
                      <p className="eyebrow mb-2 text-muted-foreground">Quantity</p>
                      <div className="flex items-center gap-3">
                        <QtyStepper
                          value={quantity}
                          onDecrement={() => setQuantity(Math.max(1, quantity - 1))}
                          onIncrement={() => setQuantity(Math.min(stock, quantity + 1))}
                          decDisabled={quantity <= 1}
                          incDisabled={quantity >= stock}
                        />
                        <span className="text-[11px] text-faint tabular-nums">Max {stock}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="solid"
                      icon={ShoppingCart}
                      loading={addingToCart}
                      disabled={stock === 0 || quantity > stock}
                      onClick={handleAddToCart}
                      className="min-w-36 flex-1"
                    >
                      {addToCartLabel}
                    </Button>
                    <Button
                      variant="outline"
                      icon={Zap}
                      disabled={stock === 0 || quantity > stock || addingToCart}
                      onClick={handleBuyNow}
                      className="min-w-32 flex-1"
                    >
                      Buy now
                    </Button>
                    {isAuthenticated && (
                      <IconButton
                        icon={Heart}
                        label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
                        variant="outline"
                        active={inWishlist}
                        onClick={handleWishlistToggle}
                        className={inWishlist ? "[&_svg]:fill-current" : undefined}
                      />
                    )}
                  </div>

                  <ul className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-4">
                    {[
                      ["View cart", "/cart"],
                      ["Wishlist", "/wishlist"],
                      ["Continue shopping", "/products"],
                    ].map(([label, to]) => (
                      <li key={to}>
                        <Link
                          to={to}
                          className="text-[11px] font-bold tracking-[0.12em] text-muted-foreground uppercase transition-colors hover:text-foreground"
                        >
                          <span className="text-primary">&gt; </span>
                          {label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardBar title="Specifications" />
          <dl className="space-y-2 px-5 py-4 text-[11px]">
            <LeaderRow label="sku">{String(product._id).slice(-8).toUpperCase()}</LeaderRow>
            <LeaderRow label="price">{formatAmount(Number(product.price) || 0)}</LeaderRow>
            <LeaderRow label="stock">{stock > 0 ? `${stock} units` : "Sold out"}</LeaderRow>
            {storeName && <LeaderRow label="store">{storeName}</LeaderRow>}
            <LeaderRow label="rating">
              {ratingCount ? `${averageRating.toFixed(1)} / 5` : "Unrated"}
            </LeaderRow>
            <LeaderRow label="reviews">{ratingCount}</LeaderRow>
            <LeaderRow label="images">{product.images?.length || 0}</LeaderRow>
            <LeaderRow label="listed">{formatDate(product.createdAt)}</LeaderRow>
            <LeaderRow label="updated">{formatDate(product.updatedAt)}</LeaderRow>
          </dl>
        </Card>

        <Card>
          <CardBar
            title={`Ratings & reviews · ${String(ratingCount).padStart(2, "0")}`}
            right={
              ratingCount > 0 && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-warning tabular-nums">
                  <Star className="size-3.5 fill-current" aria-hidden="true" />
                  {averageRating.toFixed(1)}
                </span>
              )
            }
          />

          {isAuthenticated && !isProductOwner && (
            <form onSubmit={handleSubmitRating} className="space-y-4 border-b border-border px-5 py-5">
              <div>
                <p className="eyebrow mb-2 text-muted-foreground" id="rating-label">
                  Your rating
                </p>
                <div role="radiogroup" aria-labelledby="rating-label" className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      role="radio"
                      aria-checked={rating === star}
                      aria-label={`${star} star${star > 1 ? "s" : ""}`}
                      onClick={() => setRating(star)}
                      className="flex size-8 items-center justify-center border border-transparent transition-colors hover:border-border hover:bg-accent"
                    >
                      <Star
                        aria-hidden="true"
                        className={cn("size-5", star <= rating ? "fill-current text-warning" : "text-faint")}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-[11px] text-muted-foreground tabular-nums">{rating} / 5</span>
                </div>
              </div>
              <Textarea
                label="Review"
                rows={3}
                value={review}
                onChange={(e) => setReview(e.target.value)}
                placeholder="What did you think? (optional)"
              />
              <Button type="submit" variant="solid" icon={Send} loading={submittingRating}>
                Submit rating
              </Button>
            </form>
          )}

          {reviews.length > 0 ? (
            <ul className="divide-y divide-border">
              {reviews.map((r, idx) => {
                const name = r.user?.profile?.name || r.user?.username || "Anonymous";
                return (
                  <li key={r._id || idx} className="px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <Avatar name={name} size="xs" />
                        <span className="truncate text-xs font-bold text-foreground">{name}</span>
                        {r.user?.username && (
                          <span className="truncate text-[11px] text-faint">@{r.user.username}</span>
                        )}
                      </span>
                      <span className="text-[11px] text-faint">{r.createdAt ? formatDate(r.createdAt) : ""}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-0.5" role="img" aria-label={`${r.rating} out of 5`}>
                      {renderStars(r.rating, "size-3.5")}
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {r.review || <span className="text-faint italic">No comment</span>}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={MessageCircle}
              title="No reviews yet"
              description={isProductOwner ? "Reviews from buyers show up here." : "Be the first to rate this product."}
            />
          )}
        </Card>
      </div>
    </Page>
  );
}
