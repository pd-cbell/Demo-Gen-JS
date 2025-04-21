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
    // Asynchronously schedule each event send and its repeats
    const sendTasks = [];
    let maxDelay = 0;
    for (const ev of events) {
      const timing = ev.timing_metadata || {};
      const scheduleOffsetMs = (timing.schedule_offset || 0) * 1000;
      const repeats = ev.repeat_schedule || [];
      const action = ev.event_action || 'trigger';
      const payload = { routing_key, event_action: action, payload: ev.payload };
      const summary = ev.payload.summary || '';

      // Initial send task
      sendTasks.push({ delay: scheduleOffsetMs, attempt: 'initial', summary, payload });
      maxDelay = Math.max(maxDelay, scheduleOffsetMs);

      // Repeat send tasks
      for (const rpt of repeats) {
        const count = rpt.repeat_count || 0;
        const repOffsetMs = (rpt.repeat_offset || 0) * 1000;
        for (let i = 1; i <= count; i++) {
          const delay = scheduleOffsetMs + repOffsetMs * i;
          sendTasks.push({ delay, attempt: `repeat ${i}`, summary, payload });
          maxDelay = Math.max(maxDelay, delay);
        }
      }
    }
    // Schedule all tasks
    for (const task of sendTasks) {
      setTimeout(async () => {
        try {
          const resp = await axios.post(PAGERDUTY_API_URL, task.payload, { headers: { 'Content-Type': 'application/json' } });
          const result = { summary: task.summary, status_code: resp.status, response: resp.data, attempt: task.attempt };
          res.write(`event: result\n`);
          res.write(`data: ${JSON.stringify(result)}\n\n`);
        } catch (error) {
          const errResult = { summary: task.summary, error: error.message, attempt: task.attempt };
          res.write(`event: result\n`);
          res.write(`data: ${JSON.stringify(errResult)}\n\n`);
        }
      }, task.delay);
    }
    // Signal end of stream after all tasks have been scheduled
    setTimeout(() => {
      res.write(`event: end\n`);
      res.write(`data: {}\n\n`);
      res.end();
    }, maxDelay + 1000);
  } catch (error) {
    console.error('Error in streamEvents:', error);
    res.write(`event: error\n`);
    res.write(`data: ${JSON.stringify({ message: error.message })}\n\n`);
    res.end();
  }
};