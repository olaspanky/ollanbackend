// backend/controllers/products.js
const Uploadcare = require("uploadcare")(process.env.UPLOADCARE_PUBLIC_KEY, process.env.UPLOADCARE_SECRET_KEY);
const Product = require("../models/Product");
const logger = require("../config/logger");

exports.createProduct = async (req, res) => {
  const { name, description, price, stock, category } = req.body;
  let savedProduct;

  try {
    // Validate required fields
    if (!name || !price || !stock) {
      return res.status(400).json({ message: "Name, price, and stock are required" });
    }

    let imageUrl = null;
    if (req.file) {
      // Upload image to Uploadcare
      const file = await Uploadcare.upload(req.file.buffer, {
        store: "auto",
        metadata: { uploaded_by: req.user ? req.user.id : "unknown" },
      });
      imageUrl = file.original_file_url;
      logger.info(`Image uploaded to Uploadcare: ${imageUrl}`);
    }

    // Create and save product
    savedProduct = await new Product({
      name,
      description,
      price: parseFloat(price),
      stock: parseInt(stock),
      category: category || undefined,
      image: imageUrl,
      createdBy: req.user ? req.user.id : null,
    }).save();

    logger.info(`Product created: ${name} by user ${req.user ? req.user.id : "unknown"}`);
    res.status(201).json({ message: "Product created", product: savedProduct });
  } catch (error) {
    logger.error("Create product error:", error);
    res.status(500).json({ message: error.message || "Server error" });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find().populate("createdBy", "name email");
    logger.info("Products retrieved");
    res.json(products);
  } catch (error) {
    logger.error("Get products error:", error);
    res.status(500).json({ message: "Server error" });
  }
};