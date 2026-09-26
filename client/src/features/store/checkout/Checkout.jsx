import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CircleCheck,
  CreditCard,
  Heart,
  ImageOff,
  LocateFixed,
  MapPin,
  Package,
  Pencil,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { useProduct } from "../../../context/ProductContext";
import { mediaUrl } from "../../../lib/config";
import { toast } from "../../../lib/toast";
import { cn } from "../../../lib/cn";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBar,
  Corners,
  EmptyState,
  IconButton,
  Input,
  LoadingBlock,
  Modal,
  Page,
  PageHeader,
  Spinner,
} from "../../../components/ui";
import { formatAmount, loadRazorpayScript } from "./razorpayUtils";

const EMPTY_ADDRESS = {
  name: "",
  phone: "",
  street: "",
  city: "",
  state: "",
  zipCode: "",
  country: "India",
};

// Razorpay's modal needs a hex colour; this is the light-theme primary teal (readable with white text).
const RAZORPAY_THEME = { color: "#167a5c" };

const STEPS = [
  { n: "01", label: "Address" },
  { n: "02", label: "Review" },
  { n: "03", label: "Pay" },
];

/* Terminal-style step indicator. `current` = index of the active step; STEPS.length = all done. */
function CheckoutSteps({ current }) {
  return (
    <ol className="grid grid-cols-3 border-t border-l border-border" aria-label="Checkout progress">
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li
            key={step.n}
            aria-current={active ? "step" : undefined}
            className={cn(
              "flex min-w-0 items-center gap-2 border-r border-b border-border px-3 py-3 sm:px-5",
              active
                ? "bg-primary/10 text-primary shadow-[inset_0_-2px_0_var(--primary)]"
                : done
                  ? "bg-card/60 text-foreground"
                  : "bg-card/60 text-faint",
            )}
          >
            <span className="text-[10px] tabular-nums">
              {done ? <Check className="size-3.5 text-success" aria-label="Done" /> : step.n}
            </span>
            <span className="truncate text-[11px] font-bold tracking-[0.12em] uppercase">{step.label}</span>
            {i < STEPS.length - 1 && (
              <span aria-hidden="true" className="ml-auto hidden text-faint sm:inline">
                &gt;
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* "label ........ value" row, like the landing handshake panel. */
function LeaderRow({ label, children }) {
  return (
    <div className="flex items-center gap-2">
      <dt className="shrink-0 text-muted-foreground">&gt; {label}</dt>
      <span aria-hidden="true" className="min-w-0 flex-1 overflow-hidden whitespace-nowrap text-faint/50">
        {".".repeat(60)}
      </span>
      <dd className="max-w-[60%] shrink-0 truncate text-right text-foreground tabular-nums">{children}</dd>
    </div>
  );
}

export function Checkout() {
  const navigate = useNavigate();
  const {
    createOrder,
    verifyPayment,
    saveOrderLocation,
    orderLoading,
    addresses,
    getUserAddresses,
    addDeliveryAddress,
    updateAddress,
    deleteAddress,
    addressLoading,
    cart,
  } = useProduct();

  const [selectedAddress, setSelectedAddress] = useState("");
  const [paymentStep, setPaymentStep] = useState("address");
  const [orderData, setOrderData] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  // Mongo _id of the placed order (from /order/verify). A ref so the delayed
  // location capture after payment sees it (the Razorpay handler closure is stale).
  const placedOrderIdRef = useRef(null);

  // Address form states
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [addressForm, setAddressForm] = useState(EMPTY_ADDRESS);

  // Load addresses when component mounts
  useEffect(() => {
    getUserAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-select first address if available
  useEffect(() => {
    if (addresses.length > 0 && !selectedAddress) {
      setSelectedAddress(addresses[0]._id);
    }
  }, [addresses, selectedAddress]);

  const handleAddressSelect = (addressId) => setSelectedAddress(addressId);

  const resetAddressForm = useCallback(() => {
    setAddressForm(EMPTY_ADDRESS);
    setEditingAddress(null);
    setShowAddressForm(false);
  }, []);

  const handleAddressFormChange = (e) => {
    setAddressForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAddAddress = () => {
    setAddressForm(EMPTY_ADDRESS);
    setEditingAddress(null);
    setShowAddressForm(true);
  };

  const handleEditAddress = (address) => {
    setAddressForm({
      name: address.name,
      phone: address.phone,
      street: address.street,
      city: address.city,
      state: address.state,
      zipCode: address.zipCode,
      country: address.country || "India",
    });
    setEditingAddress(address._id);
    setShowAddressForm(true);
  };

  const handleDeleteAddress = async (addressId) => {
    if (!window.confirm("Delete this address?")) return;
    const result = await deleteAddress(addressId);
    if (result.success) {
      toast.success(result.message || "Address deleted");
      // Clear selected address if it was deleted
      if (selectedAddress === addressId) setSelectedAddress("");
    } else {
      toast.error(result.message);
    }
  };

  const handleSaveAddress = async (e) => {
    e.preventDefault();

    const form = Object.fromEntries(
      Object.entries(addressForm).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]),
    );

    if (!form.name || !form.phone || !form.street || !form.city || !form.state || !form.zipCode) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(form.phone)) {
      toast.error("Please enter a valid 10-digit mobile number");
      return;
    }
    if (!/^\d{6}$/.test(form.zipCode)) {
      toast.error("Please enter a valid 6-digit PIN code");
      return;
    }

    const result = editingAddress ? await updateAddress(editingAddress, form) : await addDeliveryAddress(form);

    if (result.success) {
      toast.success(result.message || "Address saved");
      resetAddressForm();
      // Auto-select the new/updated address
      if (result.data?.address?._id) setSelectedAddress(result.data.address._id);
      else if (result.data?.addressId) setSelectedAddress(result.data.addressId);
    } else {
      toast.error(result.message);
    }
  };

  // Save location to the placed order (POST /api/stores/order/:orderId/location)
  const saveLocationToOrder = async (location) => {
    const orderId = placedOrderIdRef.current;
    if (!orderId) {
      console.warn("No order ID available to save location");
      return;
    }

    setSavingLocation(true);
    try {
      const result = await saveOrderLocation(orderId, location);
      if (result.success) toast.success(result.message || "Delivery location saved");
      else toast.error(result.message || "Failed to save location");
    } catch (error) {
      console.error("Error saving location:", error);
      toast.error("Failed to save location");
    } finally {
      setSavingLocation(false);
    }
  };

  // Get user's current location
  const getCurrentLocation = () => {
    setGettingLocation(true);

    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by this browser");
      setGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date().toISOString(),
        };
        setUserLocation(location);
        setGettingLocation(false);
        toast.success("Location captured");
        if (placedOrderIdRef.current) saveLocationToOrder(location);
      },
      (error) => {
        setGettingLocation(false);
        const messages = {
          [error.PERMISSION_DENIED]: "Location access denied",
          [error.POSITION_UNAVAILABLE]: "Location information unavailable",
          [error.TIMEOUT]: "Location request timed out",
        };
        toast.error(messages[error.code] || "Unable to get location");
        console.error("Geolocation error:", error);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const initiateRazorpayPayment = (order, addressId) => {
    if (!order?.key) {
      const msg = "Payment gateway isn't configured (missing Razorpay key).";
      setPaymentError(msg);
      toast.error(msg);
      setPaying(false);
      return;
    }

    const options = {
      key: order.key,
      amount: Math.round(Number(order.amount) * 100),
      currency: order.currency,
      name: order.name,
      description: order.description,
      order_id: order.orderId,
      prefill: order.prefill,
      theme: { ...order.theme, ...RAZORPAY_THEME },
      handler: async (response) => {
        const paymentData = {
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          addressId,
        };

        // verifyPayment also refreshes the shared cart (it's emptied server-side).
        const result = await verifyPayment(paymentData);
        setPaying(false);
        if (result.success) {
          placedOrderIdRef.current = result.data?.orderId ?? null;
          setOrderData(result.data);
          setPaymentStep("success");

          // Automatically get location after successful payment
          toast.success("Payment successful! Getting your location…");
          setTimeout(() => getCurrentLocation(), 1000);
        } else {
          setPaymentError(result.message || "Payment verification failed");
          toast.error(result.message || "Payment verification failed");
        }
      },
      modal: {
        ondismiss: () => {
          setPaying(false);
          toast("Payment cancelled");
        },
      },
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.on?.("payment.failed", (resp) => {
        const msg = resp?.error?.description || "Payment failed";
        setPaymentError(msg);
        toast.error(msg);
      });
      rzp.open();
    } catch (error) {
      console.error("Razorpay error:", error);
      setPaying(false);
      setPaymentError("Couldn't open Razorpay checkout");
      toast.error("Couldn't open Razorpay checkout");
    }
  };

  const proceedToPayment = async () => {
    if (!selectedAddress) {
      toast.error("Please select an address");
      return;
    }

    // Check if cart is empty
    if (!cart.items || cart.items.length === 0) {
      toast.error("Your cart is empty");
      navigate("/cart");
      return;
    }

    setPaymentError("");
    setPaying(true);

    // Load checkout.js first so we don't create a Razorpay order we can't pay.
    const sdkLoaded = await loadRazorpayScript();
    if (!sdkLoaded) {
      setPaying(false);
      setPaymentError("Razorpay SDK failed to load. Check your connection and try again.");
      toast.error("Razorpay SDK failed to load");
      return;
    }

    const result = await createOrder(selectedAddress);
    if (result.success) {
      setOrderData(result.data);
      initiateRazorpayPayment(result.data, result.data?.addressId || selectedAddress);
    } else {
      setPaying(false);
      setPaymentError(result.message || "Failed to create order");
      toast.error(result.message || "Failed to create order");
    }
  };

  const items = Array.isArray(cart?.items) ? cart.items.filter((i) => i?.product) : [];
  const itemCount = items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
  const total = Number(cart?.totalAmount) || 0;
  const busy = paying || orderLoading;
  const currentStep = !selectedAddress ? 0 : busy ? 2 : 1;

  /* ---------------------------------------------------------------- success */
  if (paymentStep === "success") {
    const orderRef = orderData?.orderNumber || orderData?.orderId;
    return (
      <Page>
        <PageHeader eyebrow="Marketplace / Checkout" title="Order placed" />
        <CheckoutSteps current={STEPS.length} />

        <Card corners className="mx-auto w-full max-w-2xl">
          <div className="flex flex-col items-center border-b border-border px-6 py-10 text-center">
            <CircleCheck className="size-12 text-success" aria-hidden="true" />
            <p className="eyebrow mt-5 text-success">Payment verified</p>
            <h2 className="mt-2 text-xl font-extrabold tracking-[0.08em] uppercase">Thanks for your order</h2>
            <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
              Your order has been placed and the sellers have been notified.
            </p>
            {orderRef && (
              <div className="mt-6 max-w-full border border-border-strong bg-background/60 px-4 py-2">
                <p className="eyebrow text-faint">Order ID</p>
                <p className="mt-1 text-sm font-bold break-all text-primary tabular-nums">{orderRef}</p>
              </div>
            )}
          </div>

          <dl className="space-y-2 border-b border-border px-6 py-5 text-[11px]">
            <LeaderRow label="payment id">{orderData?.paymentId || "—"}</LeaderRow>
            <LeaderRow label="amount">{formatAmount(Number(orderData?.amount) || 0)}</LeaderRow>
            <LeaderRow label="status">
              <span className="font-bold text-success uppercase">{orderData?.orderStatus || "confirmed"}</span>
            </LeaderRow>
            {orderData?.estimatedDelivery && (
              <LeaderRow label="expected delivery">
                {new Date(orderData.estimatedDelivery).toLocaleDateString()}
              </LeaderRow>
            )}
          </dl>

          {/* Delivery location */}
          <div className="space-y-3 border-b border-border px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-bold tracking-[0.14em] uppercase">
                <LocateFixed className="size-4 text-primary" aria-hidden="true" />
                Delivery location
              </h3>
              {!userLocation && (
                <Button size="sm" icon={MapPin} loading={gettingLocation} onClick={getCurrentLocation}>
                  {gettingLocation ? "Locating" : "Share location"}
                </Button>
              )}
            </div>

            {userLocation ? (
              <>
                <p className="flex items-center gap-2 text-[11px] text-success">
                  <Check className="size-3.5" aria-hidden="true" />
                  Location captured{savingLocation ? " — saving…" : ""}
                  {savingLocation && <Spinner label="Saving location" className="size-3.5" />}
                </p>
                <dl className="space-y-1.5 border border-border bg-background/40 px-4 py-3 text-[11px]">
                  <LeaderRow label="lat">{userLocation.latitude.toFixed(6)}</LeaderRow>
                  <LeaderRow label="lng">{userLocation.longitude.toFixed(6)}</LeaderRow>
                  <LeaderRow label="accuracy">{Math.round(userLocation.accuracy)} m</LeaderRow>
                  <LeaderRow label="captured">{new Date(userLocation.timestamp).toLocaleTimeString()}</LeaderRow>
                </dl>
              </>
            ) : (
              <Alert variant="warning">
                Location not captured yet. Share it to help with delivery tracking — it’s optional.
              </Alert>
            )}
          </div>

          <div className="flex flex-col gap-2 p-6 sm:flex-row">
            <Button as={Link} to="/products" variant="solid" icon={Package} className="flex-1">
              Continue shopping
            </Button>
            <Button as={Link} to="/wishlist" variant="outline" icon={Heart} className="flex-1">
              View wishlist
            </Button>
          </div>
        </Card>
      </Page>
    );
  }

  /* --------------------------------------------------------------- checkout */
  return (
    <Page>
      <PageHeader
        eyebrow="Marketplace / Checkout"
        title="Checkout"
        description="Pick a delivery address, review your order and pay securely with Razorpay."
        actions={
          <Button as={Link} to="/cart" variant="outline" icon={ArrowLeft}>
            Back to cart
          </Button>
        }
      />

      <CheckoutSteps current={currentStep} />

      {paymentError && (
        <Alert variant="destructive" title="Payment problem" className="animate-shake">
          {paymentError}
        </Alert>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          {/* 01 — Address */}
          <Card>
            <CardBar
              title="01 / Delivery address"
              right={
                <Button size="sm" icon={Plus} onClick={handleAddAddress}>
                  Add new
                </Button>
              }
            />
            <div className="p-4 sm:p-5">
              {addressLoading && addresses.length === 0 ? (
                <LoadingBlock label="Loading addresses" className="py-10" />
              ) : addresses.length > 0 ? (
                <div role="radiogroup" aria-label="Delivery address" className="grid gap-3 sm:grid-cols-2">
                  {addresses.map((address, i) => {
                    const selected = selectedAddress === address._id;
                    return (
                      <div
                        key={address._id}
                        className={cn(
                          "relative border transition-colors",
                          selected
                            ? "border-primary bg-primary/[0.06]"
                            : "border-border bg-background/40 hover:border-border-strong hover:bg-accent/40",
                        )}
                      >
                        {selected && <Corners />}
                        <button
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => handleAddressSelect(address._id)}
                          className="block w-full p-4 pr-20 text-left"
                        >
                          <span className="flex items-center gap-2">
                            <span
                              aria-hidden="true"
                              className={cn(
                                "flex size-3.5 shrink-0 items-center justify-center border",
                                selected ? "border-primary" : "border-border-strong",
                              )}
                            >
                              {selected && <span className="size-1.5 bg-primary" />}
                            </span>
                            <span className="text-[10px] text-faint tabular-nums">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span className="truncate text-xs font-bold tracking-[0.08em] uppercase">
                              {address.name}
                            </span>
                          </span>
                          <span className="mt-2 block text-[11px] leading-relaxed text-muted-foreground">
                            {address.street}, {address.city}, {address.state} — {address.zipCode}
                            {address.country ? `, ${address.country}` : ""}
                          </span>
                          <span className="mt-1 block text-[11px] text-faint tabular-nums">{address.phone}</span>
                        </button>
                        <div className="absolute top-2 right-2 flex">
                          <IconButton icon={Pencil} label="Edit address" size="sm" onClick={() => handleEditAddress(address)} />
                          <IconButton
                            icon={Trash2}
                            label="Delete address"
                            size="sm"
                            onClick={() => handleDeleteAddress(address._id)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={MapPin}
                  title="No saved addresses"
                  description="Add a delivery address to continue."
                  action={
                    <Button variant="solid" icon={Plus} onClick={handleAddAddress}>
                      Add your first address
                    </Button>
                  }
                  className="py-8"
                />
              )}
            </div>
          </Card>

          {/* 02 — Review */}
          <Card>
            <CardBar
              title="02 / Review items"
              right={
                <Link to="/cart" className="text-[11px] text-faint underline-offset-4 hover:text-primary hover:underline">
                  Edit cart
                </Link>
              }
            />
            {items.length > 0 ? (
              <ul className="divide-y divide-border">
                {items.map((item) => {
                  const product = item.product;
                  const qty = Number(item.quantity) || 0;
                  const image = product.images?.[0];
                  return (
                    <li key={product._id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                      <span className="size-12 shrink-0 overflow-hidden border border-border bg-muted">
                        {image ? (
                          <img src={mediaUrl(image)} alt="" className="size-full object-cover" />
                        ) : (
                          <span className="flex size-full items-center justify-center text-faint">
                            <ImageOff className="size-4" aria-hidden="true" />
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold tracking-[0.06em] uppercase">
                          {product.name}
                        </span>
                        <span className="block truncate text-[11px] text-faint tabular-nums">
                          {qty} × {formatAmount(Number(product.price) || 0)}
                          {product.store?.name ? ` · ${product.store.name}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-bold text-primary tabular-nums">
                        {formatAmount((Number(product.price) || 0) * qty)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                icon={ShoppingCart}
                title="Your cart is empty"
                description="Add something to your cart before checking out."
                action={
                  <Button as={Link} to="/products" variant="solid" icon={Package}>
                    Browse products
                  </Button>
                }
                className="py-8"
              />
            )}
          </Card>
        </div>

        {/* 03 — Pay */}
        <Card corners className="lg:sticky lg:top-6">
          <CardBar title="03 / Payment" right={<Badge variant="info" icon={ShieldCheck}>Razorpay</Badge>} />
          <dl className="space-y-2 px-5 py-4 text-[11px]">
            <LeaderRow label={`Items (${itemCount})`}>{formatAmount(total)}</LeaderRow>
            <LeaderRow label="Delivery">
              <span className="font-bold text-success">FREE</span>
            </LeaderRow>
          </dl>
          <div className="flex items-baseline justify-between gap-3 border-t border-dashed border-border px-5 py-4">
            <span className="eyebrow text-muted-foreground">Total</span>
            <span className="text-2xl font-extrabold text-primary tabular-nums">{formatAmount(total)}</span>
          </div>
          <div className="space-y-3 border-t border-border p-5">
            <div className="flex flex-wrap gap-1.5">
              {["Cards", "UPI", "Net banking", "Wallets"].map((m) => (
                <Badge key={m} variant="secondary">
                  {m}
                </Badge>
              ))}
            </div>
            <Button
              variant="solid"
              size="lg"
              fullWidth
              icon={CreditCard}
              loading={busy}
              onClick={proceedToPayment}
              disabled={!selectedAddress || busy || items.length === 0}
            >
              {busy ? "Processing" : `Pay ${formatAmount(total)}`}
            </Button>
            {!selectedAddress && (
              <p className="text-[11px] text-warning">Select a delivery address to continue.</p>
            )}
            {items.length === 0 && <p className="text-[11px] text-warning">Your cart is empty.</p>}
            <p className="text-[10px] leading-relaxed text-faint">
              Payment opens in Razorpay’s secure window. Your order is confirmed once the payment is verified.
            </p>
          </div>
        </Card>
      </div>

      {/* Address form */}
      <Modal
        open={showAddressForm}
        onClose={resetAddressForm}
        title={editingAddress ? "Edit address" : "New address"}
        description="Used for delivery and to prefill Razorpay."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={resetAddressForm}>
              Cancel
            </Button>
            <Button type="submit" form="checkout-address-form" variant="solid" loading={addressLoading}>
              {editingAddress ? "Update address" : "Save address"}
            </Button>
          </>
        }
      >
        <form id="checkout-address-form" onSubmit={handleSaveAddress} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Input
            label="Full name *"
            name="name"
            value={addressForm.name}
            onChange={handleAddressFormChange}
            autoComplete="name"
            className="sm:col-span-2"
            required
          />
          <Input
            label="Phone *"
            name="phone"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={addressForm.phone}
            onChange={handleAddressFormChange}
            autoComplete="tel-national"
            placeholder="10-digit mobile"
            required
          />
          <Input
            label="PIN code *"
            name="zipCode"
            inputMode="numeric"
            maxLength={6}
            value={addressForm.zipCode}
            onChange={handleAddressFormChange}
            autoComplete="postal-code"
            placeholder="6 digits"
            required
          />
          <Input
            label="Street address *"
            name="street"
            value={addressForm.street}
            onChange={handleAddressFormChange}
            autoComplete="street-address"
            className="sm:col-span-2"
            required
          />
          <Input
            label="City *"
            name="city"
            value={addressForm.city}
            onChange={handleAddressFormChange}
            autoComplete="address-level2"
            required
          />
          <Input
            label="State *"
            name="state"
            value={addressForm.state}
            onChange={handleAddressFormChange}
            autoComplete="address-level1"
            required
          />
          <Input
            label="Country"
            name="country"
            value={addressForm.country}
            onChange={handleAddressFormChange}
            autoComplete="country-name"
            className="sm:col-span-2"
          />
        </form>
      </Modal>
    </Page>
  );
}

export default Checkout;
