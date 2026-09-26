import Product from "./product.model.js";

export async function searchProducts(req, res) {
  try {
    const { q, minPrice, maxPrice, store, page = 1, limit = 12, sort = "createdAt", order = "desc" } =
      req.query;

    let query = {};

    if (q) {
      query.$or = [
        { name: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
      ];
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    if (store) query.store = store;
    query.stock = { $gt: 0 };

    const sortObj = {};
    sortObj[sort] = order === "desc" ? -1 : 1;

    const products = await Product.find(query)
      .populate("store", "name logo owner")
      .populate("ratings.user", "username profile.name")
      .sort(sortObj)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(query);

    res.status(200).json({
      products,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
      filters: { q, minPrice, maxPrice, store },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getTrendingProducts(req, res) {
  try {
    const { limit = 20 } = req.query;

    const products = await Product.aggregate([
      {
        $match: {
          stock: { $gt: 0 },
          ratings: { $exists: true, $not: { $size: 0 } },
        },
      },
      {
        $addFields: {
          averageRating: { $avg: "$ratings.rating" },
          ratingCount: { $size: "$ratings" },
        },
      },
      { $sort: { averageRating: -1, ratingCount: -1, createdAt: -1 } },
      { $limit: parseInt(limit) },
    ]);

    const populatedProducts = await Product.populate(products, [
      { path: "store", select: "name logo owner" },
      { path: "ratings.user", select: "username profile.name" },
    ]);

    res.status(200).json(populatedProducts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getAllProducts(req, res) {
  try {
    const { page = 1, limit = 12, sort = "createdAt", order = "desc" } = req.query;

    const sortObj = {};
    sortObj[sort] = order === "desc" ? -1 : 1;

    const products = await Product.find({ stock: { $gt: 0 } })
      .populate("store", "name logo owner")
      .populate("ratings.user", "username profile.name")
      .sort(sortObj)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments({ stock: { $gt: 0 } });

    res.status(200).json({
      products,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
