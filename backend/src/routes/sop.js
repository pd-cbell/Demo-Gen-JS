const express = require('express');
const router = express.Router();
const sopController = require('../controllers/sopController');

// POST /api/generate_sop
router.post('/', sopController.handleGenerateSop);
// POST /api/generate_sop/inline - generate SOP directly from provided event data
router.post('/inline', sopController.handleGenerateSopInline);
// POST /api/generate_sop/blended - generate a blended SOP for multiple selected events
router.post('/blended', sopController.handleGenerateSopBlended);

module.exports = router;