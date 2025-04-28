const axios = require('axios');

/**
 * Controller to handle SOP generation by proxying to the Python gen_service.
 * Expects JSON body with:
 *   - org_name: string
 *   - filename: string
 *   - event_index: number (optional, zero-based, defaults to 0)
 */
exports.handleGenerateSop = async (req, res) => {
  try {
    const { org_name, filename, event_index = 0 } = req.body;
    // Validate required parameters
    if (!org_name || !filename) {
      return res.status(400).json({ message: 'Both org_name and filename are required.' });
    }
    const idx = Number(event_index);
    if (isNaN(idx) || idx < 0) {
      return res.status(400).json({ message: 'Invalid event_index provided.' });
    }
    // Build request payload
    const payload = { org_name, filename, event_index: idx };
    // Python gen_service SOP endpoint (can override via env)
    const sopServiceURL = process.env.PYTHON_SOP_URL || 'http://localhost:5001/api/generate_sop';
    // Forward request to Python service
    const response = await axios.post(sopServiceURL, payload);
    // Return the SOP text and filename from Python service
    return res.json(response.data);
  } catch (error) {
    console.error('Error generating SOP:', error.response ? error.response.data : error.message);
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || 'Internal server error';
    return res.status(status).json({ message });
  }
};
/**
 * Controller to generate an SOP inline from provided event data.
 * Expects JSON body with arbitrary event payload fields (e.g., title, description, custom_details).
 * Returns SOP text without persisting to file.
 */
exports.handleGenerateSopInline = async (req, res) => {
  try {
    const eventPayload = req.body;
    if (!eventPayload || typeof eventPayload !== 'object') {
      return res.status(400).json({ message: 'Invalid event payload. Expected a JSON object.' });
    }
    const sopInlineURL = process.env.PYTHON_SOP_INLINE_URL || 'http://localhost:5001/api/generate_sop_inline';
    const response = await axios.post(sopInlineURL, eventPayload);
    return res.json(response.data);
  } catch (error) {
    console.error('Error generating inline SOP:', error.response ? error.response.data : error.message);
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || 'Internal server error';
    return res.status(status).json({ message });
  }
};
/**
 * Controller to generate a blended SOP from multiple events in a file.
 * Expects JSON body with:
 *   - org_name: string
 *   - filename: string
 *   - event_indices: array of zero-based indices
 * Returns { sop_text } without persisting a file.
 */
exports.handleGenerateSopBlended = async (req, res) => {
  try {
    const { org_name, filename, event_indices } = req.body;
    if (!org_name || !filename || !Array.isArray(event_indices) || event_indices.length < 2) {
      return res.status(400).json({ message: 'org_name, filename, and at least two event_indices are required.' });
    }
    const fs = require('fs');
    const path = require('path');
    // Locate the file under generated_files
    const generatedDir = path.join(__dirname, '..', '..', 'generated_files', org_name);
    const filePath = path.join(generatedDir, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: `File ${filename} not found for org ${org_name}.` });
    }
    // Load and parse events
    let raw = fs.readFileSync(filePath, 'utf8');
    let events;
    try {
      events = JSON.parse(raw);
    } catch (e) {
      return res.status(500).json({ message: `Error parsing JSON: ${e.message}` });
    }
    const eventsList = Array.isArray(events) ? events : [events];
    // Select specified events
    const selected = event_indices
      .map(i => eventsList[i])
      .filter(ev => ev !== undefined);
    if (selected.length < 2) {
      return res.status(400).json({ message: 'No valid events found for the given indices.' });
    }
    // Call the inline SOP endpoint
    const axios = require('axios');
    const sopInlineURL = process.env.PYTHON_SOP_INLINE_URL || 'http://localhost:5001/api/generate_sop_inline';
    const response = await axios.post(sopInlineURL, { events: selected });
    return res.json(response.data);
  } catch (error) {
    console.error('Error generating blended SOP:', error.response ? error.response.data : error.message);
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || 'Internal server error';
    return res.status(status).json({ message });
  }
};