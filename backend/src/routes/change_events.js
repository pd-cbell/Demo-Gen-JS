const express = require('express');
const router = express.Router();
const changeEventsController = require('../controllers/changeEventsController');

// POST /api/generate_change_events
router.post('/', changeEventsController.handleGenerateChangeEvents);

module.exports = router;
