import Cart from "../../models/Cart.models.js";
import Product from "../../models/Product.models.js";
import Store from "../../models/Store.models.js";

// Helper function to calculate total amount
const calculateCartTotal = (items) => {
  return items.reduce((total, item) => {
    if (
      item.product &&
      typeof item.product.price === "number" &&
      !isNaN(item.product.price) &&
      typeof item.quantity === "number" &&
      !isNaN(item.quantity)
    ) {
      return total + item.product.price * item.quantity;
    }
    return total;
  }, 0);
};

// Helper function to populate and return cart
const getPopulatedCart = async (cartId) => {
  return await Cart.findById(cartId).populate({
    path: "items.product",
    populate: { path: "store", select: "name logo owner" },
  });
};

// POST /api/stores/:storeId/cart/add - Add item to cart
export async function addToCart(req, res) {
  try {
    const { productId, quantity = 1 } = req.body;
    const { storeId } = req.params;

    // Validate input
    if (!productId) {
      return res.status(400).json({ error: "Product ID is required" });
    }

    if (quantity <= 0) {
      return res.status(400).json({ error: "Quantity must be greater than 0" });
    }

    // Verify store exists
    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    // Verify product exists and belongs to the store
    const product = await Product.findOne({ _id: productId, store: storeId });
    if (!product) {
      return res.status(404).json({ error: "Product not found in this store" });
    }

    // Check stock availability
    if (product.stock < quantity) {
      return res.status(400).json({
        error: "Insufficient stock",
        availableStock: product.stock,
      });
    }

    // Find or create cart
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }

    // Check if product already exists in cart
    const existingItemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId,
    );

    if (existingItemIndex > -1) {
      // Update quantity
      const newQuantity = cart.items[existingItemIndex].quantity + quantity;
      if (newQuantity > product.stock) {
        return res.status(400).json({
          error: "Total quantity exceeds available stock",
          availableStock: product.stock,
          currentInCart: cart.items[existingItemIndex].quantity,
        });
      }
      cart.items[existingItemIndex].quantity = newQuantity;
    } else {
      // Add new item
      cart.items.push({ product: productId, quantity });
    }

    cart.updatedAt = new Date();
    await cart.save();

    // Get populated cart
    const populatedCart = await getPopulatedCart(cart._id);
    const totalAmount = calculateCartTotal(populatedCart.items);

    res.status(200).json({
      success: true,
      ...populatedCart.toObject(),
      totalAmount: Number(totalAmount.toFixed(2)),
    });
  } catch (error) {
    console.error("Error in addToCart:", error);
    res.status(500).json({ error: error.message });
  }
}

// GET /api/cart - Get user's cart
export async function getCart(req, res) {
  try {
    if (!req.user || !req.user._id) {
      console.log("User not authenticated");
      return res.status(401).json({ error: "User not authenticated" });
    }

    let cart = await Cart.findOne({ user: req.user._id }).populate({
      path: "items.product",
      populate: { path: "store", select: "name logo owner" },
    });

    if (!cart) {
      console.log("Cart not found for user:", req.user._id);
      return res.status(200).json({
        success: true,
        items: [],
        totalAmount: 0,
      });
    }

    // Filter out items with null/undefined products (deleted products)
    const originalItemsLength = cart.items.length;
    cart.items = cart.items.filter((item) => item.product != null);

    // Save cart if items were filtered out
    if (cart.items.length !== originalItemsLength) {
      cart.updatedAt = new Date();
      await cart.save();
    }

    const totalAmount = calculateCartTotal(cart.items);

    const response = {
      success: true,
      ...cart.toObject(),
      totalAmount: Number(totalAmount.toFixed(2)),
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error in getCart:", error);
    res.status(500).json({
      error: error.message,
      type: error.name,
    });
  }
}

// PUT /api/cart/update - Update cart item quantity
export async function updateCartItem(req, res) {
  try {
    const { productId, quantity } = req.body;

    // Validate input
    if (!productId) {
      return res.status(400).json({ error: "Product ID is required" });
    }

    if (typeof quantity !== "number" || quantity < 0) {
      return res
        .status(400)
        .json({ error: "Quantity must be a non-negative number" });
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId,
    );

    if (itemIndex === -1) {
      return res.status(404).json({ error: "Item not found in cart" });
    }

    if (quantity <= 0) {
      // Remove item if quantity is 0 or negative
      cart.items.splice(itemIndex, 1);
    } else {
      // Verify product exists and check stock
      const product = await Product.findById(productId);
      if (!product) {
        // If product doesn't exist, remove it from cart
        cart.items.splice(itemIndex, 1);
      } else if (quantity > product.stock) {
        return res.status(400).json({
          error: "Quantity exceeds available stock",
          availableStock: product.stock,
        });
      } else {
        cart.items[itemIndex].quantity = quantity;
      }
    }

    cart.updatedAt = new Date();
    await cart.save();

    // Get populated cart
    const populatedCart = await getPopulatedCart(cart._id);
    const totalAmount = calculateCartTotal(populatedCart.items);

    res.status(200).json({
      success: true,
      ...populatedCart.toObject(),
      totalAmount: Number(totalAmount.toFixed(2)),
    });
  } catch (error) {
    console.error("Error in updateCartItem:", error);
    res.status(500).json({ error: error.message });
  }
}

// DELETE /api/cart/remove/:productId - Remove item from cart
export async function removeFromCart(req, res) {
  try {
    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({ error: "Product ID is required" });
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }

    const initialLength = cart.items.length;
    cart.items = cart.items.filter(
      (item) => item.product.toString() !== productId,
    );

    // Check if item was actually removed
    if (cart.items.length === initialLength) {
      return res.status(404).json({ error: "Item not found in cart" });
    }

    cart.updatedAt = new Date();
    await cart.save();

    // Get populated cart
    const populatedCart = await getPopulatedCart(cart._id);
    const totalAmount = calculateCartTotal(populatedCart.items);

    res.status(200).json({
      success: true,
      ...populatedCart.toObject(),
      totalAmount: Number(totalAmount.toFixed(2)),
    });
  } catch (error) {
    console.error("Error in removeFromCart:", error);
    res.status(500).json({ error: error.message });
  }
}

// DELETE /api/cart/clear - Clear entire cart
export async function clearCart(req, res) {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }

    cart.items = [];
    cart.updatedAt = new Date();
    await cart.save();

    res.status(200).json({
      success: true,
      message: "Cart cleared successfully",
      items: [],
      totalAmount: 0,
    });
  } catch (error) {
    console.error("Error in clearCart:", error);
    res.status(500).json({ error: error.message });
  }
}

// GET /api/cart/count - Get cart items count
export async function getCartCount(req, res) {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      return res.status(200).json({
        success: true,
        count: 0,
      });
    }

    // Count total items (sum of quantities)
    const totalCount = cart.items.reduce((count, item) => {
      return count + (item.quantity || 0);
    }, 0);

    res.status(200).json({
      success: true,
      count: totalCount,
    });
  } catch (error) {
    console.error("Error in getCartCount:", error);
    res.status(500).json({ error: error.message });
  }
}
