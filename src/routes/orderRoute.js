const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const upload = require('../middleware/upload');
const roleMiddleware = require('../middleware/roleMiddleware');
const redisClient = require('../redis');
const logger = require('../config/logger');

// Handle preflight OPTIONS request
router.options('/stream', (req, res) => {
  const allowedOrigins = [
    'https://www.ollanpharmacy.ng',
    'http://localhost:3000',
  ];

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true'); // if you need cookies/headers
  res.status(204).end();
});


router.get('/stream', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', 'https://www.ollanpharmacy.ng');
  // Remove Access-Control-Allow-Credentials unless using cookies
  // res.setHeader('Access-Control-Allow-Credentials', 'true');

  const channel = 'orders:updates';
  const heartbeatInterval = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 5000);

  let subscriber;
  try {
    if (redisClient.status !== 'ready') {
      await redisClient.connect();
    }

    subscriber = redisClient.duplicate();
    subscriber.on('connect', () => {
      logger.info('Redis subscriber connected successfully');
    });

    subscriber.on('error', (error) => {
      logger.error(`Redis subscriber error: ${error.message}`);
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Failed to stream updates' })}\n\n`);
    });

    await subscriber.subscribe(channel);
    subscriber.on('message', (channel, message) => {
      res.write(`data: ${message}\n\n`);
    });

    req.on('close', async () => {
      try {
        if (subscriber) {
          await subscriber.unsubscribe(channel);
          await subscriber.quit();
          logger.info('Redis subscriber disconnected');
        }
      } catch (err) {
        logger.error(`Error closing Redis subscriber: ${err.message}`);
      }
      clearInterval(heartbeatInterval);
      res.end();
    });

    req.socket.on('error', (err) => {
      logger.error(`SSE socket error: ${err.message}`);
      clearInterval(heartbeatInterval);
      res.end();
    });
  } catch (error) {
    logger.error(`SSE setup error: ${error.message}`);
    res.write(`event: error\ndata: ${JSON.stringify({ message: 'Failed to stream updates' })}\n\n`);
    clearInterval(heartbeatInterval);
    if (subscriber) {
      subscriber.quit();
    }
    res.end();
  }
});

router.get('/test-token', authMiddleware, (req, res) => {
  res.json({
    message: 'Token works!',
    user: req.user.email,
    source: req.query.token ? 'query' : 'header',
  });
});

router.post('/create', authMiddleware, orderController.createOrder);
router.post('/upload-prescription', authMiddleware, upload.single('prescription'), orderController.uploadPrescription);
router.post('/verify-payment', authMiddleware, orderController.verifyPayment);
router.get('/my-orders', authMiddleware, orderController.getUserOrders);
router.get('/all', authMiddleware, adminMiddleware, orderController.getAllOrders);
router.get('/admin-orders', authMiddleware, roleMiddleware(['admin']), orderController.getAdminOrders);
router.post('/update-order-status', authMiddleware, roleMiddleware(['admin']), orderController.updateOrderStatus);
router.get('/rider-orders', authMiddleware, roleMiddleware(['rider']), orderController.getRiderOrders);
router.post('/update-delivery-status', authMiddleware, roleMiddleware(['rider']), orderController.updateDeliveryStatus);
router.post('/assign-order', authMiddleware, roleMiddleware(['admin']), orderController.assignOrder);
router.get('/riders', authMiddleware, roleMiddleware(['admin']), orderController.getRiders);

module.exports = router;