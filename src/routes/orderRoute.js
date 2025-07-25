const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const upload = require('../middleware/upload');
const roleMiddleware = require('../middleware/roleMiddleware');

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

// const express = require('express');
// const router = express.Router();
// const orderController = require('../controllers/orderController');
// const authMiddleware = require('../middleware/auth');
// const roleMiddleware = require('../middleware/roleMiddleware');
// const upload = require('../middleware/upload');

// router.post('/create', authMiddleware, orderController.createOrder);
// router.post('/upload-prescription', authMiddleware, orderController.uploadPrescription);
// router.post('/verify-payment', authMiddleware, orderController.verifyPayment);
// router.get('/my-orders', authMiddleware, orderController.getUserOrders);
// router.get('/all', authMiddleware, roleMiddleware(['admin', 'seller']), orderController.getAllOrders);
// router.get('/seller-orders', authMiddleware, roleMiddleware(['seller']), orderController.getSellerOrders);
// router.post('/update-order-status', authMiddleware, roleMiddleware(['seller']), orderController.updateOrderStatus);
// router.get('/rider-orders', authMiddleware, roleMiddleware(['rider']), orderController.getRiderOrders);
// router.post('/update-delivery-status', authMiddleware, roleMiddleware(['rider']), orderController.updateDeliveryStatus);
// router.post('/assign-order', authMiddleware, roleMiddleware(['admin', 'seller']), orderController.assignOrder);

// module.exports = router;