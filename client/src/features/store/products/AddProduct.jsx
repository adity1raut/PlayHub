import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Boxes, ImageUp, IndianRupee, Plus, Warehouse, X } from "lucide-react";
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
import { toast } from "../../../lib/toast";

const MAX_IMAGES = 5;
const pad = (n) => String(n).padStart(2, "0");

export default function AddProduct() {
  const navigate = useNavigate();
  const inputId = useId();
  const { isAuthenticated } = useAuth();
  const { userStore, getCurrentUserStore } = useStore();
  const { addProduct } = useProduct();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    stock: "",
  });
  // [{ file, url }] — url is an object URL used for the preview
  const [images, setImages] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [storeChecked, setStoreChecked] = useState(!!userStore);
  const imagesRef = useRef(images);
  imagesRef.current = images;

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

  useEffect(() => () => imagesRef.current.forEach((img) => URL.revokeObjectURL(img.url)), []);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const addFiles = (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    if (files.length + images.length > MAX_IMAGES) {
      setError(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }
    setImages((prev) => [...prev, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
    setError("");
  };

  const handleImageChange = (e) => {
    addFiles(e.target.files);
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const removeImage = (index) => {
    setImages((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== index);
    });
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

      images.forEach(({ file }) => {
        formDataToSend.append("images", file);
      });

      const result = await addProduct(userStore._id, formDataToSend);

      if (result.success) {
        toast.success("Product added successfully!");
        getCurrentUserStore();
        navigate("/my-store");
      } else {
        setError(result.message || "Error adding product");
      }
    } catch {
      setError("Error adding product");
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
        <PageHeader eyebrow="My store / Products" title="Add product" />
        <Card corners>
          <EmptyState
            icon={Warehouse}
            title="Store required"
            description="You need to have a store to add products."
            action={
              <Button as={Link} to="/my-store" variant="solid" icon={Plus}>
                Create store
              </Button>
            }
          />
        </Card>
      </Page>
    );
  }

  const full = images.length >= MAX_IMAGES;

  return (
    <Page>
      <PageHeader
        eyebrow="My store / Products"
        title="Add product"
        description={`New listing in ${userStore.name}.`}
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
                {images.length}/{MAX_IMAGES}
              </span>
            </div>
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
                {full ? "Image limit reached" : "Drop images or browse"}
              </span>
              <span className="text-[11px] text-faint">PNG, JPG, WEBP, GIF · up to {MAX_IMAGES} images</span>
            </label>
            <input
              id={inputId}
              type="file"
              multiple
              accept="image/*"
              onChange={handleImageChange}
              disabled={full || loading}
              className="sr-only"
            />

            {images.length > 0 && (
              <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {images.map((img, index) => (
                  <li key={img.url} className="relative aspect-square border border-border bg-background/60">
                    <img src={img.url} alt={`Preview ${index + 1}`} className="size-full object-cover" />
                    <span className="absolute bottom-0 left-0 bg-background/85 px-1.5 py-0.5 text-[10px] text-faint tabular-nums">
                      {pad(index + 1)}
                    </span>
                    {index === 0 && (
                      <span className="absolute right-0 bottom-0 bg-primary px-1.5 py-0.5 text-[9px] font-bold tracking-[0.12em] text-primary-foreground uppercase">
                        Cover
                      </span>
                    )}
                    <span className="absolute top-1 right-1">
                      <IconButton
                        icon={X}
                        label={`Remove image ${index + 1}`}
                        size="sm"
                        variant="secondary"
                        onClick={() => removeImage(index)}
                        disabled={loading}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            )}
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
          <Button type="submit" variant="solid" icon={Plus} loading={loading}>
            Add product
          </Button>
        </div>
      </Card>
    </Page>
  );
}
