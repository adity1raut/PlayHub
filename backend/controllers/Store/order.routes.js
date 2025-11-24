import { razorpay } from "../../config/rozapay.js";
import crypto from "crypto";
import Cart from "../../models/Cart.models.js";
import Product from "../../models/Product.models.js";
import User from "../../models/User.models.js";
import Store from "../../models/Store.models.js";
import Order from "../../models/Order.models.js";

// GET /api/stores/order/addresses - Get user's saved addresses
export async function getUserAddresses(req, res) {
  try {
    const user = await User.findById(req.user._id).select("addresses");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        addresses: user.addresses || [],
        hasAddresses: user.addresses && user.addresses.length > 0,
      },
    });
  } catch (error) {
    console.error("Get addresses error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch addresses",
      error: process.env.NODE_ENV === "production" ? error.message : undefined,
    });
  }
}

// POST /api/stores/order/addresses - Add new delivery address
export async function addDeliveryAddress(req, res) {
  try {
    const { name, phone, street, city, state, zipCode, country } = req.body;

    // Validate required fields
    if (!name || !phone || !street || !city || !state || !zipCode) {
      return res.status(400).json({
        success: false,
        message:
          "All address fields are required (name, phone, street, city, state, zipCode)",
      });
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format",
      });
    }

    // Validate zipCode format (basic validation)
    const zipCodeRegex = /^\d{6}$/;
    if (!zipCodeRegex.test(zipCode)) {
      return res.status(400).json({
        success: false,
        message: "Invalid zipCode format (must be 6 digits)",
      });
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
      data: {
        address: addedAddress,
        addressId: addedAddress._id,
      },
    });
  } catch (error) {
    console.error("Add address error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add address",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

// POST /api/stores/order/create - Create Razorpay order
export async function createOrder(req, res) {
  try {
    const { addressId, newAddress } = req.body;

    // Get user's cart
    const cart = await Cart.findOne({ user: req.user._id }).populate(
      "items.product",
    );

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty",
      });
    }

    let address;
    let addressIdToUse = addressId;

    // Handle address - either use existing or add new one
    if (newAddress && Object.keys(newAddress).length > 0) {
      // Validate new address fields
      const { name, phone, street, city, state, zipCode, country } = newAddress;

      if (!name || !phone || !street || !city || !state || !zipCode) {
        return res.status(400).json({
          success: false,
          message: "All address fields are required when adding new address",
        });
      }

      // Add new address to user
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
      // Use existing address
      const user = await User.findById(req.user._id);
      address = user.addresses.id(addressId);

      if (!address) {
        return res.status(400).json({
          success: false,
          message: "Selected address not found",
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "Either provide addressId or newAddress",
      });
    }

    // Calculate total amount and validate stock
    let totalAmount = 0;
    const outOfStockItems = [];

    for (const item of cart.items) {
      // Verify stock availability
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
      return res.status(400).json({
        success: false,
        message: "Some items are out of stock",
        outOfStockItems,
      });
    }

    // Create Razorpay order
    const options = {
      amount: totalAmount * 100, // Amount in paise
      currency: "INR",
      receipt: `order_${Date.now()}`,
      notes: {
        userId: req.user._id.toString(),
        addressId: addressIdToUse.toString(),
        itemCount: cart.items.length,
      },
    };

    const razorpayOrder = await razorpay.orders.create(options);

    // Get user details for response
    const user = await User.findById(req.user._id);

    res.status(200).json({
      success: true,
      data: {
        orderId: razorpayOrder.id,
        amount: totalAmount,
        currency: "INR",
        key: process.env.RAZORPAY_KEY_ID,
        name: "Your Store Name",
        description: `Payment for ${cart.items.length} items`,
        prefill: {
          name: user.profile?.name || user.username,
          email: user.email,
          contact: address.phone,
        },
        theme: {
          color: "#7C3AED", // Purple theme to match frontend
        },
        selectedAddress: address,
        addressId: addressIdToUse,
      },
    });
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create order",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

// POST /api/stores/order/verify - Verify Razorpay payment
export async function verifyPayment(req, res) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      addressId,
    } = req.body;

    // Verify signature
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature !== expectedSign) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature. Payment verification failed.",
      });
    }

    // Get user's cart
    const cart = await Cart.findOne({ user: req.user._id }).populate([
      "items.product",
      "items.product.store",
    ]);

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty",
      });
    }

    // Get user and address details
    const user = await User.findById(req.user._id);
    const address = user.addresses.id(addressId);

    if (!address) {
      return res.status(400).json({
        success: false,
        message: "Delivery address not found",
      });
    }

    // Calculate total amount and prepare order items
    let totalAmount = 0;
    const orderItems = [];
    const stockUpdatePromises = [];

    // Validate stock again and prepare order data
    for (const item of cart.items) {
      const product = await Product.findById(item.product._id).populate(
        "store",
      );

      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Available: ${product.stock}, Required: ${item.quantity}`,
        });
      }

      // Prepare stock update
      stockUpdatePromises.push(
        Product.findByIdAndUpdate(
          product._id,
          { $inc: { stock: -item.quantity } },
          { new: true },
        ),
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

    // Update stock for all products
    await Promise.all(stockUpdatePromises);

    // Create order record
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
        paidAt: new Date(),
      },
      orderStatus: "confirmed",
      createdAt: new Date(),
      // Location will be updated separately via the location endpoint
      deliveryLocation: null,
    });

    const savedOrder = await newOrder.save();

    // Clear the cart
    cart.items = [];
    await cart.save();

    res.status(200).json({
      success: true,
      message: "Payment verified and order placed successfully",
      data: {
        orderId: savedOrder._id,
        orderNumber: savedOrder.orderNumber || savedOrder._id,
        paymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        amount: totalAmount,
        items: orderItems,
        deliveryAddress: savedOrder.deliveryAddress,
        orderStatus: savedOrder.orderStatus,
        estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      },
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).json({
      success: false,
      message: "Payment verification failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

// PUT /api/stores/order/addresses/:addressId - Update existing address
export async function updateAddress(req, res) {
  try {
    const { addressId } = req.params;
    const { name, phone, street, city, state, zipCode, country } = req.body;

    // Validate required fields
    if (!name || !phone || !street || !city || !state || !zipCode) {
      return res.status(400).json({
        success: false,
        message: "All address fields are required",
      });
    }

    const user = await User.findById(req.user._id);
    const address = user.addresses.id(addressId);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // Update address fields
    address.name = name.trim();
    address.phone = phone.trim();
    address.street = street.trim();
    address.city = city.trim();
    address.state = state.trim();
    address.zipCode = zipCode.trim();
    address.country = country ? country.trim() : "India";

    await user.save();

    res.status(200).json({
      success: true,
      message: "Address updated successfully",
      data: {
        address,
      },
    });
  } catch (error) {
    console.error("Update address error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update address",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

// DELETE /api/stores/order/addresses/:addressId - Delete address
export async function deleteAddress(req, res) {
  try {
    const { addressId } = req.params;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { addresses: { _id: addressId } } },
      { new: true },
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Address deleted successfully",
      data: {
        remainingAddresses: user.addresses,
      },
    });
  } catch (error) {
    console.error("Delete address error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete address",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

// POST /api/stores/order/:orderId/location - Save delivery location
export async function saveOrderLocation(req, res) {
  try {
    const { orderId } = req.params;
    const { latitude, longitude, accuracy, timestamp } = req.body;

    // Validate required fields
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    // Find the order and verify ownership
    const order = await Order.findOne({
      _id: orderId,
      user: req.user._id,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Update order with location
    order.deliveryLocation = {
      coordinates: [parseFloat(longitude), parseFloat(latitude)], // GeoJSON format [lng, lat]
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
    res.status(500).json({
      success: false,
      message: "Failed to save delivery location",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

// GET /api/stores/order/:orderId - Get order details
export async function getOrderDetails(req, res) {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({
      _id: orderId,
      user: req.user._id,
    }).populate(["items.product", "items.store"]);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Get order details error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order details",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

// GET /api/stores/orders - Get user's orders
export async function getUserOrders(req, res) {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const query = { user: req.user._id };
    if (status) {
      query.orderStatus = status;
    }

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
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
