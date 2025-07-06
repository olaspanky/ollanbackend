const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { getIO } = require('../utils/socket');
const logger = require('../config/logger');
const axios = require('axios');

exports.createOrder = async (req, res) => {
  const userId = req.user._id;
  const { customerInfo, prescriptionUrl } = req.body;
  const io = getIO();

  try {
    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    let total = 0;
    const items = cart.items.map(item => {
      total += item.productId.price * item.quantity;
      return {
        productId: item.productId._id,
        quantity: item.quantity,
        price: item.productId.price,
      };
    });

    for (const item of cart.items) {
      const product = await Product.findById(item.productId);
      if (product.stock < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for ${product.name}` });
      }
      product.stock -= item.quantity;
      await product.save();
    }

    const order = new Order({
      userId,
      items,
      total,
      customerInfo,
      prescriptionUrl,
      paymentReference: `OLLAN_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
    });
    await order.save();

    await Cart.findOneAndDelete({ userId });

    io.to('admin').emit('newOrder', order);
    logger.info(`Order created for user: ${userId}`);
    res.json({ message: 'Order created', order });
  } catch (error) {
    logger.error('Create order error:', error);
    res.status(500).json({ message: 'Server error' });
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