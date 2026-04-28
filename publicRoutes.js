const express = require('express');
const { contact } = require('../controllers/publicController');

const router = express.Router();

router.post('/contact', contact);

module.exports = router;
