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
  const PAGERDUTY_CHANGE_URL = 'https://events.pagerduty.com/v2/change/enqueue';
  // Initialize SSE headers before attempting to load events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();
  try {
    const { organization, filename, routing_key } = req.query;
    // Load events
    const events = await eventService.loadEvents(organization, filename);
    // Compute schedule summary
    const schedule_summary = eventService.computeScheduleSummary(events);
    // Send schedule summary as first event
    res.write(`event: schedule\n`);
    res.write(`data: ${JSON.stringify(schedule_summary)}\n\n`);
    // Build send tasks for each event and its repeats
    const sendTasks = [];
    for (const ev of events) {
      const isChange = ev.hasOwnProperty('routing_key') || ev.hasOwnProperty('links');
      // Determine schedule offset (supports both nested payload and top-level timing_metadata)
      const scheduleOffsetSec = ev.payload?.timing_metadata?.schedule_offset
        ?? ev.timing_metadata?.schedule_offset
        ?? 0;
      const scheduleOffsetMs = scheduleOffsetSec * 1000;
      const summary = ev.payload?.summary || '';
      if (isChange) {
        // Change event: only initial send
        const changeEvent = { ...ev, routing_key };
        sendTasks.push({ delay: scheduleOffsetMs, attempt: 'initial', summary, payload: changeEvent, url: PAGERDUTY_CHANGE_URL });
      } else {
        // Incident event: initial send
        const action = ev.event_action || 'trigger';
        const payload = { routing_key, event_action: action, payload: ev.payload };
        sendTasks.push({ delay: scheduleOffsetMs, attempt: 'initial', summary, payload, url: PAGERDUTY_API_URL });
        // Repeats
        // Determine repeat schedule (nested payload or top-level)
        const repeats = Array.isArray(ev.payload?.repeat_schedule)
          ? ev.payload.repeat_schedule
          : Array.isArray(ev.repeat_schedule)
            ? ev.repeat_schedule
            : [];
        for (const rpt of repeats) {
          const count = rpt.repeat_count || 0;
          const repOffsetMs = (rpt.repeat_offset || 0) * 1000;
          for (let i = 1; i <= count; i++) {
            const delay = scheduleOffsetMs + repOffsetMs * i;
            sendTasks.push({ delay, attempt: `repeat ${i}`, summary, payload, url: PAGERDUTY_API_URL });
          }
        }
      }
    }
    // If no tasks, end immediately
    let tasksRemaining = sendTasks.length;
    if (tasksRemaining === 0) {
      res.write(`event: end\n`);
      res.write(`data: {}\n\n`);
      return res.end();
    }
    // Schedule tasks and close when done
    for (const task of sendTasks) {
      setTimeout(async () => {
        try {
          const resp = await axios.post(task.url, task.payload, { headers: { 'Content-Type': 'application/json' } });
          const result = { summary: task.summary, status_code: resp.status, response: resp.data, attempt: task.attempt };
          res.write(`event: result\n`);
          res.write(`data: ${JSON.stringify(result)}\n\n`);
        } catch (error) {
          const errResult = { summary: task.summary, error: error.message, attempt: task.attempt };
          res.write(`event: result\n`);
          res.write(`data: ${JSON.stringify(errResult)}\n\n`);
        }
        // Decrement and check for completion
        tasksRemaining -= 1;
        if (tasksRemaining <= 0) {
          res.write(`event: end\n`);
          res.write(`data: {}\n\n`);
          res.end();
        }
      }, task.delay);
    }
  } catch (error) {
    console.error('Error in streamEvents:', error);
    res.write(`event: error\n`);
    res.write(`data: ${JSON.stringify({ message: error.message })}\n\n`);
    res.end();
  }
};