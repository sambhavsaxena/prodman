const express = require('express');
const { fetchLogs } = require('../controllers/logsController');
const router = express.Router();
router.get('/:id', fetchLogs);
module.exports = router;