const axios = require('axios');
const PAGERDUTY_API_URL = "https://events.pagerduty.com/v2/enqueue";

exports.loadEvents = async (organization, filename) => {
  // For now, read from a file or database as needed.
  // This function should mimic your previous file-based approach
  // and parse the events JSON.
  // Example:
  const fs = require('fs');
  const path = require('path');
  const filePath = path.join(__dirname, '..', '..', 'generated_files', organization, filename);
  const content = fs.readFileSync(filePath, 'utf-8').trim();

  // Basic cleanup (improve as needed)
  const start_index = content.indexOf('[');
  const end_index = content.lastIndexOf(']');
  if (start_index === -1 || end_index === -1) {
    throw new Error('Invalid event file format.');
  }
  const jsonString = content.substring(start_index, end_index + 1);
  return JSON.parse(jsonString);
};
 
/**
 * Compute schedule summary for each event before sending.
 * Returns an array with summary, initial_offset, total_repeats, total_sends, next_offset.
 */
exports.computeScheduleSummary = (events) => {
  return events.map((ev) => {
    const summary = ev.payload?.summary || '';
    const timing = ev.timing_metadata || {};
    const initial_offset = timing.schedule_offset || 0;
    const repeats = ev.repeat_schedule || [];
    const total_repeats = repeats.reduce((acc, r) => acc + (r.repeat_count || 0), 0);
    const total_sends = 1 + total_repeats;
    const next_offset = repeats.length > 0 ? repeats[0].repeat_offset || 0 : null;
    return { summary, initial_offset, total_repeats, total_sends, next_offset };
  });
};

/**
 * Process events asynchronously: schedule initial and repeat sends concurrently
 * Returns a promise that resolves to an array of results for each send.
 */
exports.processEvents = async (events, routing_key) => {
  const sendPromises = [];
  for (const event of events) {
    const timing_metadata = event.timing_metadata || {};
    const schedule_offset_ms = (timing_metadata.schedule_offset || 0) * 1000;
    const repeat_schedule = event.repeat_schedule || [];
    const eventAction = event.event_action || 'trigger';
    const payload = {
      routing_key,
      event_action: eventAction,
      payload: event.payload,
    };
    const summary = event.payload.summary || 'N/A';

    // Schedule initial send
    sendPromises.push(new Promise(resolve => {
      setTimeout(() => {
        axios.post(PAGERDUTY_API_URL, payload, { headers: { 'Content-Type': 'application/json' } })
          .then(response => resolve({
            summary,
            status_code: response.status,
            response: response.data,
            attempt: 'initial'
          }))
          .catch(error => resolve({
            summary,
            error: error.message,
            attempt: 'initial'
          }));
      }, schedule_offset_ms);
    }));

    // Schedule repeats
    for (const repeat of repeat_schedule) {
      const repeat_count = repeat.repeat_count || 0;
      const repeat_offset_ms = (repeat.repeat_offset || 0) * 1000;
      for (let i = 1; i <= repeat_count; i++) {
        const delay = schedule_offset_ms + repeat_offset_ms * i;
        sendPromises.push(new Promise(resolve => {
          setTimeout(() => {
            axios.post(PAGERDUTY_API_URL, payload, { headers: { 'Content-Type': 'application/json' } })
              .then(response => resolve({
                summary,
                status_code: response.status,
                response: response.data,
                attempt: `repeat ${i}`
              }))
              .catch(error => resolve({
                summary,
                error: error.message,
                attempt: `repeat ${i}`
              }));
          }, delay);
        }));
      }
    }
  }
  // Wait for all scheduled sends to complete
  return Promise.all(sendPromises);
};