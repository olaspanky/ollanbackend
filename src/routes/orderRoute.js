const express = require('express');
const router = express.Router();

const orderController = require('../controllers/orderController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/create', authMiddleware, orderController.createOrder);
router.post('/upload-prescription', authMiddleware, upload.single('prescription'), orderController.uploadPrescription);
router.post('/verify-payment', authMiddleware, orderController.verifyPayment);
router.get('/my-orders', authMiddleware, orderController.getUserOrders);
router.get('/all', authMiddleware, adminMiddleware, orderController.getAllOrders);

module.exports = router;
