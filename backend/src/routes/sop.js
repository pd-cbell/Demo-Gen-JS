const express = require('express');
const router = express.Router();
const sopController = require('../controllers/sopController');

// POST /api/generate_sop
router.post('/', sopController.handleGenerateSop);

module.exports = router;