

const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const User = require('../models/User');
const logger = require('../config/logger');
const axios = require('axios');
const emailService = require('../config/emailService'); // Updated import

async function sendOrderNotification(order, status, additionalInfo = '') {
  try {
    const email = order.customerInfo.email;
    const customerName = order.customerInfo.name;
    const orderId = order._id.toString().slice(-6); // Use last 6 characters for brevity

    await emailService.sendOrderStatusUpdate(email, customerName, orderId, status, additionalInfo);
  } catch (error) {
    logger.error('Email notification failed:', error);
    // Don't throw error to avoid breaking the main order flow
  }
}

exports.createOrder = async (req, res) => {
  const user = req.user;
  const { customerInfo, deliveryFee, prescriptionUrl } = req.body;

  try {
    if (
      !user ||
      !customerInfo ||
      !customerInfo.name ||
      !customerInfo.email ||
      !customerInfo.phone ||
      deliveryFee === undefined
    ) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    const cart = await Cart.findOne({ userId: user._id }).populate('items.productId');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    let total = 0;
    const items = cart.items.map((item) => {
      total += item.productId.price * item.quantity;
      return {
        productId: item.productId._id,
        quantity: item.quantity,
        price: item.productId.price,
      };
    });

    for (const item of cart.items) {
      const product = await Product.findById(item.productId);
      if (!product || product.stock < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for ${product?.name || 'item'}` });
      }
      product.stock -= item.quantity;
      await product.save();
    }

    const expectedDeliveryFee = total > 0
      ? customerInfo.deliveryOption === 'express'
        ? 1500
        : customerInfo.deliveryOption === 'timeframe' && total < 5000
          ? 500
          : 0
      : 0;

    if (deliveryFee !== expectedDeliveryFee) {
      return res.status(400).json({ message: 'Invalid delivery fee' });
    }

    const totalAmount = total + deliveryFee;

   const order = new Order({
  user: user._id,
  items,
  customerInfo,
  deliveryFee,
  prescriptionUrl,
  totalAmount,
  paymentReference: `OLLAN_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
  status: 'pending', // Explicitly set initial status
});

    const savedOrder = await order.save();
    await Cart.findOneAndDelete({ userId: user._id });

    logger.info(`Order created for user: ${user._id}`);
    res.status(201).json({ message: 'Order created', order: savedOrder });
  } catch (error) {
    logger.error('Create order error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
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
  const { orderId, paymentDetails } = req.body;
  const adminId = req.user._id;

  if (!orderId) {
    logger.error(`Missing required field: orderId=${orderId}`);
    return res.status(400).json({ message: 'Order ID is required' });
  }

  try {
    // Ensure only admins can verify payments
    if (req.user.role !== 'admin') {
      logger.error(`Unauthorized payment verification attempt by user: ${adminId}`);
      return res.status(403).json({ message: 'Unauthorized: Only admins can verify payments' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      logger.error(`Order not found for orderId: ${orderId}`);
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.status !== 'pending') {
      logger.error(`Order ${orderId} is not in pending status: ${order.status}`);
      return res.status(400).json({ message: 'Order is not in pending status' });
    }

    // Update order with payment details and set status to 'processing'
    order.status = 'processing';
    order.paymentDetails = paymentDetails || 'Manually verified by seller'; // Store payment details if provided
    order.paymentReference = order.paymentReference || `MANUAL_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;

    const updatedOrder = await order.save();

    // Send email notification
    await sendOrderNotification(updatedOrder, 'processing', paymentDetails);

    logger.info(`Payment manually verified for order: ${orderId} by admin: ${adminId}`);
    res.json({ message: 'Payment manually verified', order: updatedOrder });
  } catch (error) {
    logger.error(`Manual payment verification error: ${error.message}`, { orderId, stack: error.stack });
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getUserOrders = async (req, res) => {
  const userEmail = req.user.email;

  try {
    if (!userEmail) {
      logger.error('User email not provided in request');
      return res.status(400).json({ message: 'User email is required' });
    }

    const orders = await Order.find({ 'customerInfo.email': userEmail }).populate('items.productId');
    logger.info(`Orders retrieved for user email: ${userEmail}`);
    res.json(orders);
  } catch (error) {
    logger.error(`Get user orders error for email ${userEmail}: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().populate('user items.productId');
    logger.info('All orders retrieved');
    res.json(orders);
  } catch (error) {
    logger.error('Get all orders error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// exports.getAdminOrders = async (req, res) => {
//   const adminId = req.user._id;

//   try {
//     const orders = await Order.find({ status: { $ne: 'pending' } })
//       .populate('items.productId')
//       .populate('user', 'name email')
//       .populate('rider', 'name');
//     logger.info(`Orders retrieved for admin: ${adminId}`);
//     res.json(orders);
//   } catch (error) {
//     logger.error(`Get admin orders error: ${error.message}`);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// };

exports.getAdminOrders = async (req, res) => {
  const adminId = req.user._id;

  try {
    const orders = await Order.find()
      .populate('items.productId')
      .populate('user', 'name email')
      .populate('rider', 'name');
    logger.info(`Orders retrieved for admin: ${adminId}`);
    res.json(orders);
  } catch (error) {
    logger.error(`Get admin orders error: ${error.message}`);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  const { orderId, action } = req.body;
  const adminId = req.user._id;

  try {
    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized: Only admins can modify orders' });
    }

    // Removed the status check to allow modifications for any order status
    order.status = action === 'accept' ? 'accepted' : 'rejected';
    let additionalInfo = '';

    if (action === 'reject') {
      additionalInfo = 'Please contact customer service for more information.';
      for (const item of order.items) {
        const product = await Product.findById(item.productId);
        if (product) {
          product.stock += item.quantity;
          await product.save();
        }
      }
    }

    const updatedOrder = await order.save();
    await sendOrderNotification(updatedOrder, order.status, additionalInfo);

    logger.info(`Order ${orderId} ${action}ed by admin ${adminId}`);
    res.json({ message: `Order ${action}ed`, order: updatedOrder });
  } catch (error) {
    logger.error(`Update order status error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
exports.updateDeliveryStatus = async (req, res) => {
  const { orderId, deliveryStatus } = req.body;
  const riderId = req.user._id;

  try {
    if (!['en_route', 'delivered'].includes(deliveryStatus)) {
      return res.status(400).json({ message: 'Invalid delivery status' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.rider.toString() !== riderId.toString()) {
      return res.status(403).json({ message: 'Unauthorized to modify this order' });
    }

    if (order.deliveryStatus === 'delivered') {
      return res.status(400).json({ message: 'Order already delivered' });
    }

    order.deliveryStatus = deliveryStatus;
    const updatedOrder = await order.save();

    // Send email notification
    await sendOrderNotification(updatedOrder, deliveryStatus);

    logger.info(`Delivery status updated to ${deliveryStatus} for order ${orderId} by rider ${riderId}`);
    res.json({ message: 'Delivery status updated', order: updatedOrder });
  } catch (error) {
    logger.error(`Update delivery status error: ${error.message}`);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getRiderOrders = async (req, res) => {
  const riderId = req.user._id;

  try {
    const orders = await Order.find({ rider: riderId, status: 'accepted' })
      .populate('items.productId')
      .populate('user', 'name email');
    logger.info(`Orders retrieved for rider: ${riderId}`);
    res.json(orders);
  } catch (error) {
    logger.error(`Get rider orders error: ${error.message}`);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.assignOrder = async (req, res) => {
  const { orderId, riderId } = req.body;

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized: Only admins can assign orders' });
    }

    if (riderId) {
      const rider = await User.findById(riderId);
      if (!rider || rider.role !== 'rider') {
        return res.status(400).json({ message: 'Invalid rider' });
      }
      order.rider = riderId;
      order.riderName = rider.name; // Add riderName to the order
    }

    const updatedOrder = await order.save();
    logger.info(`Order ${orderId} assigned to rider ${riderId} by admin ${req.user._id}`);
    res.json({ message: 'Order assigned', order: updatedOrder });
  } catch (error) {
    logger.error(`Assign order error: ${error.message}`);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getRiders = async (req, res) => {
  try {
    const riders = await User.find({ role: 'rider' }).select('_id name');
    logger.info('Riders retrieved');
    res.json(riders);
  } catch (error) {
    logger.error(`Get riders error: ${error.message}`);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};