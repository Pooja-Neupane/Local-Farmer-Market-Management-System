const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { requireRole } = require('../middleware/auth');
const { myProducts, addProduct, updateProduct, deleteProduct, orders, sales, notifications, markNotification } = require('../controllers/farmerController');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || '');
    cb(null, unique + ext);
  },
});
const upload = multer({ storage });

router.get('/products', requireRole('farmer'), myProducts);
router.post('/products', requireRole('farmer'), upload.single('image'), addProduct);
router.put('/products', requireRole('farmer'), updateProduct);
router.delete('/products', requireRole('farmer'), deleteProduct);
router.get('/orders', requireRole('farmer'), orders);
router.get('/sales', requireRole('farmer'), sales);
router.get('/notifications', requireRole('farmer'), notifications);
router.post('/notifications/read', requireRole('farmer'), markNotification);

module.exports = router;
