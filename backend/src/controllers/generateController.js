// src/controllers/generateController.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');

exports.handleGenerate = async (req, res) => {
  try {
    const {
      org_name,
      scenarios = [],
      itsm_tools,
      observability_tools,
      service_names,
    } = req.body;

    // Validate required fields
    if (!org_name) {
      return res.status(400).json({ message: 'Organization name is required.' });
    }
    if (!Array.isArray(scenarios) || scenarios.length === 0) {
      return res.status(400).json({ message: 'At least one scenario must be selected.' });
    }

    // Forward all request body parameters to the Python generation service, including overrides for custom scenarios
    const payload = req.body;

    // Python Flask service URL (can override via env var PYTHON_SERVICE_URL)
    const pythonServiceURL = process.env.PYTHON_SERVICE_URL || "http://localhost:5001/api/generate";

    // Forward the request to the Python generation endpoint
    const response = await axios.post(pythonServiceURL, payload);
    // Python service returns an object with 'message', 'narratives', 'events', and optional 'change_events'
    const result = response.data;


    // Return the full generation result, including narratives, events, and change events
    return res.json({
      message: result.message || `Scenarios generated for organization: ${org_name}`,
      scenarios: scenarios,
      narratives: result.narratives,
      events: result.events,
      change_events: result.change_events
    });
  } catch (error) {
    console.error('Error generating scenarios:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

function sanitizeOrg(org_name) {
  return org_name.replace(/[^a-zA-Z0-9]/g, '');
}