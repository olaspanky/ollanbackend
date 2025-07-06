const Product = require("../models/Product");
const logger = require("../config/logger");
const fs = require("fs");
const path = require("path");

exports.createProduct = async (req, res) => {
  const { name, description, price, stock, category } = req.body;
  let savedProduct;
  try {
    if (!name || !price || !stock) {
      if (req.file) {
        const filePath = path.join(__dirname, "../uploads", req.file.filename); // Changed to lowercase uploads
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          logger.info(`Cleaned up file: ${filePath}`);
        }
      }
      return res.status(400).json({ message: "Name, price, and stock are required" });
    }
    console.log("Uploaded file:", req.file); // Debug file details
    if (req.file) {
      const filePath = path.join(__dirname, "../uploads", req.file.filename); // Changed to lowercase uploads
      console.log("Checking file at:", filePath); // Debug
      if (!fs.existsSync(filePath)) {
        logger.error(`File not found after upload: ${filePath}`);
        return res.status(500).json({ message: "File upload failed" });
      }
    }
    savedProduct = await new Product({
      name,
      description,
      price: parseFloat(price),
      stock: parseInt(stock),
      category,
      image: req.file ? `/uploads/${req.file.filename}` : null, // Changed to lowercase uploads
      createdBy: req.user ? req.user.id : null,
    }).save();
    logger.info(`Product created: ${name} by user ${req.user ? req.user.id : "unknown"}`);
    res.status(201).json({ message: "Product created", product: savedProduct });
  } catch (error) {
    if (req.file && !savedProduct) {
      const filePath = path.join(__dirname, "../uploads", req.file.filename); // Changed to lowercase uploads
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info(`Cleaned up file on error: ${filePath}`);
      }
    }
    logger.error("Create product error:", error);
    res.status(500).json({ message: "Server error" });
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