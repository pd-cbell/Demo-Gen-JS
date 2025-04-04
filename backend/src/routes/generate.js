// src/routes/generate.js
const express = require('express');
const router = express.Router();
const generateController = require('../controllers/generateController');

// POST /api/generate
router.post('/', generateController.handleGenerate);

module.exports = router;