const express = require('express');
const { deployProject } = require('../controllers/deploymentController');
const router = express.Router();
router.post('/', deployProject);
module.exports = router;