import mongoose from "mongoose";

// Order Item Schema
const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  productName: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Store",
    required: true,
  },
  storeName: {
    type: String,
    required: true,
  },
});

// Delivery Address Schema
const deliveryAddressSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  street: {
    type: String,
    required: true,
  },
  city: {
    type: String,
    required: true,
  },
  state: {
    type: String,
    required: true,
  },
  zipCode: {
    type: String,
    required: true,
  },
  country: {
    type: String,
    default: "India",
  },
});

// Delivery Location Schema (GeoJSON)
const deliveryLocationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["Point"],
    default: "Point",
  },
  coordinates: {
    type: [Number], // [longitude, latitude]
    index: "2dsphere",
  },
  accuracy: Number,
  capturedAt: {
    type: Date,
    default: Date.now,
  },
});

// Payment Schema
const paymentSchema = new mongoose.Schema({
  razorpayOrderId: {
    type: String,
    required: true,
  },
  razorpayPaymentId: {
    type: String,
    required: true,
  },
  razorpaySignature: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "completed", "failed", "refunded"],
    default: "pending",
  },
  method: {
    type: String,
    default: "razorpay",
  },
  paidAt: {
    type: Date,
    default: Date.now,
  },
  refundedAt: Date,
  refundAmount: {
    type: Number,
    default: 0,
  },
});

// Tracking Detail Schema
const trackingDetailSchema = new mongoose.Schema({
  status: {
    type: String,
    required: true,
  },
  message: String,
  timestamp: {
    type: Date,
    default: Date.now,
  },
  location: String,
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
});

// Delivery Tracking Schema
const deliveryTrackingSchema = new mongoose.Schema({
  estimatedDelivery: Date,
  actualDelivery: Date,
  deliveryAgent: {
    name: String,
    phone: String,
    vehicleNumber: String,
  },
  deliveryNotes: String,
  deliveryImages: [String],
  recipientName: String,
  deliveryOTP: String,
});

// Cancellation Schema
const cancellationSchema = new mongoose.Schema({
  reason: String,
  cancelledAt: Date,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  refundStatus: {
    type: String,
    enum: ["pending", "processed", "completed", "failed"],
    default: "pending",
  },
});

// Main Order Schema
const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    orderNumber: {
      type: String,
      unique: true,
      default: function () {
        return `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`;
      },
    },

    // Order Items
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: function (items) {
          return items && items.length > 0;
        },
        message: "Order must contain at least one item",
      },
    },

    // Total Amount
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    // Delivery Information
    deliveryAddress: {
      type: deliveryAddressSchema,
      required: true,
    },

    deliveryLocation: deliveryLocationSchema,

    // Payment Information
    payment: {
      type: paymentSchema,
      required: true,
    },

    // Order Status and Tracking
    orderStatus: {
      type: String,
      enum: [
        "confirmed",
        "processing",
        "packed",
        "shipped",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "return_requested",
        "returned",
      ],
      default: "confirmed",
      index: true,
    },

    trackingDetails: [trackingDetailSchema],
    deliveryTracking: deliveryTrackingSchema,
    notes: String,
    cancellation: cancellationSchema,

    // Timestamps
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for better performance
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ "payment.razorpayOrderId": 1 });

// Update the updatedAt field before saving
orderSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// Virtual for order age in days
orderSchema.virtual("orderAge").get(function () {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Method to add tracking detail
orderSchema.methods.addTrackingDetail = function (
  status,
  message,
  location,
  updatedBy,
) {
  this.trackingDetails.push({
    status,
    message,
    location,
    updatedBy,
    timestamp: new Date(),
  });
  return this.save();
};

const Order = mongoose.model("Order", orderSchema);

export default Order;
