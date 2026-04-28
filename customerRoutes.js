const express = require('express');
const { requireRole } = require('../middleware/auth');
const { listProducts, categories, farmers, checkout, orderHistory, addReview, notifications, markNotification, profile, updateProfile } = require('../controllers/customerController');

const router = express.Router();

router.get('/products', requireRole('customer'), listProducts);
router.get('/categories', requireRole('customer'), categories);
router.get('/farmers', requireRole('customer'), farmers);
router.post('/checkout', requireRole('customer'), checkout);
router.get('/orders', requireRole('customer'), orderHistory);
router.post('/reviews', requireRole('customer'), addReview);
router.get('/notifications', requireRole('customer'), notifications);
router.post('/notifications/read', requireRole('customer'), markNotification);
router.get('/profile', requireRole('customer'), profile);
router.post('/profile', requireRole('customer'), updateProfile);

module.exports = router;
