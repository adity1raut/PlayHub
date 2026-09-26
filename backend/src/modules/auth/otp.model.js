import mongoose from "mongoose";

// One active one-time code per (email, purpose). Stored in MongoDB so codes
// survive server restarts; MongoDB deletes the document once expiresAt passes.
const OtpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    purpose: { type: String, enum: ["register", "reset"], required: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    verified: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true },
);

OtpSchema.index({ email: 1, purpose: 1 }, { unique: true });

const Otp = mongoose.model("Otp", OtpSchema);

export default Otp;
