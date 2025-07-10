// const Order = require('../models/Order');
// const Cart = require('../models/Cart');
// const Product = require('../models/Product');
// const logger = require('../config/logger');
// const axios = require('axios');

// exports.createOrder = async (req, res) => {
//   const user = req.user; // Assuming req.user is set by auth middleware
//   const { customerInfo, deliveryFee, prescriptionUrl } = req.body;

//   try {
//     // Validate required fields
//     if (
//       !user ||
//       !customerInfo ||
//       !customerInfo.name ||
//       !customerInfo.email ||
//       !customerInfo.phone ||
//       !customerInfo.deliveryOption ||
//       !customerInfo.pickupLocation ||
//       !customerInfo.estimatedDelivery ||
//       deliveryFee === undefined
//     ) {
//       return res.status(400).json({ message: "All required fields must be provided" });
//     }

//     // Fetch cart
//     const cart = await Cart.findOne({ userId: user._id }).populate("items.productId");
//     if (!cart || cart.items.length === 0) {
//       return res.status(400).json({ message: "Cart is empty" });
//     }

//     // Calculate total and prepare items
//     let total = 0;
//     const items = cart.items.map((item) => {
//       total += item.productId.price * item.quantity;
//       return {
//         productId: item.productId._id,
//         quantity: item.quantity,
//         price: item.productId.price,
//       };
//     });

//     // Validate stock
//     for (const item of cart.items) {
//       const product = await Product.findById(item.productId);
//       if (!product || product.stock < item.quantity) {
//         return res.status(400).json({ message: `Insufficient stock for ${product?.name || "item"}` });
//       }
//       product.stock -= item.quantity;
//       await product.save();
//     }

//     // Validate delivery fee
//     const expectedDeliveryFee = total > 0
//       ? customerInfo.deliveryOption === "express"
//         ? 1500
//         : customerInfo.deliveryOption === "timeframe" && total < 5000
//           ? 500
//           : 0
//       : 0;

//     if (deliveryFee !== expectedDeliveryFee) {
//       return res.status(400).json({ message: "Invalid delivery fee" });
//     }

//     // Calculate total amount
//     const totalAmount = total + deliveryFee;

//     // Create order
//     const order = new Order({
//       user: user._id, // Use user instead of userId
//       items,
//       customerInfo,
//       deliveryFee,
//       prescriptionUrl,
//       totalAmount, // Use totalAmount instead of total
//       paymentReference: `OLLAN_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
//     });

//     const savedOrder = await order.save();

//     // Clear cart
//     await Cart.findOneAndDelete({ userId: user._id });

//     logger.info(`Order created for user: ${user._id}`);
//     res.status(201).json({ message: "Order created", order: savedOrder });
//   } catch (error) {
//     logger.error("Create order error:", error);
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };

// exports.uploadPrescription = async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ message: 'No file uploaded' });
//     }
//     const prescriptionUrl = `https://ollanbackend.vercel.app/uploads/${req.file.filename}`;
//     res.json({ prescriptionUrl });
//   } catch (error) {
//     logger.error('Upload prescription error:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// };

// exports.verifyPayment = async (req, res) => {
//   const { reference, orderId } = req.body;

//   // Validate inputs
//   if (!reference || !orderId) {
//     logger.error(`Missing required fields: reference=${reference}, orderId=${orderId}`);
//     return res.status(400).json({ message: "Reference and orderId are required" });
//   }

//   try {
//     // Verify Paystack secret key exists
//     if (!process.env.PAYSTACK_SECRET_KEY) {
//       logger.error("PAYSTACK_SECRET_KEY is not set in environment variables");
//       return res.status(500).json({ message: "Server configuration error: Missing Paystack secret key" });
//     }

//     // Verify Paystack transaction
//     const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
//       headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
//     });

//     if (response.data.status !== true || response.data.data.status !== "success") {
//       logger.error(`Payment verification failed for reference: ${reference}, response: ${JSON.stringify(response.data)}`);
//       return res.status(400).json({ message: "Payment verification failed" });
//     }

//     // Verify order exists
//     const order = await Order.findById(orderId);
//     if (!order) {
//       logger.error(`Order not found for orderId: ${orderId}`);
//       return res.status(400).json({ message: "Order not found" });
//     }

//     // Update order
//     const updatedOrder = await Order.findByIdAndUpdate(
//       orderId,
//       { status: "processing", paymentReference: reference },
//       { new: true }
//     );

//     logger.info(`Payment verified for order: ${orderId}, reference: ${reference}`);
//     res.json({ message: "Payment verified", order: updatedOrder });
//   } catch (error) {
//     logger.error(`Payment verification error: ${error.message}`, {
//       reference,
//       orderId,
//       stack: error.stack,
//     });
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };

// exports.getUserOrders = async (req, res) => {
//   const userEmail = req.user.email; // Assuming req.user.email is set by auth middleware

//   try {
//     // Validate email
//     if (!userEmail) {
//       logger.error("User email not provided in request");
//       return res.status(400).json({ message: "User email is required" });
//     }

//     // Find orders where customerInfo.email matches the user's email
//     const orders = await Order.find({ "customerInfo.email": userEmail }).populate("items.productId");
//     logger.info(`Orders retrieved for user email: ${userEmail}`);
//     res.json(orders);
//   } catch (error) {
//     logger.error(`Get user orders error for email ${userEmail}: ${error.message}`, { stack: error.stack });
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };

// exports.getAllOrders = async (req, res) => {
//   try {
//     const orders = await Order.find().populate('userId items.productId');
//     logger.info('All orders retrieved');
//     res.json(orders);
//   } catch (error) {
//     logger.error('Get all orders error:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// };

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

    // Clean up cart items with null productId
    const validCartItems = cart.items.filter(item => {
      if (!item.productId) {
        logger.warn(`Removing invalid cart item for user ${user._id}:`, item);
        return false;
      }
      if (!item.productId.price || item.productId.price <= 0) {
        logger.warn(`Removing cart item with invalid price for user ${user._id}:`, item);
        return false;
      }
      return true;
    });

    // Update cart with only valid items if needed
    if (validCartItems.length !== cart.items.length) {
      cart.items = validCartItems;
      await cart.save();
      logger.info(`Cleaned up cart for user ${user._id}`);
    }

    // Check if we have valid items after cleanup
    if (validCartItems.length === 0) {
      return res.status(400).json({ message: "Cart contains no valid items" });
    }

    // Calculate total and prepare items
    let total = 0;
    const items = validCartItems.map((item) => {
      try {
        const itemTotal = item.productId.price * item.quantity;
        total += itemTotal;
        return {
          productId: item.productId._id,
          quantity: item.quantity,
          price: item.productId.price,
        };
      } catch (error) {
        logger.error(`Error processing cart item for user ${user._id}:`, error);
        return null;
      }
    }).filter(item => item !== null); // Remove any null items

    // Final check for valid items
    if (items.length === 0) {
      return res.status(400).json({ message: "No valid items could be processed" });
    }

    // Validate stock
    for (const item of validCartItems) {
      try {
        const product = await Product.findById(item.productId._id);
        if (!product) {
          return res.status(400).json({ message: `Product ${item.productId.name || 'unknown'} not found` });
        }
        if (product.stock < item.quantity) {
          return res.status(400).json({ message: `Insufficient stock for ${product.name}` });
        }
        product.stock -= item.quantity;
        await product.save();
      } catch (error) {
        logger.error(`Stock validation error for product ${item.productId._id}:`, error);
        return res.status(500).json({ message: "Error validating stock" });
      }
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

  // Validate inputs
  if (!reference || !orderId) {
    logger.error(`Missing required fields: reference=${reference}, orderId=${orderId}`);
    return res.status(400).json({ message: "Reference and orderId are required" });
  }

  try {
    // Verify Paystack secret key exists
    if (!process.env.PAYSTACK_SECRET_KEY) {
      logger.error("PAYSTACK_SECRET_KEY is not set in environment variables");
      return res.status(500).json({ message: "Server configuration error: Missing Paystack secret key" });
    }

    // Verify Paystack transaction
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });

    if (response.data.status !== true || response.data.data.status !== "success") {
      logger.error(`Payment verification failed for reference: ${reference}, response: ${JSON.stringify(response.data)}`);
      return res.status(400).json({ message: "Payment verification failed" });
    }

    // Verify order exists
    const order = await Order.findById(orderId);
    if (!order) {
      logger.error(`Order not found for orderId: ${orderId}`);
      return res.status(400).json({ message: "Order not found" });
    }

    // Update order
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { status: "processing", paymentReference: reference },
      { new: true }
    );

    logger.info(`Payment verified for order: ${orderId}, reference: ${reference}`);
    res.json({ message: "Payment verified", order: updatedOrder });
  } catch (error) {
    logger.error(`Payment verification error: ${error.message}`, {
      reference,
      orderId,
      stack: error.stack,
    });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getUserOrders = async (req, res) => {
  const userEmail = req.user.email; // Assuming req.user.email is set by auth middleware

  try {
    // Validate email
    if (!userEmail) {
      logger.error("User email not provided in request");
      return res.status(400).json({ message: "User email is required" });
    }

    // Find orders where customerInfo.email matches the user's email
    const orders = await Order.find({ "customerInfo.email": userEmail }).populate("items.productId");
    logger.info(`Orders retrieved for user email: ${userEmail}`);
    res.json(orders);
  } catch (error) {
    logger.error(`Get user orders error for email ${userEmail}: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: "Server error", error: error.message });
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

// Utility function to clean up invalid cart items (can be called periodically)
exports.cleanupInvalidCartItems = async () => {
  try {
    const carts = await Cart.find().populate("items.productId");
    
    for (const cart of carts) {
      const validItems = cart.items.filter(item => {
        return item.productId && item.productId.price && item.productId.price > 0;
      });
      
      if (validItems.length !== cart.items.length) {
        cart.items = validItems;
        await cart.save();
        logger.info(`Cleaned up cart for user ${cart.userId}`);
      }
    }
    
    logger.info('Cart cleanup completed');
  } catch (error) {
    logger.error('Cart cleanup error:', error);
  }
};