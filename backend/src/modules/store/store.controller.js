import cloudinary from "../../config/cloudinary.js";
import Product from "./product.model.js";
import Store from "./store.model.js";
import User from "../auth/user.model.js";
import { broadcast } from "../../socket/realtime.js";

/** What `store:created` / `store:updated` carry: the public storefront (owner populated), never its product list. */
const publicStore = (store) => ({
  _id: store._id,
  name: store.name,
  description: store.description,
  logo: store.logo,
  owner: store.owner,
  createdAt: store.createdAt,
  updatedAt: store.updatedAt,
});

export async function getAllStores(req, res) {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const query = search ? { name: { $regex: search, $options: "i" } } : {};

    const stores = await Store.find(query)
      .populate("owner", "username profile.name followers")
      .populate("products", "name price images")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Store.countDocuments(query);
    res.status(200).json({
      stores,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getStoreById(req, res) {
  try {
    const store = await Store.findById(req.params.id)
      .populate("owner", "username profile.name profile.profileImage followers")
      .populate({
        path: "products",
        populate: { path: "ratings.user", select: "username profile.name" },
      });

    if (!store) return res.status(404).json({ error: "Store not found" });
    res.status(200).json(store);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function createStore(req, res) {
  try {
    const { name, description } = req.body;

    const existingStore = await Store.findOne({ owner: req.user._id });
    if (existingStore) {
      return res.status(400).json({ error: "User already has a store" });
    }

    let logoUrl = "";
    if (req.file) {
      try {
        const b64 = Buffer.from(req.file.buffer).toString("base64");
        const dataURI = "data:" + req.file.mimetype + ";base64," + b64;
        const result = await cloudinary.uploader.upload(dataURI, {
          folder: "store-logos",
          resource_type: "auto",
        });
        logoUrl = result.secure_url;
      } catch {
        return res.status(500).json({ error: "Failed to upload logo" });
      }
    }

    const store = new Store({
      owner: req.user._id,
      name,
      description,
      logo: logoUrl,
    });
    await store.save();

    await User.findByIdAndUpdate(req.user._id, { store: store._id });

    const populatedStore = await Store.findById(store._id).populate(
      "owner",
      "username profile.name",
    );
    broadcast("store:created", { storeId: String(store._id), store: publicStore(populatedStore) });
    res.status(201).json(populatedStore);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateStore(req, res) {
  try {
    const { name, description } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ error: "Store not found" });

    if (req.file) {
      if (store.logo) {
        try {
          const publicId = store.logo.split("/").pop().split(".")[0];
          await cloudinary.uploader.destroy(`store-logos/${publicId}`);
        } catch {}
      }
      try {
        const b64 = Buffer.from(req.file.buffer).toString("base64");
        const dataURI = "data:" + req.file.mimetype + ";base64," + b64;
        const result = await cloudinary.uploader.upload(dataURI, {
          folder: "store-logos",
          resource_type: "auto",
        });
        updateData.logo = result.secure_url;
      } catch {
        return res.status(500).json({ error: "Failed to upload new logo" });
      }
    }

    const updatedStore = await Store.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true },
    ).populate("owner", "username profile.name");

    broadcast("store:updated", { storeId: String(updatedStore._id), store: publicStore(updatedStore) });
    res.status(200).json(updatedStore);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteStore(req, res) {
  try {
    const productIds = await Product.find({ store: req.store._id }).distinct("_id");
    await Product.deleteMany({ store: req.store._id });

    if (req.store.logo) {
      try {
        const publicId = req.store.logo.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(`store-logos/${publicId}`);
      } catch {}
    }

    await User.findByIdAndUpdate(req.user._id, { $unset: { store: 1 } });
    await Store.findByIdAndDelete(req.params.id);

    // Its products went with it: open pages drop them (matched by storeId or productIds)
    broadcast("store:deleted", {
      storeId: String(req.store._id),
      ownerId: String(req.store.owner),
      productIds: productIds.map(String),
    });
    res.status(200).json({ message: "Store deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getUserStore(req, res) {
  try {
    const store = await Store.findOne({ owner: req.params.userId })
      .populate("owner", "username profile.name")
      .populate("products", "name price images stock");

    if (!store) return res.status(404).json({ error: "Store not found" });
    res.status(200).json(store);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getStoreProducts(req, res) {
  try {
    const { page = 1, limit = 12, sort = "createdAt", order = "desc" } =
      req.query;

    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ error: "Store not found" });

    const sortObj = {};
    sortObj[sort] = order === "desc" ? -1 : 1;

    const products = await Product.find({ store: req.params.id })
      .populate("store", "name logo")
      .populate("ratings.user", "username profile.name")
      .sort(sortObj)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments({ store: req.params.id });
    res.status(200).json({
      products,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getCurrentUserStore(req, res) {
  try {
    const store = await Store.findOne({ owner: req.user._id })
      .populate("owner", "username profile.name")
      .populate("products", "name price images stock");

    if (!store) {
      return res.status(404).json({ error: "You don't have a store yet" });
    }
    res.status(200).json(store);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
