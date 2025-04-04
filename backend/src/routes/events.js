const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');

// This should be a function
router.post('/send', eventController.sendEvents);

router.get('/', (req, res) => {
  res.json({ message: 'Events endpoint is active.' });
});

module.exports = router;