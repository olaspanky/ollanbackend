// src/routes/productRoute.js
const express = require("express");
const router = express.Router();
const { createProduct, getProducts } = require("../controllers/productController");
const { authMiddleware, adminMiddleware } = require("../middleware/auth");
const upload = require("../middleware/upload");

router.post("/create", authMiddleware, adminMiddleware, upload.single("image"), createProduct);
router.get("/", getProducts);

module.exports = router;