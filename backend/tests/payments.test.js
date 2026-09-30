// Razorpay checkout rules: test/live/off from the keys, and verification that turns exactly one
// matching payment into exactly one order. Razorpay's own API isn't called: each test seeds the
// checkout record POST /order/create would save, and signs payments with the test secret.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHarness, paymentSignature } from "./harness.js";

const h = createHarness("payments");
const { skip } = h;
let store, product, addressId;

before(() =>
  h.start({
    users: ["alice", "bob"],
    seed: async ({ models, users }) => {
      store = await models.Store.create({ owner: users.alice._id, name: "Pixel Forge" });
      product = await models.Product.create({ store: store._id, name: "Pro Mouse", price: 499, stock: 5 });
    },
  }),
);
after(() => h.stop());

test("payment mode comes from the keys: test, live, or off for missing / placeholder keys", async () => {
  const { paymentMode } = await import("../src/config/razorpay.js");
  const saved = { id: process.env.RAZORPAY_KEY_ID, secret: process.env.RAZORPAY_KEY_SECRET };
  const mode = (id, secret) => {
    process.env.RAZORPAY_KEY_ID = id;
    process.env.RAZORPAY_KEY_SECRET = secret;
    return paymentMode();
  };
  try {
    assert.equal(mode("rzp_test_abc", "s3cret"), "test");
    assert.equal(mode("rzp_live_abc", "s3cret"), "live");
    assert.equal(mode("your_razorpay_key_id", "your_razorpay_key_secret"), null, ".env.example placeholders");
    assert.equal(mode("rzp_test_abc", ""), null);
    assert.equal(mode("", ""), null);
  } finally {
    process.env.RAZORPAY_KEY_ID = saved.id ?? "";
    process.env.RAZORPAY_KEY_SECRET = saved.secret ?? "";
  }
});

test("checkout tells the app it's in test mode (dummy payments)", { skip }, async () => {
  const config = await h.api("bob", "GET", "/api/stores/order/payment-config");
  assert.deepEqual(config.data, { enabled: true, mode: "test", keyId: "rzp_test_ci" });
});

test("verify: forged, unknown, or someone else's payments are refused", { skip }, async () => {
  await h.api("bob", "POST", `/api/stores/${store._id}/cart/add`, { productId: String(product._id), quantity: 2 });
  await h.api("bob", "POST", "/api/stores/order/addresses", {
    name: "Bob",
    phone: "9999999999",
    street: "1 Main St",
    city: "Pune",
    state: "MH",
    zipCode: "411001",
  });
  addressId = String((await h.models.User.findById(h.users.bob._id).lean()).addresses.at(-1)._id);
  await h.models.Payment.create({ user: h.users.bob._id, razorpayOrderId: "order_p_1", amount: 99800, addressId, mode: "test" });

  const forged = await h.api("bob", "POST", "/api/stores/order/verify", {
    razorpay_order_id: "order_p_1",
    razorpay_payment_id: "pay_p_1",
    razorpay_signature: "0".repeat(64),
  });
  assert.match(forged.message, /invalid payment signature/i);

  const unknown = await h.api("bob", "POST", "/api/stores/order/verify", {
    razorpay_order_id: "order_nope",
    razorpay_payment_id: "pay_p_1",
    razorpay_signature: paymentSignature("order_nope", "pay_p_1"),
  });
  assert.match(unknown.message, /don't recognise/i);

  const notYours = await h.api("alice", "POST", "/api/stores/order/verify", {
    razorpay_order_id: "order_p_1",
    razorpay_payment_id: "pay_p_1",
    razorpay_signature: paymentSignature("order_p_1", "pay_p_1"),
  });
  assert.match(notYours.message, /don't recognise/i, "alice can't claim bob's payment");
  assert.equal(await h.models.Payment.countDocuments({ status: "created" }), 1, "the attempt is untouched");
});

test("verify: a cart that changed mid-payment doesn't become an order; the fixed cart does, once", { skip }, async () => {
  const verify = () =>
    h.api("bob", "POST", "/api/stores/order/verify", {
      razorpay_order_id: "order_p_1",
      razorpay_payment_id: "pay_p_1",
      razorpay_signature: paymentSignature("order_p_1", "pay_p_1"),
    });

  // A third mouse added in another tab while the Razorpay window was open
  await h.api("bob", "PUT", "/api/stores/cart/update", { productId: String(product._id), quantity: 3 });
  const changed = await verify();
  assert.equal(changed.success, false);
  assert.match(changed.message, /you paid ₹998 but the cart is now ₹1,497/);
  assert.match(changed.message, /test payment: no real money was taken/);
  assert.equal(await h.models.Order.countDocuments(), 0);
  assert.equal((await h.models.Product.findById(product._id).lean()).stock, 5, "no stock taken");
  assert.equal((await h.models.Payment.findOne({ razorpayOrderId: "order_p_1" }).lean()).status, "failed");

  // Back to what was paid for: the same payment can now be verified (address comes from the attempt)
  await h.api("bob", "PUT", "/api/stores/cart/update", { productId: String(product._id), quantity: 2 });
  const placed = await verify();
  assert.equal(placed.success, true, placed.message);
  assert.equal(placed.data.mode, "test");
  assert.equal(placed.data.amount, 998);

  // Verifying twice (double click, retry) returns the same order instead of a second one
  const again = await verify();
  assert.equal(again.success, true);
  assert.equal(String(again.data.orderId), String(placed.data.orderId));
  assert.equal(await h.models.Order.countDocuments(), 1);
  assert.equal((await h.models.Product.findById(product._id).lean()).stock, 3, "stock taken once");

  const orders = await h.api("bob", "GET", "/api/stores/orders");
  assert.equal(orders.data.orders.length, 1);
  assert.equal(orders.data.orders[0].payment.mode, "test");
  assert.equal(orders.data.orders[0].payment.razorpayPaymentId, "pay_p_1");
  const payment = await h.models.Payment.findOne({ razorpayOrderId: "order_p_1" }).lean();
  assert.equal(payment.status, "paid");
  assert.equal(String(payment.order), String(placed.data.orderId));
});
