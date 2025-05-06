const express = require('express');
const router = express.Router();
const diagnosticsController = require('../controllers/diagnosticsController');

// POST /api/generate_diagnostics
router.post('/', diagnosticsController.handleGenerateDiagnostics);

module.exports = router;