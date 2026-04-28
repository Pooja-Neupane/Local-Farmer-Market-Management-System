const express = require('express');
const { requireRole } = require('../middleware/auth');
const { pendingFarmers, approveFarmer, rejectFarmer, users, products, deleteProduct, updateUserStatus, orders, reports } = require('../controllers/adminController');

const router = express.Router();

router.get('/pending-farmers', requireRole('admin'), pendingFarmers);
router.post('/approve-farmer', requireRole('admin'), approveFarmer);
router.post('/reject-farmer', requireRole('admin'), rejectFarmer);
router.get('/users', requireRole('admin'), users);
router.get('/products', requireRole('admin'), products);
router.post('/products/delete', requireRole('admin'), deleteProduct);
router.post('/users/status', requireRole('admin'), updateUserStatus);
router.get('/orders', requireRole('admin'), orders);
router.get('/reports', requireRole('admin'), reports);

module.exports = router;
