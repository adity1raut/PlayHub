import { useState, useEffect, useId, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Boxes,
  ImageUp,
  IndianRupee,
  PackageX,
  RotateCcw,
  Save,
  Trash2,
  Warehouse,
  X,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useStore } from "../../../context/StoreContext";
import { useProduct } from "../../../context/ProductContext";
import {
  Alert,
  Button,
  Card,
  CardBar,
  EmptyState,
  IconButton,
  Input,
  LoadingBlock,
  Page,
  PageHeader,
  Textarea,
} from "../../../components/ui";
import { cn } from "../../../lib/cn";
import { mediaUrl } from "../../../lib/config";
import { toast } from "../../../lib/toast";

const MAX_IMAGES = 5;
const pad = (n) => String(n).padStart(2, "0");

export default function EditProduct() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const inputId = useId();
  const { isAuthenticated } = useAuth();
  const { userStore, getCurrentUserStore } = useStore();
  const { updateProduct, getProductById } = useProduct();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    stock: "",
  });
  const [existingImages, setExistingImages] = useState([]);
  // [{ file, url }] — url is an object URL used for the preview
  const [newImages, setNewImages] = useState([]);
  const [removeImages, setRemoveImages] = useState([]);
  const [productStoreId, setProductStoreId] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [storeChecked, setStoreChecked] = useState(!!userStore);
  const newImagesRef = useRef(newImages);
  newImagesRef.current = newImages;

  // userStore is loaded asynchronously by StoreContext — make sure we have it.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (userStore) {
      setStoreChecked(true);
      return;
    }
    getCurrentUserStore().finally(() => setStoreChecked(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    if (productId) {
      fetchProduct();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  useEffect(() => () => newImagesRef.current.forEach((img) => URL.revokeObjectURL(img.url)), []);

  const fetchProduct = async () => {
    setInitialLoading(true);
    setLoadError("");
    try {
      const product = await getProductById(productId);
      if (product) {
        setProductStoreId(product.store?._id || product.store || null);
        setFormData({
          name: product.name || "",
          description: product.description || "",
          price: product.price?.toString() || "",
          stock: product.stock?.toString() || "",
        });
        setExistingImages(product.images || []);
        setRemoveImages([]);
      } else {
        setLoadError("Product not found");
      }
    } catch (error) {
      console.error("Error fetching product:", error);
      setLoadError("Error fetching product details");
    } finally {
      setInitialLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const imageCount = existingImages.length - removeImages.length + newImages.length;

  const addFiles = (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    if (imageCount + files.length > MAX_IMAGES) {
      setError(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }
    setNewImages((prev) => [...prev, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
    setError("");
  };

  const handleNewImageChange = (e) => {
    addFiles(e.target.files);
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const removeNewImage = (index) => {
    setNewImages((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const toggleRemoveExistingImage = (imageUrl) => {
    if (removeImages.includes(imageUrl)) {
      // Restoring an image must not push the total over the limit.
      if (imageCount + 1 > MAX_IMAGES) {
        setError(`Maximum ${MAX_IMAGES} images allowed`);
        return;
      }
      setRemoveImages((prev) => prev.filter((url) => url !== imageUrl));
    } else {
      setRemoveImages((prev) => [...prev, imageUrl]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userStore?._id) return;
    setLoading(true);
    setError("");

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("name", formData.name.trim());
      formDataToSend.append("description", formData.description);
      formDataToSend.append("price", formData.price);
      formDataToSend.append("stock", formData.stock);

      // The API expects `removeImages` as an array (Array.isArray check).
      // A single JSON string was silently ignored — `removeImages[]` makes
      // multer parse it into an array even when only one image is removed.
      removeImages.forEach((url) => {
        formDataToSend.append("removeImages[]", url);
      });

      newImages.forEach(({ file }) => {
        formDataToSend.append("images", file);
      });

      const result = await updateProduct(userStore._id, productId, formDataToSend);

      if (result.success) {
        toast.success("Product updated successfully!");
        navigate("/my-store");
      } else {
        setError(result.message || "Error updating product");
      }
    } catch {
      setError("Error updating product");
    } finally {
      setLoading(false);
    }
  };

  if (isAuthenticated && !userStore && !storeChecked) {
    return (
      <Page>
        <LoadingBlock label="Loading your store" />
      </Page>
    );
  }

  if (!isAuthenticated || !userStore) {
    return (
      <Page>
        <PageHeader eyebrow="My store / Products" title="Edit product" />
        <Card corners>
          <EmptyState
            icon={Warehouse}
            title="Store required"
            description="You need to have a store to edit products."
            action={
              <Button as={Link} to="/my-store" variant="solid">
                Go to my store
              </Button>
            }
          />
        </Card>
      </Page>
    );
  }

  if (initialLoading) {
    return (
      <Page>
        <LoadingBlock label="Loading product" />
      </Page>
    );
  }

  const notOwner = productStoreId && String(productStoreId) !== String(userStore._id);

  if (loadError || notOwner) {
    return (
      <Page>
        <PageHeader eyebrow="My store / Products" title="Edit product" />
        <Card corners>
          <EmptyState
            icon={PackageX}
            title={notOwner ? "Not your product" : "Product unavailable"}
            description={notOwner ? "You are not authorized to edit this product" : loadError}
            action={
              <Button as={Link} to="/my-store" variant="outline" icon={ArrowLeft}>
                Back to my store
              </Button>
            }
          />
        </Card>
      </Page>
    );
  }

  const full = imageCount >= MAX_IMAGES;

  return (
    <Page>
      <PageHeader
        eyebrow="My store / Products"
        title="Edit product"
        description={formData.name ? `Editing “${formData.name}” in ${userStore.name}.` : undefined}
        actions={
          <Button as={Link} to="/my-store" variant="ghost" icon={ArrowLeft}>
            My store
          </Button>
        }
      />

      <Card as="form" corners onSubmit={handleSubmit} className="max-w-3xl">
        <CardBar title="Product details" right={<span className="text-[10px] text-faint">* required</span>} />

        <div className="space-y-4 p-5 sm:p-6">
          <Input
            label="Product name *"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            maxLength={120}
            placeholder="Enter product name"
            disabled={loading}
          />

          <Textarea
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows={4}
            placeholder="Enter product description"
            disabled={loading}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Price (₹) *"
              type="number"
              name="price"
              icon={IndianRupee}
              value={formData.price}
              onChange={handleInputChange}
              required
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              disabled={loading}
            />
            <Input
              label="Stock *"
              type="number"
              name="stock"
              icon={Boxes}
              value={formData.stock}
              onChange={handleInputChange}
              required
              min="0"
              step="1"
              inputMode="numeric"
              placeholder="0"
              disabled={loading}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor={inputId} className="eyebrow text-muted-foreground">
                Images
              </label>
              <span className="text-[10px] text-faint tabular-nums">
                {imageCount}/{MAX_IMAGES}
              </span>
            </div>

            {existingImages.length + newImages.length > 0 && (
              <ul className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {existingImages.map((imageUrl, index) => {
                  const removed = removeImages.includes(imageUrl);
                  return (
                    <li
                      key={imageUrl}
                      className={cn(
                        "relative aspect-square border bg-background/60",
                        removed ? "border-dashed border-destructive/60" : "border-border",
                      )}
                    >
                      <img
                        src={mediaUrl(imageUrl)}
                        alt={`Current ${index + 1}`}
                        className={cn("size-full object-cover transition-opacity", removed && "opacity-30")}
                      />
                      <span className="absolute bottom-0 left-0 bg-background/85 px-1.5 py-0.5 text-[10px] text-faint tabular-nums">
                        {pad(index + 1)}
                      </span>
                      {removed && (
                        <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[10px] font-bold tracking-[0.12em] text-destructive uppercase">
                          Removing
                        </span>
                      )}
                      <span className="absolute top-1 right-1">
                        <IconButton
                          icon={removed ? RotateCcw : Trash2}
                          label={removed ? `Keep image ${index + 1}` : `Remove image ${index + 1}`}
                          size="sm"
                          variant="secondary"
                          onClick={() => toggleRemoveExistingImage(imageUrl)}
                          disabled={loading}
                        />
                      </span>
                    </li>
                  );
                })}
                {newImages.map((img, index) => (
                  <li key={img.url} className="relative aspect-square border border-primary/50 bg-background/60">
                    <img src={img.url} alt={`New ${index + 1}`} className="size-full object-cover" />
                    <span className="absolute bottom-0 left-0 bg-primary px-1.5 py-0.5 text-[9px] font-bold tracking-[0.12em] text-primary-foreground uppercase">
                      New
                    </span>
                    <span className="absolute top-1 right-1">
                      <IconButton
                        icon={X}
                        label={`Remove new image ${index + 1}`}
                        size="sm"
                        variant="secondary"
                        onClick={() => removeNewImage(index)}
                        disabled={loading}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <label
              htmlFor={inputId}
              onDragOver={(e) => {
                e.preventDefault();
                if (!full) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-border-strong bg-background/40 px-4 py-8 text-center transition-colors hover:border-primary/60 hover:bg-primary/5",
                dragging && "border-primary bg-primary/10",
                (full || loading) && "pointer-events-none opacity-50",
              )}
            >
              <ImageUp className="size-6 text-primary" aria-hidden="true" />
              <span className="text-[11px] font-bold tracking-[0.12em] text-foreground uppercase">
                {full ? "Image limit reached" : "Drop new images or browse"}
              </span>
              <span className="text-[11px] text-faint">PNG, JPG, WEBP, GIF · {MAX_IMAGES} images max in total</span>
            </label>
            <input
              id={inputId}
              type="file"
              multiple
              accept="image/*"
              onChange={handleNewImageChange}
              disabled={full || loading}
              className="sr-only"
            />
          </div>

          {error && (
            <Alert variant="destructive" className="animate-shake">
              {error}
            </Alert>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <Button variant="ghost" onClick={() => navigate("/my-store")} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="solid" icon={Save} loading={loading}>
            Save changes
          </Button>
        </div>
      </Card>
    </Page>
  );
}
