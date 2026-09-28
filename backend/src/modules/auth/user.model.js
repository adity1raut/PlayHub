import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: { type: String, required: true },

  profile: {
    name: {
      type: String,
    },
    bio: {
      type: String,
      default: "",
    },
    profileImage: {
      type: String,
      default: "",
    },
    coverImage: {
      type: String,
      default: "",
    },
  },

  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  posts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
  conversations: [
    { type: mongoose.Schema.Types.ObjectId, ref: "Conversation" },
  ],
  streams: [{ type: mongoose.Schema.Types.ObjectId, ref: "Stream" }],
  store: { type: mongoose.Schema.Types.ObjectId, ref: "Store" },

  addresses: [
    {
      name: { type: String },
      phone: { type: String },
      street: { type: String },
      city: { type: String },
      state: { type: String },
      zipCode: { type: String },
      country: { type: String, default: "India" },
    },
  ],

  wishlist: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
  ],

  // Read through settingsOf() (settings.js): documents saved before this existed have no settings
  settings: {
    privacy: {
      // "friends": only mutual followers can chat with you; "everyone": anyone who also allows everyone
      messages: { type: String, enum: ["friends", "everyone"], default: "friends" },
    },
    notifications: {
      messages: { type: Boolean, default: true },
      follows: { type: Boolean, default: true },
      likes: { type: Boolean, default: true },
      comments: { type: Boolean, default: true },
      live: { type: Boolean, default: true },
      store: { type: Boolean, default: true },
    },
  },

  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", UserSchema);

export default User;
