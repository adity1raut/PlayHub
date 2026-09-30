import mongoose from "mongoose";

/**
 * One checkout attempt: created with the Razorpay order, before the buyer pays. Verification checks
 * the payment against it (right buyer, right amount) and turns it into an Order exactly once.
 */
const PaymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String },
    amount: { type: Number, required: true }, // paise, as charged
    currency: { type: String, default: "INR" },
    addressId: { type: mongoose.Schema.Types.ObjectId },
    mode: { type: String, enum: ["test", "live"], required: true },
    // created → processing (verification running) → paid; failed when it can't become an order
    status: { type: String, enum: ["created", "processing", "paid", "failed"], default: "created" },
    failureReason: { type: String },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
  },
  { timestamps: true },
);

const Payment = mongoose.model("Payment", PaymentSchema);

export default Payment;
