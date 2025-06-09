const axios = require('axios');

/**
 * Proxy to Python service for generating change events.
 * Expects JSON body with:
 *   - org_name: string
 *   - scenario: "major" | "partial" | "well"
 *   - optional overrides: itsm_tools, observability_tools, service_names, etc.
 */
exports.handleGenerateChangeEvents = async (req, res) => {
  try {
    const { org_name, scenario } = req.body;
    if (!org_name || !scenario) {
      return res.status(400).json({ message: 'org_name and scenario are required.' });
    }
    const payload = req.body;
    const url = process.env.PYTHON_CHANGE_URL || 'http://localhost:5001/api/generate_change_events';
    const response = await axios.post(url, payload);
    return res.json(response.data);
  } catch (error) {
    console.error('Error generating change events:', error.response ? error.response.data : error.message);
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || 'Internal server error';
    return res.status(status).json({ message });
  }
};
