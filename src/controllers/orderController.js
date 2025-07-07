const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const logger = require('../config/logger');
const axios = require('axios');

exports.createOrder = async (req, res) => {
  const user = req.user; // Assuming req.user is set by auth middleware
  const { customerInfo, deliveryFee, prescriptionUrl } = req.body;

  try {
    // Validate required fields
    if (
      !user ||
      !customerInfo ||
      !customerInfo.name ||
      !customerInfo.email ||
      !customerInfo.phone ||
      !customerInfo.address ||
      !customerInfo.city ||
      !customerInfo.state ||
      !customerInfo.deliveryOption ||
      !customerInfo.pickupLocation ||
      !customerInfo.estimatedDelivery ||
      deliveryFee === undefined
    ) {
      return res.status(400).json({ message: "All required fields must be provided" });
    }

    // Fetch cart
    const cart = await Cart.findOne({ userId: user._id }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    // Calculate total and prepare items
    let total = 0;
    const items = cart.items.map((item) => {
      total += item.productId.price * item.quantity;
      return {
        productId: item.productId._id,
        quantity: item.quantity,
        price: item.productId.price,
      };
    });

    // Validate stock
    for (const item of cart.items) {
      const product = await Product.findById(item.productId);
      if (!product || product.stock < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for ${product?.name || "item"}` });
      }
      product.stock -= item.quantity;
      await product.save();
    }

    // Validate delivery fee
    const expectedDeliveryFee = total > 0
      ? customerInfo.deliveryOption === "express"
        ? 1500
        : customerInfo.deliveryOption === "timeframe" && total < 5000
          ? 500
          : 0
      : 0;

    if (deliveryFee !== expectedDeliveryFee) {
      return res.status(400).json({ message: "Invalid delivery fee" });
    }

    // Calculate total amount
    const totalAmount = total + deliveryFee;

    // Create order
    const order = new Order({
      user: user._id, // Use user instead of userId
      items,
      customerInfo,
      deliveryFee,
      prescriptionUrl,
      totalAmount, // Use totalAmount instead of total
      paymentReference: `OLLAN_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
    });

    const savedOrder = await order.save();

    // Clear cart
    await Cart.findOneAndDelete({ userId: user._id });

    logger.info(`Order created for user: ${user._id}`);
    res.status(201).json({ message: "Order created", order: savedOrder });
  } catch (error) {
    logger.error("Create order error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.uploadPrescription = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const prescriptionUrl = `/uploads/${req.file.filename}`;
    res.json({ prescriptionUrl });
  } catch (error) {
    logger.error('Upload prescription error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.verifyPayment = async (req, res) => {
  const { reference, orderId } = req.body;
  try {
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });
    if (response.data.data.status === 'success') {
      const order = await Order.findByIdAndUpdate(
        orderId,
        { status: 'processing', paymentReference: reference },
        { new: true }
      );
      res.json({ message: 'Payment verified', order });
    } else {
      res.status(400).json({ message: 'Payment verification failed' });
    }
  } catch (error) {
    logger.error('Payment verification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getUserOrders = async (req, res) => {
  const userId = req.user._id;

  try {
    const orders = await Order.find({ userId }).populate('items.productId');
    logger.info(`Orders retrieved for user: ${userId}`);
    res.json(orders);
  } catch (error) {
    logger.error('Get user orders error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().populate('userId items.productId');
    logger.info('All orders retrieved');
    res.json(orders);
  } catch (error) {
    logger.error('Get all orders error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};