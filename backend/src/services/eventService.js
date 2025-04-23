const axios = require('axios');
// Template engine and faker support
const _ = require('lodash');
const { faker } = require('@faker-js/faker');
// PagerDuty Events V2 API endpoint for incident events
const PAGERDUTY_API_URL = "https://events.pagerduty.com/v2/enqueue";
// PagerDuty Events V2 API endpoint for change events
const PAGERDUTY_CHANGE_URL = "https://events.pagerduty.com/v2/change/enqueue";

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
  // Extract JSON array string
  const jsonString = content.substring(start_index, end_index + 1);
  // Template evaluation: support timestamp(offset) and faker helpers
  const templateFn = _.template(jsonString, { interpolate: /{{([\s\S]+?)}}/g });
  const context = {
    /**
     * timestamp helper: if one arg, fixed offset (seconds); if two args, random between offsets.
     * Usage in template: {{ timestamp(minOffsetSeconds, maxOffsetSeconds) }}
     */
    timestamp: (minOffsetSeconds, maxOffsetSeconds) => {
      const min = Number(minOffsetSeconds);
      // single argument: fixed offset
      if (maxOffsetSeconds === undefined) {
        return new Date(Date.now() + min * 1000).toISOString();
      }
      const max = Number(maxOffsetSeconds);
      // compute random offset between min and max (inclusive)
      const lo = Math.min(min, max);
      const hi = Math.max(min, max);
      const randSec = Math.floor(Math.random() * (hi - lo + 1)) + lo;
      return new Date(Date.now() + randSec * 1000).toISOString();
    },
    faker,
  };
  const templated = templateFn(context);
  return JSON.parse(templated);
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
/**
 * Process events or change events asynchronously.
 * Supports incident events (with timing_metadata and repeat_schedule) and PagerDuty Change Events.
 * @param {Array} events - Array of event objects loaded from file
 * @param {string} routing_key - PagerDuty routing/integration key to use for sends
 * @returns {Promise<Array>} Array of send results
 */
exports.processEvents = async (events, routing_key) => {
  const sendPromises = [];
  for (const ev of events) {
    // Determine if this is a change event (has its own routing_key or links)
    const isChange = ev.hasOwnProperty('routing_key') || ev.hasOwnProperty('links');
    // Schedule offset for initial send (default to 0)
    const scheduleOffsetMs = ((ev.timing_metadata && ev.timing_metadata.schedule_offset) || 0) * 1000;
    // Common summary for UI
    const summary = (ev.payload && ev.payload.summary) || '';

    if (isChange) {
      // Prepare change event payload, override routing_key with provided key
      const changeEvent = { ...ev, routing_key };
      // Only initial send for change events
      sendPromises.push(new Promise(resolve => {
        setTimeout(() => {
          axios.post(PAGERDUTY_CHANGE_URL, changeEvent, { headers: { 'Content-Type': 'application/json' } })
            .then(response => resolve({ summary, status_code: response.status, response: response.data, attempt: 'initial', type: 'change' }))
            .catch(error => resolve({ summary, error: error.message, attempt: 'initial', type: 'change' }));
        }, scheduleOffsetMs);
      }));
    } else {
      // Incident event: wrap into proper payload
      const evAction = ev.event_action || 'trigger';
      const payload = { routing_key, event_action: evAction, payload: ev.payload };
      // Initial send
      sendPromises.push(new Promise(resolve => {
        setTimeout(() => {
          axios.post(PAGERDUTY_API_URL, payload, { headers: { 'Content-Type': 'application/json' } })
            .then(response => resolve({ summary, status_code: response.status, response: response.data, attempt: 'initial', type: 'event' }))
            .catch(error => resolve({ summary, error: error.message, attempt: 'initial', type: 'event' }));
        }, scheduleOffsetMs);
      }));
      // Repeated sends if specified
      const repeats = ev.repeat_schedule || [];
      for (const rpt of repeats) {
        const count = rpt.repeat_count || 0;
        const repOffsetMs = (rpt.repeat_offset || 0) * 1000;
        for (let i = 1; i <= count; i++) {
          const delay = scheduleOffsetMs + repOffsetMs * i;
          sendPromises.push(new Promise(resolve => {
            setTimeout(() => {
              axios.post(PAGERDUTY_API_URL, payload, { headers: { 'Content-Type': 'application/json' } })
                .then(response => resolve({ summary, status_code: response.status, response: response.data, attempt: `repeat ${i}`, type: 'event' }))
                .catch(error => resolve({ summary, error: error.message, attempt: `repeat ${i}`, type: 'event' }));
            }, delay);
          }));
        }
      }
    }
  }
  // Wait for all scheduled sends to complete
  return Promise.all(sendPromises);
};