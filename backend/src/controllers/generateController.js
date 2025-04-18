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

    // Build the payload to send to the Python service
    // Build the payload to send to the Python service (no API key; Flask reads from env)
    const payload = {
      org_name,
      scenarios,
      itsm_tools,
      observability_tools,
      service_names,
    };

    // Python Flask service URL (can override via env var PYTHON_SERVICE_URL)
    const pythonServiceURL = process.env.PYTHON_SERVICE_URL || "http://localhost:5001/api/generate";

    // Forward the request to the Python generation endpoint
    const response = await axios.post(pythonServiceURL, payload);
    const result = response.data;

    // Optionally, save the returned narratives and events to local files
    const orgDir = path.join(__dirname, '../../generated_files', sanitizeOrg(org_name));
    if (!fs.existsSync(orgDir)) {
      fs.mkdirSync(orgDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '');
    // Save files for each scenario
    for (const scenario of scenarios) {
      if (result.narratives && result.narratives[scenario]) {
        fs.writeFileSync(path.join(orgDir, `${scenario}_narrative_${timestamp}.txt`), result.narratives[scenario], 'utf-8');
      }
      if (result.events && result.events[scenario]) {
        fs.writeFileSync(path.join(orgDir, `${scenario}_events_${timestamp}.json`), result.events[scenario], 'utf-8');
      }
    }

    return res.json({
      message: `Scenarios generated for organization: ${org_name}`,
      scenarios: scenarios,
    });
  } catch (error) {
    console.error('Error generating scenarios:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

function sanitizeOrg(org_name) {
  return org_name.replace(/[^a-zA-Z0-9]/g, '');
}