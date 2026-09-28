// End-to-end: live sync of the store (products, ratings, stores, cart, wishlist) and of a
// user's own tabs (notifications, cart, profile, settings). Real server + MongoDB + Socket.IO.
//
// Uses its own database (TEST_MONGODB_URI's name + "_sync", see ./harness.js) and is skipped
// when TEST_MONGODB_URI is unset:
//   TEST_MONGODB_URI=mongodb://127.0.0.1:27017/spawnpoint_test npm test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHarness, paymentSignature, sleep } from "./harness.js";

const h = createHarness("sync");
const { skip, seen, clear, waitFor, api } = h;
let store, product;

before(() =>
  h.start({
    users: ["alice", "bob"],
    seed: async ({ models, users }) => {
      store = await models.Store.create({ owner: users.alice._id, name: "Pixel Forge" });
      product = await models.Product.create({ store: store._id, name: "Pro Mouse", price: 999, stock: 10 });
      store.products.push(product._id);
      await store.save();
    },
  }).then(async () => {
    if (skip) return;
    // A second open tab for each player
    await h.connect("alice", "alice2");
    await h.connect("bob", "bob2");
    await sleep(200);
  }),
);
after(() => h.stop());

const noEmails = (payload) => assert.ok(!/@test\.dev/.test(JSON.stringify(payload)), "no email addresses in the payload");

test("products: created / updated / deleted broadcast to everyone", { skip }, async () => {
  clear();
  const created = await api("alice", "POST", `/api/stores/${store._id}/products`, {
    name: "Mech Keyboard",
    description: "Clicky",
    price: 2499,
    stock: 5,
  });
  assert.ok(created._id, created.error);
  const onCreate = await waitFor("bob", "product:created", (p) => p.productId === created._id);
  assert.equal(onCreate.storeId, String(store._id));
  assert.equal(onCreate.product.name, "Mech Keyboard");
  assert.equal(onCreate.product.store?.name, "Pixel Forge");

  clear();
  await api("alice", "PUT", `/api/stores/${store._id}/products/${created._id}`, { price: 1999, stock: 3 });
  const onUpdate = await waitFor("bob", "product:updated", (p) => p.productId === created._id);
  assert.equal(onUpdate.storeId, String(store._id));
  assert.equal(onUpdate.product.price, 1999);
  assert.equal(onUpdate.product.stock, 3);
  assert.equal(onUpdate.product.name, "Mech Keyboard");
  assert.ok(!("ratings" in onUpdate.product) && !("store" in onUpdate.product), "only the editable fields");

  clear();
  const refused = await api("bob", "PUT", `/api/stores/${store._id}/products/${created._id}`, { price: 1 });
  assert.equal(refused.success, false, "only the owner may edit");
  await sleep(250);
  assert.equal(seen("alice", "product:updated").length, 0);

  await api("alice", "DELETE", `/api/stores/${store._id}/products/${created._id}`);
  const onDelete = await waitFor("bob", "product:deleted", (p) => p.productId === created._id);
  assert.equal(onDelete.storeId, String(store._id));
});

test("ratings: new and edited reviews broadcast with the average and reviewer", { skip }, async () => {
  clear();
  await api("bob", "POST", `/api/stores/products/${product._id}/rating`, { rating: 4, review: "solid" });
  const first = await waitFor("alice", "product:rating", (p) => p.productId === String(product._id));
  assert.equal(first.storeId, String(store._id));
  assert.equal(first.averageRating, 4);
  assert.equal(first.ratingsCount, 1);
  assert.equal(first.review?.review, "solid");
  assert.equal(first.review?.user?.username, "bob");
  assert.equal(first.review?.user?.profile?.name, "Bob");
  noEmails(first);

  clear();
  await api("bob", "POST", `/api/stores/products/${product._id}/rating`, { rating: 2, review: "meh" });
  const edited = await waitFor("bob2", "product:rating", (p) => p.productId === String(product._id));
  assert.equal(edited.ratingsCount, 1, "an edit replaces the reviewer's rating");
  assert.equal(edited.averageRating, 2);
  assert.equal(edited.review?._id, first.review?._id);
});

test("cart: every change reaches the buyer's other tabs (and only theirs)", { skip }, async () => {
  clear();
  const added = await api("bob", "POST", `/api/stores/${store._id}/cart/add`, {
    productId: String(product._id),
    quantity: 1,
  });
  assert.equal(added.success, true, added.error);
  let cart = (await waitFor("bob2", "cart:updated", (p) => p.cart?.items?.length === 1)).cart;
  assert.equal(cart.items[0].product.name, "Pro Mouse");
  assert.equal(cart.items[0].product.store?.name, "Pixel Forge", "same populated shape as GET /cart");
  assert.equal(cart.totalAmount, 999);

  clear();
  await api("bob", "PUT", "/api/stores/cart/update", { productId: String(product._id), quantity: 3 });
  cart = (await waitFor("bob2", "cart:updated", (p) => p.cart?.items?.[0]?.quantity === 3)).cart;
  assert.equal(cart.totalAmount, 2997);
  const rest = await api("bob", "GET", "/api/stores/cart");
  assert.deepEqual(
    { items: cart.items.length, totalAmount: cart.totalAmount },
    { items: rest.items.length, totalAmount: rest.totalAmount },
  );

  clear();
  await api("bob", "DELETE", `/api/stores/cart/remove/${product._id}`);
  await waitFor("bob2", "cart:updated", (p) => p.cart?.items?.length === 0);

  clear();
  await api("bob", "POST", `/api/stores/${store._id}/cart/add`, { productId: String(product._id), quantity: 1 });
  await api("bob", "DELETE", "/api/stores/cart/clear");
  await waitFor("bob2", "cart:updated", (p) => p.cart?.items?.length === 0 && p.cart.totalAmount === 0);
  await sleep(200);
  assert.equal(seen("alice", "cart:updated").length, 0, "nobody else sees your cart");
});

test("wishlist: toggles reach the user's other tabs", { skip }, async () => {
  clear();
  const on = await api("bob", "POST", `/api/stores/wishlist/add/${product._id}`);
  assert.equal(on.inWishlist, true);
  const added = await waitFor("bob2", "wishlist:updated", (p) => p.productId === String(product._id));
  assert.equal(added.inWishlist, true);
  assert.equal(added.product?.name, "Pro Mouse");
  assert.equal(added.product?.store?.name, "Pixel Forge");

  clear();
  await api("bob", "POST", `/api/stores/wishlist/add/${product._id}`);
  const removed = await waitFor("bob2", "wishlist:updated", (p) => p.productId === String(product._id));
  assert.equal(removed.inWishlist, false);
  assert.equal(seen("alice", "wishlist:updated").length, 0);
});

test("checkout: stock drops live for everyone and the buyer's cart empties in every tab", { skip }, async () => {
  await api("bob", "POST", `/api/stores/${store._id}/cart/add`, { productId: String(product._id), quantity: 2 });
  await api("bob", "POST", "/api/stores/order/addresses", {
    name: "Bob",
    phone: "9999999999",
    street: "1 Main St",
    city: "Pune",
    state: "MH",
    zipCode: "411001",
  });
  const buyer = await h.models.User.findById(h.users.bob._id).lean();
  const [orderId, paymentId] = ["order_sync_1", "pay_sync_1"];

  clear();
  const res = await api("bob", "POST", "/api/stores/order/verify", {
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: paymentSignature(orderId, paymentId),
    addressId: String(buyer.addresses.at(-1)._id),
  });
  assert.equal(res.success, true, res.message);

  const stock = await waitFor("alice2", "product:updated", (p) => p.productId === String(product._id));
  assert.equal(stock.product.stock, 8);
  assert.equal(stock.storeId, String(store._id));
  assert.deepEqual(Object.keys(stock.product).sort(), ["_id", "stock", "updatedAt"], "a purchase only changes stock");
  assert.ok(seen("bob", "product:updated", (p) => p.product.stock === 8).length, "buyers see it too");

  const emptied = await waitFor("bob2", "cart:updated");
  assert.deepEqual(emptied.cart.items, []);
  assert.equal(emptied.cart.totalAmount, 0);
});

test("notifications: read / read-all / delete reach the user's other tabs with the unread count", { skip }, async () => {
  const { Notification } = h.models;
  const [one, two] = await Notification.create([
    { user: h.users.alice._id, type: "GENERAL", message: "one" },
    { user: h.users.alice._id, type: "GENERAL", message: "two" },
  ]);
  // Anything unread left over from the order / review tests counts too
  const unread = () => Notification.countDocuments({ user: h.users.alice._id, isRead: false });

  clear();
  const read = await api("alice", "PUT", `/api/notifications/${one._id}/read`);
  assert.equal(read.success, true);
  assert.equal(read.unreadCount, await unread());
  const onRead = await waitFor("alice2", "notification:read", (p) => p.id === String(one._id));
  assert.deepEqual(onRead, { id: String(one._id) });
  await waitFor("alice2", "notification-count", (p) => p.count === read.unreadCount);

  clear();
  const deleted = await api("alice", "DELETE", `/api/notifications/${two._id}`);
  assert.equal(deleted.success, true);
  await waitFor("alice2", "notification:deleted", (p) => p.id === String(two._id));
  await waitFor("alice2", "notification-count", (p) => p.count === deleted.unreadCount);

  await Notification.create({ user: h.users.alice._id, type: "GENERAL", message: "three" });
  clear();
  const all = await api("alice", "PUT", "/api/notifications/read-all");
  assert.equal(all.unreadCount, 0);
  await waitFor("alice2", "notification:read-all");
  await waitFor("alice2", "notification-count", (p) => p.count === 0);
  await sleep(200);
  assert.equal(seen("bob", "notification:read").length + seen("bob", "notification:read-all").length, 0);
});

test("profile edits broadcast public fields only", { skip }, async () => {
  clear();
  const res = await api("alice", "PUT", "/api/auth/profile", {
    name: "Alice Prime",
    bio: "support main",
    email: "alice.prime@test.dev",
  });
  assert.equal(res.success, true, res.message);
  const update = await waitFor("bob", "user:updated", (p) => p.userId === String(h.users.alice._id));
  assert.equal(update.username, "alice");
  assert.equal(update.profile.name, "Alice Prime");
  assert.equal(update.profile.bio, "support main");
  assert.ok("profileImage" in update.profile && "coverImage" in update.profile);
  assert.deepEqual(Object.keys(update).sort(), ["profile", "userId", "username"]);
  noEmails(update);
  await waitFor("alice2", "user:updated", (p) => p.userId === String(h.users.alice._id));
});

test("settings changes reach only the user's own tabs", { skip }, async () => {
  clear();
  const res = await api("alice", "PUT", "/api/auth/settings", { notifications: { likes: false } });
  assert.equal(res.success, true, res.message);
  const settings = await waitFor("alice2", "settings:updated");
  assert.deepEqual(settings, res.data);
  assert.equal(settings.notifications.likes, false);
  assert.equal(settings.privacy.messages, "friends");
  await sleep(200);
  assert.equal(seen("bob", "settings:updated").length, 0);

  const bad = await api("alice", "PUT", "/api/auth/settings", { notifications: { likes: "no" } });
  assert.equal(bad.success, false);
  await sleep(200);
  assert.equal(seen("alice2", "settings:updated").length, 1, "rejected changes aren't broadcast");
});

test("stores: created / updated / deleted broadcast (deletion lists the products that went with it)", { skip }, async () => {
  clear();
  const bobs = await api("bob", "POST", "/api/stores", { name: "Bob's Bits", description: "cables" });
  assert.ok(bobs._id, bobs.error);
  const created = await waitFor("alice", "store:created", (p) => p.storeId === bobs._id);
  assert.equal(created.store.name, "Bob's Bits");
  assert.equal(created.store.owner?.username, "bob");
  noEmails(created);

  clear();
  await api("alice", "PUT", `/api/stores/${store._id}`, { name: "Pixel Forge Pro", description: "Pro gear" });
  const updated = await waitFor("bob", "store:updated", (p) => p.storeId === String(store._id));
  assert.equal(updated.store.name, "Pixel Forge Pro");
  assert.equal(updated.store.description, "Pro gear");
  assert.equal(updated.store.owner?.username, "alice");
  assert.ok(!("products" in updated.store), "the product list never rides along");
  noEmails(updated);

  clear();
  const refused = await api("bob", "DELETE", `/api/stores/${store._id}`);
  assert.equal(refused.success, false, "only the owner may delete");

  await api("alice", "DELETE", `/api/stores/${store._id}`);
  const deleted = await waitFor("bob2", "store:deleted", (p) => p.storeId === String(store._id));
  assert.equal(deleted.ownerId, String(h.users.alice._id));
  assert.deepEqual(deleted.productIds, [String(product._id)]);
  assert.equal(seen("bob", "store:deleted").length, 1);
});
