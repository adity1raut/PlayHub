import Store from "./store.model.js";

const verifyStoreOwnership = async (req, res, next) => {
  try {
    // Check for both storeId and id parameters
    const storeId = req.params.storeId || req.params.id;
    const userId = req.user._id || req.user.id;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: "Store ID not provided",
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication failed",
      });
    }

    console.log(
      "Verifying store ownership for store:",
      storeId,
      "user:",
      userId,
    );

    // Find the store
    const store = await Store.findById(storeId);

    if (!store) {
      console.log("Store not found:", storeId);
      return res.status(404).json({
        success: false,
        message: "Store not found",
      });
    }

    // Check if the authenticated user owns this store
    if (store.owner.toString() !== userId.toString()) {
      console.log("Access denied. Store owner:", store.owner, "User:", userId);
      return res.status(403).json({
        success: false,
        message: "Access denied. You don't own this store",
      });
    }

    console.log("Store ownership verified successfully");
    // Add store to request object for use in route handlers
    req.store = store;
    next();
  } catch (error) {
    console.error("Store ownership verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during store verification",
    });
  }
};

export default verifyStoreOwnership;
