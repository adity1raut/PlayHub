import { paymentMode, razorpay } from "../../config/razorpay.js";
import crypto from "crypto";
import Payment from "./payment.model.js";
import Cart from "./cart.model.js";
import Product from "./product.model.js";
import User from "../auth/user.model.js";
import Order from "./order.model.js";
import Store from "./store.model.js";
import { getNotificationService } from "../../socket/socket.handlers.js";
import { toUser } from "../../socket/realtime.js";
import { announceProductUpdate } from "./product.controller.js";
import { publishCart } from "./cart.controller.js";

export async function getUserAddresses(req, res) {
  try {
    const user = await User.findById(req.user._id).select("addresses");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    res.status(200).json({
      success: true,
      data: {
        addresses: user.addresses || [],
        hasAddresses: user.addresses && user.addresses.length > 0,
      },
    });
  } catch (error) {
    console.error("Get addresses error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch addresses" });
  }
}

export async function addDeliveryAddress(req, res) {
  try {
    const { name, phone, street, city, state, zipCode, country } = req.body;

    if (!name || !phone || !street || !city || !state || !zipCode) {
      return res.status(400).json({
        success: false,
        message: "All address fields are required (name, phone, street, city, state, zipCode)",
      });
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ success: false, message: "Invalid phone number format" });
    }

    if (!/^\d{6}$/.test(zipCode)) {
      return res.status(400).json({ success: false, message: "Invalid zipCode format (must be 6 digits)" });
    }

    const newAddress = {
      name: name.trim(),
      phone: phone.trim(),
      street: street.trim(),
      city: city.trim(),
      state: state.trim(),
      zipCode: zipCode.trim(),
      country: country ? country.trim() : "India",
    };

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $push: { addresses: newAddress } },
      { new: true, runValidators: true },
    ).select("addresses");

    const addedAddress = user.addresses[user.addresses.length - 1];

    res.status(201).json({
      success: true,
      message: "Address added successfully",
      data: { address: addedAddress, addressId: addedAddress._id },
    });
  } catch (error) {
    console.error("Add address error:", error);
    res.status(500).json({ success: false, message: "Failed to add address" });
  }
}

const PAYMENTS_OFF_MESSAGE = "Payments aren't set up on this server yet. Please try again later.";
const rupees = (paise) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** Does the Razorpay signature match? (constant-time, so it can't be guessed byte by byte) */
function signatureValid(orderId, paymentId, signature) {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const a = Buffer.from(String(signature || ""));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** GET /order/payment-config — can this server take payments, and are they test (dummy) payments? */
export function getPaymentConfig(req, res) {
  const mode = paymentMode();
  res.json({
    success: true,
    data: { enabled: Boolean(mode), mode, keyId: mode ? process.env.RAZORPAY_KEY_ID : null },
  });
}

export async function createOrder(req, res) {
  try {
    const mode = paymentMode();
    if (!mode) {
      return res.status(503).json({ success: false, code: "PAYMENTS_NOT_CONFIGURED", message: PAYMENTS_OFF_MESSAGE });
    }

    const { addressId, newAddress } = req.body;

    const cart = await Cart.findOne({ user: req.user._id }).populate("items.product");

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    let address;
    let addressIdToUse = addressId;

    if (newAddress && Object.keys(newAddress).length > 0) {
      const { name, phone, street, city, state, zipCode, country } = newAddress;
      if (!name || !phone || !street || !city || !state || !zipCode) {
        return res.status(400).json({
          success: false,
          message: "All address fields are required when adding new address",
        });
      }
      const user = await User.findByIdAndUpdate(
        req.user._id,
        {
          $push: {
            addresses: {
              name: name.trim(),
              phone: phone.trim(),
              street: street.trim(),
              city: city.trim(),
              state: state.trim(),
              zipCode: zipCode.trim(),
              country: country ? country.trim() : "India",
            },
          },
        },
        { new: true },
      );
      address = user.addresses[user.addresses.length - 1];
      addressIdToUse = address._id;
    } else if (addressId) {
      const user = await User.findById(req.user._id);
      address = user.addresses.id(addressId);
      if (!address) {
        return res.status(400).json({ success: false, message: "Selected address not found" });
      }
    } else {
      return res.status(400).json({ success: false, message: "Either provide addressId or newAddress" });
    }

    let totalAmount = 0;
    const outOfStockItems = [];

    for (const item of cart.items) {
      if (!item.product) continue; // removed from the store
      if (item.product.stock < item.quantity) {
        outOfStockItems.push({
          name: item.product.name,
          available: item.product.stock,
          requested: item.quantity,
        });
      }
      totalAmount += item.product.price * item.quantity;
    }

    if (outOfStockItems.length > 0) {
      return res.status(400).json({ success: false, message: "Some items are out of stock", outOfStockItems });
    }

    // Razorpay needs an integer amount in paise, and at least ₹1
    const amountPaise = Math.round(totalAmount * 100);
    if (amountPaise < 100) {
      return res.status(400).json({ success: false, message: "The order total must be at least ₹1" });
    }

    const options = {
      amount: amountPaise,
      currency: "INR",
      receipt: `order_${Date.now()}`,
      notes: {
        userId: req.user._id.toString(),
        addressId: addressIdToUse.toString(),
        itemCount: cart.items.length,
      },
    };

    let razorpayOrder;
    try {
      razorpayOrder = await razorpay().orders.create(options);
    } catch (error) {
      const rejectedKeys = error?.statusCode === 401;
      console.error(
        rejectedKeys
          ? "Razorpay rejected RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET — check the keys in backend/.env"
          : `Razorpay order failed: ${error?.error?.description || error?.message}`,
      );
      return res.status(rejectedKeys ? 503 : 502).json({
        success: false,
        message: rejectedKeys ? PAYMENTS_OFF_MESSAGE : "Couldn't start the payment with Razorpay. Please try again.",
      });
    }

    // Remember what this payment is for; verification checks the payment against it
    await Payment.create({
      user: req.user._id,
      razorpayOrderId: razorpayOrder.id,
      amount: amountPaise,
      currency: "INR",
      addressId: addressIdToUse,
      mode,
    });

    const user = await User.findById(req.user._id);

    res.status(200).json({
      success: true,
      data: {
        orderId: razorpayOrder.id,
        amount: totalAmount,
        currency: "INR",
        key: process.env.RAZORPAY_KEY_ID,
        name: "Spawnpoint Store",
        description: `Payment for ${cart.items.length} items`,
        prefill: {
          name: user.profile?.name || user.username,
          email: user.email,
          contact: address.phone,
        },
        theme: { color: "#5eead4" },
        selectedAddress: address,
        addressId: addressIdToUse,
        mode,
      },
    });
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({ success: false, message: "Failed to create order" });
  }
}

export async function verifyPayment(req, res) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!paymentMode()) {
      return res.status(503).json({ success: false, code: "PAYMENTS_NOT_CONFIGURED", message: PAYMENTS_OFF_MESSAGE });
    }
    if (!razorpay_order_id || !razorpay_payment_id || !signatureValid(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      return res.status(400).json({ success: false, message: "Invalid payment signature." });
    }

    // Claim this checkout attempt; a second verify of the same payment gets the order made the first time
    const payment = await Payment.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id, user: req.user._id, status: { $in: ["created", "failed"] } },
      { $set: { status: "processing", razorpayPaymentId: razorpay_payment_id } },
      { new: true },
    );
    if (!payment) {
      const done = await Payment.findOne({ razorpayOrderId: razorpay_order_id, user: req.user._id }).lean();
      if (done?.status === "paid" && done.order) {
        const existing = await Order.findById(done.order).lean();
        if (existing) return res.status(200).json(orderResponse(existing, done.razorpayPaymentId, razorpay_order_id));
      }
      if (done?.status === "processing") {
        return res.status(409).json({ success: false, message: "This payment is already being processed." });
      }
      return res.status(400).json({ success: false, message: "We don't recognise this payment." });
    }
    const fail = async (status, message) => {
      await Payment.updateOne({ _id: payment._id }, { $set: { status: "failed", failureReason: message } });
      return res.status(status).json({ success: false, message });
    };

    const cart = await Cart.findOne({ user: req.user._id }).populate(["items.product", "items.product.store"]);
    if (!cart || cart.items.length === 0) {
      return fail(400, "Cart is empty");
    }

    const user = await User.findById(req.user._id);
    const address = user.addresses.id(req.body.addressId || payment.addressId);
    if (!address) {
      return fail(400, "Delivery address not found");
    }

    // The amount paid must match what's in the cart now (it syncs live across tabs, so it can
    // change while the Razorpay window is open)
    const cartPaise = Math.round(
      cart.items.reduce((sum, item) => sum + (item.product ? item.product.price * item.quantity : 0), 0) * 100,
    );
    if (cartPaise !== payment.amount) {
      const note = payment.mode === "test" ? " (test payment: no real money was taken)" : "";
      return fail(
        409,
        `Your cart changed while you were paying: you paid ${rupees(payment.amount)} but the cart is now ${rupees(cartPaise)}. ` +
          `No order was placed${note}. Please check out again.`,
      );
    }

    let totalAmount = 0;
    const orderItems = [];
    const stockUpdatePromises = [];

    for (const item of cart.items) {
      const product = await Product.findById(item.product._id).populate("store");

      if (!product || product.stock < item.quantity) {
        return fail(
          400,
          product
            ? `Insufficient stock for ${product.name}. Available: ${product.stock}, Required: ${item.quantity}`
            : "A product in your cart is no longer available",
        );
      }

      stockUpdatePromises.push(
        Product.findByIdAndUpdate(product._id, { $inc: { stock: -item.quantity } }, { new: true }),
      );

      totalAmount += product.price * item.quantity;
      orderItems.push({
        product: product._id,
        productName: product.name,
        quantity: item.quantity,
        price: product.price,
        totalPrice: product.price * item.quantity,
        store: product.store._id,
        storeName: product.store.name,
      });
    }

    const updatedProducts = await Promise.all(stockUpdatePromises);
    // Live stock on every open product page, list and cart
    updatedProducts.forEach((p) => p && announceProductUpdate(p, ["stock"]));

    const newOrder = new Order({
      user: req.user._id,
      items: orderItems,
      totalAmount,
      deliveryAddress: {
        name: address.name,
        phone: address.phone,
        street: address.street,
        city: address.city,
        state: address.state,
        zipCode: address.zipCode,
        country: address.country || "India",
      },
      payment: {
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: "completed",
        method: "razorpay",
        mode: payment.mode,
        paidAt: new Date(),
      },
      orderStatus: "confirmed",
      createdAt: new Date(),
      deliveryLocation: null,
    });

    const savedOrder = await newOrder.save();
    await Payment.updateOne({ _id: payment._id }, { $set: { status: "paid", order: savedOrder._id } });
    cart.items = [];
    await cart.save();
    publishCart(req.user._id, cart); // the buyer's other tabs empty their cart too

    notifyOrderPlaced(savedOrder, user).catch((error) =>
      console.error("Order notifications failed:", error.message),
    );

    res.status(200).json(orderResponse(savedOrder, razorpay_payment_id, razorpay_order_id));
  } catch (error) {
    console.error("Payment verification error:", error);
    // Leave the attempt retryable instead of stuck in "processing"
    await Payment.updateOne(
      { razorpayOrderId: req.body?.razorpay_order_id, user: req.user._id, status: "processing" },
      { $set: { status: "failed", failureReason: "Server error while verifying" } },
    ).catch(() => {});
    res.status(500).json({ success: false, message: "Payment verification failed" });
  }
}

function orderResponse(order, paymentId, razorpayOrderId) {
  return {
    success: true,
    message: "Payment verified and order placed successfully",
    data: {
      orderId: order._id,
      orderNumber: order.orderNumber || order._id,
      paymentId,
      razorpayOrderId,
      mode: order.payment?.mode,
      amount: order.totalAmount,
      items: order.items,
      deliveryAddress: order.deliveryAddress,
      orderStatus: order.orderStatus,
      estimatedDelivery: new Date(new Date(order.createdAt || Date.now()).getTime() + 7 * 24 * 60 * 60 * 1000),
    },
  };
}

export async function updateAddress(req, res) {
  try {
    const { addressId } = req.params;
    const { name, phone, street, city, state, zipCode, country } = req.body;

    if (!name || !phone || !street || !city || !state || !zipCode) {
      return res.status(400).json({ success: false, message: "All address fields are required" });
    }

    const user = await User.findById(req.user._id);
    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    address.name = name.trim();
    address.phone = phone.trim();
    address.street = street.trim();
    address.city = city.trim();
    address.state = state.trim();
    address.zipCode = zipCode.trim();
    address.country = country ? country.trim() : "India";

    await user.save();
    res.status(200).json({ success: true, message: "Address updated successfully", data: { address } });
  } catch (error) {
    console.error("Update address error:", error);
    res.status(500).json({ success: false, message: "Failed to update address" });
  }
}

export async function deleteAddress(req, res) {
  try {
    const { addressId } = req.params;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { addresses: { _id: addressId } } },
      { new: true },
    );
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    res.status(200).json({
      success: true,
      message: "Address deleted successfully",
      data: { remainingAddresses: user.addresses },
    });
  } catch (error) {
    console.error("Delete address error:", error);
    res.status(500).json({ success: false, message: "Failed to delete address" });
  }
}

export async function saveOrderLocation(req, res) {
  try {
    const { orderId } = req.params;
    const { latitude, longitude, accuracy, timestamp } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: "Latitude and longitude are required" });
    }

    const order = await Order.findOne({ _id: orderId, user: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    order.deliveryLocation = {
      coordinates: [parseFloat(longitude), parseFloat(latitude)],
      accuracy: accuracy ? parseFloat(accuracy) : null,
      capturedAt: timestamp ? new Date(timestamp) : new Date(),
      type: "Point",
    };
    await order.save();

    res.status(200).json({
      success: true,
      message: "Delivery location saved successfully",
      data: {
        orderId: order._id,
        location: {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          accuracy: accuracy ? parseFloat(accuracy) : null,
          capturedAt: order.deliveryLocation.capturedAt,
        },
      },
    });
  } catch (error) {
    console.error("Save location error:", error);
    res.status(500).json({ success: false, message: "Failed to save delivery location" });
  }
}

export async function getOrderDetails(req, res) {
  try {
    const order = await Order.findOne({
      _id: req.params.orderId,
      user: req.user._id,
    }).populate(["items.product", "items.store"]);

    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error("Get order details error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch order details" });
  }
}

export async function getUserOrders(req, res) {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const query = { user: req.user._id };
    if (status) query.orderStatus = status;

    const orders = await Order.find(query)
      .populate(["items.product", "items.store"])
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const totalOrders = await Order.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalOrders / limit),
          totalOrders,
          hasMore: page * limit < totalOrders,
        },
      },
    });
  } catch (error) {
    console.error("Get user orders error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch orders" });
  }
}

/**
 * After a paid order: tell each seller (notification + live `order:created` for their
 * store dashboard) and confirm to the buyer.
 */
async function notifyOrderPlaced(order, buyer) {
  const notifications = getNotificationService();
  const byStore = new Map();
  for (const item of order.items) {
    const key = String(item.store);
    const entry = byStore.get(key) || { storeName: item.storeName, itemCount: 0 };
    entry.itemCount += item.quantity;
    byStore.set(key, entry);
  }

  const stores = await Store.find({ _id: { $in: [...byStore.keys()] } }).select("owner name").lean();
  for (const store of stores) {
    const { itemCount } = byStore.get(String(store._id));
    await notifications?.sendNewOrderNotification(store.owner, buyer._id, buyer.username, itemCount, store.name);
    toUser(store.owner, "order:created", {
      orderId: String(order._id),
      storeIds: [String(store._id)],
      totalAmount: order.totalAmount,
      itemCount,
      buyerUsername: buyer.username,
    });
  }

  const totalItems = order.items.reduce((sum, i) => sum + i.quantity, 0);
  await notifications?.createNotification(
    buyer._id,
    "ORDER_UPDATE",
    `Order confirmed — ${totalItems} item${totalItems === 1 ? "" : "s"}, ₹${order.totalAmount}. Payment received.`,
    null,
  );
}
