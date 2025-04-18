const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');

// Endpoint for batch send (non-streaming)
router.post('/send', eventController.sendEvents);
// SSE endpoint for streaming event sends and live updates
router.get('/stream', eventController.streamEvents);

router.get('/', (req, res) => {
  res.json({ message: 'Events endpoint is active.' });
});

module.exports = router;