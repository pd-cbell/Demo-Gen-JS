const eventService = require('../services/eventService');

exports.sendEvents = async (req, res) => {
  try {
    const { organization, filename, routing_key } = req.body;
    const events = await eventService.loadEvents(organization, filename);
    const results = await eventService.processEvents(events, routing_key);
    res.json({ results });
  } catch (error) {
    console.error('Error in sendEvents:', error);
    res.status(500).json({ error: error.message });
  }
};