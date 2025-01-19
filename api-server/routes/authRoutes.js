const express = require('express');
const { checkUser } = require('../controllers/authController');
const router = express.Router();
router.get('/', checkUser);
module.exports = router;