import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {});
    console.log("Database connection established !!!!");
  } catch (err) {
    console.error("Failed to connect to the database: " + err.message);
    // Exit so the process manager / container restarts us instead of serving a broken API
    process.exit(1);
  }
};

export default connectDB;
