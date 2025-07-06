// src/models/Product.js
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    price: { type: Number, required: true },
    stock: { type: Number, required: true },
    category: String,
    image: String,
  },
  { strictPopulate: false } // Allow populating undefined fields
);

module.exports = mongoose.model("Product", productSchema);