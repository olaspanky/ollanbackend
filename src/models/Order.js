const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  items: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
      quantity: { type: Number, required: true },
      price: { type: Number, required: true },
    },
  ],
  customerInfo: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    deliveryOption: { type: String, required: true },
    pickupLocation: { type: String, required: true },
    estimatedDelivery: { type: String, required: true },
  },
  deliveryFee: { type: Number, required: true },
  prescriptionUrl: { type: String },
  totalAmount: { type: Number, required: true },
  paymentReference: { type: String },
  status: { type: String, default: "pending" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Order", orderSchema);