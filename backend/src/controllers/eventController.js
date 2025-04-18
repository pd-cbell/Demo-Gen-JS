const eventService = require('../services/eventService');

exports.sendEvents = async (req, res) => {
  try {
    const { organization, filename, routing_key } = req.body;
    // Load and parse events from file
    const events = await eventService.loadEvents(organization, filename);
    // Compute schedule summary for UI
    const schedule_summary = eventService.computeScheduleSummary(events);
    // Process sending events to PagerDuty
    const results = await eventService.processEvents(events, routing_key);
    // Return both schedule summary and send results
    res.json({ schedule_summary, results });
  } catch (error) {
    console.error('Error in sendEvents:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Stream events via Server-Sent Events (SSE) to provide live updates.
 * Expects query parameters: organization, filename, routing_key.
 */
exports.streamEvents = async (req, res) => {
  const axios = require('axios');
  const PAGERDUTY_API_URL = 'https://events.pagerduty.com/v2/enqueue';
  try {
    const { organization, filename, routing_key } = req.query;
    // Load events
    const events = await eventService.loadEvents(organization, filename);
    // Compute schedule summary
    const schedule_summary = eventService.computeScheduleSummary(events);
    // Set SSE response headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders && res.flushHeaders();
    // Send schedule summary as first event
    res.write(`event: schedule\n`);
    res.write(`data: ${JSON.stringify(schedule_summary)}\n\n`);
    // Stream each event send and its repeats
    for (const ev of events) {
      const timing = ev.timing_metadata || {};
      const offset = timing.schedule_offset || 0;
      if (offset) {
        await new Promise(r => setTimeout(r, offset * 1000));
      }
      const action = ev.event_action || 'trigger';
      const payload = { routing_key, event_action: action, payload: ev.payload };
      // Initial send
      let resp = await axios.post(PAGERDUTY_API_URL, payload, { headers: { 'Content-Type': 'application/json' } });
      const initial = { summary: ev.payload.summary || '', status_code: resp.status, response: resp.data, attempt: 'initial' };
      res.write(`event: result\n`);
      res.write(`data: ${JSON.stringify(initial)}\n\n`);
      // Repeat sends
      const repeats = ev.repeat_schedule || [];
      for (const rpt of repeats) {
        const count = rpt.repeat_count || 0;
        const repOffset = rpt.repeat_offset || 0;
        for (let i = 0; i < count; i++) {
          if (repOffset) {
            await new Promise(r => setTimeout(r, repOffset * 1000));
          }
          resp = await axios.post(PAGERDUTY_API_URL, payload, { headers: { 'Content-Type': 'application/json' } });
          const repeatRes = { summary: ev.payload.summary || '', status_code: resp.status, response: resp.data, attempt: `repeat ${i+1}` };
          res.write(`event: result\n`);
          res.write(`data: ${JSON.stringify(repeatRes)}\n\n`);
        }
      }
    }
    // Signal end of stream
    res.write(`event: end\n`);
    res.write(`data: {}\n\n`);
    res.end();
  } catch (error) {
    console.error('Error in streamEvents:', error);
    res.write(`event: error\n`);
    res.write(`data: ${JSON.stringify({ message: error.message })}\n\n`);
    res.end();
  }
};