import Cart from "./cart.model.js";
import Product from "./product.model.js";
import Store from "./store.model.js";
import { toUser } from "../../socket/realtime.js";

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

const getPopulatedCart = async (cartId) => {
  return await Cart.findById(cartId).populate({
    path: "items.product",
    populate: { path: "store", select: "name logo owner" },
  });
};

/**
 * The cart as GET /cart returns it (products + their store populated, deleted products
 * dropped, total worked out), also pushed to all of the owner's open tabs as `cart:updated`
 * so their cart page and cart badge follow.
 */
export function publishCart(userId, cart) {
  const view = cart.toObject();
  view.items = view.items.filter((item) => item.product != null);
  view.totalAmount = Number(calculateCartTotal(view.items).toFixed(2));
  toUser(userId, "cart:updated", { cart: view });
  return view;
}

export async function addToCart(req, res) {
  try {
    const { productId, quantity = 1 } = req.body;
    const { storeId } = req.params;

    if (!productId) return res.status(400).json({ error: "Product ID is required" });
    if (quantity <= 0) return res.status(400).json({ error: "Quantity must be greater than 0" });

    const store = await Store.findById(storeId);
    if (!store) return res.status(404).json({ error: "Store not found" });

    const product = await Product.findOne({ _id: productId, store: storeId });
    if (!product) return res.status(404).json({ error: "Product not found in this store" });

    if (product.stock < quantity) {
      return res.status(400).json({ error: "Insufficient stock", availableStock: product.stock });
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = new Cart({ user: req.user._id, items: [] });

    const existingItemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId,
    );

    if (existingItemIndex > -1) {
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
      cart.items.push({ product: productId, quantity });
    }

    cart.updatedAt = new Date();
    await cart.save();

    const view = publishCart(req.user._id, await getPopulatedCart(cart._id));
    res.status(200).json({ success: true, ...view });
  } catch (error) {
    console.error("Error in addToCart:", error);
    res.status(500).json({ error: error.message });
  }
}

export async function getCart(req, res) {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    let cart = await Cart.findOne({ user: req.user._id }).populate({
      path: "items.product",
      populate: { path: "store", select: "name logo owner" },
    });

    if (!cart) {
      return res.status(200).json({ success: true, items: [], totalAmount: 0 });
    }

    const originalItemsLength = cart.items.length;
    cart.items = cart.items.filter((item) => item.product != null);

    if (cart.items.length !== originalItemsLength) {
      cart.updatedAt = new Date();
      await cart.save();
    }

    const totalAmount = calculateCartTotal(cart.items);
    res.status(200).json({
      success: true,
      ...cart.toObject(),
      totalAmount: Number(totalAmount.toFixed(2)),
    });
  } catch (error) {
    console.error("Error in getCart:", error);
    res.status(500).json({ error: error.message, type: error.name });
  }
}

export async function updateCartItem(req, res) {
  try {
    const { productId, quantity } = req.body;

    if (!productId) return res.status(400).json({ error: "Product ID is required" });
    if (typeof quantity !== "number" || quantity < 0) {
      return res.status(400).json({ error: "Quantity must be a non-negative number" });
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ error: "Cart not found" });

    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId,
    );

    if (itemIndex === -1) return res.status(404).json({ error: "Item not found in cart" });

    if (quantity <= 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      const product = await Product.findById(productId);
      if (!product) {
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

    const view = publishCart(req.user._id, await getPopulatedCart(cart._id));
    res.status(200).json({ success: true, ...view });
  } catch (error) {
    console.error("Error in updateCartItem:", error);
    res.status(500).json({ error: error.message });
  }
}

export async function removeFromCart(req, res) {
  try {
    const { productId } = req.params;

    if (!productId) return res.status(400).json({ error: "Product ID is required" });

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ error: "Cart not found" });

    const initialLength = cart.items.length;
    cart.items = cart.items.filter(
      (item) => item.product.toString() !== productId,
    );

    if (cart.items.length === initialLength) {
      return res.status(404).json({ error: "Item not found in cart" });
    }

    cart.updatedAt = new Date();
    await cart.save();

    const view = publishCart(req.user._id, await getPopulatedCart(cart._id));
    res.status(200).json({ success: true, ...view });
  } catch (error) {
    console.error("Error in removeFromCart:", error);
    res.status(500).json({ error: error.message });
  }
}

export async function clearCart(req, res) {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ error: "Cart not found" });

    cart.items = [];
    cart.updatedAt = new Date();
    await cart.save();
    publishCart(req.user._id, cart);

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
