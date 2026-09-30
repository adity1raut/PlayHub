import { useState, useRef, useEffect, useId } from "react";
import { ImageUp, Store, X } from "lucide-react";
import { Button, IconButton, Input, Label, Modal, Textarea } from "../../../components/ui";
import { mediaUrl } from "../../../lib/config";

/**
 * Create / edit store dialog. Calls onSubmit({ name, description, logo })
 * where `logo` is a File (or null when unchanged).
 */
function StoreForm({
  isOpen,
  onClose,
  onSubmit,
  store = null,
  loading = false,
}) {
  const formId = useId();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setName(store?.name || "");
      setDescription(store?.description || "");
      setLogoFile(null);
      setLogoPreview(store?.logo ? mediaUrl(store.logo) : null);
    }
  }, [isOpen, store]);

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const clearNewLogo = () => {
    setLogoFile(null);
    setLogoPreview(store?.logo ? mediaUrl(store.logo) : null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const storeData = {
      name: name.trim(),
      description: description.trim(),
      logo: logoFile,
    };

    onSubmit(storeData);
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setLogoFile(null);
    setLogoPreview(null);
  };

  const handleClose = () => {
    if (loading) return;
    resetForm();
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title={store ? "Edit store" : "Create store"}
      description={
        store
          ? "Update your storefront details."
          : "Open your storefront on Spawnpoint. You can add products right after."
      }
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="solid" loading={loading} disabled={!name.trim()}>
            {store ? "Save changes" : "Create store"}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>Store logo</Label>
          <div className="flex items-center gap-4">
            <div className="relative size-20 shrink-0 border border-border bg-background/60">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo preview" className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center text-faint">
                  <Store className="size-7" aria-hidden="true" />
                </div>
              )}
              {logoFile && (
                <span className="absolute -top-3 -right-3">
                  <IconButton
                    icon={X}
                    label="Remove selected logo"
                    size="sm"
                    variant="secondary"
                    onClick={clearNewLogo}
                  />
                </span>
              )}
            </div>
            <div className="min-w-0 space-y-2">
              <Button variant="outline" size="sm" icon={ImageUp} onClick={() => fileInputRef.current?.click()}>
                {logoPreview ? "Change logo" : "Upload logo"}
              </Button>
              <p className="truncate text-[11px] text-faint">
                {logoFile ? logoFile.name : "Square image · PNG, JPG, WEBP"}
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              className="hidden"
            />
          </div>
        </div>

        <Input
          label="Store name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={80}
          placeholder="Enter your store name"
          disabled={loading}
        />

        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Describe your store…"
          disabled={loading}
        />
      </form>
    </Modal>
  );
}

export default StoreForm;
