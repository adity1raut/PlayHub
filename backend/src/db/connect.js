import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {});
    console.log("Database connection established !!!!");
  } catch (err) {
    console.log("Failed to connect to the database..." + err.message);
  }
};

export default connectDB;
